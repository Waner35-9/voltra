import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────
// Garde-fous de charges : aucune charge irréaliste ne sort du programme.
// Charge max de travail = poids de corps × ratio (matériel, mouvement, niveau)
// × âge × cycle × nombre de répétitions, puis arrondie au matériel réel
// (haltères de 2 en 2, kettlebells standards, barre de 2,5 en 2,5…).
// Pour les haltères et kettlebells, la charge est TOUJOURS par main / par unité.
// ─────────────────────────────────────────────────────────────

type Profil = { poids: number | null; niveau: string; age: number | null; cycle: number; avecCharges: boolean };

// [débutant, intermédiaire, avancé] × poids de corps
const RATIOS: Record<string, Record<string, number[]>> = {
  barre: { squat: [0.6, 0.9, 1.25], hinge: [0.7, 1.1, 1.5], bench: [0.45, 0.7, 0.95], ohp: [0.3, 0.45, 0.6], row: [0.4, 0.6, 0.8], thrust: [0.7, 1.1, 1.6], lunge: [0.3, 0.45, 0.65], olympic: [0.3, 0.5, 0.75], curl: [0.15, 0.25, 0.35], defaut: [0.3, 0.45, 0.6] },
  halteres: { squat: [0.12, 0.2, 0.3], hinge: [0.15, 0.25, 0.35], bench: [0.15, 0.25, 0.35], ohp: [0.1, 0.16, 0.22], row: [0.15, 0.25, 0.35], lunge: [0.1, 0.17, 0.25], curl: [0.06, 0.1, 0.14], raise: [0.04, 0.07, 0.11], olympic: [0.1, 0.15, 0.22], defaut: [0.08, 0.14, 0.2] },
  haltere_unique: { squat: [0.2, 0.3, 0.4], thrust: [0.2, 0.3, 0.45], defaut: [0.15, 0.25, 0.35] },
  kettlebell: { swing: [0.2, 0.3, 0.4], squat: [0.2, 0.3, 0.4], defaut: [0.12, 0.2, 0.28] },
  machine: { legpress: [1.0, 1.6, 2.4], defaut: [0.4, 0.6, 0.9] },
  poulie: { defaut: [0.2, 0.3, 0.45] },
};
const KETTLEBELLS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48];
const MEDBALLS = [2, 3, 4, 5, 6, 8, 10];

const SANS_CHARGE = /push[- ]?up|pull[- ]?up|chin[- ]?up|plank|jump|sprint|burpee|hop|bound|skip|crunch|sit[- ]?up|mountain climber|bear crawl|dip\b|bodyweight|body weight|band|elastic|wall sit|dead bug|bird dog|stretch|mobility|shuffle|carioca|run|drill|leg raise|hollow|superman/;

function detecterMateriel(ex: any): string {
  const m = String(ex.materiel || "").toLowerCase();
  const n = String(ex.nom || "").toLowerCase();
  if (/medicine ball|med ball|medball/.test(n) || m === "medball") return "medball";
  if (/kettlebell|\bkb\b/.test(n) || m === "kettlebell") return "kettlebell";
  if (/dumbbell|\bdb\b/.test(n) || m === "halteres" || m === "haltere") {
    return /goblet|single dumbbell|one dumbbell|hip thrust|glute bridge/.test(n) ? "haltere_unique" : "halteres";
  }
  if (/cable|pulley|poulie/.test(n) || m === "poulie") return "poulie";
  if (/machine|leg press|lever|smith|hack squat|leg extension|leg curl|pec deck/.test(n) || m === "machine") return "machine";
  if (/barbell|trap bar|hex bar|ez bar|\bbar\b/.test(n) || m === "barre") return "barre";
  if (/weighted/.test(n)) return "halteres";
  if (SANS_CHARGE.test(n) || m === "poids_du_corps" || m === "elastique") return "poids_du_corps";
  return m || "inconnu";
}

