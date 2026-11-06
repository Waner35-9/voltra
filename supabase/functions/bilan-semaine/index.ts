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

const JOUR_MS = 86400000;
const TEXTE_SANS_SEANCE = "Pas de séance la semaine dernière. Ton plan t'attend : une seule séance suffit pour reprendre le rythme.";

const isoParis = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

// Lundi de la semaine en cours et lundi de la semaine écoulée, à l'heure de Paris
function lundis() {
  const aujourdhui = new Date(`${isoParis(new Date())}T12:00:00Z`);
  const courant = new Date(aujourdhui.getTime() - ((aujourdhui.getUTCDay() + 6) % 7) * JOUR_MS);
  return { courant: courant.toISOString().slice(0, 10), passe: new Date(courant.getTime() - 7 * JOUR_MS).toISOString().slice(0, 10) };
}

// Les chiffres viennent de la base : l'IA écrit seulement la phrase
function calculerGains(logsSemaine: any[], logsAnciens: any[]) {
  const premiers: Record<string, number> = {};
  for (const l of logsAnciens) {
    const nom = l.exercices?.nom;
    if (nom && Number(l.charge_kg) > 0 && premiers[nom] === undefined) premiers[nom] = Number(l.charge_kg);
  }
  const meilleurs: Record<string, number> = {};
  for (const l of logsSemaine) {
    const nom = l.exercices?.nom;
    if (nom && Number(l.charge_kg) > 0) meilleurs[nom] = Math.max(meilleurs[nom] || 0, Number(l.charge_kg));
  }
  return Object.entries(meilleurs)
    .filter(([nom, a]) => premiers[nom] !== undefined && a > premiers[nom])
    .map(([nom, a]) => ({ nom, de: premiers[nom], a }))
    .sort((x, y) => (y.a - y.de) - (x.a - x.de))
    .slice(0, 3);
}

async function ecrireConseil(infos: { sport: string; seances: number; prevues: number | null; gains: any[]; objectif: string }) {
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    system: `Tu es Ace, le coach IA de l'app Voltra. Écris le mot de fin du bilan de la semaine d'un athlète, qui peut avoir 15 ans.

RÈGLES :
- En français, 2 phrases maximum, en le tutoyant : un constat, puis une seule priorité pour la semaine qui vient
- N'utilise que les informations données, n'invente aucun chiffre ni aucun exercice
- Ne parle jamais de physique, de poids du corps, de régime ou de compléments
- Pas de gras, pas de liste, pas d'emoji`,
    messages: [{
      role: "user",
      content: `Sport : ${infos.sport || "non renseigné"}
Séances faites : ${infos.seances}${infos.prevues ? ` sur ${infos.prevues} prévues` : ""}
Charges en progrès depuis le début : ${infos.gains.map((g) => `${g.nom} de ${g.de} à ${g.a} kg`).join(", ") || "aucune cette semaine"}
Objectif : ${infos.objectif || "aucune date fixée"}`,
    }],
  });
  const bloc = resp.content[0];
  return bloc?.type === "text" ? bloc.text.trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return repondre({ error: "Non autorisé" }, 401);

    const { data: profil } = await supabase.from("profiles").select("is_pro, sport").eq("id", user.id).maybeSingle();
    if (!profil?.is_pro) return repondre({ bilan: null });

    const { courant, passe } = lundis();

    // Un seul bilan par semaine : c'est ce qui limite le coût IA
    const { data: existant } = await supabase.from("bilans_semaine")
      .select("semaine, seances, prevues, gains, texte").eq("user_id", user.id).eq("semaine", passe).maybeSingle();
    if (existant) return repondre({ bilan: existant });

    // Pas encore de bilan pour qui a commencé cette semaine
    const debutSemaine = `${passe}T00:00:00+01:00`;
    const finSemaine = `${courant}T00:00:00+01:00`;
    const { data: premiere } = await supabase.from("seances").select("date_realisee").eq("user_id", user.id).eq("statut", "faite")
      .order("date_realisee", { ascending: true }).limit(1).maybeSingle();
    if (!premiere || premiere.date_realisee >= finSemaine) return repondre({ bilan: null });

    const { count } = await supabase.from("seances").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("statut", "faite")
      .gte("date_realisee", debutSemaine).lt("date_realisee", finSemaine);
    const seances = count || 0;

    const { data: programme } = await supabase.from("programmes").select("frequence").eq("user_id", user.id).eq("statut", "actif")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prevues = programme?.frequence || null;

    let gains: any[] = [];
    let texte = TEXTE_SANS_SEANCE;
    let garder = true;
    if (seances > 0) {
      const colonnes = "charge_kg, exercices(nom)";
      const [{ data: logsSemaine }, { data: logsAnciens }] = await Promise.all([
        supabase.from("logs_performance").select(colonnes).eq("user_id", user.id).gte("logged_at", debutSemaine).lt("logged_at", finSemaine),
        supabase.from("logs_performance").select(colonnes).eq("user_id", user.id).order("logged_at", { ascending: true }).limit(1000),
      ]);
      gains = calculerGains(logsSemaine || [], logsAnciens || []);
      const cible = user.user_metadata?.cible;
      const objectif = cible?.date ? `le ${cible.date}` : "";
      try {
        texte = await ecrireConseil({ sport: profil.sport || "", seances, prevues, gains, objectif });
      } catch (err: any) {
        console.error("ERREUR bilan IA:", err?.message);
        texte = "";
      }
      // Sans phrase de l'IA, on réessaiera à la prochaine ouverture
      if (!texte) { texte = "Belle semaine. Garde ce rythme sur la suivante."; garder = false; }
    }

    const bilan = { semaine: passe, seances, prevues, gains, texte };
    if (garder) {
      const { error } = await supabase.from("bilans_semaine").insert({ user_id: user.id, ...bilan });
      if (error) console.error("ERREUR enregistrement bilan:", error.message);
    }
    return repondre({ bilan });
  } catch (err: any) {
    console.error("ERREUR bilan:", err?.message);
    return repondre({ error: "Bilan indisponible" }, 500);
  }
});
