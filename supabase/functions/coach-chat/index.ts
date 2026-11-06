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
const liste = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30).map((x) => court(x, 80)).join(", ") : "");

// L'app accepte dès 15 ans et l'âge est facultatif : sans âge connu, on applique les règles des mineurs
const reglesCommunes = (majeur: boolean) => `- Reste sur le sport, l'entraînement et l'alimentation de l'athlète : refuse poliment tout autre sujet
- Tu peux parler d'aliments, de repas, d'hydratation, de quoi manger avant et après l'effort
${majeur
    ? "- L'athlète est majeur : tu peux l'aider à suivre un régime, à perdre ou prendre du poids progressivement, et parler des compléments courants comme la créatine ou les protéines. Refuse les régimes extrêmes, les jeûnes prolongés et les produits dopants"
    : "- L'athlète peut être mineur : aide-le à bien manger pour couvrir ses besoins, mais ne donne jamais de régime amaigrissant, de déficit ou de comptage de calories, ni de complément. Pour ces sujets, renvoie vers ses parents et un médecin ou un diététicien"}
- Si tu repères un rapport difficile à la nourriture (peur de manger, culpabilité, repas sautés, se faire vomir), ne donne aucune consigne alimentaire et encourage-le à en parler à un proche et à un médecin
- Ne juge jamais le physique de l'athlète
- Utilise **gras** pour les mots clés importants
- Tutoie toujours, sois direct et encourageant`;

function promptSeance(context: any, majeur: boolean) {
  const ex = context?.exercice_actuel;
  const prog = context?.progression_seance;
  return `Tu es le coach IA de l'app Voltra, expert en performance sportive pour ${court(context?.sport, 40) || "le sport"}.

CONTEXTE SÉANCE EN COURS :
- Séance : ${court(context?.seance_titre, 80) || "Séance"}
- Adaptation du jour : ${court(context?.adaptation_du_jour, 250) || "aucune"}
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
${reglesCommunes(majeur)}`;
}

function promptLibre(context: any, majeur: boolean) {
  const joursAvant = Number(context?.jours_avant);
  return `Tu es Ace, le coach IA de l'app Voltra, expert en performance sportive pour ${court(context?.sport, 40) || "le sport"}. L'athlète te parle en dehors d'une séance.

CE QUE TU SAIS DE LUI :
- Niveau : ${court(context?.niveau, 40) || "non renseigné"}
- Objectif : ${court(context?.objectif, 120) || "aucune date fixée"}${Number.isFinite(joursAvant) && joursAvant >= 0 ? ` (dans ${joursAvant} jours)` : ""}
- Prochains matchs : ${liste(context?.matchs) || "aucun"}
- Programme : semaine ${court(context?.semaine, 4) || "?"} sur ${court(context?.total_semaines, 4) || "?"}
- Douleurs signalées : ${liste(context?.douleurs) || "aucune"}
- Meilleures charges : ${liste(context?.records) || "pas encore de séance"}

RÈGLES :
- Réponds en français, de façon directe et motivante (4 phrases max)
- Appuie-toi sur ces informations, n'invente aucun chiffre ni aucune séance
- Tu ne peux pas modifier son programme : pour alléger une séance, dis-lui de choisir sa forme du jour avant de la lancer, et pour un match, de l'ajouter sur le tableau de bord
- Si douleur : conseille d'arrêter et de consulter si elle persiste, sans poser de diagnostic
${reglesCommunes(majeur)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Seul un abonné connecté peut parler au coach
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return repondre({ error: "Non autorisé" }, 401);
    const { data: profil } = await supabaseUser.from("profiles").select("is_pro, age").eq("id", user.id).maybeSingle();
    if (!profil?.is_pro) return repondre({ error: "Réservé à Voltra Pro" }, 403);

    const { message, context, history = [], mode } = await req.json();
    const texte = court(message, 1000).trim();
    if (!texte) return repondre({ error: "Message vide" }, 400);

    const majeur = Number(profil.age) >= 18;
    const system = mode === "libre" ? promptLibre(context, majeur) : promptSeance(context, majeur);

    const historique = Array.isArray(history) ? history.slice(-8) : [];
    const messages = [
      ...historique.map((m: any) => ({
        role: m?.role === "user" ? "user" as const : "assistant" as const,
        content: court(m?.text, 1000) || "...",
      })),
      { role: "user" as const, content: texte },
    ];
    // L'API veut un premier message de l'athlète : on retire l'accueil d'Ace
    while (messages.length > 1 && messages[0].role === "assistant") messages.shift();

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