function detecterMouvement(nom: string): string {
  const n = nom.toLowerCase();
  if (/leg press/.test(n)) return "legpress";
  if (/clean|snatch|jerk/.test(n)) return "olympic";
  if (/swing/.test(n)) return "swing";
  if (/hip thrust|glute bridge/.test(n)) return "thrust";
  if (/lunge|split squat|step[- ]?up/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/deadlift|rdl|romanian|good morning|hinge/.test(n)) return "hinge";
  if (/bench|chest press|floor press/.test(n)) return "bench";
  if (/overhead|shoulder press|military|push press|arnold/.test(n)) return "ohp";
  if (/row|pulldown|pull-down/.test(n)) return "row";
  if (/curl/.test(n)) return "curl";
  if (/raise|fly|flye/.test(n)) return "raise";
  return "defaut";
}

function niveauIndex(niveau: string) {
  const n = String(niveau || "").toLowerCase();
  return n.startsWith("av") ? 2 : n.startsWith("inter") ? 1 : 0;
}

function premiersReps(reps: any) {
  const m = String(reps ?? "").match(/\d+/);
  return m ? Number(m[0]) : 8;
}

function chargeMax(ex: any, p: Profil, facteurSemaine = 1): { materiel: string; max: number } {
  const materiel = detecterMateriel(ex);
  if (!p.avecCharges || materiel === "poids_du_corps") return { materiel, max: 0 };
  if (materiel === "medball") return { materiel, max: [4, 6, 8][niveauIndex(p.niveau)] };
  const table = RATIOS[materiel] || RATIOS.halteres; // matériel inconnu : on reste prudent
  const mouvement = detecterMouvement(String(ex.nom || ""));
  const ratio = (table[mouvement] || table.defaut)[niveauIndex(p.niveau)];
  const poids = p.poids && p.poids >= 30 && p.poids <= 250 ? p.poids : 65;
  const age = p.age || 25;
  const facteurAge = age < 16 ? 0.7 : age < 18 ? 0.85 : age >= 55 ? 0.85 : 1;
  const facteurCycle = 1 + Math.min(Math.max(p.cycle - 1, 0), 3) * 0.05;
  const reps = premiersReps(ex.reps);
  const facteurReps = reps >= 15 ? 0.7 : reps >= 10 ? 0.85 : 1;
  return { materiel, max: poids * ratio * facteurAge * facteurCycle * facteurReps * facteurSemaine };
}

function arrondirMateriel(kg: number, materiel: string, mouvement: string): number {
  if (kg <= 0) return 0;
  if (materiel === "kettlebell") return [...KETTLEBELLS].reverse().find(k => k <= kg) ?? 4;
  if (materiel === "medball") return [...MEDBALLS].reverse().find(k => k <= kg) ?? 2;
  if (materiel === "halteres" || materiel === "haltere_unique") return Math.max(2, Math.floor(kg / 2) * 2);
  if (materiel === "machine") return Math.max(5, Math.floor(kg / 5) * 5);
  if (materiel === "barre") return Math.max(mouvement === "curl" ? 10 : 20, Math.floor(kg / 2.5) * 2.5);
  return Math.max(2.5, Math.floor(kg / 2.5) * 2.5);
}

// Corrige la charge d'un exercice : plafonnée, arrondie, jamais nulle si l'exercice se fait avec une charge
function securiserExercice(ex: any, p: Profil, facteurSemaine = 1) {
  const { materiel, max } = chargeMax(ex, p, facteurSemaine);
  const mouvement = detecterMouvement(String(ex.nom || ""));
  let charge = Number(ex.chargeKg) || 0;
  if (max === 0) charge = 0;
  else if (charge <= 0) charge = max * 0.7;          // l'IA a oublié la charge
  else charge = Math.min(charge, max);
  charge = arrondirMateriel(charge, materiel, mouvement);
  const unite = materiel === "halteres" ? "par main" : materiel === "kettlebell" && /double|two/.test(String(ex.nom).toLowerCase()) ? "par main" : "";
  return { ...ex, chargeKg: charge, materiel, chargeUnite: unite };
}

