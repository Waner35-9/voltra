import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const repondre = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const court = (v: unknown, max = 200) => String(v ?? "").slice(0, max);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Seul un compte connecté peut parler au coach
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return repondre({ error: "Non autorisé" }, 401);

    const { message, context, history = [] } = await req.json();
    const texte = court(message, 1000).trim();
    if (!texte) return repondre({ error: "Message vide" }, 400);

    const ex = context?.exercice_actuel;
    const prog = context?.progression_seance;
    const liste = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30).map((x) => court(x, 80)).join(", ") : "");

    const system = `Tu es le coach IA de l'app Voltra, expert en performance sportive pour ${court(context?.sport, 40) || "le sport"}.

CONTEXTE SÉANCE EN COURS :
- Séance : ${court(context?.seance_titre, 80) || "Séance"}
- Exercice actuel : ${court(ex?.nom, 80) || "?"} (${court(ex?.index, 4)}/${court(ex?.total, 4)})
- Séries : ${court(ex?.sets_completes, 4)}/${court(ex?.sets_total, 4)} complétées
- Reps cibles : ${court(ex?.reps, 20)} | Charge : ${Number(ex?.charge_kg) > 0 ? Number(ex.charge_kg) + "kg" : "poids du corps"}
- Muscles ciblés : ${court(ex?.muscles, 120) || "N/A"}
- Exercices terminés : ${liste(prog?.exercices_completes) || "aucun"}
- Exercices restants : ${liste(prog?.exercices_restants) || "aucun"}
- Temps écoulé : ${court(prog?.duree_ecoulee_min, 6)} min | Progression : ${court(prog?.pourcentage, 6)}%

RÈGLES :
- Réponds en français, de façon directe et motivante (2-3 phrases max)
- Tu connais exactement où en est l'athlète dans sa séance, utilise ce contexte
- Si charge trop lourde : propose une réduction précise (-10% ou -20%)
- Si douleur : propose une alternative immédiate et concrète, et conseille d'arrêter et de consulter si elle persiste
- Si question sur prochain exercice : donne son nom et ses caractéristiques
- Reste sur le sport et l'entraînement : refuse poliment tout autre sujet
- Utilise **gras** pour les mots clés importants
- Tutoie toujours, sois direct et encourageant`;

    const historique = Array.isArray(history) ? history.slice(-8) : [];
    const messages = [
      ...historique.map((m: any) => ({
        role: m?.role === "user" ? "user" as const : "assistant" as const,
        content: court(m?.text, 1000) || "...",
      })),
      { role: "user" as const, content: texte },
    ];

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system,
      messages,
    });

    const bloc = resp.content[0];
    return repondre({ reply: bloc?.type === "text" ? bloc.text : "Réessaie dans un instant." });
  } catch (err: any) {
    console.error("ERREUR coach:", err?.message);
    return repondre({ reply: "Erreur du coach. Réessaie dans un instant." });
  }
});
