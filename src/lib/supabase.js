import { createClient }  from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders }   from "../_shared/cors.ts";
 
const SYSTEM_PROMPT = `Tu es un coach sportif expert en préparation physique athlétique.
Tu génères des programmes de musculation structurés en JSON pur.
 
RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en JSON valide. Zéro texte avant ou après.
- Jamais de blocs \`\`\`json\`\`\` ni de commentaires.
- Respecte exactement le schéma fourni.
- Adapte chaque exercice au sport spécifié.
- Maximum 5 exercices par séance.
- Les exercices pliométriques ont charge_kg à 0.
- Périodisation : S1 activation → S2 accumulation → S3 intensification → S4 décharge.`;
 
function buildPrompt({ sport, objectif, niveau, frequence }: any) {
  return `Génère un programme de musculation complet :
 
Sport      : ${sport}
Objectif   : ${objectif}
Niveau     : ${niveau}
Fréquence  : ${frequence} séances par semaine
Durée      : 4 semaines
 
Retourne UNIQUEMENT ce JSON :
{
  "meta": { "sport": "...", "objectif": "...", "niveau": "...", "frequence": ${frequence}, "totalSemaines": 4 },
  "semaines": [
    {
      "numero": 1,
      "theme": "Activation",
      "seances": [
        {
          "id": "s1_j1",
          "jour": 1,
          "titre": "...",
          "type": "force_basse",
          "dureeMin": 45,
          "exercices": [
            {
              "id": "ex_001",
              "nom": "...",
              "muscles": "Muscle1 · Muscle2",
              "sets": 4,
              "reps": "8",
              "chargeKg": 60,
              "reposSec": 120,
              "ordre": 1,
              "conseil": "..."
            }
          ]
        }
      ]
    }
  ]
}
 
Génère les 4 semaines avec ${frequence} séances par semaine chacune.`;
}
 