const SYSTEM_PROMPT = `Tu es un préparateur physique expert (certifié NSCA/CSCS). Tu génères des programmes en JSON pur.
RÈGLE ABSOLUE : JSON valide uniquement. Aucun texte. Aucun markdown. Maximum 8 exercices par séance.
Tu raisonnes comme un vrai coach : charges réalistes pour CE corps et CE niveau, technique avant la charge, progression sûre.`;

// Construit les semaines 2 a 4 a partir de la semaine 1 (progression deterministe)
const FACTEURS_SEMAINE = [1, 1.05, 1.1, 0.9];
function expandWeeks(prog: any) {
  const w1 = prog?.semaines?.[0];
  if (!w1 || !Array.isArray(w1.seances) || w1.seances.length === 0) {
    throw new Error("JSON invalide — semaine 1 manquante");
  }
  const themes = ["Fondations", "Volume", "Intensité", "Décharge"];
  const roundKg = (x: number) => Math.round(x / 2.5) * 2.5;

  const semaines = [1, 2, 3, 4].map((n) => ({
    numero: n,
    theme: themes[n - 1],
    seances: w1.seances.map((se: any) => ({
      ...se,
      id: `s${n}j${se.jour}`,
      exercices: (se.exercices || []).map((ex: any) => {
        let sets = Number(ex.sets) || 3;
        let reps = String(ex.reps ?? "");
        let charge = Number(ex.chargeKg) || 0;

        if (n > 1) {
          if (charge > 0) {
            charge = roundKg(charge * FACTEURS_SEMAINE[n - 1]);
          } else if (/^\d+$/.test(reps) && Number(reps) >= 8 && n < 4) {
            reps = String(Number(reps) + (n - 1)); // +1 rep (S2), +2 reps (S3)
          } else if (n === 3 && sets < 4) {
            sets += 1;
          }
          if (n === 4 && sets > 2) sets -= 1; // semaine de decharge
        }

        return {
          ...ex,
          id: n === 1 ? ex.id : `${ex.id}w${n}`,
          sets,
          reps,
          chargeKg: charge,
        };
      }),
    })),
  }));

  return { ...prog, semaines };
}

// Applique les garde-fous de charges à toutes les semaines (S3 peut monter de 10 %, S4 redescend)
function securiserProgramme(prog: any, profil: Profil) {
  return {
    ...prog,
    semaines: prog.semaines.map((sem: any, i: number) => ({
      ...sem,
      seances: sem.seances.map((se: any) => ({
        ...se,
        exercices: (se.exercices || []).map((ex: any) => securiserExercice(ex, profil, FACTEURS_SEMAINE[i] || 1)),
      })),
    })),
  };
}

