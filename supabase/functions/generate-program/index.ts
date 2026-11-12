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
  machine: { legpress: [1.0, 1.6, 2.4], squat: [0.5, 0.9, 1.3], bench: [0.35, 0.55, 0.8], ohp: [0.2, 0.35, 0.5], row: [0.35, 0.55, 0.8], curl: [0.12, 0.2, 0.3], raise: [0.1, 0.18, 0.25], triceps: [0.2, 0.3, 0.45], legext: [0.25, 0.45, 0.65], legcurl: [0.2, 0.35, 0.5], thrust: [0.6, 1.0, 1.5], hanche: [0.3, 0.45, 0.65], mollets: [0.4, 0.8, 1.2], abdos: [0.15, 0.3, 0.45], pecdeck: [0.25, 0.4, 0.6], defaut: [0.4, 0.6, 0.9] },
  poulie: { row: [0.3, 0.5, 0.7], curl: [0.1, 0.18, 0.25], triceps: [0.15, 0.25, 0.35], raise: [0.05, 0.1, 0.15], defaut: [0.2, 0.3, 0.45] },
};
const KETTLEBELLS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48];
const MEDBALLS = [2, 3, 4, 5, 6, 8, 10];

const SANS_CHARGE = /push[- ]?up|pull[- ]?up|chin[- ]?up|plank|jump|sprint|burpee|hop|bound|skip|crunch|sit[- ]?up|mountain climber|bear crawl|dip\b|bodyweight|body weight|band|elastic|wall sit|dead bug|bird dog|stretch|mobility|shuffle|carioca|run|drill|leg raise|hollow|superman/;

function detecterMateriel(ex: any): string {
  const m = String(ex.materiel || "").toLowerCase();
  const n = String(ex.nom || "").toLowerCase();
  // Cardio, mobilité et tout ce qui se fait au chrono : jamais de charge
  if (m === "cardio" || m === "mobilite" || Number(ex.travailSec) > 0) return "poids_du_corps";
  if (/assisted|glute ham|back extension|captain|roman chair|sled|battle rope|rowing machine|air bike|ski ?erg/.test(n)) return "poids_du_corps";
  if (/medicine ball|med ball|medball/.test(n) || m === "medball") return "medball";
  if (/kettlebell|\bkb\b/.test(n) || m === "kettlebell") return "kettlebell";
  if (/dumbbell|\bdb\b/.test(n) || m === "halteres" || m === "haltere") {
    return /goblet|single dumbbell|one dumbbell|hip thrust|glute bridge/.test(n) ? "haltere_unique" : "halteres";
  }
  if (/cable|pulley|poulie/.test(n) || m === "poulie") return "poulie";
  if (/machine|leg press|lever|smith|hack squat|pendulum squat|belt squat|leg extension|leg curl|pec deck|lat pulldown|calf raise/.test(n) || m === "machine") return "machine";
  if (/barbell|trap bar|hex bar|ez bar|\bbar\b/.test(n) || m === "barre") return "barre";
  if (/weighted/.test(n)) return "halteres";
  if (SANS_CHARGE.test(n) || m === "poids_du_corps" || m === "elastique") return "poids_du_corps";
  return m || "inconnu";
}

function detecterMouvement(nom: string): string {
  const n = nom.toLowerCase();
  if (/calf/.test(n)) return "mollets";
  if (/leg press/.test(n)) return "legpress";
  if (/leg curl/.test(n)) return "legcurl";
  if (/leg extension/.test(n)) return "legext";
  if (/abduct|adduct|multi hip|kickback/.test(n)) return "hanche";
  if (/triceps|pushdown|seated dip/.test(n)) return "triceps";
  if (/abdominal|crunch|torso/.test(n)) return "abdos";
  if (/reverse pec|reverse fly|rear delt/.test(n)) return "raise";
  if (/pec deck|butterfly/.test(n)) return "pecdeck";
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
  // Cardio et mobilité gardent leur étiquette : l'appli s'en sert pour l'écran de séance et la carte du corps
  const garde = ["cardio", "mobilite"].includes(String(ex.materiel)) ? ex.materiel : materiel;
  return { ...ex, chargeKg: charge, materiel: garde, chargeUnite: unite };
}

const SYSTEM_PROMPT = `Tu es un préparateur physique expert (certifié NSCA/CSCS) qui prépare des athlètes de club. Tu génères des programmes en JSON pur.
RÈGLE ABSOLUE : JSON valide uniquement. Aucun texte. Aucun markdown. Maximum 8 exercices dans le corps de chaque séance. Chaque séance dure environ 45 min, échauffement et retour au calme compris.
Tu raisonnes comme un vrai coach de club, pas comme un coach de musculation : la semaine mélange renforcement, cardio, vitesse et mobilité selon le sport, s'organise autour des entraînements du club et du match, et chaque séance a un échauffement et un retour au calme. Charges réalistes pour CE corps et CE niveau, technique avant la charge, progression sûre.`;

// Noms des machines que l'IA peut proposer : mêmes noms que src/catalogueEquipements.js
const MACHINES_SALLE = [
  "chest press machine", "incline chest press machine", "decline chest press machine", "pec deck machine",
  "lat pulldown", "assisted pull-up machine", "seated row machine", "high row machine", "t-bar row", "chest supported row",
  "shoulder press machine", "lateral raise machine", "reverse pec deck",
  "biceps curl machine", "preacher curl machine", "seated dip machine", "triceps extension machine",
  "leg press", "hack squat machine", "pendulum squat", "belt squat", "smith machine squat", "leg extension",
  "seated leg curl", "lying leg curl", "standing leg curl",
  "hip thrust machine", "glute kickback machine", "hip abductor machine", "hip adductor machine",
  "seated calf raise", "standing calf raise", "abdominal crunch machine", "rotary torso machine",
];
const CROSS_SALLE = ["sled push", "battle ropes", "rowing machine", "air bike", "ski erg", "medball wall ball", "landmine press"];

// Si l'IA oublie les machines en salle complète : on en ajoute une, compatible avec les douleurs
const MACHINES_SECOURS = [
  { nom: "seated leg curl", muscles: "Ischio-jambiers", conseil: "Controle le retour, bassin fixe.", eviter: [] },
  { nom: "lat pulldown", muscles: "Grand dorsal Biceps", conseil: "Tire vers le haut de la poitrine, sans te pencher.", eviter: ["epaule"] },
  { nom: "leg press", muscles: "Quadriceps Fessiers", conseil: "Bas du dos colle au dossier, sans verrouiller les genoux.", eviter: ["genou", "cheville", "dos"] },
  { nom: "seated row machine", muscles: "Grand dorsal Rhomboides", conseil: "Poitrine haute, serre les omoplates.", eviter: [] },
  { nom: "chest press machine", muscles: "Pectoraux Triceps", conseil: "Poignees au milieu de la poitrine, epaules collees au dossier.", eviter: ["epaule", "poignet"] },
  { nom: "leg extension", muscles: "Quadriceps", conseil: "Monte sans a-coup, controle le retour.", eviter: ["genou"] },
];

