import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TEST: Record<string, string> = {
  monthly: "price_1Tkhvu8P7FaKivct2II0H82c",
  annual: "price_1UY4c18P7FaKivctBlZDe1eL",
};

const LIVE: Record<string, string> = {
  monthly: "price_1UY4vx8P7FaKivctS2lES6I0",
  annual: "price_1UY4vE8P7FaKivcttzImHDEx",
};

// Essai gratuit sur toutes les offres, une seule fois par adresse e-mail
const JOURS_ESSAI = 7;

// Réduction de bienvenue : annuel uniquement. Valable 1 mois à partir de l'inscription :
// elle tombe sur le 1er vrai paiement (fin d'essai) et pas sur le renouvellement suivant.
const COUPONS: Record<string, string> = {
  annual: "WELCOME25_ESSAI",
};

async function lireStripe(path: string, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { "Authorization": `Bearer ${stripeKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Erreur Stripe");
  return data;
}

// Un abonnement passé, même résilié ou rétracté, compte : Stripe garde l'historique après la suppression du compte Voltra
async function aDejaEteAbonne(email: string, stripeKey: string) {
  const clients = await lireStripe(`/customers?email=${encodeURIComponent(email)}&limit=100`, stripeKey);
  for (const client of clients.data || []) {
    const abonnements = await lireStripe(`/subscriptions?customer=${client.id}&status=all&limit=1`, stripeKey);
    if (abonnements.data?.length) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Le compte vient du jeton de connexion, jamais de ce que le navigateur envoie
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return json({ error: "Non autorisé" }, 401);

    const { action, plan, success_url, cancel_url } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const isLive = stripeKey.startsWith("sk_live") || stripeKey.startsWith("rk_live");
    const PRICE_IDS = isLive ? LIVE : TEST;

    const priceId = PRICE_IDS[plan];
    if (action !== "eligibilite" && (!priceId || priceId.includes("COLLE_ICI"))) throw new Error(`Plan invalide: ${plan}`);

    const essai = !(await aDejaEteAbonne(user.email, stripeKey));
    if (action === "eligibilite") return json({ essai });

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${success_url}?paid=true&plan=${plan}${essai ? "" : "&essai=0"}&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", cancel_url);
    params.append("locale", "fr");
    params.append("customer_email", user.email);
    params.append("client_reference_id", user.id);
    params.append("metadata[user_id]", user.id);
    params.append("metadata[plan]", plan);
    params.append("subscription_data[metadata][user_id]", user.id);
    params.append("subscription_data[metadata][plan]", plan);
    if (essai) params.append("subscription_data[trial_period_days]", String(JOURS_ESSAI));
    if (COUPONS[plan]) params.append("discounts[0][coupon]", COUPONS[plan]);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erreur Stripe");

    return json({ url: data.url, session_id: data.id });
  } catch (err: any) {
    console.error("Erreur:", err.message);
    return json({ error: err.message }, 400);
  }
});