function buildPrompt({ sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille }: any) {
  const startCycle = cycle || 1;
  const freq = Math.min(Number(frequence), 4);

  const equipementConfig: Record<string, { desc: string; nb: string; sets: string }> = {
    salle_complete: { desc: "salle complete (barres, halteres, kettlebells, machines, poulies)", nb: "4-5 exos", sets: "3-4 series" },
    salle_basique: { desc: "salle basique : barres, halteres, kettlebells, banc. PAS de machines ni poulies", nb: "4-5 exos", sets: "3-4 series" },
    maison: { desc: "MAISON poids du corps SEUL, INTERDIT halteres/barres/machines", nb: "6-8 exos", sets: "2-3 series" },
    terrain: { desc: "EXTERIEUR poids du corps SEUL, INTERDIT halteres/barres/machines", nb: "6-8 exos", sets: "2-3 series" },
  };
  const c = equipementConfig[equipement] || equipementConfig.salle_complete;
  const avecCharges = equipement === "salle_complete" || equipement === "salle_basique";

  const douleurConfig: Record<string, { eviter: string; inclure: string }> = {
    genou: {
      eviter: "squats profonds, fentes sautees, box jump haut, extensions lourdes",
      inclure: "terminal knee extension, squat partiel controle, ou wall sit isometrique"
    },
    epaule: {
      eviter: "developpe militaire lourd, dips profonds, tirage nuque, mouvements amplitude extreme",
      inclure: "rotation externe controlee, face pull leger, ou Y-T-W raises"
    },
    dos: {
      eviter: "souleve de terre jambes tendues, good morning lourd, rotation chargee du tronc",
      inclure: "bird dog, dead bug, ou hip hinge poids du corps controle"
    },
    cheville: {
      eviter: "sauts a fort impact, sprints, changements de direction brusques",
      inclure: "calf raise controle, equilibre unipodal, ou ankle circles resistes"
    },
    poignet: {
      eviter: "pompes appui direct, developpe couche barre, appuis poignet en extension",
      inclure: "wrist curl leger, ou prise neutre haltere si materiel dispo sinon isometrie"
    },
  };

  const activeDouleurs = (douleurs || []).filter((d: string) => d !== "aucune" && douleurConfig[d]);
  let douleursTexte = "";
  if (activeDouleurs.length > 0) {
    const parts = activeDouleurs.map((d: string) => {
      const cfg = douleurConfig[d];
      return `${d.toUpperCase()}: eviter [${cfg.eviter}]`;
    });
    const inclureParts = activeDouleurs.slice(0, 2).map((d: string) => douleurConfig[d].inclure);
    douleursTexte = `CONTRAINTES BLESSURES (OBLIGATOIRE): ${parts.join(". ")}. MAX 2 exercices de renforcement blessure au total dans toute la seance (pas un par douleur): ${inclureParts.join(" OU ")}. Le reste des exercices doit rester sport-specifique selon les qualites cles ci-dessus.`;
  }

  const sportQualites: Record<string, string> = {
    basketball: "detente, changements de direction, gainage anti-rotation",
    football: "vitesse lineaire, endurance intermittente, ischios",
    tennis: "rotation tronc, reactivite laterale, stabilite genou",
    rugby: "force haut du corps, puissance jambes, gainage impact",
    natation: "endurance epaules/dos, traction, gainage rotationnel",
    sprint: "force relative, extension hanche, pliometrie",
    combat: "puissance hanche, endurance haute intensite, prehension",
  };
  const qualitesCles = sportQualites[sport] || "force generale, puissance, endurance";

  const objectifSchemas: Record<string, string> = {
    explosivite: "3-5 reps explosifs (sauts/med-ball), repos 2-3min, contraste force+explosif",
    force: "3-6 reps lourds, repos 2-3min, 80-90% effort",
    endurance: "12-20 reps ou circuit, repos 30-60s",
    masse: "8-12 reps, repos 60-90s",
    detente: "3-5 reps pliometrie/sauts, repos 2-3min",
  };
  const schemaReps = objectifSchemas[objectif] || "8-10 reps, repos 90s";

  const cycleProfiles: Record<number, string> = {
    1: "FONDATIONS technique, 60-70% effort",
    2: "INTENSIFICATION 75-85% effort",
    3: "PUISSANCE 85-95% effort, explosivite",
    4: "ELITE 90-100% effort, tempo/unilateral",
  };
  const cycleProfile = cycleProfiles[Math.min(startCycle, 4)] || `ELITE+${startCycle - 4} intensite max`;

  const poidsNum = Number(poids);
  const ageNum = Number(age);
  const tailleNum = Number(taille);
  const poidsValide = poidsNum >= 30 && poidsNum <= 250;
  const ageValide = ageNum >= 12 && ageNum <= 90;
  const tailleValide = tailleNum >= 120 && tailleNum <= 230;
  const profil: Profil = { poids: poidsValide ? poidsNum : null, niveau, age: ageValide ? ageNum : null, cycle: startCycle, avecCharges };

  let chargesTexte = "";
  if (avecCharges) {
    // Plafonds calculés par le serveur, donnés à l'IA comme repères (charges de travail pour ~8 reps)
    const repere = (nom: string) => {
      const { materiel, max } = chargeMax({ nom, reps: "8" }, profil);
      return arrondirMateriel(max, materiel, detecterMouvement(nom));
    };
    chargesTexte = `CHARGES (athlete ${poidsValide ? poidsNum + "kg" : "poids inconnu, reste prudent"}, niveau ${niveau}) — MAXIMUM pour ~8 reps, a ne pas depasser (descends pour plus de reps, et en dessous pour un debutant ou un exercice nouveau):
- Barre : back squat ${repere("barbell back squat")}kg, souleve de terre roumain ${repere("barbell romanian deadlift")}kg, developpe couche ${repere("barbell bench press")}kg, developpe militaire ${repere("barbell overhead press")}kg, rowing ${repere("barbell bent over row")}kg, hip thrust ${repere("barbell hip thrust")}kg.
- Halteres (chargeKg = poids d'UNE haltere, PAR MAIN) : squat ${repere("dumbbell squat")}kg/main, fentes ${repere("dumbbell lunge")}kg/main, developpe couche ${repere("dumbbell bench press")}kg/main, developpe epaules ${repere("dumbbell shoulder press")}kg/main, rowing ${repere("dumbbell row")}kg/main, elevations laterales ${repere("dumbbell lateral raise")}kg/main.
- Goblet squat (une seule haltere tenue a deux mains) : ${repere("dumbbell goblet squat")}kg. Kettlebell swing : ${repere("kettlebell swing")}kg.
chargeKg = charge realiste en kg. Pour halteres/kettlebells : TOUJOURS le poids d'une seule haltere. Pliometrie, sprints, gainage, poids du corps : chargeKg = 0.`;
  } else {
    chargesTexte = "CHARGES: aucun materiel, chargeKg = 0 partout. Progression par tempo, unilateral, amplitude, plus de reps.";
  }

  let ageTexte = "";
  if (ageValide) {
    if (ageNum < 18) ageTexte = `AGE ${ageNum} ans (jeune athlete): technique avant tout, pas de charges maximales (>85%), volume modere, repos complets.`;
    else if (ageNum >= 40 && ageNum < 55) ageTexte = `AGE ${ageNum} ans: echauffement et mobilite renforces, pliometrie progressive, repos +15%.`;
    else if (ageNum >= 55) ageTexte = `AGE ${ageNum} ans: impact reduit, mobilite, charges moderees, repos +25%, pas de sauts maximaux.`;
  }

  let morphoTexte = "";
  if (poidsValide && tailleValide) {
    const imc = poidsNum / Math.pow(tailleNum / 100, 2);
    morphoTexte = `MORPHOLOGIE: ${tailleNum}cm, ${poidsNum}kg (IMC ${imc.toFixed(1)}).`;
    if (imc >= 30) morphoTexte += " Limite le volume de sauts et d'impacts (articulations), privilegie pliometrie basse (sauts sur place, med-ball) et travail de force.";
    if (tailleNum >= 190) morphoTexte += " Grand gabarit: privilegie goblet squat, trap bar, split squat et hip hinge controle; amplitude adaptee.";
  }

  const niv = String(niveau || "").toLowerCase();
  const niveauTexte = niv.startsWith("deb")
    ? "NIVEAU DEBUTANT: exercices simples et stables (goblet squat, halteres, machines si dispo), pas de mouvements olympiques ni de pliometrie a fort impact, 2-3 series, charges legeres (RPE 6-7)."
    : niv.startsWith("inter")
      ? "NIVEAU INTERMEDIAIRE: mouvements polyarticulaires a la barre autorises, pliometrie moderee, RPE 7-8."
      : "NIVEAU AVANCE: contraste force/vitesse, variantes unilaterales chargees, pliometrie intense, RPE 8-9.";

  return `Prepa physique ${sport}, style Overtime Athletes (contraste/PAP, priorite neurologique).

ATHLETE: ${sport}, obj=${objectif}, niv=${niveau}, freq=${freq}/sem, cycle=${startCycle}${poste ? `, poste=${poste}` : ""}${poidsValide ? `, poids=${poidsNum}kg` : ""}${tailleValide ? `, taille=${tailleNum}cm` : ""}${ageValide ? `, age=${ageNum}` : ""}
QUALITES CLES: ${qualitesCles}
REPS/CHARGES: ${schemaReps}
ORDRE: explosif/pliometrie d'abord, force ensuite, accessoires/gainage en dernier
CYCLE ${startCycle}: ${cycleProfile}
${niveauTexte}
MATERIEL: ${c.desc}. ${c.nb}, ${c.sets}.
${chargesTexte}
${morphoTexte}
${ageTexte}
${douleursTexte}

JSON strict:
{"meta":{"sport":"${sport}","objectif":"${objectif}","niveau":"${niveau}","frequence":${freq},"cycle":${startCycle},"startCycle":${startCycle},"totalSemaines":4},"semaines":[{"numero":1,"theme":"S1","seances":[{"id":"s1j1","jour":1,"titre":"Seance 1","dureeMin":45,"exercices":[{"id":"e1","nom":"dumbbell goblet squat","materiel":"halteres","muscles":"Muscle","sets":3,"reps":"5","chargeKg":0,"reposSec":150,"ordre":1,"conseil":"court"}]}]}]}

nom = nom ANGLAIS standard de base d'exercices, materiel en premier (ex: "barbell full squat", "dumbbell goblet squat", "dumbbell bench press", "kettlebell swing", "box jump", "body weight squat", "cable pallof press"). Pas de nom invente ni de variante exotique.
materiel = un de: "barre", "halteres", "kettlebell", "machine", "poulie", "medball", "elastique", "poids_du_corps".
titre/theme/muscles/conseil francais courts. Le conseil donne LE point technique cle du mouvement. Pour l'exercice de renforcement blessure, precise dans "conseil" pourquoi (ex: "Renforce le genou en securite").
Genere UNIQUEMENT la semaine 1 (le tableau "semaines" contient UNE seule semaine) avec ${freq} seances, respecte ${c.nb}/${c.sets}/ordre/cycle/contraintes blessures. Les semaines suivantes sont calculees automatiquement. JSON compact sans espaces inutiles.`;
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
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chaque génération coûte un appel IA : 5 programmes maximum par compte sur 24 h
    const { count: generesRecemment } = await supabase
      .from("programmes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if ((generesRecemment || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Limite atteinte : réessaie demain." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille } = body;

    if (!sport || !objectif || !niveau || !frequence) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPrompt({ sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille }) }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${claudeRes.status} ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.map((b: any) => b.text || "").join("") ?? "";
    console.log("RAW:", rawText.substring(0, 300));

    let programme;
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      programme = JSON.parse(clean);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON invalide");
      try {
        programme = JSON.parse(match[0]);
      } catch {
        throw new Error("JSON invalide — structure incorrecte");
      }
    }

    // Semaine 1 generee par l'IA -> semaines 1 a 4 avec progression -> garde-fous de charges
    const startCycle = cycle || 1;
    const poidsNum = Number(poids), ageNum = Number(age);
    const profil: Profil = {
      poids: poidsNum >= 30 && poidsNum <= 250 ? poidsNum : null,
      niveau,
      age: ageNum >= 12 && ageNum <= 90 ? ageNum : null,
      cycle: startCycle,
      avecCharges: equipement === "salle_complete" || equipement === "salle_basique",
    };
    programme = securiserProgramme(expandWeeks(programme), profil);

    const { data: savedProg, error: saveError } = await supabase
      .from("programmes")
      .insert({
        user_id: user.id,
        titre: `${objectif} ${sport} — Cycle ${startCycle}`,
        sport, objectif, niveau, frequence,
        total_semaines: 4,
        semaine_courante: 1,
        statut: "actif",
        data_json: { ...programme, cycle: startCycle, startCycle, niveau, frequence, objectif, equipement, douleurs, poste }
      })
      .select().single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ programme: savedProg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("ERREUR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
