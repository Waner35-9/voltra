import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Version du cache : les anciennes images (mauvaise correspondance, 180 px) sont ignorées
const VERSION = "v3";

// Résolutions essayées de la meilleure à la plus petite (selon l'abonnement ExerciseDB)
const RESOLUTIONS = (Deno.env.get("EXERCISEDB_RESOLUTIONS") || "720,360,180").split(",").map(r => r.trim());

// Matériel Voltra -> matériel ExerciseDB
const EQUIPEMENT: Record<string, string[]> = {
  barre: ["barbell", "olympic barbell", "ez barbell", "trap bar", "smith machine"],
  halteres: ["dumbbell"],
  haltere_unique: ["dumbbell"],
  kettlebell: ["kettlebell"],
  machine: ["leverage machine", "sled machine", "smith machine", "assisted"],
  poulie: ["cable"],
  medball: ["medicine ball"],
  elastique: ["band", "resistance band"],
  poids_du_corps: ["body weight"],
};

function equipementDemande(term: string, materiel?: string): string[] | null {
  if (materiel && EQUIPEMENT[materiel]) return EQUIPEMENT[materiel];
  if (/dumbbell|\bdb\b/.test(term)) return EQUIPEMENT.halteres;
  if (/kettlebell/.test(term)) return EQUIPEMENT.kettlebell;
  if (/barbell|trap bar|ez bar/.test(term)) return EQUIPEMENT.barre;
  if (/cable/.test(term)) return EQUIPEMENT.poulie;
  if (/medicine ball|med ball/.test(term)) return EQUIPEMENT.medball;
  if (/band/.test(term)) return EQUIPEMENT.elastique;
  if (/machine|leg press|lever|smith/.test(term)) return EQUIPEMENT.machine;
  if (/body ?weight|push-?up|pull-?up|jump|plank|burpee/.test(term)) return EQUIPEMENT.poids_du_corps;
  return null;
}

// Noms courants -> noms utilisés par ExerciseDB
const SYNONYMES: [RegExp, string][] = [
  [/\bback squat\b/, "full squat"],
  [/\bpush ?ups?\b/, "push-up"],
  [/\bpull ?ups?\b/, "pull-up"],
  [/\bchin ?ups?\b/, "chin-up"],
  [/\bstep ?ups?\b/, "step-up"],
  [/\bsit ?ups?\b/, "sit-up"],
  [/\brdl\b/, "romanian deadlift"],
  [/\bmilitary press\b/, "overhead press"],
  [/\bskull ?crushers?\b/, "lying triceps extension"],
];
const normaliser = (t: string) => SYNONYMES.reduce((acc, [re, rep]) => acc.replace(re, rep), t);

const MOTS_VIDES = new Set(["with", "and", "the", "a", "on", "to", "of", "for", "dumbbell", "dumbbells", "barbell", "kettlebell", "cable", "band", "machine", "body", "weight", "bodyweight", "medicine", "ball"]);
const mots = (t: string) => t.toLowerCase().replace(/[^a-z0-9 -]/g, " ").split(/\s+/).filter(w => w && !MOTS_VIDES.has(w));

// Note de ressemblance entre le nom demandé et un exercice ExerciseDB
function score(demande: string, ex: any, equip: string[] | null): number {
  const a = mots(demande), b = new Set(mots(ex.name || ""));
  let s = 0;
  for (const w of a) if (b.has(w) || [...b].some(x => x.startsWith(w) || w.startsWith(x))) s += 2;
  for (const x of b) if (!a.some(w => x.startsWith(w) || w.startsWith(x))) s -= 1; // mot en trop = variante différente
  if (equip) s += equip.includes(String(ex.equipment || "").toLowerCase()) ? 4 : -6;
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nom, nomEn, materiel } = await req.json();
    const rawTerm = (nomEn || nom || "").toLowerCase().trim();
    if (!rawTerm) throw new Error("Nom manquant");

    const searchKey = `${VERSION}|${rawTerm.replace(/[^a-z0-9 -]/g, "").trim()}|${materiel || ""}`;
    const rapidKey = Deno.env.get("RAPIDAPI_KEY");
    const headers = { "X-RapidAPI-Key": rapidKey!, "X-RapidAPI-Host": "exercisedb.p.rapidapi.com" };

    // 1. Cache
    const { data: cached } = await supabase
      .from("exercise_gifs")
      .select("gif_url")
      .eq("search_key", searchKey)
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify({ gifUrl: cached.gif_url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chercher = async (q: string) => {
      const r = await fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(q)}?limit=20`, { headers });
      if (!r.ok) return [];
      const arr = await r.json();
      return Array.isArray(arr) ? arr : [];
    };

    // 2. Recherche : nom complet, puis nom sans matériel, puis mot principal ; on garde le meilleur score
    const equip = equipementDemande(rawTerm, materiel);
    const termeNet = normaliser(rawTerm.replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim());
    const sansMateriel = mots(termeNet).join(" ");
    const motPrincipal = mots(termeNet).slice(-1)[0];
    const essais = [termeNet, sansMateriel, motPrincipal].filter((q, i, arr) => q && arr.indexOf(q) === i);

    let meilleur: any = null, meilleurScore = -Infinity;
    for (const q of essais) {
      for (const ex of await chercher(q!)) {
        const sc = score(termeNet, ex, equip);
        if (sc > meilleurScore) { meilleur = ex; meilleurScore = sc; }
      }
      if (meilleurScore >= 4) break; // correspondance solide trouvée
    }
    if (meilleurScore < 1) meilleur = null; // mieux vaut pas d'image qu'une mauvaise image

    // 3. Image dans la meilleure résolution disponible, copiée dans le Storage
    let gifUrl = null;
    if (meilleur?.id) {
      for (const res of RESOLUTIONS) {
        const imgRes = await fetch(`https://exercisedb.p.rapidapi.com/image?exerciseId=${meilleur.id}&resolution=${res}`, { headers });
        if (!imgRes.ok) continue;
        const imgBlob = await imgRes.arrayBuffer();
        const fileName = `${VERSION}/${meilleur.id}_${res}.gif`;
        const { error: uploadErr } = await supabase.storage
          .from("exercise-gifs")
          .upload(fileName, imgBlob, { contentType: "image/gif", upsert: true });
        if (!uploadErr) {
          gifUrl = supabase.storage.from("exercise-gifs").getPublicUrl(fileName).data.publicUrl;
          break;
        }
      }
    }

    // 4. Mémoriser le résultat (même vide) pour ne pas rechercher à chaque fois
    await supabase.from("exercise_gifs").upsert({
      search_key: searchKey,
      gif_url: gifUrl,
      exercise_name_en: meilleur?.name || null,
    }, { onConflict: "search_key" });

    return new Response(JSON.stringify({ gifUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ERREUR:", err.message);
    return new Response(JSON.stringify({ gifUrl: null, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