function garantirMachines(prog: any, douleurs: string[] = []) {
  const possibles = MACHINES_SECOURS.filter(m => !m.eviter.some(d => douleurs.includes(d)));
  const seances = prog?.semaines?.[0]?.seances;
  if (!Array.isArray(seances) || possibles.length === 0) return prog;
  seances.forEach((se: any, i: number) => {
    const exercices = se.exercices || [];
    // Seules les séances de renforcement passent par les machines
    if (se.type && se.type !== "renforcement") return;
    if (exercices.length >= 8 || exercices.some((ex: any) => detecterMateriel(ex) === "machine")) return;
    const m = possibles[i % possibles.length];
    const machine = { id: `${se.id || `s${i}`}_machine`, nom: m.nom, materiel: "machine", muscles: m.muscles, sets: 3, reps: "10", chargeKg: 0, reposSec: 75, conseil: m.conseil };
    // Avant le dernier exercice, en général le gainage
    exercices.splice(Math.max(exercices.length - 1, 0), 0, machine);
    se.exercices = exercices;
  });
  return prog;
}

// Construit les semaines 2 a 4 a partir de la semaine 1 (progression deterministe)
const FACTEURS_SEMAINE = [1, 1.05, 1.1, 0.9];
// Cardio : fractionné +1 puis +2 blocs, décharge -1 ; endurance continue +10 %, +20 %, -20 %
const BLOCS_CARDIO = [0, 1, 2, -1];
const DUREE_CARDIO = [1, 1.1, 1.2, 0.8];
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
        let travailSec = Number(ex.travailSec) || 0;

        if (n > 1 && travailSec > 0) {
          // Exercice au chrono : on ne touche qu'au cardio, la mobilité reste la même
          if (ex.materiel === "cardio" && sets > 1) sets = Math.max(1, sets + BLOCS_CARDIO[n - 1]);
          else if (ex.materiel === "cardio") travailSec = Math.round((travailSec * DUREE_CARDIO[n - 1]) / 60) * 60 || travailSec;
        } else if (n > 1) {
          if (charge > 0 && ["medball", "kettlebell"].includes(detecterMateriel(ex))) {
            // Poids fixes (3 kg, 4 kg…) : +5 % ne tombe sur aucun poids, on garde la charge et on progresse par les séries
            if (n === 3 && sets < 4) sets += 1;
          } else if (charge > 0) {
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
          ...(travailSec > 0 ? { travailSec } : {}),
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

// ─────────────────────────────────────────────────────────────
// Semaine type : chaque séance Voltra reçoit un type (renforcement, cardio,
// vitesse, mobilité) selon le sport, la saison, les jours de club et le match.
// ─────────────────────────────────────────────────────────────
const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const LUNDI_DABORD = (d: number) => (d + 6) % 7;

// Ordre de priorité des types de séances, par sport (les premiers passent avant)
const MIX_SPORT: Record<string, string[]> = {
  basketball: ["renforcement", "vitesse", "cardio", "renforcement", "mobilite"],
  football: ["renforcement", "cardio", "vitesse", "renforcement", "mobilite"],
  tennis: ["renforcement", "vitesse", "cardio", "mobilite", "renforcement"],
  rugby: ["renforcement", "vitesse", "renforcement", "cardio", "mobilite"],
  natation: ["renforcement", "cardio", "mobilite", "renforcement", "vitesse"],
  sprint: ["vitesse", "renforcement", "vitesse", "mobilite", "renforcement"],
  combat: ["cardio", "renforcement", "vitesse", "cardio", "mobilite"],
};
const MIX_DEFAUT = ["renforcement", "cardio", "vitesse", "renforcement", "mobilite"];

// La saison change le mélange : plus de cardio en pré-saison et pendant la trêve
function mixSaison(sport: string, saison: string) {
  const mix = [...(MIX_SPORT[sport] || MIX_DEFAUT)];
  if (saison === "pre" && mix.indexOf("cardio") > 1) {
    mix.splice(mix.indexOf("cardio"), 1);
    mix.splice(1, 0, "cardio");
  }
  if (saison === "treve") {
    const v = mix.indexOf("vitesse");
    if (v >= 0) mix[v] = "cardio";
  }
  return mix;
}

type JourPlan = { jour: number; nomJour: string; type: string; contexte: string };

function planifierSemaine(sport: string, jours: number[], rythme: any, freq: number): JourPlan[] {
  const club: number[] = Array.isArray(rythme?.club) ? rythme.club.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  const match = Number.isInteger(rythme?.match) ? rythme.match : null;
  const saison = ["pre", "saison", "treve"].includes(rythme?.saison) ? rythme.saison : "saison";
  let liste = Array.isArray(jours) ? [...new Set(jours.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  if (liste.length !== freq) liste = ({ 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] } as Record<number, number[]>)[freq] || [1, 3, 5];
  liste.sort((a, b) => LUNDI_DABORD(a) - LUNDI_DABORD(b));

  const plan: JourPlan[] = liste.map((d) => {
    const avant = match === null ? null : (match - d + 7) % 7;
    const apres = match === null ? null : (d - match + 7) % 7;
    const memeJourClub = club.includes(d);
    let type = "";
    const notes: string[] = [];
    if (avant === 0) { type = "mobilite"; notes.push("JOUR DE MATCH : activation 20 min seulement (mobilite dynamique, gammes, 2-3 accelerations courtes), aucune fatigue"); }
    else if (apres === 1) { type = "mobilite"; notes.push("LENDEMAIN DE MATCH : recuperation complete de 35-45 min (velo ou footing tres leger 10-15 min, mobilite, etirements, respiration), aucun effort intense"); }
    else if (avant === 1) { type = "vitesse"; notes.push("VEILLE DE MATCH : activation de 30-35 min, vitesse et reactivite a faible volume, AUCUN renforcement lourd des jambes, aucun cardio long"); }
    else if (avant === 2) notes.push("J-2 DU MATCH : pas de jambes lourdes ni de cardio long, privilegie haut du corps, gainage, prevention");
    if (memeJourClub) notes.push("ENTRAINEMENT CLUB LE MEME JOUR : seance de 40 min maximum, pas de fractionne dur (le club fait deja du cardio)");
    else if (club.includes((d + 1) % 7)) notes.push("entrainement club le lendemain : pas d'epuisement des jambes");
    if (!notes.length) notes.push("jour libre, loin du match : c'est ici que vont les seances les plus exigeantes");
    return { jour: d, nomJour: NOMS_JOURS[d], type, contexte: notes.join(". ") };
  });

  // Les autres jours suivent le mélange du sport, les plus durs loin du match
  const mix = mixSaison(sport, saison);
  plan.filter((p) => p.type).forEach((p) => { const i = mix.indexOf(p.type); if (i >= 0) mix.splice(i, 1); });
  const libres = plan.filter((p) => !p.type);
  const distance = (p: JourPlan) => match === null ? 7 : Math.min((match - p.jour + 7) % 7, (p.jour - match + 7) % 7);
  const parDistance = [...libres].sort((a, b) => distance(b) - distance(a));
  parDistance.forEach((p, i) => { p.type = mix[i] || "renforcement"; });
  // Pas de cardio dur à J-2 du match : on l'échange avec une autre séance libre
  plan.forEach((p) => {
    if (p.type !== "cardio" || match === null || (match - p.jour + 7) % 7 !== 2) return;
    const autre = libres.find((q) => q !== p && q.type !== "cardio" && !club.includes(q.jour) && (match - q.jour + 7) % 7 > 2);
    if (autre) { p.type = autre.type; autre.type = "cardio"; } else p.type = "vitesse";
  });
  // Cardio dur le même jour que le club : on échange avec un renforcement si possible
  plan.forEach((p) => {
    if (p.type === "cardio" && club.includes(p.jour)) {
      const autre = plan.find((q) => q.type === "renforcement" && !club.includes(q.jour));
      if (autre) { autre.type = "cardio"; p.type = "renforcement"; }
    }
  });
  // Au moins un renforcement par semaine, s'il reste au moins 2 jours libres (sinon la priorité du sport passe avant)
  if (libres.length >= 2 && !plan.some((p) => p.type === "renforcement")) {
    const p = parDistance[0] || plan.find((q) => q.type !== "mobilite");
    if (p) p.type = "renforcement";
  }
  return plan;
}

// L'IA suit le plan : bon nombre de séances, bons types, échauffement et retour au calme présents
const TYPES_VALIDES = ["renforcement", "cardio", "vitesse", "mobilite"];
function imposerPlan(prog: any, plan: JourPlan[]) {
  const seances = prog?.semaines?.[0]?.seances;
  if (!Array.isArray(seances) || seances.length === 0) return prog;
  const liste = plan.map((p, i) => {
    const se = seances[i] || seances[i % seances.length];
    const type = TYPES_VALIDES.includes(p.type) ? p.type : TYPES_VALIDES.includes(se.type) ? se.type : "renforcement";
    const elements = (l: any) => (Array.isArray(l) ? l : []).filter((e: any) => e && e.nom).slice(0, 8)
      .map((e: any) => ({ nom: String(e.nom), conseil: e.conseil || "", ...(Number(e.travailSec) > 0 ? { travailSec: Math.round(Number(e.travailSec)) } : { reps: String(e.reps || "10") }) }));
    return {
      ...se,
      id: `s1j${i + 1}`,
      jour: i + 1,
      jourSemaine: p.jour,
      type,
      echauffement: elements(se.echauffement),
      retourCalme: elements(se.retourCalme),
      exercices: (Array.isArray(se.exercices) ? se.exercices : []).slice(0, 8).map((ex: any, j: number) => ({ ...ex, id: ex.id || `e${j + 1}` })),
    };
  });
  return { ...prog, semaines: [{ ...prog.semaines[0], seances: liste }] };
}

// ─────────────────────────────────────────────────────────────
// Fiches sport : ce que fait un vrai préparateur physique de club, sport par sport.
// Sources principales (novembre 2026) : Buchheit & Laursen (HIIT), FIFA 11+ et Nordic
// (ischios), Copenhagen (adducteurs), revue Antoranz 2024 (basket : programmes
// neuromusculaires), Kovacs / Fernandez-Fernandez (tennis : points 5-10 s, ratio 1:3 à 1:5),
// RHIE rugby (≥ 3 efforts, < 21 s de récup), revues dryland natation (sauts et force
// pour départs et virages, coiffe des rotateurs), Franchini (sports de combat),
// Jeffreys (échauffement RAMP), méta-analyse Eddens 2018 (force avant endurance).
// ─────────────────────────────────────────────────────────────
type FicheSport = { efforts: string; renforcement: string; cardio: string; vitesse: string; prevention: string; echauffement: string; retourCalme: string; cleSemaine?: string };
const FICHES_SPORT: Record<string, FicheSport> = {
  basketball: {
    efforts: "Match intermittent: des centaines de changements de direction, sprints de 2-3 s, 40 a 60 sauts, contacts au poste. Tout se joue sur les premiers pas, la detente repetee et la capacite a repeter les efforts.",
    renforcement: "Force des jambes (trap bar, squat, front squat, fentes arriere, split squat bulgare), chaine posterieure (RDL, hip thrust, nordic), mollets et pieds, unilateral obligatoire, pliometrie verticale ET laterale (CMJ, drop jump bas, bonds lateraux, skater jumps), gainage anti-rotation (pallof, carry unilateral), haut du corps pour les contacts (developpe, tractions, rowing).",
    cardio: "Sprints repetes multidirectionnels: 2-3 series de 6-8 x 15-20 m avec demi-tour, 20-25 s de recup, 3 min entre series. Navettes 'suicides' sur la largeur du terrain. Intermittent 15/15 ou 10/10 avec changements de direction a 100-110 % VMA, 2 blocs de 6-8 min. Circuits 'possession' 24 s d'effort / 36 s de recup. Pas chasses defensifs + sprint + saut en continu.",
    vitesse: "Premiers pas depuis la position defensive (pas court et explosif, pas de grand premier pas), acceleration wall drill, broad jump en appui decale, box drop + sprint 5 m, close-out (sprint puis freinage en pas chasses), departs avec pivot, sprint arriere puis avant, saut + sprint, pogos reactifs, reaction a un signal.",
    prevention: "Chevilles: equilibre unipodal (yeux fermes, instable), receptions de sauts tenues 2-3 s, mobilite et force de la cheville. Genoux/LCA: receptions genoux dans l'axe, fentes controlees, nordic, travail neuromusculaire en echauffement (la revue 2024 montre que c'est le plus efficace).",
    echauffement: "Footing et pas chasses, mobilite chevilles et hanches, activation fessiers (monster walk elastique), receptions de sauts, pogos, 2-3 accelerations courtes avec changement de direction.",
    retourCalme: "Mollets, quadriceps, flechisseurs de hanche, fessiers, bas du dos, respiration.",
  },
  football: {
    efforts: "10-12 km par match dont 20 a 40 sprints, beaucoup d'accelerations et de freinages, duels, frappes. Le foot est intermittent: il faut repeter les sprints et bien recuperer entre eux.",
    renforcement: "Force des jambes (squat, trap bar, split squat, step-up), ischios en excentrique (nordic, RDL, glissades), adducteurs (Copenhagen), hip thrust et fessiers, mollets, unilateral, gainage, haut du corps pour les duels (tractions, pompes, rowing). Pliometrie horizontale (broad jump, bonds).",
    cardio: "Intermittent court 15/15 ou 10/10 a 100-110 % VMA: 2-3 blocs de 6-8 min, 3 min de recup entre blocs. Intervalles longs 3-4 min a 90-95 % VMA (4 x 4 min). Sprints repetes: 2-3 series de 6 x 30 m, 20-25 s de recup. Courses 'box-to-box' (sprint de surface a surface puis retour en trottinant). Fartlek pour l'aerobie en pre-saison.",
    vitesse: "Echelle de rythme (appuis rapides), sprints 10-20-30 m, accelerations 10-20 m (departs debout, de dos, apres un saut), vitesse maximale lancee 20-30 m UNE fois par semaine au moins (la vitesse max protege les ischios), changements de direction 5-10-5, freinages, sauts horizontaux, reaction a un signal.",
    prevention: "Nordic hamstring (fait baisser fortement les blessures des ischios), Copenhagen plank (adducteurs), equilibre unipodal (chevilles), exercices du programme FIFA 11+ en echauffement (fentes, sauts lateraux, planche).",
    echauffement: "Footing avec ouvertures de hanche, mobilite hanches/adducteurs, exercices FIFA 11+ (fentes, sauts, planche laterale), gammes (talons-fesses, montees de genoux, pas chasses), 3 accelerations progressives.",
    retourCalme: "Ischios, quadriceps, adducteurs, flechisseurs de hanche, mollets, respiration.",
    cleSemaine: "Logique du foot (micro-cycle): la seance la plus lourde en force loin du match (J-4), l'endurance et la vitesse max a J-3, puis on allege (J-2, J-1 = vitesse courte et reactivite).",
  },
  tennis: {
    efforts: "Points de 5 a 10 s, 20-25 s de recup entre les points (ratio 1:3 a 1:5), matchs longs. Deplacements lateraux, freinages, rotations du tronc, frappes repetees: il faut une bonne base aerobie pour recuperer entre les points et de l'explosivite sur les 3-4 premiers pas.",
    renforcement: "Rotation du tronc (lancers de medball en rotation contre un mur, landmine rotation, cable woodchop), jambes unilaterales et laterales (fentes laterales, step-up, split squat), chaine posterieure (RDL, hip thrust), epaule (rotation externe, Y-T-W, face pull), avant-bras et poignet, gainage anti-rotation.",
    cardio: "Intermittent facon match: 10 s d'effort / 20 s de recup ou 15/25, en blocs de 6-8 min. Huit (figure-8) autour de deux plots, retour au centre apres chaque frappe simulee. Spider drill (5 plots, aller-retour depuis le centre). Couloirs: deplacements lateraux 15 s / 25 s. Repetitions de 25 s a fond / 20 s. Endurance continue 20-30 min (velo, footing) en pre-saison pour la recup entre les points.",
    vitesse: "Split-step + depart dans les 4 directions, echelle en pas lateraux, retour rapide au centre apres chaque frappe, premiers pas lateraux et croises, freinages en position basse, changements de direction 5 m, lancers de medball explosifs (rotation, coup droit, revers, au-dessus de la tete comme un service), sauts lateraux.",
    prevention: "Epaule: rotation externe a l'elastique, Y-T-W, travail des omoplates. Chevilles: montees sur pointes, equilibre (les entorses sont frequentes). Coude et poignet: excentriques du poignet. Dos: mobilite thoracique, gainage anti-rotation. Hanches et ischios: mobilite. Augmenter la charge progressivement (les pics de charge sont le premier facteur de blessure).",
    echauffement: "Corde a sauter ou pas chasses, mobilite epaules (cercles, elastique), rotations thoraciques, rotation externe a l'elastique, split-step et pas croises, 2-3 departs explosifs.",
    retourCalme: "Epaules (face posterieure), avant-bras, rotations douces du tronc, hanches, ischios, respiration.",
  },
  rugby: {
    efforts: "Sequences d'efforts repetes intenses (RHIE): au moins 3 sprints, plaquages ou rucks avec moins de 21 s de recup, 4 a 6 efforts par sequence. Beaucoup de contacts. Les avants poussent et plaquent, les arrieres sprintent plus.",
    renforcement: "Force maximale (squat, trap bar, developpe couche, tractions lestees, rowing), puissance (power clean ou hang clean si avance, kettlebell swing, sauts, lancers de medball), exercices de resistance avec partenaire du programme Activate de World Rugby, cou (isometrie dans les 4 directions), prehension (farmer walk), gainage pour les impacts, unilateral, nordic. Repos complets sur les gros mouvements (2-3 min).",
    cardio: "Circuits RHIE: sprint 20 m + plaquage d'un sac ou sprawl + se relever + sprint 10 m, 4 a 6 efforts enchaines, 1-2 min de recup, 3 a 5 series. Sprints repetes 6-8 x 30-40 m. Poussees de traineau. Intervalles longs 3 min pour la base aerobie en pre-saison. Releves du sol + sprint.",
    vitesse: "Accelerations 10-20 m, departs depuis le sol (a plat ventre, a genoux), sprints avec resistance (traineau, elastique), changements d'appui et crochets (arrieres), reaction.",
    prevention: "Cou: isometrie flexion/extension/laterale (un cou fort protege des commotions), epaules (rotation externe, Y-T-W), ischios (nordic), adducteurs (Copenhagen), apprendre a tomber et se relever.",
    echauffement: "Footing, mobilite hanches et epaules, isometrie du cou, activation fessiers, releves du sol, accelerations progressives, contacts legers (pousser un partenaire ou un sac).",
    retourCalme: "Cou (doux), pectoraux, epaules, ischios, quadriceps, hanches, respiration.",
  },
  natation: {
    efforts: "Le nageur nage deja avec son club: Voltra fait le travail HORS de l'eau (dryland). Les etudes montrent que la force, les sauts et le travail balistique ameliorent les departs et les virages, et que le renforcement de la coiffe des rotateurs protege l'epaule.",
    renforcement: "Tirage (tractions, lat pulldown, rowing), poussee (developpe halteres, pompes), triceps, rotateurs externes, jambes et sauts pour le depart et les virages (squat, trap bar, box jump, broad jump), hip hinge, gainage anti-extension et rotationnel (planche, dead bug, pallof, russian twist, battements sur le dos en position de coulee 30 s), lancers de medball au-dessus de la tete et vers le sol.",
    cardio: "Hors de l'eau et a faible impact: rameur et ski erg (meme gestuelle de tirage), velo, corde a sauter. Fractionne 30/30 ou 1 min / 1 min, blocs de 6-10 min. Endurance 20-30 min a allure facile. Circuits epaules/gainage en continu.",
    vitesse: "Sauts pour le depart (squat jump, broad jump pour ne pas plonger trop bas, box jump), streamline squat jumps (sauts bras tendus en position de coulee), lancers de medball explosifs (au-dessus de la tete, vers le sol), sauts depuis l'accroupi (comme un virage).",
    prevention: "Epaule: band pull-aparts, rotation externe a l'elastique, face pull, Y-T-W, pompes scapulaires (serratus), pas plus de 5 exercices d'epaule, courts et reguliers. Bas du dos (bird dog). Mobilite thoracique et des chevilles (pour les battements).",
    echauffement: "Rameur ou corde a sauter, cercles d'epaules, mobilite thoracique, rotation externe a l'elastique, activation des omoplates, quelques sauts.",
    retourCalme: "Grand dorsal, pectoraux, epaules en douceur, triceps, hanches, respiration.",
  },
  sprint: {
    efforts: "Courses tres courtes a vitesse maximale: acceleration (0-30 m) puis vitesse maximale (30-60 m). Le 200 m demande en plus de l'endurance de vitesse, le 400 m de l'endurance speciale (lactique).",
    renforcement: "Force maximale (squat, trap bar, hip thrust, step-up), chaine posterieure (RDL, nordic, ponts unipodaux), mollets et pieds (montees sur pointes, pliometrie basse), unilateral, gainage. Pliometrie: bonds, drop jumps, sauts de haies, hops. Peu de volume, beaucoup de qualite, repos complets.",
    cardio: "Tempo runs: 6-10 x 100 m a 65-75 %, 45 s de marche (ameliore la recuperation sans casser la vitesse). Pour le 400 m: endurance speciale 2-4 x 150-300 m a 90-95 % avec 8-15 min de recup. Pas de longs footings.",
    vitesse: "Gammes (A-skip, B-skip, jambes tendues griffees, montees de genoux, talons-fesses), wickets (mini-haies espacees pour le rythme, bassin haut), departs (3 appuis, accroupi, en chute), accelerations 10-30 m, sprints au traineau (10-20 m), sprints lances 20-30 m (flying), bonds alternes, sprints en cote. 150-300 m de sprint au total par seance, 2-4 min de recup.",
    prevention: "Ischios en excentrique (nordic, RDL, glissades), mollets et tendon d'Achille (excentriques sur une marche), adducteurs, mobilite des hanches. La plupart des blessures des ischios arrivent en sprintant: exposer regulierement a la vitesse max protege.",
    echauffement: "Footing, mobilite dynamique hanches et chevilles, gammes athletiques, activation fessiers, accelerations progressives 60-80-90 %.",
    retourCalme: "Ischios, flechisseurs de hanche, quadriceps, mollets, respiration.",
  },
  combat: {
    efforts: "Rounds intenses (boxe 3 min / 1 min, MMA 5 min, judo 4 min) avec des efforts explosifs repetes et des lactates tres eleves, portes par une bonne base aerobie. Il faut de la puissance, de l'explosivite et la capacite a tenir les rounds.",
    renforcement: "Force et puissance (trap bar, squat, developpe, tractions, rowing), d'abord mobilite et force en rotation puis puissance en rotation (medball de 3-6 kg: slam en rotation, lancer lateral contre un mur, woodchop; landmine punch), prehension (tractions avec serviette ou kimono, farmer walk) surtout pour judo et jiu-jitsu, cou (isometrie), gainage. Garder des repos complets sur la force (pas de circuit sur les exercices lourds).",
    cardio: "Rounds: shadow, sac, corde a sauter (2-3 min d'effort, 1 min de repos, 3 a 6 rounds). Intervalles courts 30/30, 20/10, 5 s explosif / 10 s actif au sac. Burpees + sprawls en rounds. Une sortie aerobie facile de 30-40 min par semaine en pre-saison.",
    vitesse: "Lancers de medball explosifs (rotation, poitrine), sauts, sprints courts, reaction a un signal, enchainements tres rapides de 5-10 s.",
    prevention: "Cou (isometrie dans les 4 directions), epaules (rotation externe), poignets et mains pour les frappeurs, genoux et hanches pour les lutteurs, mobilite des hanches (90/90).",
    echauffement: "Corde a sauter, shadow leger, mobilite epaules/hanches/cou, isometrie du cou, activation, quelques enchainements explosifs.",
    retourCalme: "Epaules, pectoraux, hanches, cou en douceur, respiration.",
  },
};
// Postes et disciplines : précisions qui priment sur la fiche du sport
const FICHES_POSTE: Record<string, string> = {
  boxe_anglaise: "Boxe anglaise: rounds de 3 min. Cardio = shadow boxing en rounds (jab-direct, esquives, deplacements), sac de frappe, corde a sauter en rounds, intervalles 5 s de coups explosifs / 10 s d'esquives. Puissance des poings: lancers de medball poitrine et rotation, landmine punch.",
  boxe_francaise: "Boxe francaise: pieds-poings. Shadow pieds-poings en rounds, chasses et fouettes enchaines, corde a sauter, mobilite et force des hanches et ischios, equilibre unipodal.",
  boxe_thai: "Boxe thai: rounds de 3 min, coups de genou et de coude. Shadow pieds-poings-genoux, genoux repetes au sac, clinch (isometrie du haut du corps), mollets et tibias, cou.",
  mma: "MMA: rounds de 5 min, debout et au sol. Rounds melant shadow, sprawls, releves du sol, frappes au sol sur un sac, lutte. Force de tirage et de prehension, cou, hanches.",
  judo: "Judo: combats de 4 min, grip decisif. Uchi-komi a l'elastique en fractionne (facon randori 20/10), tractions kimono ou serviette, tirages, force des jambes et des hanches, gainage, travail de prehension 1-2 fois par semaine sans exces (tendons).",
  jiu_jitsu: "Jiu-jitsu bresilien: rounds de 5 min au sol. Crevettes (shrimps), releves techniques, bear crawl, sprawls, prehension (serviette, kimono), force des hanches et du cou, gainage.",
  meneur: "Meneur: vitesse, changements de direction, endurance intermittente.",
  pivot: "Pivot: force, contacts au poste, detente repetee pour les rebonds.",
  gardien: "Gardien: explosivite laterale, plongeons et relevers, detente, reaction, peu de cardio long.",
  defenseur: "Defenseur: force, duels aeriens, detente, accelerations courtes.",
  milieu: "Milieu: endurance intermittente et sprints repetes en priorite.",
  attaquant: "Attaquant: vitesse maximale, accelerations, changements de direction.",
  pilier: "Pilier / talonneur: force maximale, poussees, cou, efforts de contact repetes.",
  troisieme_ligne: "3e ligne: force + endurance, plaquages et releves repetes.",
  demi: "Demi: agilite, accelerations, endurance intermittente.",
  trois_quarts: "Trois-quarts: vitesse maximale, crochets, accelerations.",
  arriere: "Arriere: vitesse maximale, jeu au pied, reception, accelerations longues.",
  fond_de_court: "Joueur de fond de court: endurance intermittente, deplacements lateraux, regularite.",
  serve_volley: "Serveur-volleyeur: explosivite, premiers pas vers l'avant, epaule.",
  "60m": "60 m / 100 m: acceleration et vitesse maximale, tres peu de cardio long.",
  "200m": "200 m: vitesse maximale + endurance de vitesse (repetitions de 100-150 m).",
  "400m": "400 m: endurance speciale (150-300 m a 90-95 %, recuperation longue) + vitesse.",
};

// Règles de préparateur communes à tous les sports
const REGLES_COACH = `REGLES DE PREPARATEUR PHYSIQUE (a appliquer partout):
- ECHAUFFEMENT facon RAMP: 1) monter en temperature (4-5 min de cardio leger propre au sport), 2) mobilite dynamique + activation + 1-2 exercices de PREVENTION du sport, 3) potentialisation: 2-3 exercices progressifs (accelerations, sauts, lancers) qui preparent le corps de la seance.
- DANS UNE SEANCE: vitesse et explosivite d'abord (frais), puis force, puis cardio. Jamais de cardio intense avant de la force lourde.
- FORCE: repos 2-3 min sur les exercices lourds et explosifs, 60-90 s sur les accessoires. Pas de circuit sur les exercices lourds.
- PLIOMETRIE: debutant 60-80 contacts au sol par seance, intermediaire 80-100, avance 100-120. Qualite avant quantite.
- VITESSE: toujours frais, juste apres l'echauffement, recuperation complete (environ 1 min par 10 m de sprint).
- FRACTIONNE (Buchheit & Laursen): court 10/10 ou 15/15 a 100-110 % VMA en blocs de 6-8 min avec 3 min de recup; long 3-4 min a 90-95 % VMA avec 2-3 min de recup; sprints repetes de 6 s max, 6-10 repetitions, 20-25 s de recup.
- Chaque exercice a une vraie consigne (allure, sensations, technique) dans "conseil" ou "intensite".`;

const SAISONS: Record<string, string> = {
  pre: "PRE-SAISON : on construit. Volume eleve, force et cardio developpes. Seances d'environ 45 min, denses (repos bien geres).",
  saison: "EN SAISON : on entretient et on reste frais pour les matchs, mais les seances restent completes. Seances d'environ 45 min (sauf veille et lendemain de match, plus courtes).",
  treve: "TREVE : on garde la forme et on corrige les points faibles. Cardio aerobie, renforcement general, mobilite. Seances d'environ 45 min.",
};

const TYPES_SEANCE: Record<string, string> = {
  renforcement: "RENFORCEMENT (6 a 8 exercices): 1-2 explosifs (sauts, lancers), 2-3 gros mouvements de force, 2-3 accessoires/unilateral propres au sport, 1-2 prevention ou gainage. Environ 45 min avec l'echauffement.",
  cardio: "CARDIO (5 a 7 exercices): 2 blocs de fractionne DIFFERENTS et propres au sport (voir la fiche du sport), puis un circuit de 3-4 exercices au poids du corps et gainage. Environ 45 min avec l'echauffement.",
  vitesse: "VITESSE & EXPLOSIVITE (6 a 8 exercices): gammes, departs varies, sprints courts, changements de direction ou agilite, 2-3 exercices de pliometrie, 1-2 lancers de medball, 1 gainage. Recuperation complete. Environ 45 min avec l'echauffement.",
  mobilite: "MOBILITE & RECUPERATION (6 a 8 exercices): cardio tres leger 5-8 min, mobilite des hanches, chevilles, epaules et colonne, etirements actifs des muscles du sport, prevention legere, gainage doux, respiration. Aucun effort intense. 35 a 40 min.",
};

// Le mot de la competition selon le sport : un boxeur fait des combats, un nageur des courses
const COMPETITIONS: Record<string, { nom: string; pl: string }> = {
  combat: { nom: "combat", pl: "combats" },
  natation: { nom: "course", pl: "courses" },
  sprint: { nom: "course", pl: "courses" },
};
function vocabulaire(texte: string, sport: string): string {
  const c = COMPETITIONS[sport];
  if (!c) return texte;
  return texte.replace(/\bMATCHS\b/g, c.pl.toUpperCase()).replace(/\bMATCH\b/g, c.nom.toUpperCase())
    .replace(/\bmatchs\b/g, c.pl).replace(/\bmatch\b/g, c.nom).replace(/\bMatch\b/g, c.nom[0].toUpperCase() + c.nom.slice(1))
    + `\nVOCABULAIRE: pour ce sport on dit "${c.nom}" (pluriel "${c.pl}"), JAMAIS "match", dans les titres, objectifs, conseils et intensites.`;
}

function buildPrompt({ sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille, plan, rythme }: any) {
  const startCycle = cycle || 1;
  const freq = plan.length;

  const equipementConfig: Record<string, { desc: string; nb: string; sets: string }> = {
    salle_complete: { desc: "salle complete (barres, halteres, kettlebells, machines, poulies)", nb: "6-7 exos", sets: "3-4 series" },
    salle_basique: { desc: "salle basique : barres, halteres, kettlebells, banc. PAS de machines ni poulies", nb: "6-7 exos", sets: "3-4 series" },
    maison: { desc: "MAISON poids du corps SEUL, INTERDIT halteres/barres/machines", nb: "6-7 exos", sets: "2-3 series" },
    terrain: { desc: "EXTERIEUR poids du corps SEUL, INTERDIT halteres/barres/machines", nb: "6-7 exos", sets: "2-3 series" },
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

  const fiche = FICHES_SPORT[sport];
  const ficheTexte = fiche
    ? `FICHE ${sport.toUpperCase()} (a suivre de pres):
- Exigences: ${fiche.efforts}
- Renforcement: ${fiche.renforcement}
- Cardio: ${fiche.cardio}
- Vitesse: ${fiche.vitesse}
- Prevention: ${fiche.prevention}
- Echauffement type: ${fiche.echauffement}
- Retour au calme: ${fiche.retourCalme}${fiche.cleSemaine ? `\n- Semaine: ${fiche.cleSemaine}` : ""}${poste && FICHES_POSTE[poste] ? `\n- POSTE/DISCIPLINE (prioritaire): ${FICHES_POSTE[poste]}` : ""}`
    : "FICHE: force generale, puissance, endurance intermittente, prevention chevilles/genoux/epaules.";

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

  const cardioMateriel: Record<string, string> = {
    salle_complete: "rameur, velo, tapis de course, ski erg, corde a sauter",
    salle_basique: "corde a sauter, burpees, montees de genoux, course dehors si possible",
    maison: "corde a sauter, burpees, montees de genoux, jumping jacks, mountain climbers, shadow",
    terrain: "course (fractionne, navettes, cotes), corde a sauter",
  };
  const cardioTexte = `MATERIEL CARDIO disponible: ${cardioMateriel[equipement] || cardioMateriel.terrain}${sport === "natation" ? " (le nageur nage deja au club: cardio HORS de l'eau)" : ""}. Adapte les formats de la fiche a ce materiel.`;
  const saisonCle = ["pre", "saison", "treve"].includes(rythme?.saison) ? rythme.saison : "saison";
  const clubJours = Array.isArray(rythme?.club) ? rythme.club.filter((d: any) => d >= 0 && d <= 6) : [];
  const matchJour = Number.isInteger(rythme?.match) ? rythme.match : null;
  const chargeClub = clubJours.length + (matchJour !== null ? 1 : 0);
  const rythmeTexte = `CLUB: ${clubJours.length ? `entrainement le ${clubJours.map((d: number) => NOMS_JOURS[d]).join(", ")}` : "aucun entrainement de club indique"}${matchJour !== null ? `, match le ${NOMS_JOURS[matchJour]}` : ""}.${chargeClub + freq >= 6 ? " SEMAINE CHARGEE : seances Voltra un peu plus courtes (35-40 min) et intensite maitrisee, mais toujours completes." : ""}`;
  const planTexte = plan.map((p: JourPlan, i: number) => `- Seance ${i + 1} (jour ${i + 1}, ${p.nomJour}) : type "${p.type}". ${p.contexte}.`).join("\n");
  const typesUtilises = [...new Set(plan.map((p: JourPlan) => p.type))].map((t) => TYPES_SEANCE[t as string]).join("\n");

  const niv = String(niveau || "").toLowerCase();
  const machinesTexte = equipement === "salle_complete"
    ? `MACHINES OBLIGATOIRES: chaque seance de RENFORCEMENT contient ${niv.startsWith("deb") ? "2" : "1 a 2"} exercices sur machine (materiel "machine"), jamais en premier: d'abord explosif et gros mouvement libre, puis machines. Varie les machines sur la semaine et choisis-les utiles au sport et coherentes avec les contraintes blessures. Noms exacts a utiliser: ${MACHINES_SALLE.join(", ")}. Autorise, au plus 1 par semaine et en fin de seance (materiel "poids_du_corps", chargeKg 0): ${CROSS_SALLE.join(", ")}.`
    : "";
  const niveauTexte = niv.startsWith("deb")
    ? "NIVEAU DEBUTANT: exercices simples et stables (goblet squat, halteres, machines si dispo), pas de mouvements olympiques ni de pliometrie a fort impact, 2-3 series, charges legeres (RPE 6-7). Cardio progressif, fractionne modere."
    : niv.startsWith("inter")
      ? "NIVEAU INTERMEDIAIRE: mouvements polyarticulaires a la barre autorises, pliometrie moderee, RPE 7-8."
      : "NIVEAU AVANCE: contraste force/vitesse, variantes unilaterales chargees, pliometrie intense, RPE 8-9.";

  return `Tu prepares UN athlete de club en ${sport}. Programme de preparation physique d'un vrai club, pas de la musculation.

ATHLETE: ${sport}, obj=${objectif}, niv=${niveau}, freq=${freq} seances Voltra/sem, cycle=${startCycle}${poste ? `, poste=${poste}` : ""}${poidsValide ? `, poids=${poidsNum}kg` : ""}${tailleValide ? `, taille=${tailleNum}cm` : ""}${ageValide ? `, age=${ageNum}` : ""}
REPS/CHARGES pour l'objectif: ${schemaReps}
${SAISONS[saisonCle]}
${rythmeTexte}

${ficheTexte}

SEMAINE (types imposes):
${planTexte}

${typesUtilises}
${cardioTexte}

${REGLES_COACH}

SEANCES LONGUES ET BIEN REMPLIES: respecte le nombre d'exercices et la duree de chaque type. Une seance legere avec peu d'exercices est un echec.
CHAQUE SEANCE = "echauffement" (8-10 min, 5-6 elements, facon RAMP, avec la prevention du sport) + "exercices" (le corps de la seance) + "retourCalme" (5 min, 4-5 elements: retour au calme cardio, etirements des muscles travailles, respiration).

CYCLE ${startCycle}: ${cycleProfile}
${niveauTexte}
MATERIEL: ${c.desc}. Renforcement: ${c.nb}, ${c.sets}.
${machinesTexte}
${chargesTexte}
${morphoTexte}
${ageTexte}
${douleursTexte}

FORMAT DES EXERCICES:
RENFORCEMENT et VITESSE: nom = nom ANGLAIS standard de base d'exercices, materiel en premier (ex: "barbell full squat", "dumbbell goblet squat", "dumbbell bench press", "kettlebell swing", "box jump", "body weight squat", "cable pallof press", "sprint", "medicine ball rotational throw"). Pas de nom invente. Sprints et sauts: reps = distance ou nombre ("20 m", "5"), materiel "poids_du_corps" (ou "medball"), chargeKg 0, repos 60-180 s.
CARDIO et MOBILITE: nom FRANCAIS clair, materiel "cardio" ou "mobilite", chargeKg 0, "travailSec" = duree d'un bloc en secondes, "sets" = nombre de blocs, "reposSec" = recuperation entre blocs, "reps" = texte court ("30 s", "3 min"), "intensite" = consigne d'allure simple ("Vite, 90 % de ta VMA", "Facile, tu peux parler"). Endurance continue: sets 1, travailSec = duree totale. Mobilite: travailSec 30-60 par element, sets 1-2, reposSec 10-15. muscles = "Cardio" ou "Mobilite" + zone.
ECHAUFFEMENT / RETOURCALME: noms FRANCAIS, chaque element a soit "travailSec" (duree) soit "reps" (texte), et un "conseil" court. Pas de charge.
materiel = un de: "barre", "halteres", "kettlebell", "machine", "poulie", "medball", "elastique", "poids_du_corps", "cardio", "mobilite".
titre/muscles/conseil francais courts. "objectif" = une phrase qui dit a quoi sert la seance pour le sport. Le conseil donne LE point technique cle. Pour l'exercice de renforcement blessure, precise dans "conseil" pourquoi.
dureeMin = duree totale realiste, echauffement et retour au calme compris.`;
}

// Consigne pour UNE séance : chaque séance est demandée séparément (en parallèle) pour qu'elle soit complète
function consigneSeance(plan: JourPlan[], i: number) {
  const p = plan[i];
  const autres = plan.filter((_, j) => j !== i).map((q) => `${q.nomJour} ${q.type}`).join(", ") || "aucune";
  return `

GENERE UNIQUEMENT LA SEANCE ${i + 1} : ${p.nomJour}, type "${p.type}". ${p.contexte}.
Les autres seances Voltra de la semaine (deja prevues, ne les repete pas, sois complementaire): ${autres}.
JSON strict, un seul objet, compact, sans texte autour:
{"type":"${p.type}","titre":"court","objectif":"une phrase","dureeMin":45,"echauffement":[{"nom":"Footing leger","travailSec":240,"conseil":"court"},{"nom":"Fentes marchees","reps":"8 par jambe","conseil":"court"}],"exercices":[{"id":"e1","nom":"box jump","materiel":"poids_du_corps","muscles":"Quadriceps Fessiers","sets":3,"reps":"5","chargeKg":0,"reposSec":120,"ordre":1,"conseil":"court"},{"id":"e2","nom":"Fractionne 15/15","materiel":"cardio","muscles":"Cardio","sets":16,"travailSec":15,"reposSec":15,"reps":"15 s","intensite":"Vite, 100 % de ta VMA","ordre":2,"conseil":"court"}],"retourCalme":[{"nom":"Etirement des ischios","travailSec":40,"conseil":"court"}]}`;
}

// Demande une séance à l'IA et lit le JSON renvoyé
async function demanderSeance(prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const brut = data.content?.map((b: any) => b.text || "").join("") ?? "";
  const morceau = brut.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!morceau) throw new Error("JSON invalide");
  const seance = JSON.parse(morceau[0]);
  if (!Array.isArray(seance?.exercices) || seance.exercices.length === 0) throw new Error("Seance vide");
  return seance;
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

    const body = await req.json();
    const { sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille, jours, rythme } = body;
    const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Séance de dépannage : une seule séance, tout de suite, avec le matériel dispo maintenant. Rien n'est enregistré ici.
    if (body.mode === "depannage") {
      if (!sport) return json({ error: "Paramètres manquants" }, 400);
      const { data: profilPro } = await supabase.from("profiles").select("is_pro").eq("id", user.id).maybeSingle();
      if (!profilPro?.is_pro) return json({ error: "Réservé aux abonnés" }, 403);
      const materiel: string[] = Array.isArray(body.materiel) ? body.materiel.map((m: unknown) => String(m).slice(0, 40)).slice(0, 12) : [];
      const dureeMin = [20, 30, 45].includes(Number(body.duree)) ? Number(body.duree) : 30;
      const lourds = materiel.some((m) => /halteres|kettlebell|salle/.test(m));
      const type = TYPES_VALIDES.includes(body.type) ? body.type : lourds ? "renforcement" : "cardio";
      const aujourdhui = new Date().getDay();
      const volume = dureeMin <= 20 ? "3-4 exercices, echauffement 4 min, retour au calme 2 min" : dureeMin <= 30 ? "4-5 exercices, echauffement 6 min, retour au calme 3 min" : "5-7 exercices";
      const planD: JourPlan[] = [{
        jour: aujourdhui, nomJour: NOMS_JOURS[aujourdhui], type,
        contexte: `SEANCE DE DEPANNAGE, prioritaire sur les durees et le materiel indiques plus haut: ${dureeMin} min TOUT COMPRIS (${volume}). Materiel disponible maintenant, et RIEN d'autre: ${materiel.length ? materiel.join(", ") : "aucun, poids du corps seul"}. Reste specifique au sport`,
      }];
      const equipD = materiel.includes("salle") ? "salle_complete" : lourds ? "salle_basique" : "maison";
      const ctx = buildPrompt({ sport, objectif: objectif || "performance", niveau: niveau || "intermediaire", frequence: 1, cycle: 1, equipement: equipD, douleurs, poste, poids, age, taille, plan: planD, rythme: null });
      const brute = await demanderSeance(vocabulaire(ctx + consigneSeance(planD, 0), sport));
      const poidsD = Number(poids), ageD = Number(age);
      const profilD: Profil = { poids: poidsD >= 30 && poidsD <= 250 ? poidsD : null, niveau: niveau || "intermediaire", age: ageD >= 12 && ageD <= 90 ? ageD : null, cycle: Number(cycle) || 1, avecCharges: lourds };
      const progD = securiserProgramme(imposerPlan({ semaines: [{ numero: 1, seances: [brute] }] }, planD), profilD);
      return json({ seance: { ...progD.semaines[0].seances[0], id: `depannage_${Date.now()}`, depannage: true, dureeMin } });
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

    if (!sport || !objectif || !niveau || !frequence) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5 séances par semaine au plus : avec le club, au-delà on se blesse
    const freq = Math.min(Math.max(Number(frequence) || 3, 1), 5);
    const plan = planifierSemaine(sport, jours, rythme, freq);

    // Une demande à l'IA par séance, toutes en même temps : chaque séance est longue et complète
    const contexte = buildPrompt({ sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille, plan, rythme });
    const seances = await Promise.all(plan.map(async (_p, i) => {
      try { return await demanderSeance(vocabulaire(contexte + consigneSeance(plan, i), sport)); }
      catch (e) { console.error(`Seance ${i + 1}, nouvel essai:`, (e as Error).message); return await demanderSeance(vocabulaire(contexte + consigneSeance(plan, i), sport)); }
    }));
    let programme: any = {
      meta: { sport, objectif, niveau, frequence: freq, cycle: cycle || 1, startCycle: cycle || 1, totalSemaines: 4 },
      semaines: [{ numero: 1, theme: "S1", seances }],
    };

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
    programme = imposerPlan(programme, plan);
    if (equipement === "salle_complete") programme = garantirMachines(programme, Array.isArray(douleurs) ? douleurs : []);
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
        data_json: { ...programme, cycle: startCycle, startCycle, niveau, frequence, objectif, equipement, douleurs, poste, jours: plan.map((p) => p.jour), rythme: rythme || null }
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
