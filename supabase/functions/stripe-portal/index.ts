import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function stripe(path: string, method = "GET", params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

// Retrouve le client Stripe + son abonnement en cours
async function findSubscription(email: string) {
  const customers = await stripe(`/customers?email=${encodeURIComponent(email)}&limit=10`);
  for (const c of customers.data || []) {
    const subs = await stripe(`/subscriptions?customer=${c.id}&status=all&limit=10`);
    const sub = (subs.data || []).find((s: any) => ["active", "trialing", "past_due"].includes(s.status));
    if (sub) return { customerId: c.id as string, sub };
  }
  return null;
}

// Droit de rétractation : 14 jours à compter de la souscription
const RETRACTATION_SECONDES = 14 * 86400;

// Paiements de cet abonnement qui peuvent encore être remboursés
async function paiementsRemboursables(customerId: string, sub: any) {
  const charges = await stripe(`/charges?customer=${customerId}&limit=100&created[gte]=${sub.created}`);
  return (charges.data || []).filter((c: any) => c.status === "succeeded" && !c.refunded && c.amount > c.amount_refunded);
}

const totalEuros = (paiements: any[]) =>
  paiements.reduce((total, c) => total + c.amount - c.amount_refunded, 0) / 100;

const euros = (montant: number) => montant.toFixed(2).replace(".", ",");

// Accusé de réception de la rétractation, obligatoire sur un support durable
async function envoyerAccuseRetractation(email: string, rembourse: number) {
  const cle = Deno.env.get("RESEND_API_KEY");
  if (!cle) { console.warn("RESEND_API_KEY absente : accusé non envoyé"); return false; }
  const date = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
  const suite = rembourse > 0
    ? `<p>Nous te remboursons <b>${euros(rembourse)} €</b> sur le moyen de paiement utilisé. L'argent arrive sous 14 jours au plus tard, souvent bien avant.</p>`
    : `<p>Aucun paiement n'a été prélevé : tu n'as rien à payer et il n'y a rien à rembourser.</p>`;
  const envoi = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Voltra <contact@voltra-app.fr>",
      to: email,
      subject: "Confirmation de ta rétractation Voltra",
      html: `<p>Salut,</p><p>Nous avons bien reçu ta rétractation du contrat Voltra Pro le <b>${date}</b> (heure de Paris). Ton abonnement est arrêté.</p>${suite}<p>Une question ? Réponds à cet e-mail ou écris à contact.voltra1@gmail.com.</p>`,
    }),
  });
  if (!envoi.ok) { console.error("Erreur envoi accusé :", await envoi.text()); return false; }
  return true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return json({ error: "Non autorisé" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "portal";
    const returnUrl = typeof body.return_url === "string" && /^https?:\/\//.test(body.return_url)
      ? body.return_url
      : "https://www.voltra-app.fr";
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 80) : "";

    const found = await findSubscription(user.email);
    if (!found) return json({ error: "no_subscription" }, 404);
    const { customerId, sub } = found;
    const item = sub.items?.data?.[0];
    const interval = item?.price?.recurring?.interval || "month";
    const retractationJusquau = sub.created + RETRACTATION_SECONDES;
    const peutSeRetracter = Date.now() / 1000 <= retractationJusquau;

    // ---- Infos sur l'abonnement ----
    if (action === "info") {
      const periodEnd = sub.current_period_end ?? item?.current_period_end ?? null;
      return json({
        interval,
        amount: (item?.price?.unit_amount ?? 0) / 100,
        currency: item?.price?.currency || "eur",
        periodEnd,
        // Stripe note une résiliation soit avec cancel_at_period_end, soit avec une date cancel_at
        cancelAtPeriodEnd: !!sub.cancel_at_period_end || !!sub.cancel_at,
        paused: !!sub.pause_collection,
        hasDiscount: !!sub.discount || (Array.isArray(sub.discounts) && sub.discounts.length > 0),
        offerUsed: sub.metadata?.retention_used === "1",
        status: sub.status,
        canRetract: peutSeRetracter,
        retractUntil: retractationJusquau,
        refundable: peutSeRetracter ? totalEuros(await paiementsRemboursables(customerId, sub)) : 0,
      });
    }

    // ---- Rétractation : remboursement intégral, puis arrêt immédiat ----
    if (action === "retract") {
      if (!peutSeRetracter) return json({ error: "retractation_expired" }, 400);
      // On rembourse d'abord : si Stripe échoue, le client garde son accès et peut réessayer
      const paiements = await paiementsRemboursables(customerId, sub);
      const rembourse = totalEuros(paiements);
      for (const c of paiements) {
        await stripe("/refunds", "POST", { charge: c.id, reason: "requested_by_customer", "metadata[motif]": "retractation" });
      }
      // Le webhook customer.subscription.deleted retire ensuite le Pro
      await stripe(`/subscriptions/${sub.id}`, "POST", { "metadata[retractation_le]": new Date().toISOString() });
      await stripe(`/subscriptions/${sub.id}`, "DELETE");
      const accuseEnvoye = await envoyerAccuseRetractation(user.email, rembourse).catch((e) => {
        console.error("Erreur accusé :", e.message);
        return false;
      });
      return json({ ok: true, refunded: rembourse, emailSent: accuseEnvoye });
    }

    // ---- Offre de rétention (1 seule fois par abonné) ----
    if (action === "offer") {
      if (sub.metadata?.retention_used === "1") return json({ error: "offer_used" }, 400);
      const params: Record<string, string> = { "metadata[retention_used]": "1" };
      if (reason) params["metadata[cancel_reason]"] = reason;
      if (body.type === "free_month") {
        if (interval === "year") return json({ error: "Offre indisponible pour l'abonnement annuel" }, 400);
        params["pause_collection[behavior]"] = "void";
        params["pause_collection[resumes_at]"] = String(Math.floor(Date.now() / 1000) + 30 * 86400);
      } else {
        params["discounts[0][coupon]"] = interval === "year" ? "RETENTION30_YEAR" : "RETENTION30";
      }
      await stripe(`/subscriptions/${sub.id}`, "POST", params);
      return json({ ok: true });
    }

    // ---- Réactiver un abonnement en cours de résiliation ----
    if (action === "resume") {
      await stripe(`/subscriptions/${sub.id}`, "POST", sub.cancel_at_period_end ? { cancel_at_period_end: "false" } : { cancel_at: "" });
      return json({ ok: true });
    }

    // ---- Page d'annulation Stripe (étape finale) ----
    if (action === "cancel_flow") {
      if (reason) await stripe(`/subscriptions/${sub.id}`, "POST", { "metadata[cancel_reason]": reason });
      const session = await stripe("/billing_portal/sessions", "POST", {
        customer: customerId,
        return_url: returnUrl,
        "flow_data[type]": "subscription_cancel",
        "flow_data[subscription_cancel][subscription]": sub.id,
        "flow_data[after_completion][type]": "redirect",
        "flow_data[after_completion][redirect][return_url]": returnUrl,
      });
      return json({ url: session.url });
    }

    // ---- Portail général (carte, factures) ----
    const session = await stripe("/billing_portal/sessions", "POST", {
      customer: customerId,
      return_url: returnUrl,
    });
    return json({ url: session.url });
  } catch (err: any) {
    console.error("ERREUR portal:", err.message);
    return json({ error: err.message }, 500);
  }
});
