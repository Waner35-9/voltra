import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Le compte vient du jeton de connexion, et son adresse e-mail doit être confirmée
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user?.email_confirmed_at) return json({ erreur: "non_autorise" }, 401);

    const { code } = await req.json();
    if (typeof code !== "string" || !code || code.length > 64) return json({ erreur: "invalide" });

    // Seule la clé de service peut passer un compte en Pro
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabaseAdmin.rpc("utiliser_invitation", { p_code: code, p_user: user.id });
    if (error) throw error;

    return json(data);
  } catch (err: any) {
    console.error("Erreur invitation:", err.message);
    return json({ erreur: "indisponible" }, 500);
  }
});