serve(async (req: Request) => {
  // Gérer les preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
 
  try {
    // ── 1. Vérifier l'authentification ──────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
 
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
 
    // ── 2. Vérifier le plan (free = 1 programme max) ────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
 
    if (profile?.plan === "free") {
      const { count } = await supabase
        .from("programmes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
 
      if ((count ?? 0) >= 1) {
        return new Response(
          JSON.stringify({ error: "Plan gratuit : 1 programme maximum", upgrade: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
 
    // ── 3. Récupérer les paramètres ──────────────────────────
    const body = await req.json();
    const { sport, objectif, niveau, frequence } = body;
 
    if (!sport || !objectif || !niveau || !frequence) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
 
    // ── 4. Appel Claude API ──────────────────────────────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":    Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: buildPrompt({ sport, objectif, niveau, frequence }) }],
      }),
    });
 
    if (!claudeRes.ok) {
      throw new Error(`Claude API error: ${claudeRes.status}`);
    }
 
    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.map((b: any) => b.text || "").join("") ?? "";
    const clean      = rawText.replace(/```json|```/g, "").trim();
 
    let programme;
    try {
      programme = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON invalide reçu de Claude");
      programme = JSON.parse(match[0]);
    }
 
    // ── 5. Sauvegarder en base ───────────────────────────────
    const { data: savedProg, error: saveError } = await supabase
      .from("programmes")
      .insert({
        user_id:         user.id,
        titre:           `${objectif} ${sport}`,
        sport, objectif, niveau, frequence,
        total_semaines:  4,
        semaine_courante: 1,
        statut:          "actif",
        data_json:       programme,
      })
      .select()
      .single();
 
    if (saveError) throw saveError;
 
    // ── 6. Retourner le programme ────────────────────────────
    return new Response(
      JSON.stringify({ programme: savedProg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
 
  } catch (err: any) {
    console.error("generate-program error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
 
 
// ═══════════════════════════════════════════════════════════════
// validate-session/index.ts
// Valide une séance, log les perfs, calcule la progression
// ═══════════════════════════════════════════════════════════════
import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders }  from "../_shared/cors.ts";
 
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
 
  try {
    // ── 1. Auth ──────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
 
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
 
    // ── 2. Récupérer les données de la séance ────────────────
    const body = await req.json();
    const { seanceId, logs, feedback } = body;
    // logs = [{ exerciceId, repsPar Set: [8,8,7], chargeKg: 80 }, ...]
    // feedback = 'easy' | 'good' | 'hard'
 
    if (!seanceId || !logs || !feedback) {
      return new Response(
        JSON.stringify({ error: "Données manquantes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
 
    // ── 3. Insérer les logs de performance ───────────────────
    const logsToInsert = logs.map((log: any) => {
      // Calculer le statut automatiquement
      const totalSets   = log.repsParSet.length;
      const setsReussis = log.repsParSet.filter((r: number) => r >= log.repsCible).length;
      const taux        = setsReussis / totalSets;
 
      return {
        exercice_id:  log.exerciceId,
        seance_id:    seanceId,
        user_id:      user.id,
        reps_par_set: log.repsParSet,
        charge_kg:    log.chargeKg,
        rpe:          log.rpe,
        feedback,
        statut: taux === 1 ? "reussite" : taux >= 0.5 ? "partiel" : "echec",
      };
    });
 
    const { error: logsError } = await supabase
      .from("logs_performance")
      .insert(logsToInsert);
 
    if (logsError) throw logsError;
 
    // ── 4. Marquer la séance comme faite ─────────────────────
    await supabase
      .from("seances")
      .update({ statut: "faite", date_realisee: new Date().toISOString() })
      .eq("id", seanceId)
      .eq("user_id", user.id);
 
    // ── 5. Calculer la progression (fonction SQL) ─────────────
    const { data: progression, error: progError } = await supabase
      .rpc("calculer_progression", {
        p_user_id:  user.id,
        p_seance_id: seanceId,
        p_feedback:  feedback,
      });
 
    if (progError) throw progError;
 
    // ── 6. Vérifier si déload nécessaire ─────────────────────
    const { data: deloadRaison } = await supabase
      .rpc("check_deload_needed", { p_user_id: user.id });
 
    if (deloadRaison) {
      await supabase.rpc("appliquer_deload", {
        p_user_id: user.id,
        p_raison:  deloadRaison,
      });
    }
 
    // ── 7. Construire le message de progression ───────────────
    const messages = (progression as any[]).map((p: any) => {
      if (p.action === "progression_charge") {
        return `💪 ${p.exercice} : ${p.charge_avant} → ${p.charge_apres} kg`;
      } else if (p.action === "progression_reps") {
        return `📈 ${p.exercice} : +${p.reps_apres - p.reps_avant} rep`;
      } else if (p.action === "regression") {
        return `🔄 ${p.exercice} : charge réduite à ${p.charge_apres} kg`;
      }
      return `🎯 ${p.exercice} : maintien`;
    });
 
    return new Response(
      JSON.stringify({
        success:     true,
        progression,
        messages,
        deload:      deloadRaison ? { active: true, raison: deloadRaison } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
 
  } catch (err: any) {
    console.error("validate-session error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
 
 
// ═══════════════════════════════════════════════════════════════
// LIB CLIENT — supabase.js (à mettre dans src/lib/supabase.js)
// Fonctions appelées depuis le frontend React
// ═══════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
 
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
 
export default supabase;
 
// ── Auth ─────────────────────────────────────────────────────
 
export async function signUp(email, password, name) {
  return supabase.auth.signUp({
    email, password,
    options: { data: { name } },
  });
}
 
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
 
export async function signOut() {
  return supabase.auth.signOut();
}
 
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
 
// ── Programme ────────────────────────────────────────────────
 
// Appelle l'Edge Function sécurisée (clé Claude côté serveur)
export async function generateProgram({ sport, objectif, niveau, frequence }) {
  const session = await getSession();
 
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-program`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ sport, objectif, niveau, frequence }),
    }
  );
 
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur génération");
  return data.programme;
}
 
// Récupérer le programme actif
export async function getProgrammeActif() {
  const { data, error } = await supabase
    .from("programmes")
    .select("*")
    .eq("statut", "actif")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
 
  if (error) return null;
  return data;
}
 
// ── Séances ──────────────────────────────────────────────────
 
export async function getSeanceDuJour(programmeId) {
  const { data, error } = await supabase
    .from("seances")
    .select(`*, exercices(*)`)
    .eq("programme_id", programmeId)
    .eq("statut", "a_faire")
    .order("semaine", { ascending: true })
    .order("jour",    { ascending: true })
    .limit(1)
    .single();
 
  if (error) return null;
  // Trier les exercices par ordre
  if (data?.exercices) {
    data.exercices.sort((a, b) => a.ordre - b.ordre);
  }
  return data;
}
 
export async function getHistorique(userId) {
  const { data, error } = await supabase
    .from("seances")
    .select(`*, logs_performance(*)`)
    .eq("user_id", userId)
    .eq("statut", "faite")
    .order("date_realisee", { ascending: false })
    .limit(20);
 
  if (error) return [];
  return data;
}
 
// ── Validation séance ────────────────────────────────────────
 
export async function validateSession({ seanceId, logs, feedback }) {
  const session = await getSession();
 
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-session`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ seanceId, logs, feedback }),
    }
  );
 
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur validation");
  return data; // { progression, messages, deload }
}
 
// ── Profil ───────────────────────────────────────────────────
 
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
 
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
 
  return data;
}
 
export async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
 
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();
 
  if (error) throw error;
  return data;
}
 
// ── Progression ──────────────────────────────────────────────
 
export async function getProgressionExercice(exerciceNom) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
 
  // Récupère les 8 derniers logs pour cet exercice (courbe de progression)
  const { data } = await supabase
    .from("logs_performance")
    .select("charge_kg, reps_par_set, logged_at")
    .eq("user_id", user.id)
    .order("logged_at", { ascending: true })
    .limit(8);
 
  return data || [];
}