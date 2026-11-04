import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const TEST: Record<string, string> = {
  monthly: "price_1Tkhvu8P7FaKivct2II0H82c",
  annual: "price_1UY4c18P7FaKivctBlZDe1eL",
};

const LIVE: Record<string, string> = {
  monthly: "price_1UY4vx8P7FaKivctS2lES6I0",
  annual: "price_1UY4vE8P7FaKivcttzImHDEx",
};

// Essai gratuit sur toutes les offres
const JOURS_ESSAI = 7;

// Réduction de bienvenue : annuel uniquement. Valable 1 mois à partir de l'inscription :
// elle tombe sur le 1er vrai paiement (fin d'essai) et pas sur le renouvellement suivant.
const COUPONS: Record<string, string> = {
  annual: "WELCOME25_ESSAI",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { plan, user_id, email, success_url, cancel_url } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const isLive = stripeKey.startsWith("sk_live") || stripeKey.startsWith("rk_live");
    const PRICE_IDS = isLive ? LIVE : TEST;

    const priceId = PRICE_IDS[plan];
    if (!priceId || priceId.includes("COLLE_ICI")) throw new Error(`Plan invalide: ${plan}`);

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${success_url}?paid=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", cancel_url);
    params.append("locale", "fr");
    if (email) params.append("customer_email", email);
    if (user_id) {
      params.append("client_reference_id", user_id);
      params.append("metadata[user_id]", user_id);
      params.append("metadata[plan]", plan);
      params.append("subscription_data[metadata][user_id]", user_id);
      params.append("subscription_data[metadata][plan]", plan);
    }
    params.append("subscription_data[trial_period_days]", String(JOURS_ESSAI));
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

    return new Response(
      JSON.stringify({ url: data.url, session_id: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erreur:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
