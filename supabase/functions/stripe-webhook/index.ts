import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Verification de la signature Stripe (sans SDK)
async function verifyStripeSignature(body: string, header: string | null, secret: string, tolerance = 300) {
  if (!header || !secret) return false;
  let t = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    const k = part.slice(0, i);
    const v = part.slice(i + 1);
    if (k === "t") t = v;
    if (k === "v1") v1.push(v);
  }
  if (!t || v1.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > tolerance) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const safeEqual = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  };
  return v1.some((x) => safeEqual(x, hex));
}

// E-mail envoyé 3 jours avant la fin de l'essai
async function envoyerRappelEssai(abonnement: any) {
  const cle = Deno.env.get("RESEND_API_KEY");
  if (!cle) { console.warn("RESEND_API_KEY absente : rappel non envoyé"); return; }
  const res = await fetch(`https://api.stripe.com/v1/customers/${abonnement.customer}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` },
  });
  const client = await res.json();
  if (!client?.email) { console.warn("Client sans e-mail :", abonnement.customer); return; }
  const annuel = abonnement.items?.data?.[0]?.price?.recurring?.interval === "year";
  const date = new Date(abonnement.trial_end * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const montant = annuel ? "56,24 € pour ta première année" : "14,99 € par mois";
  const envoi = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Voltra <contact@voltra-app.fr>",
      to: client.email,
      subject: `Ton essai Voltra se termine le ${date}`,
      html: `<p>Salut,</p><p>Ton essai gratuit de Voltra se termine le <b>${date}</b>.</p><p>Sans action de ta part, ton abonnement démarre à cette date : ${montant}.</p><p>Tu veux arrêter ? Résilie avant le ${date} depuis ton profil, dans « Gérer mon abonnement » : tu ne paieras rien.</p><p><a href="https://www.voltra-app.fr">Ouvrir Voltra</a></p>`,
    }),
  });
  if (!envoi.ok) console.error("Erreur envoi rappel :", await envoi.text());
}

serve(async (req) => {
  const body = await req.text();

  const valid = await verifyStripeSignature(
    body,
    req.headers.get("stripe-signature"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
  );
  if (!valid) {
    console.error("Signature Stripe invalide");
    return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch (err: any) {
    console.error("JSON invalide:", err.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("Event type:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object;
        const userId = session?.client_reference_id || session?.metadata?.user_id;
        if (!userId) { console.log("Pas de userId trouvé"); break; }
        const update: any = { id: userId, is_pro: true };
        if (session?.customer) update.stripe_customer_id = session.customer;
        const { error } = await supabase.from("profiles").upsert(update, { onConflict: "id" });
        if (error) throw error;
        console.log("Pro activé pour:", userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const customerId = event.data?.object?.customer;
        if (!customerId) break;
        const { data: profile, error: readError } = await supabase
          .from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
        if (readError) throw readError;
        if (profile) {
          const { error } = await supabase.from("profiles").update({ is_pro: true }).eq("id", profile.id);
          if (error) throw error;
          console.log("Renouvellement OK pour:", profile.id);
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        await envoyerRappelEssai(event.data?.object);
        break;
      }

      case "invoice.payment_failed": {
        // Stripe réessaie plusieurs fois : on ne coupe pas le Pro tout de suite.
        console.log("Paiement échoué (nouvelle tentative par Stripe) pour:", event.data?.object?.customer);
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = event.data?.object?.customer;
        if (!customerId) break;
        const { data: profile, error: readError } = await supabase
          .from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
        if (readError) throw readError;
        if (profile) {
          const { error } = await supabase.from("profiles").update({ is_pro: false }).eq("id", profile.id);
          if (error) throw error;
          console.log("Abonnement terminé, Pro désactivé:", profile.id);
        }
        break;
      }

      default:
        console.log("Event ignoré:", event.type);
    }
  } catch (err: any) {
    // Réponse 500 : Stripe renverra l'événement, un client qui a payé ne reste pas sans son Pro
    console.error("Erreur traitement event:", err.message);
    return new Response(JSON.stringify({ error: "Erreur de traitement" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
