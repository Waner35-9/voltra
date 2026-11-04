// @ts-nocheck
import { Fragment, useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Lien de confirmation d'email : on lit l'URL tout de suite, avant que Supabase ne la nettoie
const URL_AU_CHARGEMENT = window.location.hash + window.location.search;
let confirmationEmail = /type=signup|confirmed=true/.test(URL_AU_CHARGEMENT) ? "ok"
  : /error_code=/.test(URL_AU_CHARGEMENT) && !/type=recovery/.test(URL_AU_CHARGEMENT) ? "erreur"
  : null;

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getNiveauCycle(niveau) {
  if (!niveau) return 1;
  const n = niveau.toLowerCase();
  if (n === "avance" || n === "avancé") return 3;
  if (n === "intermediaire" || n === "intermédiaire") return 2;
  return 1;
}

async function generateProgramIA({ sport, objectif, niveau, frequence, cycle, equipement, douleurs, poste, poids, age, taille }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Pas de session");
  const startCycle = cycle || getNiveauCycle(niveau);
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-program`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ sport, objectif, niveau, frequence, cycle: startCycle, startCycle, equipement, douleurs, poste, poids, age, taille }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur generation");
  return data.programme;
}

const DAY_OPTIONS = [{ i: 1, l: "Lun" }, { i: 2, l: "Mar" }, { i: 3, l: "Mer" }, { i: 4, l: "Jeu" }, { i: 5, l: "Ven" }, { i: 6, l: "Sam" }, { i: 0, l: "Dim" }];
const DAY_NAMES = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
const DEFAULT_JOURS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };

// ─────────────────────────────────────────────
// Garde-fous de charges (mêmes règles que la fonction serveur generate-program) :
// corrige aussi les programmes créés avant (ex. 90 kg d'haltères par main).
// Haltères et kettlebells : charge PAR MAIN / par unité.
// ─────────────────────────────────────────────
const RATIOS_CHARGE = {
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

function detecterMateriel(ex) {
  const m = String(ex.materiel || "").toLowerCase();
  const n = `${ex.nomEn || ""} ${ex.nom || ""}`.toLowerCase();
  if (/medicine ball|med ball|medball/.test(n) || m === "medball") return "medball";
  if (/kettlebell|\bkb\b/.test(n) || m === "kettlebell") return "kettlebell";
  if (/dumbbell|\bdb\b|halt[eè]re/.test(n) || m === "halteres" || m === "haltere") {
    return /goblet|single dumbbell|one dumbbell|hip thrust|glute bridge/.test(n) ? "haltere_unique" : "halteres";
  }
  if (/cable|pulley|poulie/.test(n) || m === "poulie") return "poulie";
  if (/machine|leg press|lever|smith|hack squat|leg extension|leg curl|pec deck|presse/.test(n) || m === "machine") return "machine";
  if (/barbell|trap bar|hex bar|ez bar|\bbar\b|barre/.test(n) || m === "barre") return "barre";
  if (/weighted|lest/.test(n)) return "halteres";
  if (SANS_CHARGE.test(n) || m === "poids_du_corps" || m === "elastique") return "poids_du_corps";
  return m || "inconnu";
}

function detecterMouvement(ex) {
  const n = `${ex.nomEn || ""} ${ex.nom || ""}`.toLowerCase();
  if (/leg press|presse/.test(n)) return "legpress";
  if (/clean|snatch|jerk|epaul|arrach/.test(n)) return "olympic";
  if (/swing/.test(n)) return "swing";
  if (/hip thrust|glute bridge/.test(n)) return "thrust";
  if (/lunge|split squat|step[- ]?up|fente/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/deadlift|rdl|romanian|good morning|hinge|soulev/.test(n)) return "hinge";
  if (/bench|chest press|floor press|couch/.test(n)) return "bench";
  if (/overhead|shoulder press|military|push press|arnold|militaire/.test(n)) return "ohp";
  if (/row|pulldown|pull-down|rowing|tirage/.test(n)) return "row";
  if (/curl/.test(n)) return "curl";
  if (/raise|fly|flye|[eé]l[eé]vation/.test(n)) return "raise";
  return "defaut";
}

function securiserExercice(ex, p) {
  const materiel = detecterMateriel(ex);
  const mouvement = detecterMouvement(ex);
  const lvl = /^av/.test(String(p.niveau || "").toLowerCase()) ? 2 : /^inter/.test(String(p.niveau || "").toLowerCase()) ? 1 : 0;
  let max;
  if (!p.avecCharges || materiel === "poids_du_corps") max = 0;
  else if (materiel === "medball") max = [4, 6, 8][lvl];
  else {
    const table = RATIOS_CHARGE[materiel] || RATIOS_CHARGE.halteres;
    const poids = p.poids >= 30 && p.poids <= 250 ? p.poids : 65;
    const age = p.age || 25;
    const reps = Number((String(ex.reps ?? "").match(/\d+/) || [8])[0]);
    max = poids * (table[mouvement] || table.defaut)[lvl]
      * (age < 16 ? 0.7 : age < 18 ? 0.85 : age >= 55 ? 0.85 : 1)
      * (1 + Math.min(Math.max((p.cycle || 1) - 1, 0), 3) * 0.05)
      * (reps >= 15 ? 0.7 : reps >= 10 ? 0.85 : 1)
      * 1.1; // marge pour la semaine 3 (+10 %)
  }
  let charge = Number(ex.chargeKg) || 0;
  if (max === 0) charge = 0;
  else if (charge <= 0) charge = max * 0.7;
  else charge = Math.min(charge, max);
  if (charge > 0) {
    if (materiel === "kettlebell") charge = [...KETTLEBELLS].reverse().find(k => k <= charge) ?? 4;
    else if (materiel === "medball") charge = [...MEDBALLS].reverse().find(k => k <= charge) ?? 2;
    else if (materiel === "halteres" || materiel === "haltere_unique") charge = Math.max(2, Math.floor(charge / 2) * 2);
    else if (materiel === "machine") charge = Math.max(5, Math.floor(charge / 5) * 5);
    else if (materiel === "barre") charge = Math.max(mouvement === "curl" ? 10 : 20, Math.floor(charge / 2.5) * 2.5);
    else charge = Math.max(2.5, Math.floor(charge / 2.5) * 2.5);
  }
  return { ...ex, chargeKg: charge, materiel, chargeUnite: materiel === "halteres" ? "par main" : (ex.chargeUnite || "") };
}

// Enregistre les jours d'entrainement choisis dans le programme
async function attachJours(prog, jours) {
  if (!prog?.id || !jours?.length) return prog;
  const dj = { ...(prog.data_json || {}), jours };
  try { await supabase.from("programmes").update({ data_json: dj }).eq("id", prog.id); } catch (e) { console.error(e); }
  return { ...prog, data_json: dj };
}

// Selecteur de jours (max = nombre de seances par semaine)
function DayPicker({ jours, max, onChange, accent }) {
  const toggle = (i) => {
    if (jours.includes(i)) onChange(jours.filter(d => d !== i));
    else if (jours.length < max) onChange([...jours, i]);
    else onChange([...jours.slice(1), i]);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        {DAY_OPTIONS.map(d => {
          const on = jours.includes(d.i);
          return (
            <div key={d.i} onClick={() => toggle(d.i)} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRadius: 12, cursor: "pointer", background: on ? accent : DS.colors.surfaceHigh, color: on ? "#000" : DS.colors.textSec, border: `1px solid ${on ? accent : DS.colors.border}`, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, transition: "var(--t-choix)" }}>{d.l}</div>
          );
        })}
      </div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: jours.length === max ? accent : DS.colors.textSec, textAlign: "center", marginTop: 10 }}>
        {jours.length === max ? "✓ Jours choisis" : `Choisis ${max - jours.length} jour${max - jours.length > 1 ? "s" : ""} de plus`}
      </p>
    </div>
  );
}

// Titre + sous-titre d'une étape d'onboarding
function StepTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.02em", color: DS.colors.textPrimary, marginBottom: 8 }}>{title}</h1>
      {sub && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, lineHeight: 1.5, color: DS.colors.textSec }}>{sub}</p>}
    </div>
  );
}

// Roue de sélection (style iOS) : on fait défiler, la valeur au centre est choisie
const WHEEL_ITEM = 48;
function WheelPicker({ values, value, onChange, format = v => v }) {
  const ref = useRef(null);
  const [live, setLive] = useState(Math.max(0, values.indexOf(value)));
  useEffect(() => { if (ref.current) ref.current.scrollTop = live * WHEEL_ITEM; }, []);
  const onScroll = () => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(ref.current.scrollTop / WHEEL_ITEM)));
    if (i !== live) { setLive(i); onChange(values[i]); }
  };
  const H = WHEEL_ITEM * 5;
  const mask = "linear-gradient(transparent, #000 35%, #000 65%, transparent)";
  return (
    <div style={{ position: "relative", height: H, width: "100%", maxWidth: 240, margin: "0 auto" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: (H - WHEEL_ITEM) / 2, height: WHEEL_ITEM, borderRadius: 16, background: DS.colors.surface, border: `1.5px solid ${DS.colors.borderAccent}`, boxShadow: DS.shadow.card }} />
      <div ref={ref} onScroll={onScroll} style={{ position: "relative", height: H, overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none", WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ height: (H - WHEEL_ITEM) / 2 }} />
        {values.map((v, i) => {
          const d = Math.abs(i - live);
          return (
            <div key={v} onClick={() => ref.current.scrollTo({ top: i * WHEEL_ITEM, behavior: "smooth" })} style={{ height: WHEEL_ITEM, scrollSnapAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums", fontSize: d === 0 ? 26 : 20, fontWeight: d === 0 ? 800 : 500, color: d === 0 ? DS.colors.textPrimary : DS.colors.textSec, transition: "font-size 0.15s ease, color 0.15s ease" }}>
              {format(v)}
            </div>
          );
        })}
        <div style={{ height: (H - WHEEL_ITEM) / 2 }} />
      </div>
    </div>
  );
}

// Règle graduée : on fait glisser, la graduation au centre est choisie (verticale = plus grand en haut)
const RULER_TICK = 12;
function RulerPicker({ min, max, value, onChange, vertical = false }) {
  const ref = useRef(null);
  const list = Array.from({ length: max - min + 1 }, (_, i) => vertical ? max - i : min + i);
  const [live, setLive] = useState(Math.max(0, list.indexOf(value)));
  const axis = vertical ? "scrollTop" : "scrollLeft";
  useEffect(() => { if (ref.current) ref.current[axis] = live * RULER_TICK; }, []);
  const onScroll = () => {
    const i = Math.min(list.length - 1, Math.max(0, Math.round(ref.current[axis] / RULER_TICK)));
    if (i !== live) { setLive(i); onChange(list[i]); }
  };
  const size = vertical ? 320 : 96;
  const spacer = `calc(50% - ${RULER_TICK / 2}px)`;
  const mask = `linear-gradient(${vertical ? "180deg" : "90deg"}, transparent, #000 25%, #000 75%, transparent)`;
  return (
    <div style={{ position: "relative", width: vertical ? 120 : "100%", height: size }}>
      <div ref={ref} onScroll={onScroll} style={{ display: "flex", flexDirection: vertical ? "column" : "row", width: "100%", height: "100%", overflowX: vertical ? "hidden" : "scroll", overflowY: vertical ? "scroll" : "hidden", scrollSnapType: `${vertical ? "y" : "x"} mandatory`, scrollbarWidth: "none", WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ flexShrink: 0, [vertical ? "height" : "width"]: spacer }} />
        {list.map((v, i) => {
          const major = v % 10 === 0, mid = v % 5 === 0;
          const len = major ? 40 : mid ? 28 : 16;
          const near = Math.abs(i - live) < 1;
          return (
            <div key={v} onClick={() => ref.current.scrollTo({ [vertical ? "top" : "left"]: i * RULER_TICK, behavior: "smooth" })} style={{ flexShrink: 0, position: "relative", scrollSnapAlign: "center", cursor: "pointer", display: "flex", flexDirection: vertical ? "row" : "column", alignItems: vertical ? "center" : "center", justifyContent: vertical ? "flex-end" : "flex-start", [vertical ? "height" : "width"]: RULER_TICK, [vertical ? "width" : "height"]: "100%" }}>
              <div style={{ [vertical ? "width" : "height"]: len, [vertical ? "height" : "width"]: 2, borderRadius: 1, background: near ? "transparent" : major ? DS.colors.textSec : DS.colors.textDim }} />
              {major && (
                <span style={{ position: "absolute", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, color: DS.colors.textSec, whiteSpace: "nowrap", ...(vertical ? { right: 56, top: "50%", transform: "translateY(-50%)" } : { top: 52, left: "50%", transform: "translateX(-50%)" }) }}>{v}</span>
              )}
            </div>
          );
        })}
        <div style={{ flexShrink: 0, [vertical ? "height" : "width"]: spacer }} />
      </div>
      {/* Repère central */}
      <div style={{ position: "absolute", pointerEvents: "none", background: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark, borderRadius: 2, boxShadow: `0 0 12px ${DS.colors.primaryGlow}`, ...(vertical ? { right: 0, top: "50%", width: 46, height: 4, transform: "translateY(-50%)" } : { top: 0, left: "50%", width: 4, height: 44, transform: "translateX(-50%)" }) }} />
    </div>
  );
}

async function saveCompleteSession(programmeId, seance, completedSetsData, feedback, durationMin) {
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const userId = session.user.id;
  try {
    const { data: seanceRecord, error: seanceError } = await supabase
      .from("seances")
      .insert({ programme_id: programmeId, user_id: userId, semaine: 1, jour: 1, titre: seance.titre, type: seance.type || "force_basse", duree_min: durationMin, statut: "faite", date_realisee: new Date().toISOString() })
      .select().single();
    if (seanceError) throw seanceError;

    for (let exI = 0; exI < seance.exercices.length; exI++) {
      const ex = seance.exercices[exI];
      const { data: exRecord, error: exErr } = await supabase
        .from("exercices")
        .insert({ seance_id: seanceRecord.id, nom: ex.nom, muscles: ex.muscles, sets: ex.sets, reps: String(ex.reps), charge_kg: ex.chargeKg || 0, repos_sec: ex.reposSec || 90, ordre: exI + 1, conseil: ex.conseil })
        .select().single();
      if (exErr) continue;

      const repsParSet = [];
      for (let setI = 0; setI < (ex.sets || 3); setI++) {
        const setData = completedSetsData[`${exI}-${setI}`];
        repsParSet.push(setData?.reps || parseInt(ex.reps) || 8);
      }
      const repsCible = parseInt(ex.reps) || 8;
      const taux = repsParSet.filter(r => r >= repsCible).length / repsParSet.length;

      await supabase.from("logs_performance").insert({
        exercice_id: exRecord.id, seance_id: seanceRecord.id, user_id: userId,
        reps_par_set: repsParSet, charge_kg: ex.chargeKg || 0, feedback,
        statut: taux === 1 ? "reussite" : taux >= 0.5 ? "partiel" : "echec",
      });
    }

    await supabase.rpc("calculer_progression", { p_user_id: userId, p_seance_id: seanceRecord.id, p_feedback: feedback });
    const { data: deload } = await supabase.rpc("check_deload_needed", { p_user_id: userId });
    if (deload) await supabase.rpc("appliquer_deload", { p_user_id: userId, p_raison: deload });

    let cycleTermine = false;
    // Faire progresser reellement la semaine du programme selon les JOURS DISTINCTS entraines
    // (et non le nombre brut de seances - evite qu'une double seance le meme jour ne fasse
    // avancer artificiellement la structure du programme sans le temps de recuperation reel)
    const { data: progData } = await supabase.from("programmes").select("frequence, total_semaines, semaine_courante").eq("id", programmeId).single();
    if (progData) {
      const { data: seancesDates } = await supabase
        .from("seances")
        .select("date_realisee")
        .eq("programme_id", programmeId)
        .eq("statut", "faite");
      const joursDistincts = new Set((seancesDates || []).map(s => new Date(s.date_realisee).toDateString())).size;
      const freq = progData.frequence || 3;
      const totalSem = progData.total_semaines || 4;
      const nouvelleSemaine = Math.min(Math.floor((joursDistincts || 1) / freq) + 1, totalSem);
      // Le cycle se termine quand toutes les séances prévues sont faites, pas au début de la dernière semaine
      cycleTermine = joursDistincts >= freq * totalSem;
      if (nouvelleSemaine !== progData.semaine_courante) {
        await supabase.from("programmes").update({ semaine_courante: nouvelleSemaine }).eq("id", programmeId);
      }
    }

    return { success: true, deload, cycleTermine };
  } catch (err) {
    console.error("saveCompleteSession:", err);
    return null;
  }
}


// ─────────────────────────────────────────────
// SPORT THEMES
// ─────────────────────────────────────────────
// Avatar du coach IA "Ace" - style manga guerrier
function AceAvatar({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: "50%", flexShrink: 0 }}>
      <defs>
        <linearGradient id="aceSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A2A2E" />
          <stop offset="100%" stopColor="#141416" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="#0A0A0C" />
      <path d="M30 38 Q30 20 50 20 Q70 20 70 38 L70 55 Q70 68 58 74 L50 78 L42 74 Q30 68 30 55 Z" fill="url(#aceSkin)" stroke="#9BE84F" strokeWidth="1.2" />
      <path d="M28 34 L22 14 L34 26 L38 8 L44 24 L50 6 L56 24 L62 8 L66 26 L78 14 L72 34" fill="#0A0A0C" stroke="#9BE84F" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M35 42 L45 45" stroke="#9BE84F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M65 42 L55 45" stroke="#9BE84F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M36 49 L44 49" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 49 L64 49" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 50 L48 60 L52 60" stroke="#5A5A5E" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M43 67 Q50 70 57 67" stroke="#9BE84F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M60 34 L64 46" stroke="#9BE84F" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

const SPORT_THEMES = {
  basketball: { accent: "#FF8C00", accentRgb: "255,140,0", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,140,0,0.06), transparent)" },
  football:   { accent: "#00D94F", accentRgb: "0,217,79",  bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(0,217,79,0.06), transparent)" },
  tennis:     { accent: "#FFE500", accentRgb: "255,229,0", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,229,0,0.06), transparent)" },
  rugby:      { accent: "#FF4500", accentRgb: "255,69,0",  bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,69,0,0.07), transparent)" },
  natation:   { accent: "#00C8FF", accentRgb: "0,200,255", bg: "radial-gradient(ellipse 400px 200px at 50% 0%, rgba(0,200,255,0.07), transparent)" },
  sprint:     { accent: "#FF2D55", accentRgb: "255,45,85", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,45,85,0.06), transparent)" },
  combat:     { accent: "#CC00FF", accentRgb: "204,0,255", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(204,0,255,0.07), transparent)" },
  default:    { accent: "#9BE84F", accentRgb: "155,232,79", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(155,232,79,0.06), transparent)" },
};

// Couleur d'accent lisible : assombrie en thème clair pour rester lisible sur fond blanc
function accentLisible(hex) {
  if (DS.colors.isDark || !/^#[0-9a-f]{6}$/i.test(hex || "")) return hex;
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(c * 0.62);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function getSportTheme(sport) {
  return SPORT_THEMES[sport] || SPORT_THEMES.default;
}

// Alias for backwards compatibility
const s = {
  mono: { fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" },
  display: { fontFamily: "'Inter',sans-serif", fontWeight: 900, letterSpacing: "-0.02em", textTransform: "uppercase" },
  heading: { fontFamily: "'Inter',sans-serif", fontWeight: 700 },
  body: { fontFamily: "'Inter',sans-serif", fontWeight: 400 },
};

const THEMES = {
  light: {
    // Style B — Apple aesthetic, light
    bg: "#F5F5F7", surface: "#FFFFFF", surfaceUp: "#F5F5F7", surfaceHigh: "#E8E8ED",
    surfaceDark: "#ECEEF0", // light theme - slightly darker surface
    primary: "#9BE84F", primarySoft: "rgba(155,232,79,0.15)", primaryGlow: "rgba(155,232,79,0.3)",
    primaryDark: "#5FAE2E",
    success: "#34C759", successSoft: "rgba(52,199,89,0.12)",
    warning: "#FF9500", warningSoft: "rgba(255,149,0,0.10)",
    gold: "#FFD60A", goldSoft: "rgba(255,214,10,0.12)",
    textPrimary: "#1D1D1F", textSec: "#86868B", textDim: "#C7C7CC",
    border: "rgba(0,0,0,0.06)", borderAccent: "rgba(155,232,79,0.4)",
    shadow: { primary: "0 4px 24px rgba(155,232,79,0.3)", card: "0 2px 12px rgba(0,0,0,0.06)", glow: "0 0 40px rgba(155,232,79,0.2)" },
    navBg: "rgba(255,255,255,0.92)",
    stickyBg: "rgba(245,245,247,0.95)",
    heroText: "#FFFFFF",
    isDark: false,
  },
  dark: {
    // Style B — Apple aesthetic, dark
    bg: "#000000", surface: "#1C1C1E", surfaceUp: "#2C2C2E", surfaceHigh: "#3A3A3C",
    surfaceDark: "#1C1C1E",
    primary: "#9BE84F", primarySoft: "rgba(155,232,79,0.15)", primaryGlow: "rgba(155,232,79,0.3)",
    primaryDark: "#9BE84F",
    success: "#30D158", successSoft: "rgba(48,209,88,0.12)",
    warning: "#FF9F0A", warningSoft: "rgba(255,159,10,0.12)",
    gold: "#FFD60A", goldSoft: "rgba(255,214,10,0.12)",
    textPrimary: "#FFFFFF", textSec: "rgba(255,255,255,0.5)", textDim: "rgba(255,255,255,0.2)",
    border: "rgba(255,255,255,0.08)", borderAccent: "rgba(155,232,79,0.3)",
    shadow: { primary: "0 8px 32px rgba(155,232,79,0.2)", card: "none", glow: "0 0 40px rgba(155,232,79,0.15)" },
    navBg: "rgba(0,0,0,0.92)",
    stickyBg: "rgba(0,0,0,0.92)",
    heroText: "#FFFFFF",
    isDark: true,
  },
};

let DS = (() => {
  const saved = localStorage.getItem("voltra_theme") || "light";
  return { colors: THEMES[saved], radius: { sm: 10, md: 14, lg: 20, xl: 24, full: 9999 }, shadow: THEMES[saved].shadow };
})();

function applyTheme(theme) {
  DS = { colors: THEMES[theme], radius: { sm: 10, md: 14, lg: 20, xl: 24, full: 9999 }, shadow: THEMES[theme].shadow };
}

// Dégradé avec une courbe douce : pas de ligne visible derrière les boutons fixés en bas
const fonduBas = () => {
  const c = DS.colors.bg;
  return `linear-gradient(${c}00, ${c}1A 6%, ${c}59 13%, ${c}A6 20%, ${c}E6 27%, ${c} 34%)`;
};

// Apparition en cascade seulement à la première visite d'un onglet : on y revient trop souvent pour la rejouer
const ongletsVus = new Set();
function useStaggerUneFois(cle) {
  const [premiere] = useState(() => !ongletsVus.has(cle));
  useEffect(() => { ongletsVus.add(cle); }, [cle]);
  return premiere ? "v-stagger" : undefined;
}

// Case obligatoire avant paiement : accès immédiat et renonciation au droit de rétractation (contenu numérique)
function ConsentementAchat({ coche, onChange }) {
  return (
    <div onClick={() => onChange(!coche)} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer", textAlign: "left" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, background: coche ? DS.colors.primary : "transparent", border: `2px solid ${coche ? DS.colors.primary : DS.colors.textDim}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0B0B0C", fontSize: 13, fontWeight: 800, transition: "var(--t-choix)" }}>{coche ? "✓" : ""}</div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, lineHeight: 1.45, color: DS.colors.textSec, margin: 0 }}>
        Je demande l'accès immédiat à Voltra Pro et je renonce à mon droit de rétractation de 14 jours dès le début de cet accès.
      </p>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", height: 56,
        background: disabled ? DS.colors.surfaceHigh : `linear-gradient(135deg, ${DS.colors.primary}, #7ED63A)`,
        border: "none", borderRadius: DS.radius.full,
        color: disabled ? DS.colors.textDim : "#0B0B0C", fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : DS.shadow.primary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative", overflow: "hidden",
        fontFamily: "'Inter',sans-serif", fontWeight: 700, ...style,
      }}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: DS.colors.textSec, fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 600, display: "block", marginBottom: 8, paddingLeft: 4 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        inputMode={type === "email" ? "email" : undefined}
        autoCapitalize={type === "text" ? undefined : "none"}
        autoCorrect={type === "text" ? undefined : "off"}
        autoComplete={type === "email" ? "email" : type === "password" ? "current-password" : undefined}
        placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 52, padding: "0 16px",
          background: DS.colors.surface,
          border: `1.5px solid ${focused ? DS.colors.primary : DS.colors.border}`,
          borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 16,
          outline: "none", transition: "border-color 160ms ease, box-shadow 160ms ease",
          boxShadow: focused ? `0 0 0 3px ${DS.colors.primarySoft}` : DS.shadow.card,
          fontFamily: "'Inter',sans-serif",
        }}
      />
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: DS.colors.surface,
      borderRadius: DS.radius.xl,
      padding: 20,
      boxShadow: DS.shadow.card,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "primary" }) {
  const colors = {
    primary: { bg: DS.colors.primarySoft, text: DS.colors.primary, border: DS.colors.borderAccent },
    success: { bg: DS.colors.successSoft, text: DS.colors.success, border: "rgba(0,229,160,0.25)" },
    gold: { bg: DS.colors.goldSoft, text: DS.colors.gold, border: "rgba(255,209,102,0.25)" },
  };
  const c = colors[color];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: DS.radius.full, color: c.text, fontSize: 12, ...s.heading,
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ value }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(value), 100); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ height: 6, background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: "100%", transform: `translateX(${width - 100}%)`,
        background: DS.colors.primary,
        borderRadius: DS.radius.full, transition: "transform 500ms var(--ease-out)",
        boxShadow: `0 0 8px ${DS.colors.primaryGlow}`,
      }} />
    </div>
  );
}

const Icons = {
  home: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinejoin="round" fill={a ? DS.colors.primarySoft : "none"} /></svg>,
  chart: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 20H21M5 20V12M9 20V8M13 20V14M17 20V4" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  user: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" /><path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  arrow: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={DS.colors.textSec} strokeWidth="2" /><path d="M12 7V12L15 15" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
};

const MOCK_PROGRAM = {
  titre: "Explosivite Basketball", semaineCourante: 3, totalSemaines: 8, progression: 62,
  seancesDuJour: [{
    id: "s3_j1", titre: "Force & Explosivite", type: "force_basse", dureeMin: 48,
    exercices: [
      { id: "e1", nom: "Squat barre", muscles: "Quadriceps Fessiers", sets: 4, reps: "6-8", chargeKg: 75, reposSec: 120, conseil: "Descendre sous le parallele, genoux dans l'axe." },
      { id: "e2", nom: "Romanian Deadlift", muscles: "Ischio Lombaires", sets: 3, reps: "10", chargeKg: 60, reposSec: 90, conseil: "Dos plat, tension dans les ischios en bas." },
      { id: "e3", nom: "Box Jump", muscles: "Quadriceps Mollets", sets: 5, reps: "5", chargeKg: 0, reposSec: 150, conseil: "Atterrissage souple, amorti complet." },
      { id: "e4", nom: "Hip Thrust", muscles: "Fessiers", sets: 3, reps: "12", chargeKg: 70, reposSec: 75, conseil: "Pause 1s en haut, contraction max." },
      { id: "e5", nom: "Kettlebell Swing", muscles: "Fessiers Dorsaux", sets: 4, reps: "12", chargeKg: 20, reposSec: 90, conseil: "Puissance vient des hanches, pas des bras." },
    ],
  }],
  derniereSeance: { titre: "Haut du Corps", joursPasses: 2, dureeMin: 42, nbExercices: 5, gainKg: 2.5 },
};

const SPORTS = [
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "rugby", label: "Rugby", emoji: "🏉" },
  { id: "natation", label: "Natation", emoji: "🏊" },
  { id: "sprint", label: "Sprint", emoji: "🏃" },
  { id: "combat", label: "Combat", emoji: "🥊" },
];
const SPORT_EMOJIS = {
  basketball: "🏀", football: "⚽", tennis: "🎾",
  rugby: "🏉", natation: "🏊", sprint: "🏃", combat: "🥊", default: "⚡"
};

const OBJECTIFS_PAR_SPORT = {
  basketball: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "detente", label: "Detente verticale", desc: "Jump & reactivite", emoji: "🚀" },
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  football: [
    { id: "explosivite", label: "Explosivite", desc: "Accel & sprint", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
    { id: "force", label: "Force", desc: "Puissance physique", emoji: "🏋️" },
  ],
  tennis: [
    { id: "explosivite", label: "Explosivite", desc: "Reactivite & vitesse", emoji: "⚡" },
    { id: "force", label: "Force", desc: "Puissance de frappe", emoji: "🏋️" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  rugby: [
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  natation: [
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
    { id: "force", label: "Force haut du corps", desc: "Epaules & dorsaux", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
  ],
  sprint: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "detente", label: "Detente", desc: "Puissance impulsion", emoji: "🚀" },
  ],
  combat: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance et vitesse de frappe", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio et resistance", emoji: "🫁" },
    { id: "force", label: "Force", desc: "Puissance maximale", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
  ],
};
const OBJECTIFS = [];
const NIVEAUX = ["Debutant", "Intermediaire", "Avance"];
const PLANS = [
  { id: "annual", label: "Annuel", price: 74.99, displayPrice: "6,25 €", unit: "/ mois", priceDetail: "Facturé 74,99 € par an", bienvenue: "-25 % la 1ère année : 56,24 €, puis 74,99 €/an", savings: "−58 %", color: DS.colors.primary, colorSoft: DS.colors.primarySoft, colorBorder: DS.colors.borderAccent, badge: "LE PLUS POPULAIRE", highlight: true },
  { id: "monthly", label: "Mensuel", price: 14.99, displayPrice: "14,99 €", unit: "/ mois", priceDetail: "Facturé chaque mois", bienvenue: "-30 % le 1er mois : 10,49 €, puis 14,99 €/mois", savings: null, color: DS.colors.success, colorSoft: DS.colors.successSoft, colorBorder: "rgba(0,229,160,0.35)", badge: null, highlight: false },
];

// ─────────────────────────────────────────────
// MUSCLE ICONS SVG
// ─────────────────────────────────────────────
function getMuscleIcon(muscles, color) {
  const m = (muscles || "").toLowerCase();
  if (m.includes("quad")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="28" rx="7" ry="12" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="28" rx="7" ry="12" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="24" rx="4" ry="8" fill={color + "60"}/>
      <ellipse cx="32" cy="24" rx="4" ry="8" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("fessier")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="30" rx="10" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="30" rx="10" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="28" rx="6" ry="6" fill={color + "60"}/>
      <ellipse cx="32" cy="28" rx="6" ry="6" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("pectoral") || m.includes("chest")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M8 20 Q16 12 24 16 Q32 12 40 20 L40 32 Q32 38 24 34 Q16 38 8 32 Z" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <path d="M12 22 Q20 16 24 18 L24 32 Q16 36 12 30 Z" fill={color + "50"}/>
      <path d="M36 22 Q28 16 24 18 L24 32 Q32 36 36 30 Z" fill={color + "50"}/>
    </svg>
  );
  if (m.includes("dorsal") || m.includes("dos")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M8 12 Q16 8 24 10 Q32 8 40 12 L38 36 Q30 42 24 40 Q18 42 10 36 Z" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <path d="M12 14 Q20 10 24 12 L22 36 Q16 40 12 34 Z" fill={color + "50"}/>
      <path d="M36 14 Q28 10 24 12 L26 36 Q32 40 36 34 Z" fill={color + "50"}/>
    </svg>
  );
  if (m.includes("ischio")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="26" rx="7" ry="13" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="26" rx="7" ry="13" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="28" rx="4" ry="9" fill={color + "60"}/>
      <ellipse cx="32" cy="28" rx="4" ry="9" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("mollet")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="30" rx="6" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="30" rx="6" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="32" rx="3" ry="6" fill={color + "60"}/>
      <ellipse cx="32" cy="32" rx="3" ry="6" fill={color + "60"}/>
    </svg>
  );
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="18" fill={color + "20"} stroke={color} strokeWidth="1.5"/>
      <path d="M16 24 Q20 16 24 20 Q28 16 32 24 Q28 32 24 28 Q20 32 16 24Z" fill={color + "60"}/>
    </svg>
  );
}

function getExerciceColor(type, index) {
  const palettes = {
    force_basse: ["#6C63FF", "#7B6EFF", "#8A7AFF", "#9B8BFF", "#AC9CFF"],
    force_haute: ["#FF63D4", "#FF70DA", "#FF7EE0", "#FF8CE6", "#FF9AEC"],
    explosivite: ["#FF6B35", "#FF7A45", "#FF8A55", "#FF9A66", "#FFAA77"],
    gainage: ["#00E5A0", "#10EBA8", "#20F1B0", "#30F7B8", "#40FDC0"],
  };
  const colors = palettes[type] || palettes.force_basse;
  return colors[index % colors.length];
}

const MOTIVATION = {
  rest: ["Recupere bien.", "Souffle, t'as bien bosse.", "Presque fini.", "Tu geres.", "Keep going."],
  complete: ["Propre !", "Excellent !", "Belle serie !", "On continue.", "Top !"],
  finish: ["Seance terminee", "Travail accompli.", "Champion.", "Incroyable.", "Respect."],
};
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─────────────────────────────────────────────
// TIMER DE REPOS
// ─────────────────────────────────────────────
function RestTimer({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(true);
  const ref = useRef(null);
  const [motivText] = useState(() => getRandom(MOTIVATION.rest));

  useEffect(() => { setLeft(seconds); setRunning(true); }, [seconds]);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) { onComplete?.(); return; }
    ref.current = setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(ref.current);
  }, [left, running]);

  const pct = ((seconds - left) / seconds) * 100;
  const pad = n => String(n).padStart(2, "0");
  const color = left > seconds * 0.6 ? DS.colors.primary : left > seconds * 0.3 ? DS.colors.warning : DS.colors.success;
  const circumference = 2 * Math.PI * 54;

  return (
    <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "28px 24px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: DS.shadow.card }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${color}10, transparent 70%)`, transition: "background 0.5s ease", pointerEvents: "none" }} />
      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>Temps de repos</p>
      <div style={{ position: "relative", width: 148, height: 148, margin: "0 auto 16px" }}>
        <svg width="148" height="148" viewBox="0 0 148 148" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="74" cy="74" r="54" fill="none" stroke={DS.colors.surfaceHigh} strokeWidth="10" />
          <circle cx="74" cy="74" r="54" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...s.mono, fontSize: 38, color, fontWeight: 700, lineHeight: 1, transition: "color 0.5s ease" }}>
            {pad(Math.floor(left / 60))}:{pad(left % 60)}
          </span>
          <span style={{ color: DS.colors.textDim, fontSize: 11, marginTop: 4 }}>sec</span>
        </div>
      </div>
      <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 20, fontStyle: "italic" }}>"{motivText}"</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setRunning(r => !r)} style={{ flex: 1, height: 44, background: "transparent", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.heading }}>
          {running ? "Pause" : "Reprendre"}
        </button>
        <button onClick={onComplete} style={{ flex: 1, height: 44, background: DS.colors.successSoft, border: `1px solid rgba(0,229,160,0.3)`, borderRadius: DS.radius.md, color: DS.colors.success, fontSize: 14, cursor: "pointer", ...s.heading }}>
          Passer
        </button>
      </div>
    </div>
  );
}

// Cache local + Edge Function pour les GIFs animés ExerciseDB
// ─────────────────────────────────────────────
// ECRAN SEANCE LIVE
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ANIMATIONS D'EXERCICES — motion design dessiné par l'app (rien à télécharger)
// Un athlète vectoriel, vu de profil, fait le mouvement en boucle avec son matériel.
// Une pose = position du bassin, inclinaison du buste, cibles des mains et des pieds ;
// genoux et coudes sont calculés automatiquement (cinématique inverse).
// Cible : [x, y] absolu, ["S", dx, dy] relatif à l'épaule, ["H", dx, dy] relatif au bassin.
// ─────────────────────────────────────────────
const SEG = { buste: 28, cou: 4, tete: 6, bras: 14, avantBras: 13, cuisse: 21, tibia: 20 };
const SOL = 92;

// Articulation intermédiaire (genou, coude) entre une origine et une cible ; sens = côté du pli
function ik2(o, cible, a, b, sens) {
  const dx = cible[0] - o[0], dy = cible[1] - o[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
  const t = Math.atan2(dy, dx) + sens * Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const mid = [o[0] + a * Math.cos(t), o[1] + a * Math.sin(t)];
  const dir = Math.atan2(cible[1] - mid[1], cible[0] - mid[0]);
  return [mid, [mid[0] + b * Math.cos(dir), mid[1] + b * Math.sin(dir)]];
}

const lerp = (a, b, k) => a + (b - a) * k;
function lerpCible(a, b, k) {
  if (typeof a[0] === "string" && a[0] === b[0]) return [a[0], lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
function resoudre(c, epaule, bassin) {
  if (c[0] === "S") return [epaule[0] + c[1], epaule[1] + c[2]];
  if (c[0] === "H") return [bassin[0] + c[1], bassin[1] + c[2]];
  return c;
}

const epauleDe = (hip, tDeg) => [hip[0] + SEG.buste * Math.sin(tDeg * Math.PI / 180), hip[1] - SEG.buste * Math.cos(tDeg * Math.PI / 180)];

// Cible intermédiaire : même repère -> on interpole dans ce repère ; repères différents -> on interpole les positions réelles
function cibleEntre(a, b, k, A, B, epaule, bassin) {
  if (typeof a[0] === "string" && a[0] === b[0]) return resoudre(lerpCible(a, b, k), epaule, bassin);
  const pa = resoudre(a, epauleDe(A.hip, A.t), A.hip), pb = resoudre(b, epauleDe(B.hip, B.t), B.hip);
  return [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
}

function calculerPose(A, B, k, def) {
  const bassin = [lerp(A.hip[0], B.hip[0], k), lerp(A.hip[1], B.hip[1], k)];
  const t = lerp(A.t, B.t, k) * Math.PI / 180;
  const epaule = epauleDe(bassin, lerp(A.t, B.t, k));
  const r = SEG.cou + SEG.tete;
  const tete = [epaule[0] + r * Math.sin(t + 0.12), epaule[1] - r * Math.cos(t + 0.12)];
  const jambes = [0, 1].map(i => {
    const pied = cibleEntre(A.pieds[i], B.pieds[i], k, A, B, epaule, bassin);
    return [bassin, ...ik2(bassin, pied, SEG.cuisse, SEG.tibia, def.sensJambe ?? -1)];
  });
  const bras = [0, 1].map(i => {
    const main = cibleEntre(A.mains[i], B.mains[i], k, A, B, epaule, bassin);
    return [epaule, ...ik2(epaule, main, SEG.bras, SEG.avantBras, def.sensBras ?? 1)];
  });
  return { bassin, epaule, tete, t, jambes, bras };
}

// Bibliothèque de mouvements (varie selon le matériel)
const DEBOUT = { hip: [50, 52], t: 2, pieds: [[52, SOL], [49, SOL]] };
const PEND = [["S", 1, 26], ["S", 0, 26]];
function construireMotif(motif, materiel) {
  switch (motif) {
    case "squat": {
      const mainsA = materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]]
        : materiel === "haltere_unique" || materiel === "kettlebell" ? [["S", 9, 6], ["S", 8, 6]]
        : materiel === "halteres" ? PEND : [["S", 4, 24], ["S", 3, 24]];
      const mainsB = materiel === "poids_du_corps" || materiel === "inconnu" ? [["S", 25, 2], ["S", 24, 2]] : mainsA;
      return { periode: 2.6, A: { ...DEBOUT, t: 4, mains: mainsA }, B: { hip: [40, 70], t: 40, pieds: DEBOUT.pieds, mains: mainsB }, equipDos: materiel === "barre" };
    }
    case "hinge":
      return { periode: 2.8, A: { ...DEBOUT, t: 4, mains: PEND }, B: { hip: [35, 58], t: 72, pieds: DEBOUT.pieds, mains: [["S", -2, 26], ["S", -3, 26]] } };
    case "swing":
      return { periode: 1.6, A: { hip: [37, 60], t: 62, pieds: DEBOUT.pieds, mains: [["H", 9, 13], ["H", 8, 13]] }, B: { ...DEBOUT, t: -3, mains: [["S", 25, 3], ["S", 24, 3]] } };
    case "ohp":
      return { periode: 2.4, A: { ...DEBOUT, t: 0, mains: [["S", 7, -1], ["S", 6, -1]] }, B: { ...DEBOUT, t: 0, mains: [["S", 2, -26], ["S", 1, -26]] } };
    case "bench":
      return { periode: 2.4, scene: "banc", sensBras: 1, A: { hip: [58, 63], t: -90, pieds: [[78, SOL], [75, SOL]], mains: [[39, 52], [38, 52]] }, B: { hip: [58, 63], t: -90, pieds: [[78, SOL], [75, SOL]], mains: [[30, 37], [29, 37]] } };
    case "row":
      return { periode: 2.2, A: { hip: [38, 57], t: 68, pieds: DEBOUT.pieds, mains: [["S", 0, 25], ["S", -1, 25]] }, B: { hip: [38, 57], t: 68, pieds: DEBOUT.pieds, mains: [["S", -7, 9], ["S", -8, 9]] } };
    case "lunge":
      return { periode: 2.6, A: { hip: [48, 55], t: 3, pieds: [[62, SOL], [32, SOL]], mains: materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]] : PEND }, B: { hip: [46, 70], t: 4, pieds: [[62, SOL], [32, SOL]], mains: materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]] : PEND }, equipDos: materiel === "barre" };
    case "jump":
      return { periode: 1.5, ombre: true, A: { hip: [46, 65], t: 38, pieds: DEBOUT.pieds, mains: [["S", -12, 20], ["S", -13, 20]] }, B: { hip: [50, 36], t: 2, pieds: [[52, 76], [49, 76]], mains: [["S", 4, -25], ["S", 3, -25]] } };
    case "slam":
      return { periode: 1.4, A: { ...DEBOUT, t: -4, mains: [["S", 3, -25], ["S", 2, -25]] }, B: { hip: [40, 64], t: 55, pieds: DEBOUT.pieds, mains: [[63, 85], [62, 85]] } };
    case "pushup":
      return { periode: 2.2, A: { hip: [43, 74], t: 64, pieds: [[6, SOL], [7, SOL]], mains: [[68, SOL], [66, SOL]] }, B: { hip: [45, 85], t: 82, pieds: [[6, SOL], [7, SOL]], mains: [[68, SOL], [66, SOL]] } };
    case "plank":
      return { periode: 3.2, A: { hip: [40, 80], t: 74, pieds: [[6, SOL], [7, SOL]], mains: [[80, SOL], [78, SOL]] }, B: { hip: [40, 78], t: 73, pieds: [[6, SOL], [7, SOL]], mains: [[80, SOL], [78, SOL]] } };
    case "pullup":
      return { periode: 2.6, scene: "barre_traction", A: { hip: [50, 54], t: 0, pieds: [["H", -10, 36], ["H", -12, 36]], mains: [[46, -4], [54, -4]] }, B: { hip: [50, 30], t: 4, pieds: [["H", -10, 36], ["H", -12, 36]], mains: [[46, -4], [54, -4]] } };
    case "curl":
      return { periode: 2.2, A: { ...DEBOUT, t: 0, mains: [["S", 2, 26], ["S", 1, 26]] }, B: { ...DEBOUT, t: 0, mains: [["S", 9, 5], ["S", 8, 5]] } };
    case "raise":
      return { periode: 2.4, A: { ...DEBOUT, t: 0, mains: [["S", 1, 26], ["S", 0, 26]] }, B: { ...DEBOUT, t: 0, mains: [["S", 26, 0], ["S", 25, 0]] } };
    case "sprint":
      return { periode: 0.8, aller: true, A: { hip: [50, 54], t: 12, pieds: [[62, 80], [34, SOL]], mains: [["S", -10, 17], ["S", 13, 8]] }, B: { hip: [50, 54], t: 12, pieds: [[34, SOL], [62, 80]], mains: [["S", 13, 8], ["S", -10, 17]] } };
    case "thrust":
      return { periode: 2.4, scene: "banc_thrust", A: { hip: [48, 84], t: -45, pieds: [[72, SOL], [69, SOL]], mains: [["H", -2, -3], ["H", -3, -3]] }, B: { hip: [52, 64], t: -88, pieds: [[72, SOL], [69, SOL]], mains: [["H", -2, -3], ["H", -3, -3]] } };
    default:
      return construireMotif("squat", materiel);
  }
}

// Quel mouvement montrer pour cet exercice
function motifExercice(ex) {
  const n = `${ex?.nomEn || ""} ${ex?.nom || ""}`.toLowerCase();
  const materiel = detecterMateriel(ex || {});
  let motif = detecterMouvement(ex || {});
  if (/push[- ]?up|pompe/.test(n)) motif = "pushup";
  else if (/pull[- ]?up|chin[- ]?up|traction|pulldown|pull-down/.test(n)) motif = "pullup";
  else if (/plank|gainage|dead bug|bird dog|hollow|crunch|sit[- ]?up|pallof|mountain climber/.test(n)) motif = "plank";
  else if (/sprint|run|course|skip|high knee|carioca|shuffle|accel/.test(n)) motif = "sprint";
  else if (/jump|saut|hop|bound|burpee|plyo/.test(n)) motif = "jump";
  else if (materiel === "medball" || /slam|throw|lancer/.test(n)) motif = "slam";
  else if (motif === "olympic") motif = "jump";
  else if (motif === "legpress") motif = "squat";
  else if (motif === "defaut") motif = "squat";
  return { motif, materiel };
}

function ExerciseAnimation({ exercice, accent = "#9BE84F", couleur = "#F4F4F5" }) {
  const { motif, materiel } = motifExercice(exercice);
  const def = construireMotif(motif, materiel);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setPhase(0.46); return; }
    let raf, debut;
    const boucle = (ts) => {
      debut = debut ?? ts;
      setPhase(((ts - debut) / (def.periode * 1000)) % 1);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [motif, materiel]);

  // Aller (42 %), pause, retour (42 %), pause — courbe douce ; la course alterne sans pause
  const doux = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const k = def.aller
    ? (phase < 0.5 ? doux(phase * 2) : 1 - doux((phase - 0.5) * 2))
    : phase < 0.42 ? doux(phase / 0.42) : phase < 0.5 ? 1 : phase < 0.92 ? 1 - doux((phase - 0.5) / 0.42) : 0;
  const p = calculerPose(def.A, def.B, k, def);

  const membre = (pts, w, op) => <polyline points={pts.map(q => q.join(",")).join(" ")} fill="none" stroke={couleur} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={op} />;
  const mainsMilieu = [(p.bras[0][2][0] + p.bras[1][2][0]) / 2, (p.bras[0][2][1] + p.bras[1][2][1]) / 2];

  // Matériel dessiné dans les mains (ou sur le dos)
  const disque = (c, r) => (
    <g>
      <circle cx={c[0]} cy={c[1]} r={r} fill="#14161A" stroke={accent} strokeWidth="2.4" />
      <circle cx={c[0]} cy={c[1]} r={r * 0.28} fill={accent} />
    </g>
  );
  const haltere = (c, op) => (
    <g opacity={op} transform={`translate(${c[0]},${c[1]})`}>
      <rect x="-4.5" y="-0.9" width="9" height="1.8" rx="0.9" fill={accent} />
      <rect x="-5.5" y="-2.8" width="2.6" height="5.6" rx="1" fill={accent} />
      <rect x="2.9" y="-2.8" width="2.6" height="5.6" rx="1" fill={accent} />
    </g>
  );
  let equip = null;
  if (materiel === "barre") {
    const dos = def.equipDos ? [p.epaule[0] - 6 * Math.cos(p.t), p.epaule[1] - 6 * Math.sin(p.t) + 1] : mainsMilieu;
    equip = disque(dos, 8.5);
  } else if (materiel === "halteres") {
    equip = <>{haltere(p.bras[1][2], 0.45)}{haltere(p.bras[0][2], 1)}</>;
  } else if (materiel === "haltere_unique") {
    equip = <g transform={`rotate(90 ${mainsMilieu[0]} ${mainsMilieu[1]})`}>{haltere(mainsMilieu, 1)}</g>;
  } else if (materiel === "kettlebell") {
    equip = (
      <g>
        <path d={`M ${mainsMilieu[0] - 2.6} ${mainsMilieu[1] + 1.5} Q ${mainsMilieu[0]} ${mainsMilieu[1] - 3} ${mainsMilieu[0] + 2.6} ${mainsMilieu[1] + 1.5}`} fill="none" stroke={accent} strokeWidth="1.6" />
        <circle cx={mainsMilieu[0]} cy={mainsMilieu[1] + 5.5} r="4.6" fill={accent} />
      </g>
    );
  } else if (materiel === "medball") {
    equip = <circle cx={mainsMilieu[0]} cy={mainsMilieu[1] + 1} r="5.2" fill={accent} />;
  } else if (materiel === "poulie") {
    equip = <><line x1={mainsMilieu[0]} y1={mainsMilieu[1]} x2="96" y2="30" stroke={accent} strokeWidth="1.2" strokeDasharray="2 1.5" /><circle cx="96" cy="30" r="2.6" fill={accent} /></>;
  }

  const sceneCouleur = "rgba(255,255,255,0.14)";
  const hauteurSaut = Math.max(0, SOL - Math.max(p.jambes[0][2][1], p.jambes[1][2][1]));

  return (
    <svg viewBox="0 -14 100 112" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", overflow: "visible" }} aria-label={`Animation : ${exercice?.nom || "exercice"}`} role="img">
      <defs>
        <radialGradient id="voltraSol" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Sol et ombre */}
      <line x1="2" y1={SOL + 1.6} x2="98" y2={SOL + 1.6} stroke={sceneCouleur} strokeWidth="0.8" />
      <ellipse cx={p.bassin[0] + 2} cy={SOL + 1.6} rx={Math.max(8, 20 - hauteurSaut * 0.5)} ry="2.4" fill="url(#voltraSol)" />
      {/* Décor selon l'exercice */}
      {def.scene === "banc" && <g fill={sceneCouleur}><rect x="14" y="66" width="58" height="4.5" rx="2" /><rect x="20" y="70" width="2.5" height="22" /><rect x="64" y="70" width="2.5" height="22" /></g>}
      {def.scene === "banc_thrust" && <g fill={sceneCouleur}><rect x="4" y="66" width="28" height="4.5" rx="2" /><rect x="8" y="70" width="2.5" height="22" /><rect x="26" y="70" width="2.5" height="22" /></g>}
      {def.scene === "barre_traction" && <g><line x1="22" y1="-4" x2="78" y2="-4" stroke={sceneCouleur} strokeWidth="2.4" strokeLinecap="round" /><line x1="24" y1="-4" x2="24" y2={SOL} stroke={sceneCouleur} strokeWidth="1.2" /><line x1="76" y1="-4" x2="76" y2={SOL} stroke={sceneCouleur} strokeWidth="1.2" /></g>}
      {/* Membres du côté éloigné (en retrait) */}
      {membre(p.jambes[1], 6.4, 0.32)}
      {membre(p.bras[1], 5, 0.32)}
      {def.equipDos && equip}
      {/* Corps */}
      <line x1={p.bassin[0]} y1={p.bassin[1]} x2={p.epaule[0]} y2={p.epaule[1]} stroke={couleur} strokeWidth="9" strokeLinecap="round" />
      <circle cx={p.tete[0]} cy={p.tete[1]} r={SEG.tete} fill={couleur} />
      {membre(p.jambes[0], 7, 1)}
      {membre(p.bras[0], 5.4, 1)}
      {!def.equipDos && equip}
    </svg>
  );
}

function SeanceScreen({ seance, onFinish, onBack, sport, isPro, resumeState }) {
  const [exIdx, setExIdx] = useState(resumeState?.exIdx || 0);
  const [setIdx, setSetIdx] = useState(resumeState?.setIdx || 0);
  const [resting, setResting] = useState(false);
  const [waitingRest, setWaitingRest] = useState(false);
  const [completedSets, setCompletedSets] = useState(resumeState?.completedSets || {});
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [startTime] = useState(() => resumeState?.elapsed ? Date.now() - resumeState.elapsed * 1000 : Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const theme = getSportTheme(sport);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Compte à rebours repos plein écran
  const [restLeft, setRestLeft] = useState(0);
  useEffect(() => {
    if (!resting) return;
    setRestLeft(currentEx?.reposSec || 90);
    const t = setInterval(() => {
      setRestLeft(p => {
        if (p <= 1) {
          clearInterval(t);
          setResting(false);
          setSetIdx(i => i + 1);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resting]);

  const formatElapsed = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const exercices = seance?.exercices || [];
  const currentEx = exercices[exIdx] || null;

  // Message coach proactif quand exercice change
  useEffect(() => {
    if (!currentEx) return;
    const intro = exIdx === 0
      ? `Séance lancée ! On commence par **${currentEx.nom}** — ${currentEx.sets} séries de ${currentEx.reps} reps. ${currentEx.chargeKg > 0 ? `Charge : ${currentEx.chargeKg}kg.` : ""} Je suis là si tu as besoin d'adapter. 💪`
      : `Exercice ${exIdx + 1}/${exercices.length} — **${currentEx.nom}**. ${currentEx.muscles ? `Muscles ciblés : ${currentEx.muscles}.` : ""} ${currentEx.chargeKg > 0 ? `${currentEx.chargeKg}kg, ${currentEx.sets}×${currentEx.reps}.` : `${currentEx.sets}×${currentEx.reps}.`}`;
    setCoachMessages([{ role: "assistant", text: intro }]);
  }, [exIdx, currentEx?.nom]);

  if (exercices.length === 0 && !showSummary) {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
        <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 24, color: DS.colors.textPrimary, marginBottom: 8 }}>Séance introuvable</h2>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, marginBottom: 24 }}>Le programme n'a pas encore d'exercices. Attends que la génération soit terminée.</p>
        <button onClick={() => onFinish && onFinish("skip", {}, 0)} style={{ padding: "12px 24px", background: DS.colors.primary, border: "none", borderRadius: DS.radius.full, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Retour au dashboard</button>
      </div>
    );
  }

  if (!currentEx && !showSummary) return null;

  const totalSets = currentEx ? (currentEx.sets || 4) : 4;
  const progressPct = currentEx ? Math.round(((exIdx + setIdx / totalSets) / exercices.length) * 100) : 100;
  const accentColor = theme.accent;

  const freeCoachMessages = coachMessages.filter(m => m.role === "user").length;
  const coachBlocked = !isPro && freeCoachMessages >= 2;

  const sendCoachMessage = async () => {
    if (!coachInput.trim() || coachLoading || coachBlocked) return;
    const userMsg = coachInput.trim();
    setCoachInput("");
    setCoachMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setCoachLoading(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      // Contexte complet de la séance
      const setsCompletes = Object.keys(completedSets).filter(k => k.startsWith(`${exIdx}-`)).length;
      const totalSetsEx = currentEx?.sets || 4;
      const exercicesCompletes = exercices.slice(0, exIdx).map(ex => ex.nom);
      const dureeMin = Math.floor(elapsed / 60);

      const sessionContext = {
        seance_titre: seance?.titre,
        sport,
        exercice_actuel: {
          nom: currentEx?.nom,
          muscles: currentEx?.muscles,
          sets_total: totalSetsEx,
          sets_completes: setsCompletes,
          reps: currentEx?.reps,
          charge_kg: currentEx?.chargeKg || 0,
          index: exIdx + 1,
          total: exercices.length,
        },
        progression_seance: {
          exercices_completes: exercicesCompletes,
          exercices_restants: exercices.slice(exIdx + 1).map(ex => ex.nom),
          duree_ecoulee_min: dureeMin,
          pourcentage: Math.round(((exIdx + setsCompletes / totalSetsEx) / exercices.length) * 100),
        },
      };

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          message: userMsg,
          context: sessionContext,
          history: coachMessages.slice(-8),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoachMessages(prev => [...prev, { role: "assistant", text: data.reply || "Désolé, erreur." }]);
    } catch (err) {
      setCoachMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion. Réessaie." }]);
    }
    setCoachLoading(false);
  };

  const handleSetComplete = () => {
    const key = `${exIdx}-${setIdx}`;
    setCompletedSets(prev => ({ ...prev, [key]: { reps: parseInt(currentEx.reps) || 8, kg: currentEx.chargeKg || 0 } }));
    const msg = getRandom(MOTIVATION.complete);
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
    if (setIdx < totalSets - 1) {
      // Repos plein écran directement
      setResting(true);
    } else {
      if (exIdx < exercices.length - 1) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1200);
        setTimeout(() => { setExIdx(i => i + 1); setSetIdx(0); setAnimKey(k => k + 1); }, 500);
      } else {
        setTimeout(() => setShowSummary(true), 600);
      }
    }
  };

  const handlePause = () => {
    try {
      localStorage.setItem("voltra_paused_session", JSON.stringify({
        seance, exIdx, setIdx, completedSets, elapsed, sport, savedAt: Date.now()
      }));
    } catch (e) {}
    setShowExitModal(false);
    onBack();
  };

  // ── ECRAN RECAPITULATIF ──
  if (showSummary) {
    const totalSetsCount = exercices.reduce((acc, ex) => acc + (ex.sets || 3), 0);
    const durationMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 300px 300px at 50% 30%, ${accentColor}08, transparent)`, pointerEvents: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40, position: "relative" }}>

          {/* Trophee */}
          <div style={{ width: 100, height: 100, borderRadius: 26, background: `${accentColor}15`, border: `2px solid ${accentColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, marginBottom: 24, boxShadow: `0 0 60px ${accentColor}30`, animation: "celebrate 0.6s var(--ease-spring)" }}>
            🏆
          </div>

          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>SEANCE TERMINEE</div>
          <h1 style={{ ...s.display, fontSize: 36, color: DS.colors.textPrimary, marginBottom: 6, textAlign: "center", letterSpacing: "0.02em" }}>{getRandom(MOTIVATION.finish).toUpperCase()}</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginBottom: 36, letterSpacing: "0.06em" }}>{(seance.titre || "").toUpperCase()}</p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 36 }}>
            {[
              { val: exercices.length, label: "EXO", color: accentColor },
              { val: totalSetsCount, label: "SERIES", color: DS.colors.success },
              { val: `${durationMin}`, label: "MIN", color: "#FF8C00" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: DS.colors.surface, border: `1px solid ${stat.color}25`, borderRadius: DS.radius.lg, padding: "18px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Ressenti */}
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Comment tu te sens ?</p>
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 24 }}>
            {[
              { id: "easy", emoji: "😤", label: "FACILE", color: accentColor },
              { id: "good", emoji: "💪", label: "PARFAIT", color: DS.colors.success },
              { id: "hard", emoji: "🔥", label: "DUR", color: "#FF4500" },
            ].map(fb => (
              <button key={fb.id} onClick={() => setFeedback(fb.id)} style={{ flex: 1, padding: "16px 8px", background: feedback === fb.id ? fb.color + "20" : DS.colors.surface, border: `2px solid ${feedback === fb.id ? fb.color : DS.colors.border}`, borderRadius: DS.radius.lg, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", transform: feedback === fb.id ? "scale(1.05)" : "scale(1)" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{fb.emoji}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", color: feedback === fb.id ? fb.color : DS.colors.textSec, fontSize: 10, letterSpacing: "0.06em" }}>{fb.label}</div>
              </button>
            ))}
          </div>

          <button onClick={() => onFinish(feedback, completedSets, exercices, durationMin)} disabled={!feedback} style={{ width: "100%", height: 56, background: feedback ? `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: feedback ? "#000" : DS.colors.textSec, fontSize: 15, cursor: feedback ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", boxShadow: feedback ? `0 8px 32px ${accentColor}40` : "none", transition: "var(--t-choix)" }}>
            {feedback ? "ENREGISTRER ET CONTINUER" : "SELECTIONNE TON RESSENTI"}
          </button>
        </div>
      </div>
    );
  }

  // ── ÉCRAN REPOS PLEIN ÉCRAN ──
  if (resting) {
    const restTotal = currentEx?.reposSec || 90;
    const restPct = (restLeft / restTotal) * 100;
    const nextSetNum = setIdx + 2; // série suivante (1-indexed)
    return (
      <div style={{ fontFamily: "'Inter',sans-serif", background: "linear-gradient(180deg, #0A2540 0%, #051426 100%)", minHeight: "100dvh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(10,132,255,0.25), transparent 70%)", pointerEvents: "none" }} />

        <div style={{ padding: "52px 24px 0", display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>EX {exIdx + 1}/{exercices.length}</p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.35em", color: "#5AC8FA", marginBottom: 12 }}>💨 RÉCUPÉRATION</p>
          <p style={{ fontSize: 140, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", textShadow: "0 0 60px rgba(90,200,250,0.4)" }}>{restLeft}</p>
          <div style={{ width: 200, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 4, marginTop: 24, overflow: "hidden" }}>
            <div style={{ width: "100%", transform: `translateX(${restPct - 100}%)`, height: "100%", background: "#5AC8FA", borderRadius: 4, transition: "transform 1s linear" }} />
          </div>
        </div>

        <div style={{ padding: "0 20px 32px", position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 18px", marginBottom: 14 }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginBottom: 6 }}>ENSUITE</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800 }}>{currentEx.nom} — Série {nextSetNum}/{totalSets}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{currentEx.reps} reps{currentEx.chargeKg > 0 ? ` · ${currentEx.chargeKg} kg` : ""}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(90,200,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎯</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRestLeft(r => r + 30)} style={{ flex: 1, height: 52, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>+30 sec</button>
            <button onClick={() => { setResting(false); setSetIdx(i => i + 1); }} style={{ flex: 2, height: 52, background: "#5AC8FA", border: "none", borderRadius: 16, color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Reprendre →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉCRAN EFFORT — photo + zone focus ──
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", minHeight: "100dvh", background: "#000", maxWidth: 430, margin: "0 auto", position: "relative", display: "flex", flexDirection: "column", color: "white" }}>

      {/* Celebration */}
      {celebrate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 80, animation: "celebrate 0.6s var(--ease-spring) forwards" }}>💥</div>
          <div style={{ position: "absolute", fontSize: 40, top: "35%", left: "20%", animation: "floatUp 1s ease forwards", opacity: 0 }}>⚡</div>
          <div style={{ position: "absolute", fontSize: 30, top: "30%", right: "20%", animation: "floatUp 1s ease forwards", animationDelay: "0.15s", opacity: 0 }}>✨</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: accentColor, color: "#000", padding: "8px 20px", borderRadius: 999, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 800, zIndex: 200, boxShadow: `0 4px 20px ${accentColor}60`, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Modal de sortie — stats + pause */}
      {showExitModal && (() => {
        const doneSets = Object.keys(completedSets).length;
        const setsWithWeight = Object.values(completedSets).filter(s => s.kg > 0);
        const kgTotal = Math.round(setsWithWeight.reduce((a, s) => a + (s.kg * (s.reps || 8)), 0));
        const totalReps = Object.values(completedSets).reduce((a, s) => a + (s.reps || 8), 0);
        const exosRestants = exercices.length - exIdx;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
            <div style={{ width: "100%", maxWidth: 360, background: "#101418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "28px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>😳</p>
              <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 22, color: "white", marginBottom: 8, lineHeight: 1.15 }}>Tu abandonnes maintenant ?</h2>
              {doneSets > 0 ? (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
                  Tu as déjà validé <strong style={{ color: accentColor }}>{doneSets} série{doneSets > 1 ? "s" : ""}</strong>{kgTotal > 0 ? <> et soulevé <strong style={{ color: accentColor }}>{kgTotal} kg</strong></> : totalReps > 0 ? <> et fait <strong style={{ color: accentColor }}>{totalReps} répétitions</strong></> : null}. Il ne reste que <strong style={{ color: "white" }}>{exosRestants} exercice{exosRestants > 1 ? "s" : ""}</strong>.
                </p>
              ) : (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
                  La séance vient de commencer — c'est maintenant que tout se joue.
                </p>
              )}
              <button onClick={() => setShowExitModal(false)} style={{ width: "100%", height: 56, background: accentColor, border: "none", borderRadius: 999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 17, fontWeight: 900, cursor: "pointer", marginBottom: 10, boxShadow: `0 8px 32px ${accentColor}40` }}>
                JE CONTINUE 💪
              </button>
              <button onClick={handlePause} style={{ width: "100%", height: 48, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
                ⏸ Mettre en pause — je reviens
              </button>
              <button onClick={() => { setShowExitModal(false); onBack(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                Quitter sans sauvegarder
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Photo immersive ── */}
      <div key={animKey} style={{ position: "relative", height: "36vh", minHeight: 260, overflow: "hidden", flexShrink: 0 }}>
        {/* Démo animée du mouvement (dessinée par l'app, instantanée) */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 62%, ${accentColor}26, transparent 70%), linear-gradient(180deg, #0B0D10 0%, #000 100%)` }} />
        <div key={currentEx?.nom} className="v-pop" style={{ position: "absolute", left: "10%", right: "10%", top: 78, bottom: 30 }}>
          <ExerciseAnimation exercice={currentEx} accent={accentColor} />
        </div>

        {/* Header sur la photo */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "50px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
          <button onClick={() => setShowExitModal(true)} style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 15, cursor: "pointer" }}>✕</button>
          <div style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "6px 14px", border: "1px solid rgba(255,255,255,0.15)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</p>
          </div>
          <button onClick={() => setShowCoach(true)} style={{ width: 36, height: 36, borderRadius: 18, background: `${accentColor}30`, backdropFilter: "blur(10px)", border: `1px solid ${accentColor}60`, cursor: "pointer", padding: 3, display: "flex", alignItems: "center", justifyContent: "center" }}><AceAvatar size={28} /></button>
        </div>

        {/* Progression exercices — segments */}
        <div style={{ position: "absolute", bottom: 12, left: 20, right: 20, zIndex: 2, display: "flex", gap: 4 }}>
          {exercices.map((_, i) => {
            const fill = i < exIdx ? 1 : i === exIdx ? setIdx / totalSets : 0;
            return (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                <div style={{ width: "100%", transform: `translateX(${fill * 100 - 100}%)`, height: "100%", background: accentColor, borderRadius: 2, transition: "transform 240ms var(--ease-out)" }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Zone Focus ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px 36px" }}>

        {/* Nom */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: accentColor, marginBottom: 6 }}>EXERCICE {exIdx + 1}/{exercices.length}{currentEx.muscles ? ` · ${(currentEx.muscles || "").split(/[\s,]+/)[0].toUpperCase()}` : ""}</p>
          <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", color: "white" }}>{currentEx.nom}</h1>
          {currentEx.conseil && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8, fontStyle: "italic" }}>💡 {currentEx.conseil}</p>}
        </div>

        {/* Chiffre géant */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>SÉRIE {setIdx + 1} SUR {totalSets}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, color: accentColor, letterSpacing: "-0.04em", textShadow: `0 0 50px ${accentColor}40` }}>{currentEx.reps}</span>
            <span style={{ fontSize: 20, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{currentEx.chargeKg > 0 ? `× ${currentEx.chargeKg}kg${currentEx.chargeUnite === "par main" ? " /main" : ""}` : "reps"}</span>
          </div>

          {/* Séries cercles */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {Array.from({ length: totalSets }).map((_, i) => {
              const done = !!completedSets[`${exIdx}-${i}`];
              const current = i === setIdx && !done;
              return (
                <div key={i} style={{ width: 38, height: 38, borderRadius: 19, background: done ? accentColor : current ? `${accentColor}20` : "rgba(255,255,255,0.06)", border: `2px solid ${done || current ? accentColor : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: done ? "#000" : current ? accentColor : "rgba(255,255,255,0.3)", boxShadow: current ? `0 0 16px ${accentColor}50` : "none", transition: "var(--t-choix)" }}>
                  {done ? "✓" : i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bouton massif */}
        <button onClick={handleSetComplete} style={{ width: "100%", height: 64, background: accentColor, border: "none", borderRadius: 20, color: "#000", fontSize: 18, fontWeight: 900, letterSpacing: "-0.01em", cursor: "pointer", boxShadow: `0 8px 40px ${accentColor}40`, fontFamily: "'Inter',sans-serif" }}>
          SÉRIE VALIDÉE ✓
        </button>
      </div>


      {/* Bouton Coach IA flottant */}
      <button onClick={() => setShowCoach(true)} style={{ position: "fixed", bottom: "calc(112px + env(safe-area-inset-bottom, 0px))", right: 20, width: 54, height: 54, borderRadius: DS.radius.full, background: accentColor, border: "none", color: "#000", fontSize: 22, cursor: "pointer", boxShadow: `0 0 24px ${accentColor}60`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        <AceAvatar size={22} />
      </button>

      {/* Drawer Coach IA */}
      {showCoach && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowCoach(false)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "0 0 40px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: accentColor + "20", border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><AceAvatar size={30} /></div>
                <div>
                  <p style={{ ...s.heading, fontSize: 15, color: DS.colors.textPrimary }}>Coach IA</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em" }}>EN LIGNE</p>
                </div>
              </div>
              <button onClick={() => setShowCoach(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 30, height: 30, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            {/* Contexte exercice actuel */}
            {currentEx && (
              <div style={{ margin: "8px 16px 0", background: accentColor + "12", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.md, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: accentColor, marginBottom: 1 }}>{currentEx.nom}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>
                    {Object.keys(completedSets).filter(k => k.startsWith(`${exIdx}-`)).length}/{currentEx.sets} séries · {currentEx.reps} reps{currentEx.chargeKg > 0 ? ` · ${currentEx.chargeKg}kg` : ""}
                  </p>
                </div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>
                  {exIdx + 1}/{exercices.length}
                </div>
              </div>
            )}
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {coachMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, marginBottom: 2 }}><AceAvatar size={28} /></div>
                  )}
                  <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? accentColor : "rgba(255,255,255,0.08)", color: msg.role === "user" ? "#000" : "white", fontSize: 13, lineHeight: 1.6, fontFamily: "'Inter',sans-serif", fontWeight: msg.role === "user" ? 600 : 400 }}>
                    {msg.text.split("**").map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><AceAvatar size={28} /></div>
                  <div style={{ display: "flex", gap: 4, padding: "12px 16px", background: DS.colors.surfaceHigh, borderRadius: "18px 18px 18px 4px" }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, animation: `pulse 1s ease ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>
            {/* Message bloqué si limite atteinte */}
            {coachBlocked && (
              <div style={{ margin: "8px 16px", background: "rgba(155,232,79,0.08)", border: "1px solid rgba(155,232,79,0.2)", borderRadius: DS.radius.lg, padding: "12px 14px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentColor, fontWeight: 600, marginBottom: 4 }}>⚡ Limite gratuite atteinte</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec, marginBottom: 8 }}>2 messages gratuits par séance. Passe en Pro pour un coach illimité.</p>
                <button onClick={() => setShowUpsell(true)} style={{ background: accentColor, border: "none", borderRadius: DS.radius.full, padding: "6px 16px", color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Débloquer le coach →</button>
              </div>
            )}
            {/* Suggestions rapides contextuelles */}
            <div style={{ padding: "6px 16px 0", display: "flex", gap: 6, overflowX: "auto", opacity: coachBlocked ? 0.3 : 1, pointerEvents: coachBlocked ? "none" : "auto" }}>
              {[
                "Trop lourd 😓",
                "Alternative ?",
                "J'ai mal 🤕",
                "Forme correcte ?",
                "Prochain exo ?",
              ].map((sug, i) => (
                <button key={i} onClick={() => setCoachInput(sug)} style={{ flexShrink: 0, padding: "5px 12px", background: accentColor + "10", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.full, color: accentColor, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>{sug}</button>
              ))}
            </div>
            {/* Input */}
            <div style={{ padding: "8px 16px 4px", display: "flex", gap: 8 }}>
              <input enterKeyHint="send" value={coachInput} onChange={e => !coachBlocked && setCoachInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCoachMessage()} placeholder={coachBlocked ? "Limite atteinte — Passe en Pro" : "Parle à Ace..."} style={{ flex: 1, height: 44, padding: "0 16px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 14, outline: "none", fontFamily: "'Inter',sans-serif" }} />
              <button onClick={sendCoachMessage} disabled={!coachInput.trim() || coachLoading} style={{ width: 44, height: 44, borderRadius: DS.radius.full, background: coachInput.trim() ? accentColor : "rgba(255,255,255,0.08)", border: "none", color: coachInput.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, flexShrink: 0, fontWeight: 700 }}>→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYMENT SUCCESS SCREEN
// ─────────────────────────────────────────────
function PaymentSuccessScreen({ plan, onContinue }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const planLabel = plan === "annual" ? "Annuel" : "Mensuel";
  const planEmoji = plan === "annual" ? "⚡" : "🚀";

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 40%, rgba(155,232,79,0.1), transparent)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>
        {/* Icône animée */}
        <div style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.9)", transition: "opacity 360ms var(--ease-out), transform 360ms var(--ease-spring)", marginBottom: 32 }}>
          <div style={{ width: 100, height: 100, borderRadius: 28, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, margin: "0 auto", boxShadow: "0 0 60px rgba(155,232,79,0.5)" }}>
            {planEmoji}
          </div>
        </div>

        {/* Texte */}
        <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(12px)", transition: "opacity 300ms var(--ease-out), transform 300ms var(--ease-out)" }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), fontWeight: 800, letterSpacing: "0.06em", marginBottom: 14 }}>PAIEMENT CONFIRMÉ</p>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: "-0.03em" }}>
            BIENVENUE DANS<br />L'ÉQUIPE PRO ⚡
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, marginBottom: 8, lineHeight: 1.6 }}>
            Plan <strong style={{ color: DS.colors.textPrimary }}>{planLabel}</strong> activé. Ton programme personnalisé est en cours de génération.
          </p>

          {/* Features débloquées */}
          <div style={{ background: "rgba(155,232,79,0.06)", border: "1px solid rgba(155,232,79,0.2)", borderRadius: 20, padding: "20px 20px", marginTop: 28, marginBottom: 32, textAlign: "left" }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), fontWeight: 800, letterSpacing: "0.06em", marginBottom: 14 }}>CE QUE TU VIENS DE DÉBLOQUER</p>
            {[
              { emoji: "📈", text: "Séances illimitées" },
              { emoji: "🤖", text: "Coach IA en temps réel" },
              { emoji: "⚡", text: "Progression automatique des charges" },
              { emoji: "🏆", text: "Cycles infinis de progression" },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ fontSize: 16 }}>{f.emoji}</span>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textPrimary, fontWeight: 500 }}>{f.text}</p>
                <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
            ))}
          </div>

          <button onClick={onContinue} style={{ width: "100%", height: 56, background: "#9BE84F", border: "none", borderRadius: 9999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(155,232,79,0.4)" }}>
            Voir mon programme →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME GENERATION LOADING SCREEN
// ─────────────────────────────────────────────
function ProgrammeGeneratingScreen({ sport, onDone, programmeActif, programmeLoading, onboardingData }) {
  const theme = getSportTheme(sport);
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");
  const [checkIdx, setCheckIdx] = useState(0);

  const steps = [
    { emoji: "🔍", text: "Analyse de ton profil sportif", duration: 3000 },
    { emoji: "🧠", text: "L'IA construit ta structure", duration: 4000 },
    { emoji: "💪", text: "Sélection des exercices clés", duration: 3000 },
    { emoji: "📈", text: "Calibration des progressions", duration: 4000 },
    { emoji: "⚡", text: "Optimisation pour ton sport", duration: 3000 },
    { emoji: "🎯", text: "Personnalisation finale", duration: 2000 },
    { emoji: "✅", text: "Programme prêt !", duration: 1000 },
  ];

  // Checklist personnalisée construite avec les vraies données de l'utilisateur
  const equipLabels = { salle_complete: "salle complète", salle_basique: "salle basique", maison: "entraînement maison", terrain: "extérieur" };
  const niveauLabels = { debutant: "débutant", intermediaire: "intermédiaire", avance: "avancé" };
  const checklist = [
    `Exercices sélectionnés pour ton poste`,
    `Charges calibrées sur ton niveau ${niveauLabels[onboardingData?.niveau] || ""}`,
    `Programme adapté pour "${equipLabels[onboardingData?.equipement] || "ton équipement"}"`,
    ...(onboardingData?.douleurs?.length > 0 && !onboardingData.douleurs.includes("aucune")
      ? [`Exercices remplacés pour protéger ${onboardingData.douleurs.length > 1 ? "tes zones sensibles" : "ta zone sensible"}`]
      : ["Aucune contrainte détectée — intensité maximale"]),
    `Progression sur 4 semaines programmée`,
    `Fréquence ${onboardingData?.frequence || 3}x/semaine intégrée`,
  ];

  useEffect(() => {
    let elapsed = 0;
    const timers = [];
    steps.forEach((s, i) => {
      if (i < steps.length - 1) timers.push(setTimeout(() => setStep(i), elapsed));
      elapsed += s.duration;
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Si programme déjà prêt et on a dépassé les étapes visuelles
  // On attend le VRAI programme : on n'entre dans l'app que quand il est prêt
  // (ou si la génération a échoué, le dashboard proposera de réessayer)
  useEffect(() => {
    if (step < steps.length - 2) return;
    if (programmeActif) { setStep(steps.length - 1); const t = setTimeout(() => onDone(), 900); return () => clearTimeout(t); }
    if (!programmeLoading) { const t = setTimeout(() => onDone(), 1500); return () => clearTimeout(t); }
  }, [programmeActif, programmeLoading, step]);

  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 400);
    return () => clearInterval(d);
  }, []);

  useEffect(() => {
    const c = setInterval(() => setCheckIdx(p => Math.min(p + 1, checklist.length)), 1800);
    return () => clearInterval(c);
  }, []);

  const progress = Math.round((step / (steps.length - 1)) * 100);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 400px 400px at 50% 40%, ${theme.accent}08, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 390 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px", boxShadow: `0 0 50px ${theme.accent}50`, animation: "pulse 2s ease infinite" }}>⚡</div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 10 }}>GÉNÉRATION EN COURS</p>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, lineHeight: 1.1, letterSpacing: "0.02em" }}>
            Ton programme<br />se construit{dots}
          </h1>
        </div>

        {/* Barre de progression */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>PROGRESSION</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>{progress}%</p>
          </div>
          <div style={{ background: DS.colors.surface, borderRadius: 9999, height: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", transform: `translateX(${progress - 100}%)`, background: theme.accent, borderRadius: 9999, transition: "transform 500ms var(--ease-out)", boxShadow: `0 0 12px ${theme.accent}80` }} />
          </div>
        </div>

        {/* Étapes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: i < step ? theme.accent + "08" : i === step ? theme.accent + "15" : "rgba(255,255,255,0.02)", border: `1px solid ${i <= step ? theme.accent + "25" : "rgba(255,255,255,0.04)"}`, borderRadius: 14, transition: "var(--t-choix)", opacity: i > step ? 0.35 : 1 }}>
              <span style={{ fontSize: 16, filter: i > step ? "grayscale(1)" : "none", transition: "filter 0.3s" }}>{s.emoji}</span>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: i <= step ? DS.colors.textPrimary : DS.colors.textSec, fontWeight: i === step ? 600 : 400, flex: 1 }}>{s.text}</p>
              {i < step && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round"/></svg>
              )}
              {i === step && (
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${theme.accent}`, borderTopColor: "transparent", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Checklist de personnalisation en direct */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}20`, borderRadius: 16, padding: "16px 18px" }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 12 }}>CONSTRUIT SPÉCIALEMENT POUR TOI</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checklist.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i < checkIdx ? 1 : 0.25, transition: "opacity 240ms ease" }}>
                {i < checkIdx ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: i === checkIdx - 1 ? "pop 0.4s var(--ease-spring)" : "none" }}><circle cx="12" cy="12" r="11" fill={theme.accent} /><path d="M7 12.5L10.5 16L17 8" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <div style={{ width: 15, height: 15, borderRadius: "50%", border: `1px solid ${DS.colors.border}`, flexShrink: 0 }} />
                )}
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: i < checkIdx ? DS.colors.textPrimary : DS.colors.textSec, fontWeight: i < checkIdx ? 600 : 400 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
function CycleCompleteScreen({ programme, sport, cycleLoading, onContinue }) {
  const theme = getSportTheme(sport);
  const cycle = (programme?.data_json?.cycle || 1);
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    if (!cycleLoading) {
      const t = setTimeout(() => setShowContinue(true), 1000);
      return () => clearTimeout(t);
    }
  }, [cycleLoading]);

  const getCycleMsg = (n) => {
    if (n === 1) return { emoji: "🏆", title: "Cycle 1 termine !", desc: "Tu as complete ton premier cycle. Tu es deja plus fort." };
    if (n === 2) return { emoji: "⚡", title: "Cycle 2 accompli !", desc: "Plus intense, plus cible. Ton corps s'est adapte." };
    if (n === 3) return { emoji: "🔥", title: "Niveau avance atteint !", desc: "Tu fais partie des rares qui vont aussi loin." };
    if (n === 4) return { emoji: "💎", title: "Elite !", desc: "Peu d'athletes atteignent ce niveau. Impressionnant." };
    return { emoji: "🚀", title: `Elite+ ${n - 4} accompli !`, desc: `Cycle ${n} termine. Tu repousses des limites que peu connaissent.` };
  };
  const msg = getCycleMsg(cycle);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 400px 400px at 50% 40%, ${theme.accent}08, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>

        {/* Trophée animé */}
        <div style={{ fontSize: 80, marginBottom: 24, animation: "celebrate 0.8s var(--ease-spring)" }}>
          {msg.emoji}
        </div>

        {/* Titre */}
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 12 }}>
          CYCLE {cycle} COMPLETE
        </div>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 42, color: DS.colors.textPrimary, lineHeight: 0.95, marginBottom: 12, letterSpacing: "0.02em" }}>
          {msg.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.06em", marginBottom: 40, maxWidth: 300, margin: "0 auto 40px" }}>
          {msg.desc}
        </p>

        {/* Stats du cycle */}
        <div style={{ display: "flex", gap: 10, marginBottom: 40, justifyContent: "center" }}>
          {[
            { val: cycle, label: "CYCLES", color: accentLisible(theme.accent) },
            { val: `${(programme?.semaine_courante || 8)}`, label: "SEMAINES", color: accentLisible("#9BE84F") },
            { val: "↑↑↑", label: "NIVEAU", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surfaceHigh, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "14px 16px", textAlign: "center", position: "relative", overflow: "hidden", minWidth: 80 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Status génération */}
        {cycleLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, animation: "pulse 1s infinite", boxShadow: `0 0 8px ${theme.accent}` }} />
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em" }}>
              GENERATION DU CYCLE {cycle + 1} EN COURS...
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)", borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), letterSpacing: "0.06em" }}>
              CYCLE {cycle + 1} PRET · PLUS INTENSE
            </p>
          </div>
        )}

        {/* CTA */}
        {showContinue && (
          <button onClick={onContinue} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", boxShadow: `0 8px 32px ${theme.accent}40`, animation: "slideUp 280ms var(--ease-out)" }}>
            ATTAQUER LE CYCLE {cycle + 1} →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// THEME CHOICE SCREEN
// ─────────────────────────────────────────────
function ThemeChoiceScreen({ onChoose }) {
  const [selected, setSelected] = useState(null);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimIn(true), 100);
  }, []);

  const themes = [
    {
      id: "light",
      name: "LUMINEUX",
      desc: "Épuré, moderne, premium",
      bg: "#F4F5F6",
      surface: "#FFFFFF",
      text: "#16181A",
      textSec: "#8A8F94",
      accent: "#9BE84F",
      preview: [
        { type: "card", bg: "#FFFFFF", shadow: true },
        { type: "bar", color: "#9BE84F" },
        { type: "btn", bg: "#9BE84F", text: "#16181A" },
      ],
    },
    {
      id: "dark",
      name: "SOMBRE",
      desc: "Intense, immersif, athlétique",
      bg: "#06060E",
      surface: "#0D0D18",
      text: "#FFFFFF",
      textSec: "#6B6B8A",
      accent: "#9BE84F",
      preview: [
        { type: "card", bg: "#0D0D18", border: "rgba(255,255,255,0.06)" },
        { type: "bar", color: "#9BE84F" },
        { type: "btn", bg: "#9BE84F", text: "#000" },
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #1B1E1C 0%, #0E100F 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 40%, rgba(155,232,79,0.06), transparent)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 390, position: "relative", zIndex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(16px)", transition: "opacity 400ms var(--ease-out), transform 400ms var(--ease-out)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 0 40px rgba(155,232,79,0.4)" }}>⚡</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 32, color: "white", letterSpacing: "0.06em", marginBottom: 8 }}>VOLTRA</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}>CHOISIS TON STYLE</div>
        </div>

        {/* Theme cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 32 }}>
          {themes.map(theme => (
            <div key={theme.id} onClick={() => setSelected(theme.id)} style={{ flex: 1, borderRadius: 24, overflow: "hidden", border: `2px solid ${selected === theme.id ? "#9BE84F" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", transform: selected === theme.id ? "scale(1.02)" : "scale(1)", boxShadow: selected === theme.id ? "0 0 30px rgba(155,232,79,0.3)" : "none" }}>

              {/* Preview mini app */}
              <div style={{ background: theme.bg, padding: "16px 12px", height: 200 }}>
                {/* Mini header */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⚡</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 5, background: theme.text, borderRadius: 3, opacity: 0.7, marginBottom: 3, width: "60%" }} />
                    <div style={{ height: 3, background: theme.textSec, borderRadius: 3, opacity: 0.5, width: "40%" }} />
                  </div>
                </div>
                {/* Mini card */}
                <div style={{ background: theme.surface, borderRadius: 12, padding: "10px 10px", marginBottom: 8, boxShadow: theme.id === "light" ? "0 2px 12px rgba(0,0,0,0.08)" : "none", border: theme.id === "dark" ? `1px solid ${theme.preview[0].border}` : "none" }}>
                  <div style={{ height: 4, background: theme.accent, borderRadius: 99, marginBottom: 6, width: "70%" }} />
                  <div style={{ height: 3, background: theme.textSec, borderRadius: 3, opacity: 0.4, marginBottom: 4, width: "90%" }} />
                  <div style={{ height: 3, background: theme.textSec, borderRadius: 3, opacity: 0.3, width: "60%" }} />
                </div>
                {/* Mini progress */}
                <div style={{ height: 4, background: theme.id === "light" ? "#ECEEF0" : "#1A1A28", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "65%", background: theme.accent, borderRadius: 99 }} />
                </div>
                {/* Mini button */}
                <div style={{ height: 28, background: theme.accent, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ height: 3, width: "50%", background: theme.id === "light" ? "#16181A" : "#16181A", borderRadius: 3, opacity: 0.8 }} />
                </div>
              </div>

              {/* Theme label */}
              <div style={{ background: selected === theme.id ? "#9BE84F" : "rgba(255,255,255,0.06)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: selected === theme.id ? "#16181A" : "white", letterSpacing: "0.08em" }}>{theme.name}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: selected === theme.id ? "#16181A" : "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginTop: 2 }}>{theme.desc}</p>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 9999, border: `2px solid ${selected === theme.id ? "#16181A" : "rgba(255,255,255,0.3)"}`, background: selected === theme.id ? "#16181A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selected === theme.id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", letterSpacing: "0.06em", marginBottom: 24 }}>TU POURRAS CHANGER CA DANS TON PROFIL</p>

        {/* CTA */}
        <button onClick={() => selected && onChoose(selected)} disabled={!selected} style={{ width: "100%", height: 56, background: selected ? "#9BE84F" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 9999, color: selected ? "#16181A" : "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", cursor: selected ? "pointer" : "not-allowed", transition: "var(--t-choix)", boxShadow: selected ? "0 8px 32px rgba(155,232,79,0.4)" : "none" }}>
          {selected ? `CONTINUER EN MODE ${themes.find(t => t.id === selected)?.name} →` : "SÉLECTIONNE UN THÈME"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WELCOME SCREEN
// ─────────────────────────────────────────────
function WelcomeScreen({ onStart }) {
  const [featureIdx, setFeatureIdx] = useState(0);
  const accentTexte = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;

  const features = [
    { emoji: "🎯", title: "Programme 100% personnalisé", desc: "L'IA crée ton programme selon ton sport, ton poste, ton niveau et tes objectifs." },
    { emoji: "📈", title: "Progression automatique", desc: "Tes charges augmentent intelligemment chaque semaine pour maximiser tes gains." },
    { emoji: "🤖", title: "Ace, ton coach IA", desc: "Il t'accompagne pendant chaque séance, adapte les charges et te motive." },
    { emoji: "🏆", title: "Suis tes records", desc: "Visualise ta progression semaine après semaine et bats tes limites." },
  ];

  // Carrousel automatique, façon « stories »
  useEffect(() => {
    const t = setTimeout(() => setFeatureIdx(i => (i + 1) % features.length), 3200);
    return () => clearTimeout(t);
  }, [featureIdx]);

  const sports = ["🏀 Basketball", "⚽ Football", "🎾 Tennis", "🏉 Rugby", "🏊 Natation", "🏃 Sprint", "🥊 Combat"];
  const f = features[featureIdx];

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -160, right: -120, width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`, pointerEvents: "none" }} />

      <div className="v-stagger" style={{ flex: 1, padding: "56px 24px 0", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: DS.shadow.primary }}>⚡</div>
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: "0.04em", color: DS.colors.textPrimary }}>VOLTRA</span>
        </div>

        {/* Titre */}
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 40, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 14 }}>
          Ta prépa<br />physique<br /><span style={{ color: accentTexte }}>sur mesure</span>
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, lineHeight: 1.5, color: DS.colors.textSec, marginBottom: 28, maxWidth: 320 }}>
          Un programme créé par l'IA pour ton sport, et un coach qui t'accompagne à chaque séance.
        </p>

        {/* Carte fonctionnalité, qui défile toute seule */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 24, padding: "18px 20px 20px", boxShadow: DS.shadow.card }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {features.map((_, i) => (
              <div key={i} onClick={() => setFeatureIdx(i)} style={{ flex: 1, height: 4, borderRadius: 2, background: DS.colors.surfaceHigh, overflow: "hidden", cursor: "pointer" }}>
                <div key={featureIdx} style={{ height: "100%", borderRadius: 2, background: DS.colors.primary, width: i < featureIdx ? "100%" : "0%", animation: i === featureIdx ? "vProgress 3.2s linear forwards" : "none" }} />
              </div>
            ))}
          </div>
          <div key={featureIdx} className="v-up" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div className="v-float" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 16, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{f.emoji}</div>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 17, color: DS.colors.textPrimary, marginBottom: 4 }}>{f.title}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.5, color: DS.colors.textSec }}>{f.desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau des sports qui défile */}
      <div style={{ overflow: "hidden", margin: "28px 0 20px", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content", animation: "vMarquee 22s linear infinite" }}>
          {[...sports, ...sports].map((sp, i) => (
            <span key={i} style={{ whiteSpace: "nowrap", background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: "8px 14px", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13, color: DS.colors.textPrimary }}>{sp}</span>
          ))}
        </div>
      </div>

      {/* Bouton */}
      <div className="v-up" style={{ padding: "0 24px 40px", position: "relative", zIndex: 1, animationDelay: "0.35s" }}>
        <PrimaryButton onClick={onStart} style={{ height: 58 }}>
          <span className="v-shine" style={{ position: "absolute", inset: 0, borderRadius: DS.radius.full }} />
          Construire mon programme
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </PrimaryButton>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, textAlign: "center", marginTop: 12 }}>
          Gratuit · 2 minutes · Sans carte bancaire
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN SPLASH
// ─────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 150);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => onDone && onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.8)", transition: "opacity 800ms var(--ease-out), transform 800ms var(--ease-out)", pointerEvents: "none" }} />

      {phase >= 1 && (
        <div className="v-pop v-glow" style={{ width: 92, height: 92, borderRadius: 28, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, position: "relative", zIndex: 1, marginBottom: 26 }}>
          <span className="v-shine" style={{ position: "absolute", inset: 0, borderRadius: 28 }} />
          ⚡
        </div>
      )}

      <div style={{ display: "flex", position: "relative", zIndex: 1 }}>
        {"VOLTRA".split("").map((l, i) => (
          <span key={i} style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 44, letterSpacing: "0.04em", color: DS.colors.textPrimary, opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "none" : "translateY(14px)", transition: `opacity 400ms var(--ease-out) ${i * 0.04}s, transform 400ms var(--ease-out) ${i * 0.04}s` }}>{l}</span>
        ))}
      </div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: "0.12em", color: DS.colors.textSec, marginTop: 10, opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.6s ease 0.5s", position: "relative", zIndex: 1 }}>
        PERFORMANCE · IA · SPORT
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN AUTH
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DOCUMENTS LEGAUX
// ─────────────────────────────────────────────
const LEGAL_EMAIL = "contact.voltra1@gmail.com";
const LEGAL_DATE = "4 novembre 2026";
// À compléter par Erwan : affichés automatiquement dès qu'ils sont renseignés
const LEGAL_SIRET = "";
const LEGAL_STATUT = "";
const LEGAL_MEDIATEUR = "";
const LEGAL_DOCS = {
  cgu: {
    label: "CGU",
    title: "Conditions générales d'utilisation et de vente",
    sections: [
      ["1. Objet", "Voltra est une application web de préparation physique qui génère des programmes d'entraînement personnalisés grâce à l'intelligence artificielle, et propose un coach virtuel (Ace). Les présentes conditions encadrent l'utilisation de l'application et la vente des abonnements. En créant un compte, tu les acceptes."],
      ["2. Éditeur", `Voltra, édité par Erwan Mantouba, Rennes (35000), France. Contact : ${LEGAL_EMAIL}.`],
      ["3. Compte", "Tu dois avoir au moins 12 ans pour créer un compte. Les moins de 15 ans doivent avoir l'accord de leur représentant légal pour l'utilisation de leurs données personnelles, et les mineurs doivent avoir l'accord de leur représentant légal pour tout achat. Tu es responsable de la confidentialité de tes identifiants et des informations que tu fournis, qui doivent être exactes."],
      ["4. Offres et prix", "Voltra propose une offre gratuite (accès limité) et des offres payantes (abonnement mensuel, abonnement annuel). Les tarifs en vigueur sont affichés dans l'application, toutes taxes comprises, avant le paiement. Les paiements sont traités de façon sécurisée par Stripe ; Voltra n'a jamais accès à tes données bancaires."],
      ["5. Abonnements et résiliation", `Les abonnements se renouvellent automatiquement à chaque échéance (mensuelle ou annuelle) jusqu'à résiliation. Tu peux résilier à tout moment, en quelques clics, depuis ton profil (« Gérer mon abonnement »), ou en écrivant à ${LEGAL_EMAIL} ; la résiliation prend effet à la prochaine échéance et l'accès Pro reste actif jusqu'à la fin de la période déjà payée. Une réduction de bienvenue peut s'appliquer au premier mois de l'abonnement mensuel ou à la première année de l'abonnement annuel uniquement, dans les conditions affichées lors de l'offre.`],
      ["6. Droit de rétractation", `Conformément au Code de la consommation, tu disposes de 14 jours à compter de ta souscription pour te rétracter, sans avoir à te justifier, en écrivant à ${LEGAL_EMAIL}. Le contenu numérique (programme généré, accès Pro) étant fourni immédiatement, en validant ton achat tu demandes l'exécution immédiate du service et reconnais perdre ton droit de rétractation une fois le service pleinement exécuté ; en cas de rétractation dans le délai, tu ne paies que la part de service déjà utilisée.`],
      ["7. Santé et sécurité — important", "Voltra fournit des conseils sportifs généraux et ne remplace en aucun cas un avis médical. Avant de commencer un programme, consulte un médecin, surtout en cas de blessure, de douleur, de pathologie, de grossesse ou de reprise après une longue pause. Les programmes et les réponses du coach IA sont générés automatiquement : ils peuvent comporter des erreurs et doivent être adaptés à ta condition. Tu t'entraînes sous ta seule responsabilité et tu arrêtes immédiatement en cas de douleur ou de malaise. Dans la mesure permise par la loi, Voltra ne peut être tenu responsable des blessures liées à une mauvaise utilisation du service."],
      ["8. Utilisation acceptable", "Tu t'engages à ne pas détourner l'application (piratage, extraction automatisée, partage de ton compte, contournement des limites de l'offre gratuite) ni à demander au coach IA des contenus illicites ou dangereux. Voltra peut suspendre un compte en cas d'abus."],
      ["9. Propriété intellectuelle", "L'application, son design, sa marque et ses contenus sont protégés. Tu bénéficies d'un droit d'usage personnel, non exclusif et non transférable. Les programmes générés pour toi sont à ton usage personnel."],
      ["10. Disponibilité", "Voltra met tout en œuvre pour assurer un service continu mais ne garantit pas une disponibilité permanente (maintenance, incident, dépendance à des services tiers). Les fonctionnalités peuvent évoluer."],
      ["11. Suppression du compte", `Tu peux demander la suppression de ton compte et de tes données à tout moment à ${LEGAL_EMAIL}. Elle est effectuée dans un délai maximum de 30 jours.`],
      ["12. Droit applicable et litiges", `Les présentes conditions sont soumises au droit français. En cas de litige, contacte-nous d'abord à ${LEGAL_EMAIL} pour trouver une solution amiable. Tu peux aussi recourir gratuitement à un médiateur de la consommation${LEGAL_MEDIATEUR ? ` (${LEGAL_MEDIATEUR})` : ""} ou à la plateforme européenne de règlement en ligne des litiges, et tu conserves la faculté de saisir les tribunaux compétents.`],
      ["Dernière mise à jour", LEGAL_DATE],
    ],
  },
  privacy: {
    label: "Confidentialité",
    title: "Politique de confidentialité",
    sections: [
      ["Responsable du traitement", `Voltra, édité par Erwan Mantouba, Rennes (35000), France — ${LEGAL_EMAIL}.`],
      ["Données que nous collectons", "• Compte : prénom, adresse e-mail, mot de passe (stocké chiffré, jamais lisible).\n• Profil sportif : sport, objectif, poste ou discipline, niveau, fréquence et jours d'entraînement, équipement.\n• Données de santé : zones de douleur ou de blessure, poids, âge, taille. Ces informations sont facultatives et servent uniquement à adapter tes programmes.\n• Activité : séances réalisées, charges, répétitions, historique, records.\n• Photo de profil (facultative).\n• Échanges avec le coach IA.\n• Paiement : géré par Stripe ; nous recevons seulement l'état de ton abonnement, jamais ton numéro de carte."],
      ["Pourquoi (finalités et bases légales)", "• Créer ton compte et fournir le service, générer tes programmes et le coach IA : exécution du contrat.\n• Traiter tes données de santé (blessures, poids, âge) pour personnaliser l'entraînement : ton consentement explicite, que tu donnes en les renseignant et que tu peux retirer à tout moment.\n• Gérer les paiements et obligations comptables : exécution du contrat et obligation légale.\n• Sécuriser le service et prévenir les abus : intérêt légitime."],
      ["Intelligence artificielle", "Pour générer ton programme et répondre au coach, les informations utiles de ton profil (sport, objectif, niveau, blessures, poids, âge, séance en cours) et tes messages sont transmis à notre prestataire d'IA (Anthropic). Ton adresse e-mail et ton identité ne sont pas nécessaires à cette génération. Les décisions prises par l'IA (programme, conseils) ne produisent pas d'effet juridique sur toi."],
      ["Prestataires et transferts hors UE", "Nous faisons appel à : Supabase (base de données, authentification, stockage), Vercel (hébergement de l'application), Stripe (paiement), Anthropic (intelligence artificielle). Certains sont situés aux États-Unis ou ailleurs hors Union européenne ; les transferts sont encadrés par des garanties appropriées (clauses contractuelles types de la Commission européenne ou équivalent). Nous ne vendons jamais tes données."],
      ["Durée de conservation", "Tes données sont conservées tant que ton compte est actif, puis supprimées dans un délai de 30 jours après la suppression du compte. Les données de facturation sont conservées 10 ans (obligation légale comptable) par notre prestataire de paiement."],
      ["Tes droits", `Tu disposes des droits d'accès, de rectification, d'effacement, de limitation, d'opposition, de portabilité et du droit de retirer ton consentement à tout moment. Pour les exercer : ${LEGAL_EMAIL} (réponse sous 1 mois). Tu peux aussi modifier tes informations directement dans ton profil. En cas de désaccord, tu peux saisir la CNIL (www.cnil.fr).`],
      ["Cookies et stockage local", "Voltra utilise uniquement le stockage de ton navigateur pour le fonctionnement de l'application (session de connexion, thème clair/sombre, séance en pause). Nous n'utilisons pas de cookies publicitaires."],
      ["Mineurs", `Voltra est accessible dès 12 ans. Pour les moins de 15 ans, le traitement des données (y compris de santé) nécessite l'accord d'un représentant légal ; sur demande à ${LEGAL_EMAIL}, nous supprimons sans délai les données d'un mineur collectées sans cet accord.`],
      ["Sécurité", "Les échanges sont chiffrés (HTTPS) et l'accès aux données est protégé par des règles d'accès par utilisateur. Aucun système n'étant infaillible, nous t'informerons en cas d'incident te concernant, conformément à la loi."],
      ["Dernière mise à jour", LEGAL_DATE],
    ],
  },
  mentions: {
    label: "Mentions légales",
    title: "Mentions légales",
    sections: [
      ["Éditeur du site", `Voltra — édité par Erwan Mantouba.\nAdresse : Rennes (35000), France.\nEmail : ${LEGAL_EMAIL}\nDirecteur de la publication : Erwan Mantouba.${LEGAL_STATUT ? `\nStatut : ${LEGAL_STATUT}` : ""}${LEGAL_SIRET ? `\nSIRET : ${LEGAL_SIRET}` : ""}`],
      ["Hébergement", "Application hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (+1 415 398 5463). Base de données et authentification : Supabase Pte. Ltd., Singapour (supabase.com)."],
      ["Propriété intellectuelle", "L'ensemble des éléments de l'application (marque Voltra, logo, textes, design, programmes) est protégé par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite."],
      ["Contact", `Pour toute question ou réclamation : ${LEGAL_EMAIL}.`],
    ],
  },
};

function LegalScreen({ initial = "cgu", onBack }) {
  const [tab, setTab] = useState(initial);
  const doc = LEGAL_DOCS[tab];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "sticky", top: 0, background: DS.colors.bg, borderBottom: `1px solid ${DS.colors.border}`, padding: "52px 16px 12px", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: 20, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 16, cursor: "pointer" }}>←</button>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 18, color: DS.colors.textPrimary, margin: 0 }}>Informations légales</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(LEGAL_DOCS).map(k => (
            <div key={k} onClick={() => setTab(k)} style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", background: tab === k ? DS.colors.primary : DS.colors.surfaceHigh, color: tab === k ? "#000" : DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700 }}>{LEGAL_DOCS[k].label}</div>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 20px 80px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 22, color: DS.colors.textPrimary, margin: "0 0 20px", letterSpacing: "-0.01em" }}>{doc.title}</h1>
        {doc.sections.map(([h, p], i) => (
          <div key={tab + i} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: DS.colors.textPrimary, margin: "0 0 6px" }}>{h}</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.6, color: DS.colors.textSec, margin: 0, whiteSpace: "pre-line" }}>{p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth, confirmation, onboardingData }) {
  const [accepted, setAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(confirmation === "erreur" ? "Ce lien de confirmation a expiré ou a déjà servi. Essaie de te connecter ; sinon, recrée ton compte." : "");
  const [success, setSuccess] = useState(confirmation === "ok" ? "Compte confirmé ! Connecte-toi pour continuer." : "");

  // Detecter si on vient d'un lien reset password
  const isPasswordRecovery = window.location.hash.includes("type=recovery");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    if (mode === "signup" && !name) { setError("Entre ton prénom."); return; }
    if (mode === "signup" && !accepted) { setError("Accepte les CGU et la politique de confidentialité pour continuer."); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caractères minimum."); return; }
    setLoading(true);
    if (mode === "signup") {
      // Les réponses de l'onboarding sont gardées avec le compte, pour les retrouver même si l'email est confirmé ailleurs
      const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { name, ...(onboardingData ? { onboarding: onboardingData } : {}) }, emailRedirectTo: `${window.location.origin}/?confirmed=true` } });
      if (e) { setError(e.message === "User already registered" ? "Email déjà utilisé." : e.message); setLoading(false); return; }
      if (data.user && !data.session) { setSuccess("Vérifie ta boîte mail pour confirmer ton compte !"); setLoading(false); return; }
      onAuth(data.user);
    } else {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) { setError(e.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : e.message); setLoading(false); return; }
      onAuth(data.user);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(""); setSuccess("");
    if (!email) { setError("Entre ton email d'abord."); return; }
    setLoading(true);
    const redirectUrl = `${window.location.origin}${window.location.pathname}#type=recovery`;
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess("Email envoyé ! Vérifie ta boîte mail et clique sur le lien.");
  };

  const handleResetPassword = async () => {
    setError(""); setSuccess("");
    if (!newPassword || !confirmPassword) { setError("Remplis les deux champs."); return; }
    if (newPassword.length < 6) { setError("Minimum 6 caractères."); return; }
    if (newPassword !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (e) { setError(e.message); return; }
    // Nettoyer le hash et rediriger
    window.history.replaceState({}, document.title, window.location.pathname);
    setSuccess("Mot de passe mis à jour !");
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) onAuth(session.user);
      });
    }, 1500);
  };

  // Ecran reset password (vient du lien email)
  if (isPasswordRecovery) {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>🔑</div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Nouveau mot de passe</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec }}>Choisis un nouveau mot de passe sécurisé</p>
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Nouveau mot de passe" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 caractères" />
          <Input label="Confirmer le mot de passe" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Répète ton mot de passe" />
          {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
          {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
          {loading ? (
            <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
              <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
              Mise à jour...
            </div>
          ) : (
            <PrimaryButton onClick={handleResetPassword}>Mettre à jour mon mot de passe</PrimaryButton>
          )}
        </div>
      </div>
    );
  }

  // Mode mot de passe oublié
  if (mode === "forgot") {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>📧</div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Mot de passe oublié ?</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, lineHeight: 1.6 }}>Entre ton email et on t'envoie un lien pour réinitialiser ton mot de passe.</p>
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
          {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
          {success && (
            <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "16px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>📬</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, color: DS.colors.success, fontSize: 14, marginBottom: 4 }}>Email envoyé !</p>
              <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 13 }}>Vérifie ta boîte mail et clique sur le lien de réinitialisation.</p>
            </div>
          )}
          {!success && (
            loading ? (
              <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
                Envoi en cours...
              </div>
            ) : (
              <PrimaryButton onClick={handleForgotPassword}>Envoyer le lien</PrimaryButton>
            )
          )}
          <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <div className="v-stagger" style={{ paddingTop: 64, paddingBottom: 32 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 24 }}>⚡</div>
        <h1 key={mode} className="v-up" style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 10 }}>
          {mode === "login" ? <>Content de<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>te revoir</span></> : <>Crée ton<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>compte</span></>}
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 15 }}>{mode === "login" ? "Ton programme t'attend." : "30 secondes pour sauvegarder ton programme."}</p>
      </div>
      <div className="v-up" style={{ flex: 1, animationDelay: "0.15s" }}>
        <div style={{ position: "relative", display: "flex", background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, padding: 4, marginBottom: 28 }}>
          <div style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: "calc(50% - 4px)", borderRadius: DS.radius.full, background: DS.colors.primary, boxShadow: DS.shadow.primary, transform: mode === "signup" ? "translateX(100%)" : "none", transition: "transform 220ms var(--ease-out)" }} />
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ position: "relative", zIndex: 1, flex: 1, height: 42, borderRadius: DS.radius.full, background: "transparent", border: "none", color: mode === m ? "#0B0B0C" : DS.colors.textSec, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "color 0.25s", fontFamily: "'Inter',sans-serif" }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>
        {mode === "signup" && <Input label="Prénom" value={name} onChange={setName} placeholder="Alex" />}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
        <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="Min. 6 caractères" />
        {mode === "signup" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
            <div onClick={() => setAccepted(a => !a)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, cursor: "pointer", background: accepted ? DS.colors.primary : "transparent", border: `2px solid ${accepted ? DS.colors.primary : DS.colors.textSec}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 13, fontWeight: 800 }}>{accepted ? "✓" : ""}</div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, lineHeight: 1.5, color: DS.colors.textSec, margin: 0 }}>
              J'ai au moins 12 ans (accord d'un parent si moins de 15 ans) et j'accepte les <span onClick={() => setShowLegal("cgu")} style={{ color: DS.colors.primary, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>CGU</span> et la <span onClick={() => setShowLegal("privacy")} style={{ color: DS.colors.primary, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>politique de confidentialité</span>, et que mes données de santé facultatives (blessures, poids, âge) soient utilisées pour personnaliser mon programme.
            </p>
          </div>
        )}
        {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
        {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
        {loading ? (
          <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
            <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
            {mode === "login" ? "Connexion..." : "Création du compte..."}
          </div>
        ) : (
          <PrimaryButton onClick={handleSubmit}>{mode === "login" ? "Se connecter" : "Créer mon compte"}</PrimaryButton>
        )}
        {mode === "login" && (
          <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            Mot de passe oublié ?
          </button>
        )}
      </div>
      <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", paddingBottom: 40, fontFamily: "'Inter',sans-serif" }}>
        <span onClick={() => setShowLegal("cgu")} style={{ textDecoration: "underline", cursor: "pointer" }}>CGU</span> · <span onClick={() => setShowLegal("privacy")} style={{ textDecoration: "underline", cursor: "pointer" }}>Confidentialité</span> · <span onClick={() => setShowLegal("mentions")} style={{ textDecoration: "underline", cursor: "pointer" }}>Mentions légales</span>
      </p>
      {showLegal && <LegalScreen initial={showLegal} onBack={() => setShowLegal(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN ONBOARDING - 6 etapes personnalisees
// ─────────────────────────────────────────────
const POSTES_PAR_SPORT = {
  basketball: [
    { id: "meneur", label: "Meneur", desc: "Vitesse, agilite, cardio", emoji: "⚡" },
    { id: "ailier", label: "Ailier", desc: "Polyvalence, athletisme", emoji: "🏃" },
    { id: "ailier_fort", label: "Ailier-fort", desc: "Force, rebonds", emoji: "💪" },
    { id: "pivot", label: "Pivot", desc: "Puissance, domination", emoji: "🏋️" },
  ],
  football: [
    { id: "gardien", label: "Gardien", desc: "Reflexes, detente", emoji: "🧤" },
    { id: "defenseur", label: "Defenseur", desc: "Force, duels aeriens", emoji: "🛡️" },
    { id: "milieu", label: "Milieu", desc: "Endurance, polyvalence", emoji: "⚙️" },
    { id: "attaquant", label: "Attaquant", desc: "Explosivite, vitesse", emoji: "🎯" },
  ],
  tennis: [
    { id: "fond_de_court", label: "Fond de court", desc: "Endurance, regularite", emoji: "🔄" },
    { id: "serve_volley", label: "Serveur-volleyeur", desc: "Explosivite, reflexes", emoji: "⚡" },
  ],
  rugby: [
    { id: "pilier", label: "Pilier / Talonneur", desc: "Force brute, puissance", emoji: "🏋️" },
    { id: "troisieme_ligne", label: "3eme ligne", desc: "Force + endurance", emoji: "💪" },
    { id: "demi", label: "Demi", desc: "Agilite, explosivite", emoji: "⚡" },
    { id: "trois_quarts", label: "Trois-quarts", desc: "Vitesse, detente", emoji: "🏃" },
    { id: "arriere", label: "Arriere", desc: "Vitesse, vision du jeu", emoji: "🎯" },
  ],
  sprint: [
    { id: "60m", label: "60m / 100m", desc: "Acceleration pure", emoji: "💨" },
    { id: "200m", label: "200m", desc: "Puissance + vitesse", emoji: "⚡" },
    { id: "400m", label: "400m", desc: "Endurance lactique", emoji: "🔥" },
  ],
  combat: [
    { id: "mma", label: "MMA", desc: "Combat complet, polyvalence", emoji: "🥊" },
    { id: "boxe_anglaise", label: "Boxe anglaise", desc: "Vitesse, explosivite des poings", emoji: "👊" },
    { id: "boxe_francaise", label: "Boxe francaise", desc: "Vitesse, coordination pieds-poings", emoji: "🦵" },
    { id: "judo", label: "Judo", desc: "Force, equilibre, explosivite", emoji: "🥋" },
    { id: "jiu_jitsu", label: "Jiu-jitsu bresilien", desc: "Force fonctionnelle, gainage", emoji: "💪" },
    { id: "boxe_thai", label: "Boxe thai", desc: "Puissance, endurance, genoux/coudes", emoji: "🔥" },
  ],
};

const DOULEURS = [
  { id: "aucune", label: "Aucune douleur", emoji: "✅", exclusive: true },
  { id: "epaule", label: "Epaule", emoji: "💪" },
  { id: "genou", label: "Genou", emoji: "🦵" },
  { id: "dos", label: "Dos / Lombaires", emoji: "🦴" },
  { id: "cheville", label: "Cheville", emoji: "🦶" },
  { id: "poignet", label: "Poignet / Coude", emoji: "✋" },
];

const EQUIPEMENTS = [
  { id: "salle_complete", label: "Salle complete", desc: "Tout le materiel disponible", emoji: "🏋️" },
  { id: "salle_basique", label: "Salle basique", desc: "Barres, halteres, machines", emoji: "⚙️" },
  { id: "maison", label: "Maison", desc: "Poids du corps + elastiques", emoji: "🏠" },
  { id: "terrain", label: "Terrain / Exterieur", desc: "Sans materiel specifique", emoji: "🌿" },
];

const TOTAL_STEPS = 6;

function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    sport: null, objectif: null, poste: null,
    douleurs: [], equipement: null,
    niveau: null, frequence: 3, jours: [1, 3, 5],
    poids: null, age: null, taille: null,
  });
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [reaction, setReaction] = useState(null);
  const [showCoachDemo, setShowCoachDemo] = useState(false);

  const hasPoste = data.sport && data.sport !== "natation";
  const stepLabels = ["Sport", "Objectif", ...(hasPoste ? ["Poste"] : []), "Douleurs", "Equipement", "Niveau", "Âge", "Taille", "Poids"];
  const totalSteps = stepLabels.length;

  // Step mapping selon si poste existe
  const getStepContent = () => {
    const steps = [0, 1]; // sport, objectif
    if (hasPoste) steps.push(2); // poste
    steps.push(3, 4, 5, 6, 7, 8); // douleurs, equipement, niveau, âge, taille, poids
    return steps[step];
  };
  const contentStep = getStepContent();

  // Âge, taille, poids : facultatifs. « Continuer » garde la valeur affichée, « Passer » n'enregistre rien.
  const PROFIL_DEFAUTS = { 6: ["age", 20], 7: ["taille", 175], 8: ["poids", 70] };
  const champProfil = PROFIL_DEFAUTS[contentStep];

  const goNext = () => {
    // Génère un message de réaction personnalisé selon l'étape
    const msg = getReactionMessage();
    if (msg) {
      setReaction(msg);
      setAnimIn(false);
      setTimeout(() => {
        setReaction(null);
        setStep(s => s + 1);
        setAnimIn(true);
      }, 1100);
    } else {
      setAnimIn(false);
      setTimeout(() => { setStep(s => s + 1); setAnimIn(true); }, 200);
    }
  };

  const getReactionMessage = () => {
    const sportLabel = SPORTS.find(s => s.id === data.sport)?.label || data.sport;
    if (contentStep === 0) {
      const reactions = {
        basketball: "On va cibler ta détente verticale 🚀",
        football: "Programme calibré pour la vitesse et l'endurance ⚡",
        tennis: "On travaille explosivité et réactivité 🎾",
        rugby: "Préparation physique impact et puissance 🏉",
        natation: "Endurance et puissance de nage en approche 🏊",
        sprint: "On va chercher chaque dixième de seconde ⏱️",
        combat: "Puissance et cardio de combattant en approche 🥊",
      };
      return reactions[data.sport] || `Programme ${sportLabel} en préparation 🎯`;
    }
    if (contentStep === 1) {
      const reactions = {
        explosivite: "Objectif explosivité noté — on va bosser le fast-twitch 💥",
        force: "Objectif force noté — charges progressives à venir 🏋️",
        endurance: "Objectif endurance noté — cardio et volume adaptés 🔥",
        masse: "Objectif prise de masse noté — volume et surcharge calibrés 📈",
        detente: "Objectif détente noté — pliométrie au programme 🚀",
      };
      return reactions[data.objectif] || "Objectif noté, programme ajusté 🎯";
    }
    if (contentStep === 2) {
      return `Parfait, on cible les qualités clés de ton poste 🎯`;
    }
    if (contentStep === 3) {
      if (data.douleurs.includes("aucune") || data.douleurs.length === 0) {
        return "Aucune contrainte — on peut pousser fort 💪";
      }
      return "On adapte tes exercices pour te protéger 🛡️";
    }
    if (contentStep === 4) {
      const eqLabel = EQUIPEMENTS.find(e => e.id === data.equipement)?.label || "";
      return `Exercices sélectionnés pour "${eqLabel}" ✅`;
    }
    return null;
  };

  const handleFinish = () => {
    setLoading(true);
    setGenError(false);
    setSlideIndex(0);
    const timeout = setTimeout(() => {
      setGenError(true);
    }, 20000);
    // La génération est lancée une seule fois par l'App (startGeneration)
    onComplete(data, null);
  };

  const retryGeneration = () => {
    setGenError(false);
    handleFinish();
  };

  const skipGeneration = () => {
    setLoading(false);
    setGenError(false);
    onComplete(data, null);
  };

  const toggleDouleur = (id) => {
    if (id === "aucune") {
      setData(d => ({ ...d, douleurs: d.douleurs.includes("aucune") ? [] : ["aucune"] }));
    } else {
      setData(d => ({
        ...d,
        douleurs: d.douleurs.includes("aucune")
          ? [id]
          : d.douleurs.includes(id)
            ? d.douleurs.filter(x => x !== id)
            : [...d.douleurs, id]
      }));
    }
  };

  const canNext = (() => {
    if (contentStep === 0) return data.sport !== null;
    if (contentStep === 1) return data.objectif !== null;
    if (contentStep === 2) return data.poste !== null;
    if (contentStep === 3) return data.douleurs.length > 0;
    if (contentStep === 4) return data.equipement !== null;
    if (contentStep === 5) return data.niveau !== null && (data.jours || []).length === data.frequence;
    if (contentStep >= 6) return true; // profil physique optionnel
    return false;
  })();

  const isLastStep = step === totalSteps - 1;

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px", position: "relative" }}>

      {/* Écran demo coach IA — avant génération */}
      {showCoachDemo && (() => {
        const CoachDemoContent = () => {
          const [msgVisible, setMsgVisible] = useState(0);
          useEffect(() => {
            const t1 = setTimeout(() => setMsgVisible(1), 500);
            const t2 = setTimeout(() => setMsgVisible(2), 1600);
            const t3 = setTimeout(() => setMsgVisible(3), 2900);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
          }, []);
          return (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, minHeight: 180 }}>
                {msgVisible >= 1 && (
                  <div style={{ alignSelf: "flex-end", maxWidth: "78%", background: "#9BE84F", color: "#000", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, animation: "fadeIn 240ms var(--ease-out)" }}>
                    Je suis épuisé, j'y arrive plus 😮‍💨
                  </div>
                )}
                {msgVisible >= 2 && (
                  <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 8, animation: "fadeIn 240ms var(--ease-out)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><AceAvatar size={26} /></div>
                    <div style={{ maxWidth: "78%", background: DS.colors.surface, color: DS.colors.textPrimary, padding: "10px 14px", borderRadius: "18px 18px 18px 4px", fontFamily: "'Inter',sans-serif", fontSize: 13 }}>
                      Pas de souci, on baisse la charge de <strong>15%</strong> pour cette série. On garde le volume, on protège ta forme 💪
                    </div>
                  </div>
                )}
                {msgVisible >= 3 && (
                  <div style={{ alignSelf: "center", background: "rgba(155,232,79,0.12)", border: "1px solid rgba(155,232,79,0.3)", borderRadius: 12, padding: "6px 14px", marginTop: 4, animation: "fadeIn 240ms var(--ease-out)" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.isDark ? "#9BE84F" : DS.colors.primaryDark, fontWeight: 600 }}>✓ Série adaptée en temps réel</p>
                  </div>
                )}
              </div>
              <button onClick={() => { setShowCoachDemo(false); handleFinish(); }} style={{ width: "100%", height: 56, background: "#9BE84F", border: "none", borderRadius: 9999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(155,232,79,0.4)" }}>
                Générer mon programme →
              </button>
            </>
          );
        };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 300, background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", animation: "fadeIn 240ms var(--ease-out)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 20%, rgba(155,232,79,0.08), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 360 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden", margin: "0 auto 14px", boxShadow: "0 0 40px rgba(155,232,79,0.4)" }}><AceAvatar size={56} /></div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 11, color: DS.colors.isDark ? "#9BE84F" : DS.colors.primaryDark, letterSpacing: "0.06em", marginBottom: 8 }}>ACE — TON COACH IA</p>
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, lineHeight: 1.2 }}>Il s'adapte à toi,<br />en temps réel</h2>
              </div>
              <CoachDemoContent />
            </div>
          </div>
        );
      })()}


      {reaction && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", animation: "fadeIn 240ms var(--ease-out)" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20, boxShadow: DS.shadow.primary, animation: "pop 0.4s var(--ease-spring)" }}>
            ✓
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 19, color: DS.colors.textPrimary, textAlign: "center", lineHeight: 1.4 }}>
            {reaction}
          </p>
        </div>
      )}

      {loading && (() => {
        const sportTheme = getSportTheme(data.sport);
        const slides = [
          {
            emoji: "⚡",
            tag: "GENERATION EN COURS",
            title: "Ton programme\nest en creation",
            desc: "L'IA analyse ton profil pour creer un programme sur mesure adapte a ton sport et tes objectifs.",
            visual: (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {[
                  { emoji: "🏋️", text: "Selection des exercices", delay: "0s" },
                  { emoji: "📈", text: "Calcul des progressions", delay: "0.5s" },
                  { emoji: "⚡", text: `Optimisation ${data.sport || "sport"}`, delay: "1s" },
                  { emoji: "✓", text: "Finalisation", delay: "1.5s" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "10px 14px", opacity: 0, animation: `fadeIn 0.4s ease ${item.delay} forwards` }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <p style={{ color: DS.colors.textSec, fontSize: 13 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            emoji: "🏃",
            tag: "SEANCES LIVE",
            title: "Suis chaque\nexercice en temps reel",
            desc: "Photos, chrono, series guidees. Chaque rep est tracee pour maximiser ta progression.",
            visual: (
              <div style={{ background: DS.colors.surface, border: `1px solid ${sportTheme.accent}20`, borderRadius: DS.radius.xl, overflow: "hidden", width: "100%" }}>
                <div style={{ height: 90, background: DS.colors.surfaceHigh, position: "relative", display: "flex", alignItems: "flex-end", padding: "10px 14px" }}>
                  <div style={{ position: "absolute", top: 8, left: 10, background: DS.colors.isDark ? "rgba(6,6,14,0.8)" : "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent) }}>EX 1/5</p>
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 10, background: sportTheme.accent + "20", border: `1px solid ${sportTheme.accent}40`, borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), fontWeight: 700 }}>12:34</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), marginBottom: 2 }}>QUADRICEPS</p>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 20, color: DS.colors.textPrimary }}>SQUAT BARRE</p>
                  </div>
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, background: i <= 2 ? sportTheme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${i <= 2 ? sportTheme.accent : DS.colors.border}`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: i <= 2 ? sportTheme.accent : DS.colors.textSec }}>{i <= 2 ? "✓" : i}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
          {
            emoji: "🤖",
            tag: "COACH IA",
            title: "Un coach\ntoujours disponible",
            desc: "Pendant chaque seance, ton coach IA repond a tes questions, adapte les charges et te motive.",
            visual: (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { role: "user", text: "J'arrive pas a finir mes reps" },
                  { role: "ai", text: "Reduis la charge de 10% et concentre-toi sur la forme. Tu fais du super travail !" },
                  { role: "user", text: "Merci j'ai mal au genou" },
                  { role: "ai", text: "Je remplace le squat par du leg press pour proteger ton genou. Continue !" },
                ].map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", opacity: 0, animation: `fadeIn 0.3s ease ${i * 0.4}s forwards` }}>
                    <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: DS.radius.md, background: msg.role === "user" ? sportTheme.accent : DS.colors.surface, border: msg.role === "ai" ? `1px solid ${DS.colors.border}` : "none" }}>
                      <p style={{ color: msg.role === "user" ? "#000" : DS.colors.textPrimary, fontSize: 12, lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            emoji: "📈",
            tag: "PROGRESSION",
            title: "Vois tes records\nbattre semaine apres semaine",
            desc: "Charges, series, temps — tout est tracé. Tu vois exactement ou tu en es et ce qui t'attend.",
            visual: (
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "14px 16px", width: "100%" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 60, marginBottom: 8 }}>
                  {[40, 55, 50, 70, 65, 85, 100].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 6 ? sportTheme.accent : `rgba(${sportTheme.accentRgb},${0.2 + i * 0.08})`, borderRadius: "3px 3px 0 0", boxShadow: i === 6 ? `0 0 10px ${sportTheme.accent}50` : "none" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>S1</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent) }}>+60% EN 7 SEMAINES</p>
                </div>
              </div>
            ),
          },
        ];
        const currentSlide = slides[Math.min(slideIndex, slides.length - 1)];
        return (
          <div style={{ position: "fixed", inset: 0, background: DS.colors.bg, zIndex: 200, display: "flex", flexDirection: "column", padding: "0 24px 40px" }}>
            {/* Glow */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 300px 300px at 50% 30%, ${sportTheme.accent}06, transparent)`, pointerEvents: "none" }} />

            {/* Dots navigation */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingTop: 52, marginBottom: 32, position: "relative", zIndex: 2 }}>
              {slides.map((_, i) => (
                <div key={i} style={{ width: i === slideIndex ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIndex ? sportTheme.accent : DS.colors.surfaceHigh, transition: "width 240ms var(--ease-out), background 240ms ease", boxShadow: i === slideIndex ? `0 0 8px ${sportTheme.accent}` : "none" }} />
              ))}
            </div>

            {genError ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 12, letterSpacing: "0.05em" }}>Generation lente...</h2>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginBottom: 32, lineHeight: 1.8, letterSpacing: "0.06em" }}>Le serveur prend du temps. Tu peux reessayer ou continuer — le programme se generera en arriere-plan.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <button onClick={retryGeneration} style={{ width: "100%", height: 52, background: DS.colors.primary, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer" }}>REESSAYER</button>
                  <button onClick={skipGeneration} style={{ width: "100%", height: 52, background: "transparent", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 11, letterSpacing: "0.06em", cursor: "pointer" }}>CONTINUER SANS PROGRAMME</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }} key={slideIndex}>
                {/* Tag */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sportTheme.accent + "15", border: `1px solid ${sportTheme.accent}30`, borderRadius: 6, padding: "3px 10px", marginBottom: 16, alignSelf: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sportTheme.accent, animation: "pulse 1.5s infinite" }} />
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), letterSpacing: "0.06em" }}>{currentSlide.tag}</p>
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: "0.02em", whiteSpace: "pre-line" }}>
                  {currentSlide.title}
                </h2>

                {/* Desc */}
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em", marginBottom: 24 }}>{currentSlide.desc}</p>

                {/* Visual */}
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  {currentSlide.visual}
                </div>
              </div>
            )}

            {/* Bottom nav */}
            {!genError && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2, paddingTop: 16 }}>
                <button onClick={() => setSlideIndex(i => Math.max(0, i - 1))} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 44, height: 44, color: DS.colors.textSec, cursor: "pointer", fontSize: 18, opacity: slideIndex === 0 ? 0.3 : 1 }}>←</button>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{slideIndex + 1} / {slides.length}</p>
                <button onClick={() => setSlideIndex(i => Math.min(slides.length - 1, i + 1))} style={{ background: slideIndex === slides.length - 1 ? sportTheme.accent : DS.colors.surfaceHigh, border: "none", borderRadius: slideIndex === slides.length - 1 ? DS.radius.full : DS.radius.full, padding: slideIndex === slides.length - 1 ? "0 20px" : "0", width: slideIndex === slides.length - 1 ? "auto" : 44, height: 44, color: slideIndex === slides.length - 1 ? "#000" : DS.colors.textSec, cursor: "pointer", fontSize: slideIndex === slides.length - 1 ? 13 : 18, fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: "0.05em", boxShadow: slideIndex === slides.length - 1 ? `0 4px 20px ${sportTheme.accent}50` : "none" }}>
                  {slideIndex === slides.length - 1 ? "VOIR MON PROGRAMME →" : "→"}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Barre du haut : retour + progression */}
      <div style={{ paddingTop: 52, paddingBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => step > 0 && setStep(st => st - 1)} aria-label="Retour" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: DS.radius.full, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.shadow.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: step > 0 ? "pointer" : "default", opacity: step > 0 ? 1 : 0, transition: "opacity 0.2s ease" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke={DS.colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, height: 6, borderRadius: DS.radius.full, background: DS.colors.surfaceHigh, overflow: "hidden" }}>
          <div style={{ width: "100%", transform: `translateX(${((step + 1) / totalSteps) * 100 - 100}%)`, height: "100%", borderRadius: DS.radius.full, background: DS.colors.primary, boxShadow: `0 0 10px ${DS.colors.primaryGlow}`, transition: "transform 260ms var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ flex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "opacity 220ms var(--ease-out), transform 220ms var(--ease-out)", overflowY: "auto" }}>

        {/* ETAPE 1 - Sport */}
        {contentStep === 0 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Choisis ta discipline" : "Quel est ton sport ?"} sub="Ton programme sera entièrement adapté." />
            <div className="v-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {SPORTS.map(sport => (
                <div key={sport.id} onClick={() => setData(d => ({ ...d, sport: sport.id, poste: null }))} style={{ background: data.sport === sport.id ? DS.colors.primary : DS.colors.surface, borderRadius: DS.radius.full, padding: "16px 8px", textAlign: "center", cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", transform: data.sport === sport.id ? "scale(1.05)" : "scale(1)", boxShadow: data.sport === sport.id ? DS.shadow.primary : DS.colors.isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{sport.emoji}</div>
                  <div style={{ color: data.sport === sport.id ? "#16181A" : DS.colors.textPrimary, fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{sport.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 2 - Objectif */}
        {contentStep === 1 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Ton objectif de combat ?" : "Quel est ton objectif ?"} sub="Les exercices et les charges s'adapteront." />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(OBJECTIFS_PAR_SPORT[data.sport] || []).map(obj => (
                <div key={obj.id} onClick={() => setData(d => ({ ...d, objectif: obj.id }))} style={{ background: data.objectif === obj.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.objectif === obj.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{obj.emoji}</span>
                  <div>
                    <div style={{ color: data.objectif === obj.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{obj.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{obj.desc}</div>
                  </div>
                  {data.objectif === obj.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 3 - Poste (sauf natation) */}
        {contentStep === 2 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Ta discipline ?" : "Ton poste ?"} sub={data.sport === "combat" ? "Le programme est adapté à ta discipline de combat." : "Le programme cible les qualités de ton poste."} />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(POSTES_PAR_SPORT[data.sport] || []).map(poste => (
                <div key={poste.id} onClick={() => setData(d => ({ ...d, poste: poste.id }))} style={{ background: data.poste === poste.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.poste === poste.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{poste.emoji}</span>
                  <div>
                    <div style={{ color: data.poste === poste.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{poste.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{poste.desc}</div>
                  </div>
                  {data.poste === poste.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 4 - Douleurs */}
        {contentStep === 3 && (
          <div>
            <StepTitle title="Des douleurs ?" sub="Les exercices s'adapteront automatiquement." />
            <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,107,53,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 24, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p style={{ color: DS.colors.warning, fontSize: 12, ...s.body }}>Tu peux selectionner plusieurs zones. Les exercices a risque seront remplaces.</p>
            </div>
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DOULEURS.map(d => {
                const selected = data.douleurs.includes(d.id);
                const solutions = {
                  epaule: "On évite le développé militaire et privilégie les mouvements en amplitude contrôlée",
                  genou: "On adapte les squats en amplitude partielle et priorise les mouvements à faible impact",
                  dos: "On remplace le soulevé de terre par des variantes protégées, gainage renforcé",
                  cheville: "On évite les sauts à fort impact, on privilégie les mouvements au sol",
                  poignet: "On remplace les appuis directs par des prises neutres ou sangles",
                };
                return (
                  <div key={d.id}>
                    <div onClick={() => toggleDouleur(d.id)} style={{ background: selected ? (d.id === "aucune" ? DS.colors.successSoft : DS.colors.warningSoft) : DS.colors.surface, border: `1px solid ${selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)" }}>
                      <span style={{ fontSize: 22 }}>{d.emoji}</span>
                      <p style={{ color: selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.textPrimary, fontSize: 15, ...s.heading, flex: 1 }}>{d.label}</p>
                      {selected && <div style={{ width: 20, height: 20, background: d.id === "aucune" ? DS.colors.success : DS.colors.warning, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                    </div>
                    {selected && solutions[d.id] && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 14px 4px 18px", animation: "fadeIn 240ms var(--ease-out)" }}>
                        <span style={{ fontSize: 13, marginTop: 1 }}>🛡️</span>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, lineHeight: 1.5 }}>{solutions[d.id]}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPE 5 - Equipement */}
        {contentStep === 4 && (
          <div>
            <StepTitle title="Ton équipement ?" sub="Les exercices seront adaptés à ce que tu as." />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {EQUIPEMENTS.map(eq => (
                <div key={eq.id} onClick={() => setData(d => ({ ...d, equipement: eq.id }))} style={{ background: data.equipement === eq.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.equipement === eq.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{eq.emoji}</span>
                  <div>
                    <div style={{ color: data.equipement === eq.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{eq.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{eq.desc}</div>
                  </div>
                  {data.equipement === eq.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 6 - Niveau + Frequence */}
        {contentStep === 5 && (
          <div>
            <StepTitle title="Ton rythme" sub="Le programme se calibre sur ton niveau et ton planning." />
            <div style={{ marginBottom: 36 }}>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Niveau actuel</p>
              <div style={{ display: "flex", gap: 10 }}>
                {NIVEAUX.map(n => (
                  <div key={n} onClick={() => setData(d => ({ ...d, niveau: n.toLowerCase() }))} style={{ flex: 1, padding: "12px 0", textAlign: "center", background: data.niveau === n.toLowerCase() ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.md, color: data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.textSec, fontSize: 14, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", ...s.heading }}>{n}</div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seances par semaine</p>
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 20 }}>
                <div style={{ ...s.display, fontSize: 48, color: DS.colors.primary, textAlign: "center", marginBottom: 16 }}>{data.frequence}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[2, 3, 4, 5].map(n => (
                    <div key={n} onClick={() => setData(d => ({ ...d, frequence: n, jours: (d.jours && d.jours.length === n) ? d.jours : DEFAULT_JOURS[n] }))} style={{ flex: 1, padding: "10px 0", textAlign: "center", background: data.frequence === n ? DS.colors.primary : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: data.frequence === n ? "#000" : DS.colors.textSec, fontSize: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", ...s.heading }}>{n}</div>
                  ))}
                </div>
                <p style={{ color: DS.colors.textSec, fontSize: 13, textAlign: "center", marginTop: 12, ...s.body }}>jours / semaine</p>
              </div>
            </div>
            <div>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quels jours t'entraînes-tu ?</p>
              <DayPicker jours={data.jours || []} max={data.frequence} accent={DS.colors.primary} onChange={(j) => setData(d => ({ ...d, jours: j }))} />
            </div>
          </div>
        )}

        {/* ETAPE 7 - Âge */}
        {contentStep === 6 && (
          <div>
            <StepTitle title="Quel âge as-tu ?" sub="Ton âge nous aide à doser les charges et la récupération." />
            <WheelPicker values={Array.from({ length: 59 }, (_, i) => i + 12)} value={data.age ?? 20} onChange={v => setData(d => ({ ...d, age: v }))} format={v => `${v} ans`} />
          </div>
        )}

        {/* ETAPE 8 - Taille */}
        {contentStep === 7 && (
          <div>
            <StepTitle title="Quelle est ta taille ?" sub="Fais glisser la règle pour choisir ta taille." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingLeft: 8 }}>
              <div>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 64, letterSpacing: "-0.03em", color: DS.colors.textPrimary, fontVariantNumeric: "tabular-nums" }}>{data.taille ?? 175}</span>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 20, color: DS.colors.textSec, marginLeft: 6 }}>cm</span>
              </div>
              <RulerPicker vertical min={130} max={220} value={data.taille ?? 175} onChange={v => setData(d => ({ ...d, taille: v }))} />
            </div>
          </div>
        )}

        {/* ETAPE 9 - Poids */}
        {contentStep === 8 && (
          <div>
            <StepTitle title="Combien pèses-tu ?" sub="Pour proposer des charges vraiment adaptées à toi." />
            <div style={{ textAlign: "center", margin: "24px 0 28px" }}>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 64, letterSpacing: "-0.03em", color: DS.colors.textPrimary, fontVariantNumeric: "tabular-nums" }}>{data.poids ?? 70}</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 20, color: DS.colors.textSec, marginLeft: 6 }}>kg</span>
            </div>
            <RulerPicker min={35} max={160} value={data.poids ?? 70} onChange={v => setData(d => ({ ...d, poids: v }))} />
          </div>
        )}
      </div>

      {[3, 6, 7, 8].includes(contentStep) && (
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, lineHeight: 1.45, color: DS.colors.textSec, marginTop: 14 }}>
          🔒 Donnée de santé facultative. En la renseignant, tu acceptes qu'elle serve uniquement à adapter ton programme. Tu peux retirer ton accord à tout moment.
        </p>
      )}

      {/* Bouton principal, toujours visible en bas */}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))", background: fonduBas() }}>
        <PrimaryButton disabled={!canNext} onClick={() => {
          if (champProfil && data[champProfil[0]] == null) setData(d => ({ ...d, [champProfil[0]]: champProfil[1] }));
          isLastStep ? setShowCoachDemo(true) : goNext();
        }}>
          {isLastStep ? "Générer mon programme" : "Continuer"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </PrimaryButton>
        {champProfil && (
          <button onClick={() => { setData(d => ({ ...d, [champProfil[0]]: null })); isLastStep ? setShowCoachDemo(true) : goNext(); }} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>
            Passer cette étape
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN PRICING
// ─────────────────────────────────────────────
function PricingScreen({ onSelectPlan, programme, frequence, user }) {
  const [selected, setSelected] = useState("annual");
  const [showFeatures, setShowFeatures] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [consentAchat, setConsentAchat] = useState(false);

  // Bouton "Plus tard" visible en haut à gauche
  const SkipButton = () => (
    <button onClick={() => onSelectPlan("free")} style={{
      position: "fixed", top: 52, left: 16, zIndex: 200,
      display: "flex", alignItems: "center", gap: 6,
      background: DS.colors.surface,
      border: `1px solid ${DS.colors.border}`,
      borderRadius: DS.radius.full,
      padding: "8px 14px",
      color: DS.colors.textSec,
      fontFamily: "'Inter',sans-serif",
      fontSize: 13, fontWeight: 600,
      cursor: "pointer",
      boxShadow: DS.shadow.card,
    }}>
      ✕ <span>Plus tard</span>
    </button>
  );

  const handleStripeCheckout = async (planId) => {
    if (planId === "free") { onSelectPlan("free"); return; }
    setLoading(true);
    setStripeError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            plan: planId,
            user_id: session?.user?.id,
            email: session?.user?.email,
            success_url: window.location.origin + window.location.pathname,
            cancel_url: window.location.origin + window.location.pathname,
          }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStripeError("Erreur lors de la redirection. Réessaie.");
      }
    } catch (err) {
      setStripeError("Erreur de connexion. Réessaie.");
    }
    setLoading(false);
  };


  const pad = n => String(n).padStart(2, "0");
  const currentPlan = PLANS.find(p => p.id === selected);
  const featuresPro = ["Progression automatique des charges", "Nouveau programme IA genere a chaque cycle", "Adaptation si seance skippee", "Deload automatique intelligent", "Historique complet + graphiques", "Jusqu'a 5 seances / semaine", "Coach IA integre", "Export PDF du programme"];

  const accentTexte = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const statsProg = [
    { val: String(programme?.data_json?.semaines?.length || 8), label: "semaines" },
    { val: String(programme?.data_json?.semaines?.[0]?.seances?.[0]?.exercices?.length || 5), label: "exos / séance" },
    { val: String(frequence || programme?.data_json?.semaines?.[0]?.seances?.length || 3), label: "séances / sem" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -150, right: -120, width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`, pointerEvents: "none" }} />
      <div className="v-stagger" style={{ padding: "104px 20px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: accentTexte, marginBottom: 10 }}>PROGRAMME PRÊT</p>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 12 }}>
            Débloque<br /><span style={{ color: accentTexte }}>tout Voltra</span>
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: DS.colors.textSec }}>{programme?.titre || "Ton programme"} · accès complet, coach Ace inclus.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {statsProg.map((st, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 18, padding: "12px 6px", textAlign: "center", boxShadow: DS.shadow.card }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 24, color: DS.colors.textPrimary, fontVariantNumeric: "tabular-nums" }}><CountUp value={st.val} delay={200 + i * 120} /></div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Offres */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {PLANS.map(plan => {
            const on = selected === plan.id;
            return (
              <div key={plan.id} onClick={() => setSelected(plan.id)} style={{ position: "relative", background: DS.colors.surface, border: `2px solid ${on ? DS.colors.primary : DS.colors.border}`, borderRadius: 22, padding: "18px 20px", cursor: "pointer", boxShadow: on ? DS.shadow.primary : DS.shadow.card, transform: on ? "scale(1.02)" : "scale(1)", transition: "var(--t-choix), transform 160ms var(--ease-out)" }}>
                {plan.badge && <div style={{ position: "absolute", top: -11, left: 18, padding: "4px 10px", background: DS.colors.primary, borderRadius: DS.radius.full, color: "#0B0B0C", fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>{plan.badge}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: DS.colors.textSec, marginBottom: 2 }}>{plan.label}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em", color: DS.colors.textPrimary }}>{plan.displayPrice || `${plan.price}€`}</span>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec }}>{plan.unit}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>{plan.priceDetail}</span>
                      {plan.savings && <span style={{ padding: "2px 8px", background: DS.colors.primarySoft, borderRadius: DS.radius.full, color: accentTexte, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700 }}>{plan.savings}</span>}
                    </div>
                    {plan.bienvenue && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, color: accentTexte, marginTop: 4 }}>{plan.bienvenue}</p>}
                  </div>
                  <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: DS.radius.full, border: `2px solid ${on ? DS.colors.primary : DS.colors.textDim}`, background: on ? DS.colors.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "var(--t-choix)" }}>
                    {on && <svg className="v-pop" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#0B0B0C" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        {/* Ce qui est inclus */}
        <button onClick={() => setShowFeatures(v => !v)} style={{ width: "100%", background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 18, padding: "14px 18px", color: DS.colors.textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'Inter',sans-serif", marginBottom: 8 }}>
          <span>Voir ce qui est inclus</span>
          <span style={{ transform: showFeatures ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms var(--ease-out)" }}>⌄</span>
        </button>
        {showFeatures && (
          <div className="v-stagger" style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 18, padding: "6px 16px", marginBottom: 16 }}>
            {featuresPro.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < featuresPro.length - 1 ? `1px solid ${DS.colors.border}` : "none" }}>
                <div style={{ width: 22, height: 22, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke={accentTexte} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <span style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textPrimary, fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bouton de paiement, toujours visible */}
      <div style={{ position: "sticky", bottom: 0, padding: "20px 20px calc(24px + env(safe-area-inset-bottom, 0px))", maxWidth: 430, margin: "0 auto", background: fonduBas(), zIndex: 2 }}>
        {stripeError && <p style={{ color: "#FF2D55", fontSize: 12, textAlign: "center", marginBottom: 8, fontFamily: "'Inter',sans-serif" }}>⚠ {stripeError}</p>}
        <ConsentementAchat coche={consentAchat} onChange={setConsentAchat} />
        <PrimaryButton onClick={() => handleStripeCheckout(selected)} disabled={loading || !consentAchat} style={{ height: 58 }}>
          {!loading && <span className="v-shine" style={{ position: "absolute", inset: 0, borderRadius: DS.radius.full }} />}
          {loading ? "Redirection vers Stripe..." : `Continuer avec ${currentPlan.label}`}
        </PrimaryButton>
        <p style={{ color: DS.colors.textSec, fontSize: 12, textAlign: "center", margin: "10px 0 6px", fontFamily: "'Inter',sans-serif" }}>🔒 Paiement sécurisé Stripe · Résiliable à tout moment</p>
        <button onClick={() => onSelectPlan("free")} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif", textDecoration: "underline" }}>
          Non merci, je veux juste essayer gratuitement
        </button>
      </div>
      <SkipButton />
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN MATCHS
// ─────────────────────────────────────────────
function MatchsScreen({ user, onBack }) {
  const [matchs, setMatchs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titre: "", date_match: "", adversaire: "", lieu: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMatchs(); }, []);

  const loadMatchs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("matchs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date_match", new Date().toISOString().split("T")[0])
      .order("date_match", { ascending: true });
    if (data) setMatchs(data);
    setLoading(false);
  };

  const saveMatch = async () => {
    if (!form.titre || !form.date_match) return;
    setSaving(true);
    await supabase.from("matchs").insert({ ...form, user_id: user.id });
    setForm({ titre: "", date_match: "", adversaire: "", lieu: "" });
    setShowForm(false);
    await loadMatchs();
    setSaving(false);
  };

  const deleteMatch = async (id) => {
    await supabase.from("matchs").delete().eq("id", id);
    setMatchs(m => m.filter(x => x.id !== id));
  };

  const getDaysUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getMatchColor = (days) => {
    if (days <= 1) return DS.colors.warning;
    if (days <= 3) return DS.colors.gold;
    return DS.colors.success;
  };

  const getMatchLabel = (days) => {
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `Dans ${days} jours`;
  };

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textSec, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 26, color: DS.colors.textPrimary, letterSpacing: "0.06em" }}>MES MATCHS</h1>
          <button onClick={() => setShowForm(v => !v)} style={{ background: DS.colors.primary, border: "none", borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.primary }}>+</button>
        </div>
      </div>

      <div style={{ padding: "24px 20px 0" }}>

        {showForm && (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: DS.radius.xl, padding: 20, marginBottom: 24 }}>
            <p style={{ color: DS.colors.primary, fontSize: 14, ...s.heading, marginBottom: 16 }}>Nouveau match</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre *</label>
              <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Match de championnat" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date *</label>
              <input type="date" value={form.date_match} onChange={e => setForm(f => ({ ...f, date_match: e.target.value }))} style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", colorScheme: "dark" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Adversaire</label>
                <input value={form.adversaire} onChange={e => setForm(f => ({ ...f, adversaire: e.target.value }))} placeholder="Optionnel" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lieu</label>
                <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Optionnel" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
              </div>
            </div>
            <button onClick={saveMatch} disabled={saving || !form.titre || !form.date_match} style={{ width: "100%", height: 48, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, border: "none", borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, cursor: "pointer", ...s.heading, boxShadow: DS.shadow.primary }}>
              {saving ? "Enregistrement..." : "Ajouter le match"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          </div>
        ) : matchs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📅</p>
            <p style={{ color: DS.colors.textPrimary, fontSize: 18, ...s.heading, marginBottom: 8 }}>Aucun match programme</p>
            <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, lineHeight: 1.6 }}>Ajoute tes matchs pour que Voltra adapte automatiquement tes seances.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {matchs.map(match => {
              const days = getDaysUntil(match.date_match);
              const color = getMatchColor(days);
              return (
                <div key={match.id} style={{ background: DS.colors.surface, border: `1px solid ${color}30`, borderRadius: DS.radius.xl, padding: 20, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "inline-flex", padding: "3px 10px", background: color + "20", border: `1px solid ${color}40`, borderRadius: DS.radius.full, color, fontSize: 11, ...s.heading, marginBottom: 8 }}>
                        {getMatchLabel(days)}
                      </div>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 17, ...s.heading, marginBottom: 4 }}>{match.titre}</p>
                      {match.adversaire && <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>vs {match.adversaire}</p>}
                      {match.lieu && <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>📍 {match.lieu}</p>}
                    </div>
                    <button onClick={() => deleteMatch(match.id)} style={{ background: "none", border: "none", color: DS.colors.textDim, fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
                  </div>
                  <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 14px" }}>
                    <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
                      {days <= 1 ? "⚡ Seance tres legere aujourd'hui - preserve ton energie" :
                       days <= 3 ? "⚠️ Charges reduites - approche du match" :
                       days <= 5 ? "💪 Programme normal - fin de cycle avant match" :
                       "✅ Programme complet - match encore loin"}
                    </p>
                  </div>
                  <p style={{ color: DS.colors.textDim, fontSize: 11, ...s.mono, marginTop: 8 }}>
                    {new Date(match.date_match).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
function DashboardScreen({ user, programme, programmeLoading, matchs, derniereSeance, sport: sportProp, onStartSession, onOpenMatchs, onResumeSession }) {
  const stagger = useStaggerUneFois("dashboard");
  // Séance en pause récupérable (< 2h)
  const [pausedSession] = useState(() => {
    try {
      const raw = localStorage.getItem("voltra_paused_session");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.savedAt > 2 * 60 * 60 * 1000) {
        localStorage.removeItem("voltra_paused_session");
        return null;
      }
      return data;
    } catch { return null; }
  });
  const sport = sportProp || "default";
  const theme = getSportTheme(sport);
  const progData = programme?.data_json;

  // Determiner la vraie seance du jour selon la progression reelle
  const [seanceIdxDansSemaine, setSeanceIdxDansSemaine] = useState(0);
  useEffect(() => {
    if (!programme?.id) return;
    const freq = programme?.frequence || 1;
    supabase
      .from("seances")
      .select("id", { count: "exact", head: true })
      .eq("programme_id", programme.id)
      .eq("statut", "faite")
      .then(({ count }) => setSeanceIdxDansSemaine((count || 0) % freq));
  }, [programme?.id, programme?.frequence]);

  const semaineIdx = Math.max(0, Math.min((programme?.semaine_courante || 1) - 1, (progData?.semaines?.length || 1) - 1));
  const seancesSemaine = progData?.semaines?.[semaineIdx]?.seances || progData?.semaines?.[0]?.seances || [];
  const seance = seancesSemaine[seanceIdxDansSemaine] || seancesSemaine[0] || null;
  const exercices = seance?.exercices || [];

  const prog = {
    titre: programme?.titre || null,
    semaineCourante: programme?.semaine_courante || 1,
    totalSemaines: programme?.total_semaines || 8,
    progression: Math.round(((programme?.semaine_courante || 1) / (programme?.total_semaines || 8)) * 100),
  };

  const userName = user?.user_metadata?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Athlète";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après‑midi" : "Bonsoir";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const currentCycle = programme?.data_json?.cycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
  const startCycle = programme?.data_json?.startCycle || getNiveauCycle(programme?.data_json?.niveau) || 1;

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, paddingBottom: 130 }}>

      {/* Badge programme loading */}
      {programmeLoading && (
        <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: DS.colors.surface, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: DS.shadow.card, whiteSpace: "nowrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: theme.accent, animation: "pulse 1s infinite" }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>Génération du programme...</p>
        </div>
      )}

      {/* Header */}
      <div className={stagger ? "v-up" : undefined} style={{ padding: "56px 24px 4px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -140, right: -110, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${theme.accent}26, transparent 70%)`, pointerEvents: "none" }} />
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, marginBottom: 6, fontWeight: 600, position: "relative" }}>
          {today.charAt(0).toUpperCase() + today.slice(1)}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 34, color: DS.colors.textPrimary, margin: 0, letterSpacing: "-0.03em", lineHeight: 1, textTransform: "uppercase" }}>
            {greeting},<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>{userName}</span>
          </h1>
          <div style={{ width: 52, height: 52, borderRadius: 18, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `0 8px 24px ${theme.accent}55` }}>
            {SPORT_EMOJIS[sport] || "⚡"}
          </div>
        </div>
      </div>

      <div className={stagger} style={{ padding: "20px 16px 0" }}>

        {/* Bannière reprise séance en pause */}
        {pausedSession && (
          <div onClick={() => onResumeSession && onResumeSession(pausedSession)} style={{ background: `linear-gradient(135deg, ${theme.accent}18, ${theme.accent}06)`, border: `1.5px solid ${theme.accent}50`, borderRadius: DS.radius.xl, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: `0 4px 20px ${theme.accent}20` }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, animation: "pulse 2s infinite" }}>⏸</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 15, color: DS.colors.textPrimary, marginBottom: 2 }}>Séance en pause</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>
                Tu en étais à l'exercice {(pausedSession.exIdx || 0) + 1}, série {(pausedSession.setIdx || 0) + 1} · {Object.keys(pausedSession.completedSets || {}).length} séries validées
              </p>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 800, color: accentLisible(theme.accent), whiteSpace: "nowrap" }}>Reprendre →</p>
          </div>
        )}

        {/* Jour prévu / repos selon les jours choisis */}
        {seance && progData?.jours?.length > 0 && (() => {
          const todayI = new Date().getDay();
          const prevu = progData.jours.includes(todayI);
          let next = null;
          for (let k = 1; k <= 7; k++) { const d = (todayI + k) % 7; if (progData.jours.includes(d)) { next = d; break; } }
          return (
            <div style={{ background: prevu ? `${theme.accent}15` : DS.colors.surface, border: `1px solid ${prevu ? theme.accent + "50" : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{prevu ? "💪" : "😴"}</span>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textPrimary, margin: 0, fontWeight: 600 }}>
                {prevu ? "Séance prévue aujourd'hui" : `Jour de repos prévu · prochaine séance ${DAY_NAMES[next]}`}
              </p>
            </div>
          );
        })()}

        {/* Séance du jour — card sombre */}
        {!seance ? (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.shadow.card, borderRadius: 26, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, fontSize: 120, opacity: 0.06 }}>{SPORT_EMOJIS[sport] || "⚡"}</div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentLisible(theme.accent), fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>PROGRAMME EN PRÉPARATION</p>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Ton programme arrive...</h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, margin: 0 }}>L'IA construit ton programme personnalisé. Reviens dans quelques instants.</p>
          </div>
        ) : (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.colors.isDark ? `0 0 0 1px ${theme.accent}22, 0 12px 40px ${theme.accent}14` : "0 12px 32px rgba(0,0,0,0.08)", borderRadius: 26, overflow: "hidden", marginBottom: 16, position: "relative" }}>
            <div style={{ position: "absolute", right: -20, top: -20, fontSize: 140, opacity: 0.06 }}>{SPORT_EMOJIS[sport] || "⚡"}</div>
            <div style={{ padding: "20px 20px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentLisible(theme.accent), fontWeight: 700, marginBottom: 6, letterSpacing: "0.04em" }}>
                    {seance.type?.replace(/_/g, " ").toUpperCase() || "SÉANCE DU JOUR"}
                  </p>
                  <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, margin: 0, letterSpacing: "-0.01em" }}>
                    {seance.titre || "Séance"}
                  </h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, fontWeight: 800, color: DS.colors.textPrimary, margin: 0, lineHeight: 1 }}>{seance.dureeMin || 45}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>min</p>
                </div>
              </div>

              {/* Progress dots */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {exercices.slice(0, 6).map((_, i) => (
                  <div key={i} style={{ height: 3, flex: 1, background: DS.colors.surfaceHigh, borderRadius: 2 }} />
                ))}
              </div>

              {/* Exercices preview */}
              {exercices.slice(0, 4).map((ex, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: `1px solid ${DS.colors.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, opacity: 0.7 }} />
                    <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textPrimary, fontWeight: 500 }}>{ex.nom}</span>
                  </div>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec }}>{ex.sets}×{ex.reps}</span>
                </div>
              ))}
              {exercices.length > 4 && (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, marginTop: 8, marginBottom: 0 }}>+{exercices.length - 4} exercices</p>
              )}
            </div>

            <div style={{ padding: "0 16px 16px" }}>
              <PrimaryButton onClick={() => onStartSession(seance)} style={{ height: 54 }}>
                
                Démarrer la séance
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4.5V19.5L19 12L7 4.5Z" fill="currentColor" /></svg>
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Progression cycle */}
        <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 16, boxShadow: DS.shadow.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, margin: "0 0 2px" }}>
                {currentCycle === 1 ? "🌱 Fondations" : currentCycle === 2 ? "⚡ Intensification" : currentCycle === 3 ? "🔥 Puissance" : currentCycle === 4 ? "💎 Elite" : `🚀 Elite+${currentCycle - 4}`}
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>
                Cycle {currentCycle} · Semaine {prog.semaineCourante} sur {prog.totalSemaines}
              </p>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, color: accentLisible(theme.accent), margin: 0 }}>{prog.progression}%</p>
          </div>
          <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, height: 6, overflow: "hidden" }}>
            <div style={{ width: "100%", transform: `translateX(${prog.progression - 100}%)`, height: "100%", background: theme.accent, borderRadius: DS.radius.full, transition: "transform 500ms var(--ease-out)" }} />
          </div>
        </div>

        {/* Parcours cycles */}
        <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "18px 16px", marginBottom: 16, boxShadow: DS.shadow.card }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, marginBottom: 14 }}>Ton parcours</p>
          <div style={{ display: "flex", gap: 0, position: "relative" }}>
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, background: DS.colors.surfaceHigh, zIndex: 0 }} />
            <div style={{ position: "absolute", top: 20, left: 20, height: 2, width: `${Math.min(100, (1/4)*100)}%`, background: theme.accent, zIndex: 0 }} />
            {(() => {
              const getLabel = (n) => n === 1 ? "BASES" : n === 2 ? "INTENSITÉ" : n === 3 ? "PUISSANCE" : n === 4 ? "ELITE" : `E+${n-4}`;
              const start = Math.max(1, currentCycle - 1);
              return Array.from({ length: 4 }, (_, i) => ({ num: start + i, label: getLabel(start + i) })).map((c, i) => {
                const isDone = currentCycle > c.num && c.num >= startCycle;
                const isSkipped = c.num < startCycle;
                const isCurrent = currentCycle === c.num;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: DS.radius.full, background: isDone ? theme.accent : isCurrent ? theme.accent + "20" : DS.colors.surfaceHigh, border: `2px solid ${isDone || isCurrent ? theme.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isCurrent ? `0 0 12px ${theme.accent}50` : "none" }}>
                      {isDone ? <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>✓</span>
                        : isSkipped ? <span style={{ color: DS.colors.textDim, fontSize: 12 }}>—</span>
                        : <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: isCurrent ? theme.accent : DS.colors.textSec, fontWeight: 700 }}>{c.num}</span>}
                    </div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isCurrent ? theme.accent : DS.colors.textSec, fontWeight: isCurrent ? 700 : 400, letterSpacing: "0.05em", textAlign: "center" }}>{c.label}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Dernière séance */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, marginBottom: 12 }}>Dernière séance</p>
          {derniereSeance ? (
            <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: DS.shadow.card }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {derniereSeance.feedback === "good" ? "💪" : derniereSeance.feedback === "easy" ? "😤" : "🔥"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: DS.colors.textPrimary, marginBottom: 3 }}>{derniereSeance.titre}</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>
                  {new Date(derniereSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {derniereSeance.duree_min || 0} min
                </p>
              </div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: accentLisible(theme.accent), fontWeight: 700 }}>
                {derniereSeance.exercices?.length || 0} exo
              </p>
            </div>
          ) : (
            <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "20px", textAlign: "center", boxShadow: DS.shadow.card }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec }}>Aucune séance encore. C'est l'heure de commencer ! 💪</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
function HistoriqueScreen() {
  const stagger = useStaggerUneFois("historique");
  const [seancesReelles, setSeancesReelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSeances, setTotalSeances] = useState(0);
  const [selectedSeance, setSelectedSeance] = useState(null);
  const [selectedExo, setSelectedExo] = useState(null);
  const [logsPerf, setLogsPerf] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      const { data } = await supabase
        .from("seances")
        .select("*, exercices(*)")
        .eq("user_id", session.user.id)
        .eq("statut", "faite")
        .order("date_realisee", { ascending: false })
        .limit(30);
      if (data) { setSeancesReelles(data); setTotalSeances(data.length); }
      const { data: logs } = await supabase
        .from("logs_performance")
        .select("*, exercices(nom)")
        .eq("user_id", session.user.id)
        .order("charge_kg", { ascending: false })
        .limit(100);
      if (logs) setLogsPerf(logs);
      setLoading(false);
    });
  }, []);

  // Stats
  const dureeTotal = seancesReelles.reduce((acc, s) => acc + (s.duree_min || 0), 0);
  const dureeAvg = totalSeances > 0 ? Math.round(dureeTotal / totalSeances) : 0;
  const streak = (() => {
    let count = 0;
    const today = new Date();
    const sorted = [...seancesReelles].sort((a, b) => new Date(b.date_realisee) - new Date(a.date_realisee));
    for (const sc of sorted) {
      const diff = Math.floor((today - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24));
      if (diff <= count + 2) count++;
      else break;
    }
    return count;
  })();

  // Records
  const records = {};
  logsPerf.forEach(log => {
    const nom = log.exercices?.nom;
    if (!nom || !log.charge_kg) return;
    if (!records[nom] || log.charge_kg > records[nom]) records[nom] = log.charge_kg;
  });
  const topRecords = Object.entries(records).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Progression charges
  const exosDispos = [...new Set(logsPerf.map(l => l.exercices?.nom).filter(Boolean))];
  const exoSelectionne = selectedExo || exosDispos[0];
  const progressionExo = logsPerf
    .filter(l => l.exercices?.nom === exoSelectionne)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-8);

  // Calendrier
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const seanceDates = new Set(seancesReelles.map(s => new Date(s.date_realisee).getDate()));

  // Séances par semaine (8 dernières)
  const seancesParSemaine = (() => {
    const buckets = Array(8).fill(0);
    seancesReelles.forEach(sc => {
      const diff = Math.floor((now - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24 * 7));
      if (diff < 8) buckets[7 - diff]++;
    });
    return buckets;
  })();
  const maxSemaine = Math.max(...seancesParSemaine, 1);

  const feedbackColor = (f) => f === "easy" ? DS.colors.primary : f === "good" ? DS.colors.success : DS.colors.warning;
  const feedbackLabel = (f) => f === "easy" ? "Facile" : f === "good" ? "Parfait" : "Dur";
  const feedbackEmoji = (f) => f === "easy" ? "😤" : f === "good" ? "💪" : "🔥";

  const accentColor = "#FF2D55";

  return (
    <div className={stagger} style={{ minHeight: "100dvh", background: DS.colors.bg, paddingBottom: 130 }}>

      {/* Drawer detail seance */}
      {selectedSeance && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setSelectedSeance(null)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", marginBottom: 4 }}>
                  {new Date(selectedSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </p>
                <h3 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 22, color: DS.colors.textPrimary }}>{selectedSeance.titre}</h3>
              </div>
              <button onClick={() => setSelectedSeance(null)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { val: `${selectedSeance.duree_min || 0}m`, label: "DUREE", color: accentColor },
                { val: selectedSeance.exercices?.length || 0, label: "EXO", color: DS.colors.success },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, color: DS.colors.textPrimary, fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginTop: 2, letterSpacing: "0.06em" }}>{stat.label}</div>
                </div>
              ))}
              {selectedSeance.feedback && (
                <div style={{ flex: 1, background: feedbackColor(selectedSeance.feedback) + "15", borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", border: `1px solid ${feedbackColor(selectedSeance.feedback)}30` }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{feedbackEmoji(selectedSeance.feedback)}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: feedbackColor(selectedSeance.feedback), letterSpacing: "0.08em" }}>{feedbackLabel(selectedSeance.feedback).toUpperCase()}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(selectedSeance.exercices || []).map((ex, i) => (
                <div key={i} style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{ex.muscles?.split(" ")[0]}</p>
                  </div>
                  <p style={{ fontFamily: "'Inter',sans-serif", color: accentColor, fontSize: 12, fontWeight: 700 }}>{ex.sets}×{ex.reps}{ex.charge_kg > 0 ? ` @ ${ex.charge_kg}kg` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: DS.colors.stickyBg, backdropFilter: "blur(10px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 34, color: DS.colors.textPrimary, letterSpacing: "-0.03em" }}>PROGRESSION</h1>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 999, padding: "6px 12px", whiteSpace: "nowrap", fontWeight: 700 }}>CE MOIS</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: accentColor, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>Chargement...</p>
        </div>
      ) : (
        <div style={{ padding: "20px 20px 0" }}>

          {/* Hero stat */}
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, boxShadow: DS.shadow.card, padding: "24px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em", marginBottom: 8 }}>VOLUME TOTAL</div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 72, color: DS.colors.textPrimary, lineHeight: 0.9, letterSpacing: "-0.02em" }}>{totalSeances}</div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", marginTop: 8 }}>SEANCES COMPLETEES</div>
            {streak > 0 && (
              <div style={{ position: "absolute", top: 20, right: 20, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: 8, padding: "6px 12px", fontFamily: "'Inter',sans-serif", fontSize: 11, color: accentLisible("#9BE84F"), fontWeight: 700 }}>
                🔥 {streak} JOURS
              </div>
            )}
          </div>

          {/* 4 stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { val: streak, label: "STREAK ACTUEL", color: accentColor },
              { val: `${dureeAvg}m`, label: "DUREE MOY.", color: accentLisible("#9BE84F") },
              { val: topRecords[0] ? `${topRecords[0][1]}kg` : "—", label: `RECORD ${(topRecords[0]?.[0] || "").split(" ")[0].toUpperCase()}`, color: "#FFE500" },
              { val: seancesReelles.filter(s => s.feedback === "good" || s.feedback === "easy").length, label: "SEANCES REUSSIES", color: "#00C8FF" },
            ].map((stat, i) => (
              <div key={i} style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 16, padding: "16px 14px", position: "relative", overflow: "hidden" }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 6 }}>{stat.val}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Graphique séances par semaine — cliquable */}
          <div style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 16px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>SEANCES SUR 8 SEMAINES · APPUIE POUR DETAIL</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
              {seancesParSemaine.map((count, i) => {
                const isLast = i === 7;
                const h = count > 0 ? Math.max(12, (count / maxSemaine) * 100) : 8;
                const isEmpty = count === 0;
                const seancesOfWeek = seancesReelles.filter(sc => {
                  const diff = Math.floor((now - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24 * 7));
                  return diff === 7 - i;
                });
                return (
                  <div key={i} onClick={() => seancesOfWeek.length > 0 && setSelectedSeance(seancesOfWeek[0])} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: seancesOfWeek.length > 0 ? "pointer" : "default" }}>
                    {count > 0 && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isLast ? accentColor : "rgba(255,255,255,0.3)" }}>{count}</div>}
                    <div style={{ width: "100%", height: h, background: isEmpty ? "rgba(255,255,255,0.04)" : isLast ? accentColor : `rgba(255,45,85,${0.2 + (count/maxSemaine)*0.6})`, borderRadius: "4px 4px 0 0", border: isEmpty ? "1px dashed rgba(255,255,255,0.08)" : "none", boxShadow: isLast && count > 0 ? `0 0 12px rgba(255,45,85,0.5)` : "none", transition: "opacity 0.2s" }} />
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isLast ? accentColor : "rgba(255,255,255,0.2)" }}>S{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendrier du mois */}
          <div style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, color: DS.colors.textPrimary, letterSpacing: "0.08em" }}>{now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}</div>
              {streak > 0 && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em" }}>🔥 {streak} JOURS</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
              {["L","M","M","J","V","S","D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, paddingBottom: 4 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === now.getDate();
                const hasSeance = seanceDates.has(day);
                return (
                  <div key={day} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: hasSeance ? accentColor : isToday ? DS.colors.surfaceHigh : "transparent", border: isToday && !hasSeance ? `1px solid ${accentColor}` : "none", boxShadow: hasSeance ? `0 0 8px rgba(255,45,85,0.4)` : "none" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: hasSeance || isToday ? 800 : 500, color: hasSeance ? "#0B0B0C" : isToday ? accentLisible(accentColor) : DS.colors.textSec }}>{day}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Records personnels */}
          {topRecords.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>RECORDS PERSONNELS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, overflow: "hidden" }}>
                {topRecords.map(([nom, charge], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < topRecords.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: i === 0 ? "rgba(255,229,0,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "rgba(255,229,0,0.3)" : "rgba(255,255,255,0.06)"}`, flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </div>
                    <div style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: DS.colors.textPrimary, fontWeight: 500 }}>{nom}</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: accentLisible("#9BE84F"), fontWeight: 700 }}>{charge} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique séances récentes */}
          {seancesReelles.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>DERNIERES SEANCES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seancesReelles.slice(0, 6).map((sc, i) => (
                  <div key={i} onClick={() => setSelectedSeance(sc)} style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.feedback ? feedbackColor(sc.feedback) + "15" : "rgba(255,255,255,0.05)", border: `1px solid ${sc.feedback ? feedbackColor(sc.feedback) + "30" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {feedbackEmoji(sc.feedback) || "🏋️"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading, marginBottom: 2 }}>{sc.titre}</p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.08em" }}>
                        {new Date(sc.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()} · {sc.duree_min || 0}min
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: accentColor, fontWeight: 700 }}>{sc.exercices?.length || 0} EXO</p>
                      {sc.feedback && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: feedbackColor(sc.feedback), marginTop: 2 }}>{feedbackLabel(sc.feedback).toUpperCase()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seancesReelles.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🏋️</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, color: DS.colors.textPrimary, letterSpacing: "0.08em", marginBottom: 8 }}>AUCUNE SEANCE ENCORE</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>Complete ta premiere seance pour voir ta progression ici.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────
// PROFIL
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MON ABONNEMENT — infos, offre de retention, resiliation guidee
// ─────────────────────────────────────────────
async function callSubscription(action, extra = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée, reconnecte-toi.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, return_url: window.location.origin, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "Erreur"); e.code = data.error; throw e; }
  return data;
}

function SubscriptionScreen({ onBack, accent, totalSeances, memberDays }) {
  const [info, setInfo] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [flow, setFlow] = useState(0); // 0 normal, 1 avant de partir, 2 offre, 3 confirmation
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { setInfo(await callSubscription("info")); setLoadErr(""); }
    catch (e) { setLoadErr(e.code === "no_subscription" ? "none" : (e.message || "Erreur")); }
  };
  useEffect(() => { load(); }, []);

  const dateFr = (unix) => unix ? new Date(unix * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const isYear = info?.interval === "year";
  const planLabel = info ? `${isYear ? "Annuel" : "Mensuel"} · ${String(info.amount).replace(".", ",")} €/${isYear ? "an" : "mois"}` : "";

  const goPortal = async (action) => {
    setBusy(true); setMsg("");
    try { const d = await callSubscription(action, { reason }); if (d.url) { window.location.href = d.url; return; } }
    catch (e) { setMsg(e.message || "Erreur, réessaie."); }
    setBusy(false);
  };
  const takeOffer = async (type) => {
    setBusy(true); setMsg("");
    try {
      await callSubscription("offer", { type, reason });
      setFlow(0); await load();
      setMsg(type === "free_month" ? "✓ Ton prochain mois est offert. Merci de rester avec nous !" : "✓ Ta réduction de 30 % est appliquée. Merci de rester avec nous !");
    } catch (e) { setMsg(e.code === "offer_used" ? "Tu as déjà profité d'une offre de fidélité." : (e.message || "Erreur, réessaie.")); }
    setBusy(false);
  };
  const resume = async () => {
    setBusy(true); setMsg("");
    try { await callSubscription("resume"); await load(); setMsg("✓ Ton abonnement est réactivé."); }
    catch (e) { setMsg(e.message || "Erreur, réessaie."); }
    setBusy(false);
  };

  const card = { background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 };
  const h = { fontFamily: "'Inter',sans-serif", fontWeight: 800, color: DS.colors.textPrimary, margin: 0 };
  const t = { fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.55, color: DS.colors.textSec, margin: 0 };
  const btnMain = { width: "100%", height: 52, borderRadius: DS.radius.md, background: accent, border: "none", color: "#000", fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 800, cursor: "pointer" };
  const btnGhost = { width: "100%", height: 46, borderRadius: DS.radius.md, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, color: DS.colors.textPrimary, fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 700, cursor: "pointer" };
  const link = { fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, textDecoration: "underline", cursor: "pointer", textAlign: "center", margin: "14px 0 0" };
  const REASONS = ["Trop cher", "Je ne m'en sers pas assez", "Je n'ai pas trouvé ce que je cherchais", "Je fais une pause", "Autre"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "52px 16px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}`, position: "sticky", top: 0, background: DS.colors.bg, zIndex: 2 }}>
        <button onClick={flow ? () => setFlow(0) : onBack} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: 20, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 16, cursor: "pointer" }}>←</button>
        <p style={{ ...h, fontSize: 18 }}>Mon abonnement</p>
      </div>

      <div style={{ padding: "20px 16px 80px", maxWidth: 520, margin: "0 auto" }}>
        {msg && <div style={{ ...card, borderColor: `${accent}60`, background: `${accent}12` }}><p style={{ ...t, color: DS.colors.textPrimary, fontWeight: 600 }}>{msg}</p></div>}

        {!info && !loadErr && <p style={{ ...t, textAlign: "center", marginTop: 40 }}>Chargement...</p>}
        {loadErr === "none" && (
          <div style={card}>
            <p style={{ ...h, fontSize: 16, marginBottom: 8 }}>Aucun abonnement récurrent</p>
            <p style={t}>Ton accès Pro n'est lié à aucun abonnement en cours. Une question ? contact.voltra1@gmail.com</p>
          </div>
        )}
        {loadErr && loadErr !== "none" && (
          <div style={card}><p style={t}>Impossible de charger ton abonnement ({loadErr}). Réessaie ou écris à contact.voltra1@gmail.com</p></div>
        )}

        {info && flow === 0 && (
          <>
            <div style={{ ...card, borderColor: `${accent}50` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>⭐</span>
                <p style={{ ...h, fontSize: 18 }}>Voltra Pro</p>
              </div>
              <p style={{ ...t, color: DS.colors.textPrimary, fontWeight: 600 }}>{planLabel}</p>
              <p style={{ ...t, marginTop: 6 }}>
                {info.cancelAtPeriodEnd ? `Résiliation prévue : ton accès reste actif jusqu'au ${dateFr(info.periodEnd)}.`
                  : info.paused ? `Pause active : ton prochain mois est offert.`
                  : `Prochain renouvellement le ${dateFr(info.periodEnd)}.`}
                {info.hasDiscount && !info.cancelAtPeriodEnd ? " 🎁 Réduction de fidélité appliquée." : ""}
              </p>
              {info.cancelAtPeriodEnd && <button onClick={resume} disabled={busy} style={{ ...btnMain, marginTop: 14 }}>{busy ? "..." : "Réactiver mon abonnement"}</button>}
            </div>

            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 12 }}>Ce que Voltra Pro t'apporte</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}><p style={{ ...h, fontSize: 22, color: accent }}>{totalSeances || 0}</p><p style={{ ...t, fontSize: 11 }}>séances</p></div>
                <div style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}><p style={{ ...h, fontSize: 22, color: accent }}>{memberDays || 0}</p><p style={{ ...t, fontSize: 11 }}>jours actifs</p></div>
              </div>
              <p style={t}>✓ Programme IA personnalisé et cycles évolutifs{"\n"}✓ Coach Ace illimité pendant tes séances{"\n"}✓ Séances et progression sans limite</p>
            </div>

            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 6 }}>Paiement et factures</p>
              <p style={{ ...t, marginBottom: 12 }}>Change ta carte bancaire, consulte et télécharge tes factures.</p>
              <button onClick={() => goPortal("portal")} disabled={busy} style={btnGhost}>{busy ? "Ouverture..." : "Moyen de paiement et factures"}</button>
            </div>

            {!info.cancelAtPeriodEnd && (
              <p onClick={() => { setMsg(""); setFlow(1); }} style={link}>Résilier mon abonnement</p>
            )}
          </>
        )}

        {info && flow === 1 && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Avant de partir…</p>
              <p style={t}>Tu as fait <b style={{ color: accent }}>{totalSeances || 0} séance{totalSeances > 1 ? "s" : ""}</b> avec Voltra. En résiliant, tu perdras à la fin de ta période d'accès :{"\n"}• ton programme IA qui évolue avec toi{"\n"}• le coach Ace pendant tes séances{"\n"}• les séances illimitées</p>
            </div>
            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 10 }}>Pourquoi veux-tu partir ? (facultatif)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {REASONS.map(r => (
                  <div key={r} onClick={() => setReason(r)} style={{ padding: "9px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, background: reason === r ? accent : DS.colors.surfaceHigh, color: reason === r ? "#000" : DS.colors.textSec, border: `1px solid ${reason === r ? accent : DS.colors.border}` }}>{r}</div>
                ))}
              </div>
            </div>
            <button onClick={onBack} style={btnMain}>Garder mon abonnement</button>
            <p onClick={() => setFlow(info.offerUsed ? 3 : 2)} style={link}>Continuer la résiliation</p>
          </>
        )}

        {info && flow === 2 && (
          <>
            <div style={{ ...card, borderColor: `${accent}60` }}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>🎁 Une offre rien que pour toi</p>
              <p style={t}>On préfère te garder. Choisis ce qui te convient :</p>
            </div>
            <div style={card}>
              <p style={{ ...h, fontSize: 16, marginBottom: 4 }}>−30 % {isYear ? "sur ton prochain renouvellement" : "pendant 3 mois"}</p>
              <p style={{ ...t, marginBottom: 12 }}>{isYear ? "Une seule fois, au prochain paiement annuel." : "Appliqué automatiquement sur tes 3 prochaines factures."} Sans engagement, tu peux toujours résilier ensuite.</p>
              <button onClick={() => takeOffer("discount")} disabled={busy} style={btnMain}>{busy ? "..." : "Profiter de −30 %"}</button>
            </div>
            {!isYear && (
              <div style={card}>
                <p style={{ ...h, fontSize: 16, marginBottom: 4 }}>1 mois offert</p>
                <p style={{ ...t, marginBottom: 12 }}>On met ton abonnement en pause : ton prochain mois ne te coûte rien, et tu gardes ton accès Pro.</p>
                <button onClick={() => takeOffer("free_month")} disabled={busy} style={btnGhost}>{busy ? "..." : "Profiter d'un mois offert"}</button>
              </div>
            )}
            <p onClick={() => setFlow(3)} style={link}>Non merci, je veux résilier</p>
          </>
        )}

        {info && flow === 3 && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Dernière étape</p>
              <p style={t}>Ton accès Pro reste actif jusqu'au <b>{dateFr(info.periodEnd)}</b>, puis il s'arrêtera. Tu ne seras plus facturé. Tu garderas ton compte et ton historique.</p>
            </div>
            <button onClick={onBack} style={btnMain}>Finalement, je reste</button>
            <button onClick={() => goPortal("cancel_flow")} disabled={busy} style={{ ...btnGhost, marginTop: 12, color: "#FF2D55", borderColor: "rgba(255,45,85,0.3)" }}>{busy ? "Ouverture..." : "Confirmer la résiliation"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function ProfilScreen({ isPro, user, programme, sportActif: sportActifProp, appTheme, onThemeChange, onLogout, onRegenerateProgram }) {
  const stagger = useStaggerUneFois("profil");
  const [notifOn, setNotifOn] = useState(false);
  const [notifHeure, setNotifHeure] = useState("08:00");
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editData, setEditData] = useState({ sport: null, objectif: null, frequence: 3, jours: [1, 3, 5] });
  const [showLegal, setShowLegal] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [paidPlan, setPaidPlan] = useState(null);
  const [lastSessionStats, setLastSessionStats] = useState(null);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [recordKg, setRecordKg] = useState(0);
  const [seancesFaitesSemaine, setSeancesFaitesSemaine] = useState([]);
  const [totalSeancesAllTime, setTotalSeancesAllTime] = useState(0);
  const memberSinceDays = user?.created_at ? Math.floor((Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0;
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image trop lourde (max 5Mo)"); return; }
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await supabase.auth.updateUser({ data: { avatar_url: pub.publicUrl } });
      setAvatarUrl(pub.publicUrl);
    } catch (err) {
      console.error("Erreur upload avatar:", err.message);
      alert("Erreur lors de l'envoi de la photo");
    }
    setUploadingAvatar(false);
  };

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";
  const progData = programme?.data_json;
  const semaineCourante = programme?.semaine_courante || 1;
  const totalSemaines = programme?.total_semaines || 8;
  const progression = Math.round((semaineCourante / totalSemaines) * 100);
  const sport = sportActifProp || progData?.sport || user?.user_metadata?.sport || "default";
  const objectif = progData?.objectif || "Non defini";
  const frequence = progData?.frequence || 3;
  const theme = getSportTheme(sport);
  const currentCycle = progData?.cycle || getNiveauCycle(progData?.niveau) || 1;
  const startCycle = progData?.startCycle || getNiveauCycle(progData?.niveau) || 1;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from("seances").select("date_realisee").eq("user_id", session.user.id).eq("statut", "faite").order("date_realisee", { ascending: false }).limit(30);
      if (data) {
        setSeancesCount(data.length);
        let s = 0, today = new Date();
        for (const sc of data) {
          const diff = Math.floor((today - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24));
          if (diff <= s + 2) s++;
          else break;
        }
        setStreak(s);
      }
      // Record de kg soulevés en une seule seance + total seances toutes periodes
      const { data: allSeances, count: totalCount } = await supabase
        .from("seances")
        .select("id, exercices(charge_kg, sets, reps)", { count: "exact" })
        .eq("user_id", session.user.id)
        .eq("statut", "faite");
      if (allSeances) {
        setTotalSeancesAllTime(totalCount || allSeances.length);
        let maxKg = 0;
        allSeances.forEach(sc => {
          const kgSeance = (sc.exercices || []).reduce((acc, ex) => {
            if (!(ex.charge_kg > 0)) return acc;
            return acc + ex.charge_kg * (ex.sets || 1) * (parseInt(ex.reps) || 1);
          }, 0);
          if (kgSeance > maxKg) maxKg = kgSeance;
        });
        setRecordKg(Math.round(maxKg));
      }
      // Seances faites cette semaine (pour le calendrier)
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // lundi=0
      const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek); monday.setHours(0, 0, 0, 0);
      const { data: weekData } = await supabase
        .from("seances")
        .select("date_realisee")
        .eq("user_id", session.user.id)
        .eq("statut", "faite")
        .gte("date_realisee", monday.toISOString());
      if (weekData) {
        setSeancesFaitesSemaine(weekData.map(d => new Date(d.date_realisee).getDay()));
      }
    });
  }, []);

  const openEdit = () => {
    setEditData({ sport, objectif: objectif !== "Non defini" ? objectif : null, frequence, jours: progData?.jours?.length === frequence ? progData.jours : DEFAULT_JOURS[frequence] });
    setShowEditDrawer(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const sportChanged = editData.sport !== sport;
    // Seulement regenerer si le SPORT change — objectif et frequence = mise a jour simple
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("profiles").upsert({ id: session.user.id, sport: editData.sport }, { onConflict: "id" });
        if (sportChanged && programme?.id) {
          // Sport change → nouveau programme
          if (onRegenerateProgram) await onRegenerateProgram(editData, true);
        } else if (programme?.id) {
          // Juste mettre a jour objectif + frequence sans regenerer ni remettre a zero
          const updatedJson = { ...(programme.data_json || {}), objectif: editData.objectif, frequence: editData.frequence, jours: editData.jours };
          await supabase.from("programmes").update({ data_json: updatedJson }).eq("id", programme.id);
          if (onRegenerateProgram) await onRegenerateProgram(editData, false);
        }
      }
    } catch (err) { console.error(err); }
    setSaving(false);
    setShowEditDrawer(false);
  };

  return (
    <div className={stagger} style={{ minHeight: "100dvh", background: DS.colors.bg, paddingBottom: 130, position: "relative", overflow: "hidden" }}>

      {/* Sport bg */}
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      {/* Drawer edition */}
      {showEditDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowEditDrawer(false)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <p style={{ ...s.display, fontSize: 20, color: DS.colors.textPrimary }}>Modifier mon profil</p>
              <button onClick={() => setShowEditDrawer(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Sport</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
              {SPORTS.map(sp => (
                <div key={sp.id} onClick={() => setEditData(d => ({ ...d, sport: sp.id, objectif: null }))} style={{ background: editData.sport === sp.id ? theme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${editData.sport === sp.id ? theme.accent : DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 6px", textAlign: "center", cursor: "pointer", transition: "var(--t-choix)" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{sp.emoji}</div>
                  <div style={{ color: editData.sport === sp.id ? theme.accent : DS.colors.textSec, fontSize: 10, ...s.heading }}>{sp.label}</div>
                </div>
              ))}
            </div>
            {editData.sport && (
              <>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Objectif</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  {(OBJECTIFS_PAR_SPORT[editData.sport] || []).map(obj => (
                    <div key={obj.id} onClick={() => setEditData(d => ({ ...d, objectif: obj.id }))} style={{ background: editData.objectif === obj.id ? theme.accent + "15" : DS.colors.surfaceHigh, border: `1px solid ${editData.objectif === obj.id ? theme.accent : DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <span style={{ fontSize: 20 }}>{obj.emoji}</span>
                      <div>
                        <p style={{ color: editData.objectif === obj.id ? theme.accent : DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{obj.label}</p>
                        <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{obj.desc}</p>
                      </div>
                      {editData.objectif === obj.id && <div style={{ marginLeft: "auto", width: 18, height: 18, background: theme.accent, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#000" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Seances / semaine</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[2, 3, 4, 5].map(n => (
                <div key={n} onClick={() => setEditData(d => ({ ...d, frequence: n, jours: (d.jours && d.jours.length === n) ? d.jours : DEFAULT_JOURS[n] }))} style={{ flex: 1, padding: "14px 0", textAlign: "center", background: editData.frequence === n ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: editData.frequence === n ? "#000" : DS.colors.textSec, fontSize: 18, cursor: "pointer", ...s.display }}>{n}</div>
              ))}
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Mes jours d'entraînement</p>
            <div style={{ marginBottom: 28 }}>
              <DayPicker jours={editData.jours || []} max={editData.frequence} accent={theme.accent} onChange={(j) => setEditData(d => ({ ...d, jours: j }))} />
            </div>
            <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,140,0,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ color: DS.colors.warning, fontSize: 12 }}>⚠️ Un nouveau programme IA sera généré.</p>
            </div>
            <button onClick={saveEdit} disabled={saving || !editData.sport || !editData.objectif || (editData.jours || []).length !== editData.frequence} style={{ width: "100%", height: 52, background: editData.sport && editData.objectif ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: editData.sport && editData.objectif ? "#000" : DS.colors.textSec, fontSize: 15, cursor: "pointer", ...s.heading, fontWeight: 700, letterSpacing: "0.05em" }}>
              {saving ? (editData.sport !== sport || editData.objectif !== objectif ? "Génération en cours..." : "Sauvegarde...") : (editData.sport !== sport || editData.objectif !== objectif ? "Sauvegarder et regenerer ⚡" : "Sauvegarder les changements")}
            </button>
          </div>
        </div>
      )}

      {/* Header hero */}
      <div style={{ padding: "60px 24px 32px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
          <div onClick={() => fileInputRef.current?.click()} style={{ position: "relative", width: 72, height: 72, flexShrink: 0, cursor: "pointer" }}>
            <div style={{ width: 72, height: 72, background: avatarUrl ? "transparent" : theme.accent + "20", border: `2px solid ${theme.accent}50`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, ...s.display, color: accentLisible(theme.accent), overflow: "hidden", boxShadow: `0 0 30px ${theme.accent}20` }}>
              {uploadingAvatar ? (
                <div style={{ width: 20, height: 20, border: `2px solid ${theme.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            {/* Bouton camera */}
            <div style={{ position: "absolute", bottom: -4, right: -4, width: 26, height: 26, borderRadius: "50%", background: theme.accent, border: `2px solid ${DS.colors.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#000" strokeWidth="2"/></svg>
            </div>
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{SPORT_EMOJIS[sport] || "⚡"}</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", textTransform: "uppercase" }}>{sport !== "default" ? sport : "Sport"}</span>
            </div>
            <p style={{ ...s.display, fontSize: 24, color: DS.colors.textPrimary, letterSpacing: "0.05em", lineHeight: 1, marginBottom: 4 }}>{userName.toUpperCase()}</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>{user?.email}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px", position: "relative", zIndex: 1 }}>

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[
            { val: totalSeancesAllTime || seancesCount, label: "Seances", color: accentLisible(theme.accent) },
            { val: streak, label: "Streak", color: DS.colors.success },
            { val: `${progression}%`, label: "Progres", color: DS.colors.warning },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 4 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { val: recordKg > 0 ? `${recordKg}` : "—", label: "Record kg", color: "#FF8C00" },
            { val: memberSinceDays, label: "Jours actif", color: "#00C8FF" },
            { val: `${seancesCount}`, label: "Ce mois", color: DS.colors.textSec },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 4 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Programme actif */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: 20, marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Programme actif</p>
              <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>{programme?.titre || "Aucun programme"}</p>
            </div>
            <div style={{ background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "4px 10px" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>CYCLE {currentCycle}</p>
            </div>
          </div>
          <ProgressBar value={progression} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>{frequence}x / semaine</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>Semaine {semaineCourante}/{totalSemaines} · {progression}%</p>
          </div>
          {objectif && objectif !== "Non defini" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ton objectif</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, textTransform: "capitalize" }}>{objectif}</p>
              </div>
            </div>
          )}
        </div>

        {/* Calendrier de la semaine */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cette semaine</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>{seancesFaitesSemaine.length}/{frequence} séances</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(() => {
              const jours = ["L", "M", "M", "J", "V", "S", "D"];
              const joursIdx = [1, 2, 3, 4, 5, 6, 0]; // getDay() index: L=1..D=0
              const todayIdx = new Date().getDay();
              const planPositions = (progData?.jours?.length ? progData.jours : DEFAULT_JOURS[Math.min(frequence, 5)]) || [1, 3, 5];
              return jours.map((j, i) => {
                const dayNum = joursIdx[i];
                const isPlanned = planPositions.includes(dayNum);
                const isDone = seancesFaitesSemaine.includes(dayNum);
                const isToday = dayNum === todayIdx;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isToday ? theme.accent : DS.colors.textDim, fontWeight: isToday ? 700 : 400 }}>{j}</p>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: isDone ? theme.accent : isPlanned ? theme.accent + "15" : DS.colors.surfaceHigh, border: `1.5px solid ${isDone ? theme.accent : isPlanned ? theme.accent + "40" : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isToday ? `0 0 0 2px ${theme.accent}30` : "none" }}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#000" strokeWidth="3" strokeLinecap="round" /></svg>
                      ) : isPlanned ? (
                        <span style={{ fontSize: 12 }}>💪</span>
                      ) : (
                        <span style={{ fontSize: 10, color: DS.colors.textDim }}>·</span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Historique des cycles — badges */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Parcours de cycles</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {(() => {
              const cycleInfo = (n) => n === 1 ? { label: "Fondations", emoji: "🌱" } : n === 2 ? { label: "Intensification", emoji: "⚡" } : n === 3 ? { label: "Puissance", emoji: "🔥" } : n === 4 ? { label: "Elite", emoji: "💎" } : { label: `Elite+${n - 4}`, emoji: "🚀" };
              const maxDisplay = Math.max(currentCycle, 4);
              return Array.from({ length: maxDisplay }, (_, i) => i + 1).map(n => {
                const info = cycleInfo(n);
                const isDone = currentCycle > n && n >= startCycle;
                const isSkipped = n < startCycle;
                const isCurrent = currentCycle === n;
                return (
                  <div key={n} style={{ flexShrink: 0, width: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: isSkipped ? 0.35 : 1 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: isDone ? theme.accent : isCurrent ? theme.accent + "20" : DS.colors.surfaceHigh, border: `2px solid ${isDone || isCurrent ? theme.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: isCurrent ? `0 0 16px ${theme.accent}50` : "none" }}>
                      {isSkipped ? "—" : info.emoji}
                    </div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? theme.accent : DS.colors.textSec, textAlign: "center", lineHeight: 1.2 }}>{info.label}</p>
                    {isDone && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>✓ FAIT</p>}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Modifier profil — 1 seul bouton clair */}
        <div onClick={openEdit} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✏️</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Modifier mon profil</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, fontFamily: "'Inter',sans-serif" }}>{sport !== "default" ? sport : "?"} · {objectif !== "Non defini" ? objectif : "?"} · {frequence}x/sem</p>
            </div>
          </div>
          <span style={{ color: accentLisible(theme.accent), fontSize: 18 }}>→</span>
        </div>

        {/* Notifications */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: notifOn ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, background: "rgba(255,229,0,0.1)", border: "1px solid rgba(255,229,0,0.2)", borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔔</div>
              <div>
                <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Rappels de séance</p>
                <p style={{ color: DS.colors.textSec, fontSize: 11, fontFamily: "'Inter',sans-serif" }}>{notifOn ? `TOUS LES JOURS À ${notifHeure}` : "DÉSACTIVÉ"}</p>
              </div>
            </div>
            <div onClick={() => {
              if (!notifOn) {
                if ("Notification" in window) {
                  Notification.requestPermission().then(p => { if (p === "granted") setNotifOn(true); });
                } else { setNotifOn(true); }
              } else { setNotifOn(false); }
            }} style={{ width: 50, height: 28, background: notifOn ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: 3, transform: `translateX(${notifOn ? 22 : 0}px)`, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "transform 200ms var(--ease-out)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
          {notifOn && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 14px" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", flex: 1 }}>HEURE DU RAPPEL</p>
              <input type="time" value={notifHeure} onChange={e => setNotifHeure(e.target.value)}
                style={{ background: "transparent", border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: "6px 10px", color: accentLisible(theme.accent), fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", colorScheme: "dark", cursor: "pointer" }} />
            </div>
          )}
        </div>

        {/* Theme */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{DS.colors.isDark ? "🌙" : "☀️"}</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Apparence</p>
              <p style={{ color: DS.colors.textSec, fontSize: 11, fontFamily: "'Inter',sans-serif" }}>{DS.colors.isDark ? "THÈME SOMBRE" : "THÈME LUMINEUX"}</p>
            </div>
          </div>
          <div onClick={() => { const next = DS.colors.isDark ? "light" : "dark"; DS.colors = THEMES[next]; DS.shadow = THEMES[next].shadow; localStorage.setItem("voltra_theme", next); onThemeChange && onThemeChange(next); }} style={{ width: 50, height: 28, background: DS.colors.isDark ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s", border: `1px solid ${DS.colors.border}` }}>
            <div style={{ position: "absolute", top: 3, left: 3, transform: `translateX(${DS.colors.isDark ? 22 : 0}px)`, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "transform 200ms var(--ease-out)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              {DS.colors.isDark ? "🌙" : "☀️"}
            </div>
          </div>
        </div>

        {/* Abonnement */}
        {isPro && (
          <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}40`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 15, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 800 }}>Voltra Pro actif</p>
            </div>
            <p onClick={() => setShowSub(true)} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, textDecoration: "underline", cursor: "pointer", margin: 0 }}>Gérer mon abonnement</p>
            {showSub && <SubscriptionScreen onBack={() => setShowSub(false)} accent={theme.accent} totalSeances={totalSeancesAllTime} memberDays={memberSinceDays} />}
          </div>
        )}

        {/* Informations legales */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, marginBottom: 14, overflow: "hidden" }}>
          {[["cgu", "📄", "Conditions d'utilisation"], ["privacy", "🔒", "Politique de confidentialité"], ["mentions", "ℹ️", "Mentions légales"]].map(([k, ic, label], i) => (
            <div key={k} onClick={() => setShowLegal(k)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", borderTop: i ? `1px solid ${DS.colors.border}` : "none" }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 14, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{label}</p>
              <span style={{ color: DS.colors.textSec }}>›</span>
            </div>
          ))}
          <a href="mailto:contact.voltra1@gmail.com?subject=Voltra%20-%20Support%20ou%20donn%C3%A9es" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderTop: `1px solid ${DS.colors.border}`, textDecoration: "none" }}>
            <span style={{ fontSize: 18 }}>✉️</span>
            <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 14, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>Support · supprimer mes données</p>
            <span style={{ color: DS.colors.textSec }}>›</span>
          </a>
        </div>
        {showLegal && <LegalScreen initial={showLegal} onBack={() => setShowLegal(null)} />}

        {/* Deconnexion */}
        <div onClick={onLogout} style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: DS.radius.xl, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚪</div>
          <p style={{ color: "#FF2D55", fontSize: 15, ...s.heading }}>Se déconnecter</p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME PREVIEW — avant inscription
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PROJECTION SCREEN — la transformation concrète
// ─────────────────────────────────────────────
// Nombre qui « compte » jusqu'à sa valeur (ex. "+18%", "24", "0.5T")
function CountUp({ value, duration = 1100, delay = 0 }) {
  const m = String(value).match(/^([+-]?)(\d+(?:[.,]\d+)?)(.*)$/);
  const [shown, setShown] = useState(m ? 0 : value);
  useEffect(() => {
    if (!m) return;
    const target = parseFloat(m[2].replace(",", "."));
    const decimals = (m[2].split(/[.,]/)[1] || "").length;
    let raf, start;
    const t = setTimeout(() => {
      const step = (ts) => {
        start = start || ts;
        const k = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - k, 3);
        setShown((target * eased).toFixed(decimals));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [value]);
  if (!m) return <>{value}</>;
  const sep = m[2].includes(",") ? "," : ".";
  return <>{m[1]}{String(shown).replace(".", sep)}{m[3]}</>;
}

function ProjectionScreen({ sport, onboardingData, onContinue }) {
  const theme = getSportTheme(sport);
  const accentTexte = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;

  const frequence = onboardingData?.frequence || 3;
  const totalSeances = frequence * 4; // 1 cycle = 4 semaines

  const stats = [
    { val: String(totalSeances), label: "Séances sur le cycle 1", sub: "puis ça continue", icon: "📅" },
    { val: "4", label: "Semaines de progression", sub: "charges ajustées au fil des séances", icon: "📈" },
    { val: "100%", label: "Adapté à ton profil", sub: "sport, niveau et matériel", icon: "🎯" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -140, left: -100, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${theme.accent}22, transparent 70%)`, pointerEvents: "none" }} />

      <div className="v-stagger" style={{ padding: "56px 24px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: accentTexte, marginBottom: 10 }}>TON PREMIER CYCLE · 4 SEMAINES</p>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 38, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 28 }}>
          Voici ton<br /><span style={{ color: accentTexte }}>premier cycle</span>
        </h1>

        {stats.map((st, i) => (
          <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 22, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 12, boxShadow: DS.shadow.card }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${theme.accent}1F`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{st.icon}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 32, letterSpacing: "-0.02em", color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}><CountUp value={st.val} delay={250 + i * 150} /></p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary }}>{st.label}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>{st.sub}</p>
            </div>
          </div>
        ))}

        {/* Continuité après le premier cycle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: 18, padding: "14px 16px", margin: "4px 0 12px" }}>
          <span style={{ fontSize: 22 }}>♾️</span>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, lineHeight: 1.5 }}>
            Et ce n'est que le <strong style={{ color: DS.colors.textPrimary }}>premier cycle</strong>. Ton programme évolue ensuite automatiquement : <strong style={{ color: DS.colors.textPrimary }}>progression continue toute l'année</strong>.
          </p>
        </div>

      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "20px 24px calc(24px + env(safe-area-inset-bottom, 0px))", maxWidth: 430, margin: "0 auto", background: fonduBas(), zIndex: 2 }}>
        <PrimaryButton onClick={onContinue} style={{ height: 58 }}>
          Voir mon programme complet
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME PREVIEW
// ─────────────────────────────────────────────
function ProgrammePreview({ programme, sport, onboardingData, onContinue }) {
  const theme = getSportTheme(sport);
  const progData = programme?.data_json;
  const seance = progData?.semaines?.[0]?.seances?.[0];
  const exercices = seance?.exercices || [];
  const frequence = onboardingData?.frequence || 3;

  const pad = n => String(n).padStart(2, "0");

  const nomsProgramme = {
    basketball: { explosivite: "Protocole Meneur Elite", detente: "Jump Performance", force: "Power Basketball", endurance: "Cardio Court" },
    football: { explosivite: "Sprint & Power", endurance: "Endurance Football", force: "Physical Domination" },
    tennis: { explosivite: "Reactive Tennis", force: "Power Serve", endurance: "Court Endurance" },
    rugby: { force: "Force Brute", masse: "Mass & Power", explosivite: "Impact Rugby", endurance: "Iron Endurance" },
    natation: { endurance: "Aqua Endurance Elite", force: "Power Swimmer", masse: "Swimmer Physique" },
    sprint: { explosivite: "Speed Demon", force: "Power Sprint", detente: "Explosive Athlete" },
    combat: { explosivite: "Combat Power", endurance: "Fight Conditioning", force: "Warrior Strength", masse: "Combat Mass" },
  };
  const nomProg = nomsProgramme[sport]?.[onboardingData?.objectif] || programme?.titre || "Performance Elite";
  const accentTexte = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none", opacity: 0.4 }} />

      <div className="v-stagger" style={{ padding: "48px 22px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* En-tête façon « sport énergique » */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 34, lineHeight: 1.02, letterSpacing: "-0.02em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 12 }}>
            Ton programme<br /><span style={{ color: accentTexte }}>est prêt</span>
          </h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: "6px 14px", boxShadow: DS.shadow.card }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, animation: "pulse 1.5s infinite" }} />
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: DS.colors.textPrimary }}>{nomProg}</span>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>· {frequence}x / semaine</span>
          </div>
        </div>

        {/* Ticket offre de bienvenue */}
        <div className="v-shine" style={{ background: DS.colors.primary, color: "#0B0B0C", borderRadius: 22, padding: "20px 22px", transform: "rotate(-1.5deg)", boxShadow: DS.shadow.primary, margin: "8px 4px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -18, top: -18, width: 90, height: 90, borderRadius: "50%", background: "rgba(0,0,0,0.06)" }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em" }}>OFFRE DE BIENVENUE</p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 64, lineHeight: 1, letterSpacing: "-0.03em", margin: "4px 0 6px" }}>-25%</p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14 }}>Ta 1ère année à 56,24 € <span style={{ textDecoration: "line-through", opacity: 0.55, fontWeight: 600 }}>74,99 €</span></p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 500, fontSize: 12, opacity: 0.7, marginTop: 2 }}>Puis 74,99 €/an · ou -30 % le 1er mois en mensuel (10,49 €, puis 14,99 €/mois)</p>
        </div>

        {/* Garanties */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 22 }}>
          {["Sans engagement", "Résiliable à tout moment", "Paiement sécurisé Stripe"].map(t => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12, color: DS.colors.textPrimary, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: "6px 12px", boxShadow: DS.shadow.card }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke={accentTexte} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{t}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { val: exercices.length || "5+", label: "Exos / séance", color: accentLisible(theme.accent) },
            { val: frequence * 4, label: "Séances / cycle", color: "#00FF87" },
            { val: "∞", label: "Progression", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surfaceHigh, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "14px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 5 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, fontWeight: 500 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Aperçu séance */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.xl, overflow: "hidden", marginBottom: 16, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${DS.colors.border}` }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: DS.colors.textPrimary }}>Aperçu — Séance 1</p>
            <div style={{ background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: DS.radius.full, padding: "3px 10px" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, color: "#FF2D55" }}>🔒 Accès restreint</p>
            </div>
          </div>
          <div style={{ padding: "8px 16px 14px" }}>
            {/* 2 exercices visibles */}
            {(exercices.length > 0 ? exercices.slice(0, 2) : [{nom: "Squat Barre", muscles: "Quadriceps", sets: 4, reps: "8"}, {nom: "Deadlift Roumain", muscles: "Ischios", sets: 3, reps: "10"}]).map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${DS.colors.border}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: theme.accent + "20", border: `1px solid ${theme.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: accentLisible(theme.accent), fontWeight: 700 }}>{i + 1}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 14, color: DS.colors.textPrimary, marginBottom: 2 }}>{ex.nom}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>{(ex.muscles || "").split(" ")[0]}</p>
                </div>
                <p style={{ fontFamily: "'Inter',sans-serif", color: accentLisible(theme.accent), fontSize: 12, fontWeight: 700 }}>{ex.sets}×{ex.reps}</p>
              </div>
            ))}

            {/* Exercices floutés avec vrai contenu */}
            <div style={{ position: "relative", marginTop: 4 }}>
              {[
                {nom: exercices[2]?.nom || "Box Jump Explosif", muscles: exercices[2]?.muscles || "Mollets", sets: exercices[2]?.sets || 4, reps: exercices[2]?.reps || "6"},
                {nom: exercices[3]?.nom || "Hip Thrust Barre", muscles: exercices[3]?.muscles || "Fessiers", sets: exercices[3]?.sets || 3, reps: exercices[3]?.reps || "12"},
                {nom: exercices[4]?.nom || "Fentes Bulgares", muscles: exercices[4]?.muscles || "Quadriceps", sets: exercices[4]?.sets || 3, reps: exercices[4]?.reps || "10"},
              ].map((ex, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 2 ? `1px solid ${DS.colors.border}` : "none", filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: DS.colors.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec, fontWeight: 700 }}>{i + 3}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 14, color: DS.colors.textPrimary, marginBottom: 2 }}>{ex.nom}</p>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>{ex.muscles}</p>
                  </div>
                  <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 12 }}>{ex.sets}×{ex.reps}</p>
                </div>
              ))}
              {/* Overlay cadenas */}
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: DS.colors.isDark ? "rgba(6,6,14,0.6)" : "rgba(255,255,255,0.65)", backdropFilter: "blur(3px)", borderRadius: DS.radius.md }}>
                <span style={{ fontSize: 28, marginBottom: 8 }}>🔒</span>
                <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: DS.colors.textPrimary, marginBottom: 4 }}>
                  {Math.max(exercices.length > 2 ? exercices.length - 2 : 3, 3)} exercices bloqués
                </p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>Inscris-toi pour tout débloquer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        {/* CTA, toujours visible en bas */}
        <div style={{ position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", background: fonduBas() }}>
        <button onClick={onContinue} style={{ width: "100%", height: 58, background: DS.colors.textPrimary, color: DS.colors.bg, border: "none", borderRadius: DS.radius.full, fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          Je profite de l'offre
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, textAlign: "center" }}>
          Inscription gratuite · 30 secondes · Sans carte bancaire
        </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// POST SESSION UPSELL
// ─────────────────────────────────────────────
function PostSessionUpsell({ stats, programme, sportActif, onSelectPlan }) {
  const [selected, setSelected] = useState("annual");
  const [loading, setLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [consentAchat, setConsentAchat] = useState(false);
  const theme = getSportTheme(sportActif);

  // Paiement : même parcours Stripe que la page des offres (le passage en Pro se fait par le webhook Stripe)
  const handleCheckout = async () => {
    setLoading(true);
    setStripeError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ plan: selected, user_id: session?.user?.id, email: session?.user?.email, success_url: window.location.origin + window.location.pathname, cancel_url: window.location.origin + window.location.pathname }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setStripeError("Erreur lors de la redirection. Réessaie.");
    } catch (err) {
      setStripeError("Erreur de connexion. Réessaie.");
    }
    setLoading(false);
  };
  const currentPlan = PLANS.find(p => p.id === selected);
  const totalSemaines = programme?.total_semaines || 8;
  const semaineCourante = programme?.semaine_courante || 1;

  const feedbackMsg = stats?.feedback === "easy" ? "Tu as géré facilement —" :
    stats?.feedback === "good" ? "Séance parfaite —" : "Tu t'es vraiment donné —";

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, overflowY: "auto", paddingBottom: 40, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sportActif] || "⚡"}
      </div>

      <div style={{ padding: "60px 20px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header celebratoire */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: theme.accent + "20", border: `2px solid ${theme.accent}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px", boxShadow: `0 0 60px ${theme.accent}30`, animation: "celebrate 0.6s var(--ease-spring)" }}>
            🏆
          </div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 10 }}>SEANCE TERMINEE</div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 32, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 8, letterSpacing: "0.02em" }}>
            {feedbackMsg}<br />tu progresses !
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stats?.titre?.toUpperCase()}</p>
        </div>

        {/* Stats personnalisées de la séance */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {[
            { val: stats?.exercices || 0, label: "EXERCICES", color: accentLisible(theme.accent) },
            { val: `${stats?.duree || 0}min`, label: "DUREE", color: accentLisible("#9BE84F") },
            stats?.totalKg > 0
              ? { val: `${stats.totalKg}kg`, label: "SOULEVE", color: "#FF8C00" }
              : { val: `${stats?.totalReps || 0}`, label: "REPETITIONS", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, background: DS.colors.surfaceHigh, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Message accrocheur */}
        <div style={{ background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent}04)`, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 18, color: DS.colors.textPrimary, marginBottom: 6 }}>
            Ta progression vient de commencer.
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em" }}>
            {stats?.totalKg > 0 ? `Tu viens de soulever ${stats.totalKg}kg. ` : stats?.totalReps > 0 ? `Tu viens de faire ${stats.totalReps} répétitions. ` : ""}La vraie transformation commence maintenant — continue avec Pro pour débloquer toutes tes séances.
          </p>
        </div>

        {/* Ce qu'il rate */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>CE QUE TU DEBLOQUES</p>
          {[
            { emoji: "📈", title: "Progression automatique", desc: "Tes charges augmentent intelligemment chaque semaine" },
            { emoji: "🤖", title: "Coach IA illimité", desc: "Adaptation en temps réel pendant chaque séance" },
            { emoji: "🏆", title: "Suivi des records", desc: "Visualise tes progrès et bats tes records" },
            { emoji: "⚡", title: "Progression sans fin", desc: "Nouveau programme généré automatiquement à chaque cycle" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < 3 ? `1px solid ${DS.colors.border}` : "none" }}>
              <div style={{ width: 36, height: 36, background: theme.accent + "12", border: `1px solid ${theme.accent}20`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{f.emoji}</div>
              <div>
                <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading, marginBottom: 2 }}>{f.title}</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PLANS.map(plan => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{ position: "relative", background: selected === plan.id ? plan.colorSoft : DS.colors.surface, border: `1.5px solid ${selected === plan.id ? plan.colorBorder : DS.colors.border}`, borderRadius: DS.radius.xl, padding: "16px 20px", cursor: "pointer", transition: "var(--t-choix)" }}>
              {selected === plan.id && <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 2, background: plan.color, borderRadius: DS.radius.full }} />}
              {plan.badge && <div style={{ display: "inline-flex", padding: "2px 8px", background: plan.colorSoft, border: `1px solid ${plan.colorBorder}`, borderRadius: DS.radius.full, color: accentLisible(plan.color), fontSize: 10, ...s.heading, marginBottom: 8 }}>{plan.badge}</div>}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 12, marginBottom: 4 }}>{plan.label}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: selected === plan.id ? accentLisible(plan.color) : DS.colors.textPrimary }}>{plan.displayPrice || `${plan.price}€`}</span>
                    <span style={{ color: DS.colors.textSec, fontSize: 13 }}>{plan.unit}</span>
                  </div>
                  {plan.priceDetail && <p style={{ color: DS.colors.textSec, fontSize: 12, marginTop: 4 }}>{plan.priceDetail}</p>}
                  {plan.bienvenue && <p style={{ color: accentLisible(plan.color), fontSize: 12, fontWeight: 700, marginTop: 2 }}>{plan.bienvenue}</p>}
                </div>
                <div style={{ width: 22, height: 22, borderRadius: DS.radius.full, border: `2px solid ${selected === plan.id ? plan.color : DS.colors.textDim}`, background: selected === plan.id ? plan.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "var(--t-choix)" }}>
                  {selected === plan.id && <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: "white" }} />}
                </div>
              </div>
              {plan.savings && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ padding: "2px 8px", background: plan.colorSoft, borderRadius: DS.radius.full, color: accentLisible(plan.color), fontSize: 10, ...s.heading }}>{plan.savings}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <ConsentementAchat coche={consentAchat} onChange={setConsentAchat} />
        <button onClick={handleCheckout} disabled={loading || !consentAchat} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", marginBottom: 12, boxShadow: `0 8px 32px ${theme.accent}40` }}>
          {loading ? "Redirection..." : "CONTINUER MA PROGRESSION →"}
        </button>
        {stripeError && <p style={{ color: "#FF2D55", fontSize: 12, textAlign: "center", marginBottom: 8, fontFamily: "'Inter',sans-serif" }}>{stripeError}</p>}
        <p style={{ color: DS.colors.textDim, fontSize: 11, textAlign: "center", marginBottom: 16, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em" }}>🔒 Paiement sécurisé Stripe · Annulation en 1 clic</p>
        <button onClick={() => onSelectPlan("free")} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textDim, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif", marginTop: 4 }}>
          Non merci, je reste sur le plan gratuit
        </button>
        {/* Bouton plus tard visible */}
        <button onClick={() => onSelectPlan("free")} style={{ position: "fixed", top: 52, left: 16, zIndex: 200, display: "flex", alignItems: "center", gap: 6, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: "8px 14px", color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ✕ <span>Plus tard</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────
function BottomNav({ activeTab, setTab }) {
  const tabs = [
    { id: "dashboard", label: "Aujourd'hui", icon: Icons.home },
    { id: "historique", label: "Progression", icon: Icons.chart },
    { id: "profil", label: "Profil", icon: Icons.user },
  ];
  const idx = Math.max(0, tabs.findIndex(t => t.id === activeTab));
  // Barre flottante façon « pilule », avec un repère qui glisse vers l'onglet choisi
  return (
    <div style={{ position: "fixed", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 100, width: "calc(100% - 32px)", maxWidth: 398, background: DS.colors.navBg, backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: 6, display: "flex", boxShadow: DS.colors.isDark ? "0 12px 40px rgba(0,0,0,0.6)" : "0 12px 36px rgba(0,0,0,0.12)" }}>
      <div style={{ position: "absolute", top: 6, bottom: 6, left: 6, width: `calc((100% - 12px) / ${tabs.length})`, borderRadius: DS.radius.full, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, transform: `translateX(${idx * 100}%)`, transition: "transform 240ms var(--ease-out)" }} />
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setTab(tab.id)} style={{ position: "relative", zIndex: 1, flex: 1, height: 52, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <span style={{ display: "flex", transform: isActive ? "translateY(-1px) scale(1.08)" : "none", transition: "transform 200ms var(--ease-out)" }}>{tab.icon(isActive)}</span>
            <span style={{ color: isActive ? DS.colors.textPrimary : DS.colors.textSec, fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: isActive ? 800 : 600, transition: "color 0.2s ease" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
export default function VoltraApp() {
  const [screen, setScreen] = useState("splash");
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem("voltra_theme") || "light");
  const [themeChosen, setThemeChosen] = useState(() => !!localStorage.getItem("voltra_theme"));
  const [sessionChecked, setSessionChecked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const userRef = useRef(null);
  const sessionCheckedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [seanceActive, setSeanceActive] = useState(null);
  const [resumeState, setResumeState] = useState(null);
  const [programmeActif, setProgrammeActif] = useState(null);
  const [sportActif, setSportActif] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [matchs, setMatchs] = useState([]);
  const [showMatchs, setShowMatchs] = useState(false);
  const [derniereSeance, setDerniereSeance] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [showDoubleSessionWarning, setShowDoubleSessionWarning] = useState(false);
  const [pendingSeance, setPendingSeance] = useState(null);
  const [authConfirmation, setAuthConfirmation] = useState(null);
  const [profilPhysique, setProfilPhysique] = useState(null);

  const launchSeance = (rawSeance) => {
    const dj = programmeActif?.data_json || {};
    const profilCharges = {
      poids: profilPhysique?.poids ?? onboardingData?.poids ?? null,
      age: profilPhysique?.age ?? onboardingData?.age ?? null,
      niveau: dj.niveau || programmeActif?.niveau || onboardingData?.niveau || "debutant",
      cycle: dj.cycle || 1,
      avecCharges: !["maison", "terrain"].includes(dj.equipement || onboardingData?.equipement),
    };
    const seance = {
      ...rawSeance,
      exercices: (rawSeance.exercices || []).map((ex, i) => securiserExercice({
        materiel: ex.materiel || "",
        chargeUnite: ex.chargeUnite || "",
        id: ex.id || `ex_${i}`,
        nom: ex.nom || "Exercice",
        nomEn: ex.nomEn || ex.nom_en || "",
        muscles: ex.muscles || "",
        sets: ex.sets || 3,
        reps: ex.reps || "8",
        chargeKg: ex.chargeKg || ex.charge_kg || 0,
        reposSec: ex.reposSec || ex.repos_sec || 90,
        conseil: ex.conseil || "",
        ordre: ex.ordre || i + 1,
      }, profilCharges))
    };
    setResumeState(null);
    localStorage.removeItem("voltra_paused_session");
    setSeanceActive(seance);
  };
  const [showUpsell, setShowUpsell] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const genPromiseRef = useRef(null);
  // Lance la génération UNE seule fois (réutilise la requête en cours)
  const startGeneration = (data) => {
    if (genPromiseRef.current) return genPromiseRef.current;
    setProgrammeLoading(true);
    genPromiseRef.current = generateProgramIA(data)
      .then(async prog => { const p = await attachJours(prog, data.jours); if (p) setProgrammeActif(p); return p; })
      .catch(err => { console.error(err); return null; })
      .finally(() => { setProgrammeLoading(false); genPromiseRef.current = null; });
    return genPromiseRef.current;
  };
  const [paidPlan, setPaidPlan] = useState(null);
  const [lastSessionStats, setLastSessionStats] = useState(null);
  const [cycleComplete, setCycleComplete] = useState(false);

  useEffect(() => {
    applyTheme(appTheme);
    document.body.style.background = DS.colors.bg;
    document.body.style.color = DS.colors.textPrimary;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", DS.colors.bg);
  }, [appTheme]);

  const ecranPrecedent = useRef(screen);
  // Transition douce à chaque changement d'écran ou d'onglet (opacité seulement, pour ne pas décaler les éléments fixés)
  useEffect(() => {
    const el = document.getElementById("root")?.firstElementChild;
    if (!el || !el.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Changer d'onglet arrive sans cesse : fondu très court. Changer d'écran : un peu plus présent.
    const memeEcran = ecranPrecedent.current === screen;
    ecranPrecedent.current = screen;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: memeEcran ? 120 : 220, easing: "ease-out" });
  }, [screen, activeTab, !!seanceActive]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
        --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
        --t-choix: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, opacity 160ms ease, scale 120ms var(--ease-out);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter',sans-serif; overscroll-behavior: none; -webkit-font-smoothing: antialiased; }
      h1, h2 { letter-spacing: -0.02em; text-wrap: balance; }
      p { text-wrap: pretty; }
      button, a, [style*="cursor: pointer"] { touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
      :focus-visible { outline: 2px solid #9BE84F; outline-offset: 2px; }
      @media (pointer: coarse) { input, textarea, select { font-size: 16px !important; } }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fillCircle { from { stroke-dashoffset: 276; } to { stroke-dashoffset: 0; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes splashPulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(0,255,135,0.5)); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 40px rgba(0,255,135,0.8)); } }
      @keyframes celebrate { from { transform: scale(0.8) rotate(-6deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
      @keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-60px); opacity: 0; } }
      /* Motion design : apparitions, relief au toucher, brillance */
      @keyframes vFadeUp { from { opacity: 0; translate: 0 10px; } }
      @keyframes vScaleIn { from { opacity: 0; scale: 0.95; } }
      @keyframes vFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
      @keyframes vGlow { 0% { box-shadow: 0 0 0 0 rgba(155,232,79,0.45); } 100% { box-shadow: 0 0 0 14px rgba(155,232,79,0); } }
      @keyframes vMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes vProgress { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      @keyframes vShine { 0% { transform: translateX(-120%) skewX(-20deg); } 25%, 100% { transform: translateX(260%) skewX(-20deg); } }
      .v-stagger > * { animation: vFadeUp 300ms var(--ease-out) backwards; }
      ${Array.from({ length: 12 }, (_, i) => `.v-stagger > *:nth-child(${i + 1}) { animation-delay: ${(i * 0.04).toFixed(2)}s; }`).join("\n      ")}
      .v-up { animation: vFadeUp 320ms var(--ease-out) backwards; }
      .v-pop { animation: vScaleIn 240ms var(--ease-out) backwards; }
      .v-float { animation: vFloat 3.2s ease-in-out infinite; }
      .v-glow { animation: vGlow 1.6s ease-out 2; }
      .v-shine { position: relative; overflow: hidden; }
      .v-shine::after { content: ""; position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: vShine 7s var(--ease-out) 1.5s infinite; pointer-events: none; }
      button { transition: var(--t-choix); }
      button:disabled { opacity: 0.55; }
      button:not(:disabled):active { scale: 0.97; }
      [style*="cursor: pointer"]:not(button) { transition: var(--t-choix); }
      [style*="cursor: pointer"]:not(button):active { scale: 0.98; }
      @media (hover: hover) and (pointer: fine) { button:not(:disabled):hover { filter: brightness(1.05); } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; transition-duration: 0.001ms !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        userRef.current = session.user;
      }
      setSessionChecked(true);
      sessionCheckedRef.current = true;
    });

    // Detecter confirmation email via hash URL
    if (window.location.hash.includes("access_token")) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUser(user);
          userRef.current = user;
        }
      });
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_OUT") {
        setUser(null);
        userRef.current = null;
        setScreen("onboarding");
      } else if (_event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
        userRef.current = session.user;
      } else if (_event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        userRef.current = session.user;
        // Ne pas rediriger ici — onAuth ou splashDone s'en charge (y compris après la confirmation d'email)
      } else if (_event === "PASSWORD_RECOVERY") {
        // Laisser AuthScreen gérer via isPasswordRecovery
        setScreen("auth");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Router proprement quand splash + session sont prêts
  useEffect(() => {
    if (!splashDone) return;
    const themeOk = !!localStorage.getItem("voltra_theme");
    const doRoute = () => {
      const params = new URLSearchParams(window.location.search);
      const isConfirmed = params.get("confirmed") === "true";
      const hasToken = window.location.hash.includes("access_token");
      const isPaid = params.get("paid") === "true";
      const paidPlanParam = params.get("plan") || "monthly";
      if (isPaid && userRef.current) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setPaidPlan(paidPlanParam);
        setScreen("payment-success");
        // Le passage en Pro est fait uniquement par le webhook Stripe : on relit le profil (le webhook peut prendre quelques secondes)
        const uid = userRef.current.id;
        let essais = 0;
        const verifierPro = async () => {
          const { data } = await supabase.from("profiles").select("is_pro").eq("id", uid).maybeSingle();
          if (data?.is_pro) setIsPro(true);
          else if (++essais < 15) setTimeout(verifierPro, 2000);
        };
        verifierPro();
        return;
      }
      if (confirmationEmail) {
        // Vient du lien de confirmation d'email → page de connexion, même si l'onboarding n'a pas été fait sur cet appareil
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthConfirmation(confirmationEmail);
        confirmationEmail = null;
        setScreen("auth");
        return;
      }
      if (!themeOk) {
        setScreen("theme-choice");
      } else if (userRef.current) {
        setScreen("app");
      } else if (isConfirmed || hasToken) {
        // Vient de la confirmation email → aller à la connexion
        setScreen("auth");
      } else {
        setScreen("onboarding");
      }
    };
    if (sessionCheckedRef.current) {
      doRoute();
    } else {
      const interval = setInterval(() => {
        if (sessionCheckedRef.current) {
          clearInterval(interval);
          doRoute();
        }
      }, 50);
      const fallback = setTimeout(() => { clearInterval(interval); doRoute(); }, 3000);
      return () => { clearInterval(interval); clearTimeout(fallback); };
    }
  }, [splashDone]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProgrammeActif(null);
    setSportActif(null);
    setOnboardingData(null);
    setIsPro(false);
    setUser(null);
    setScreen("onboarding");
  };

  useEffect(() => {
    if (screen !== "app" || !user) return;
    supabase
      .from("programmes")
      .select("*")
      .eq("user_id", user.id)
      .eq("statut", "actif")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setProgrammeActif(data);
      });
    supabase
      .from("matchs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date_match", new Date().toISOString().split("T")[0])
      .order("date_match", { ascending: true })
      .limit(5)
      .then(({ data }) => { if (data) setMatchs(data); });
    // Charger le sport et is_pro depuis le profil
    supabase
      .from("profiles")
      .select("sport, is_pro, poids, age, taille")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.sport) setSportActif(data.sport);
        if (data?.is_pro) setIsPro(true);
        if (data) setProfilPhysique({ poids: data.poids, age: data.age, taille: data.taille });
      });
    supabase
      .from("seances")
      .select("*, exercices(*)")
      .eq("user_id", user.id)
      .eq("statut", "faite")
      .order("date_realisee", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setDerniereSeance(data); });
    supabase
      .from("seances")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("statut", "faite")
      .then(({ count }) => { if (count) setSeancesCount(count); });
  }, [screen, user]);

  if (screen === "theme-choice") return <ThemeChoiceScreen key={appTheme} onChoose={(theme) => {
    DS.colors = THEMES[theme];
    DS.shadow = THEMES[theme].shadow;
    setAppTheme(theme);
    setThemeChosen(true);
    localStorage.setItem("voltra_theme", theme);
    setScreen("welcome");
  }} />;
  if (screen === "welcome") return <div key={appTheme}><WelcomeScreen onStart={() => setScreen("onboarding")} /></div>;
  if (screen === "splash") return <SplashScreen onDone={() => setSplashDone(true)} />;
  if (screen === "payment-success") return <PaymentSuccessScreen
    plan={paidPlan}
    onContinue={() => {
      if (programmeLoading || !programmeActif) {
        setScreen("programme-generating");
      } else {
        setScreen("app");
      }
    }}
  />;

  if (screen === "programme-generating") return <ProgrammeGeneratingScreen
    sport={sportActif}
    programmeActif={programmeActif}
    programmeLoading={programmeLoading}
    onboardingData={onboardingData}
    onDone={() => setScreen("app")}
  />;

  if (screen === "cycle-complete") return <CycleCompleteScreen
    programme={programmeActif}
    sport={sportActif}
    cycleLoading={cycleComplete}
    onContinue={() => setScreen("app")}
  />;
  if (screen === "projection") return <ProjectionScreen
    sport={sportActif}
    onboardingData={onboardingData}
    onContinue={() => setScreen("preview")}
  />;
  if (screen === "preview") return <ProgrammePreview
    programme={programmeActif}
    sport={sportActif}
    onboardingData={onboardingData}
    onContinue={() => setScreen("auth")}
  />;
  if (screen === "auth") return <AuthScreen confirmation={authConfirmation} onboardingData={onboardingData} onAuth={async (u) => {
    setUser(u);
    userRef.current = u;
    let ob = onboardingData;
    // Email confirmé dans un autre onglet/appareil : on reprend les réponses gardées avec le compte, s'il n'a pas encore de programme
    if (!ob && u.user_metadata?.onboarding) {
      const { data: progs } = await supabase.from("programmes").select("id").eq("user_id", u.id).limit(1);
      if (!progs?.length) {
        ob = u.user_metadata.onboarding;
        setOnboardingData(ob);
        setSportActif(ob.sport);
      }
    }
    // Sauvegarder le sport dans le profil
    if (ob?.sport) {
      await supabase.from("profiles").upsert({ id: u.id, sport: ob.sport, poids: ob.poids || null, age: ob.age || null, taille: ob.taille || null }, { onConflict: "id" });
    }
    if (ob) {
      // Toujours regenerer apres auth — maintenant on a une session valide
      setScreen("pricing");
      startGeneration(ob);
    } else {
      setScreen("app");
    }
  }} />;
  if (screen === "onboarding") return <OnboardingScreen onComplete={(data, programme) => {
    if (programme) setProgrammeActif(programme);
    setSportActif(data.sport);
    setOnboardingData(data);
    if (user) {
      startGeneration(data);
      setScreen("pricing");
    } else {
      setScreen("projection");
    }
  }} />;
  if (screen === "post-session-upsell") return <PostSessionUpsell
    stats={lastSessionStats}
    programme={programmeActif}
    sportActif={sportActif}
    onSelectPlan={() => setScreen("app")}
  />;
if (screen === "pricing") return <PricingScreen programme={programmeActif} frequence={onboardingData?.frequence} user={user} onSelectPlan={async (plan) => {
    if (plan === "free") {
      // Plan gratuit → écran de génération si programme pas encore prêt
      if (!programmeActif && onboardingData) {
        setScreen("programme-generating");
        startGeneration(onboardingData);
      } else {
        setScreen("app");
      }
    } else {
      // Les offres payantes passent par Stripe (le Pro est activé par le webhook)
      setScreen("app");
    }
  }} />;

  return (
    <div key={`${appTheme}-${screen}`} style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100dvh" }}>

      {/* Avertissement 2eme seance dans la journee (Pro uniquement) */}
      {showDoubleSessionWarning && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ width: "100%", maxWidth: 360, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 24, padding: "28px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>💪</p>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 20, color: DS.colors.textPrimary, marginBottom: 8, lineHeight: 1.15 }}>Tu as déjà fait une séance aujourd'hui</h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, lineHeight: 1.6, marginBottom: 20 }}>
              Le repos fait partie de la progression. Es-tu sûr de vouloir enchaîner une 2ème séance ?
            </p>
            <button onClick={() => { setShowDoubleSessionWarning(false); if (pendingSeance) launchSeance(pendingSeance); setPendingSeance(null); }} style={{ width: "100%", height: 52, background: DS.colors.primary, border: "none", borderRadius: 999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
              Oui, je continue
            </button>
            <button onClick={() => { setShowDoubleSessionWarning(false); setPendingSeance(null); }} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 13, cursor: "pointer" }}>
              Non, à demain
            </button>
          </div>
        </div>
      )}

      {showMatchs ? (
        <MatchsScreen user={user} onBack={() => {
          setShowMatchs(false);
          supabase.from("matchs").select("*").eq("user_id", user.id)
            .gte("date_match", new Date().toISOString().split("T")[0])
            .order("date_match", { ascending: true }).limit(5)
            .then(({ data }) => { if (data) setMatchs(data); });
        }} />
      ) : seanceActive ? (
        <SeanceScreen
          isPro={isPro}
          resumeState={resumeState}
          seance={seanceActive}
          sport={sportActif}
          onBack={() => setSeanceActive(null)}
          onFinish={async (feedback, completedSetsData, exercices, durationMin) => {
            let ecranSuivant = "app";
            try {
              let resultat = null;
              if (programmeActif?.id && feedback) {
                resultat = await saveCompleteSession(programmeActif.id, seanceActive, completedSetsData, feedback, durationMin);
                const { data } = await supabase.from("programmes").select("*").eq("id", programmeActif.id).single();
                if (data) setProgrammeActif(data);
              }
              // Verifier si le cycle est termine
              const updatedProg = await supabase.from("programmes").select("*").eq("id", programmeActif?.id).single();
              const prog = updatedProg.data;
              if (prog && resultat?.cycleTermine) {
                // Cycle termine → generer nouveau programme plus intense
                setCycleComplete(true);
                ecranSuivant = "cycle-complete";
                // Le cycle suivant garde le profil de l'athlète : niveau, matériel, blessures, poids, âge, taille
                const reponses = onboardingData || user?.user_metadata?.onboarding || {};
                const newData = {
                  sport: sportActif,
                  objectif: prog.objectif || prog.data_json?.objectif,
                  niveau: prog.niveau || prog.data_json?.niveau || reponses.niveau || "intermediaire",
                  frequence: prog.frequence || prog.data_json?.frequence || 3,
                  cycle: (prog.data_json?.cycle || 1) + 1,
                  jours: prog.data_json?.jours,
                  equipement: prog.data_json?.equipement || reponses.equipement,
                  douleurs: prog.data_json?.douleurs || reponses.douleurs,
                  poste: prog.data_json?.poste || reponses.poste,
                  poids: profilPhysique?.poids ?? reponses.poids,
                  age: profilPhysique?.age ?? reponses.age,
                  taille: profilPhysique?.taille ?? reponses.taille,
                };
                generateProgramIA(newData).then(async newProg0 => {
                  const newProg = await attachJours(newProg0, newData.jours);
                  if (newProg) {
                    setProgrammeActif(newProg);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      await supabase.from("programmes")
                        .update({ statut: "termine" })
                        .eq("id", prog.id);
                    }
                  }
                  setCycleComplete(false);
                }).catch(err => {
                  console.error("Cycle regen error:", err);
                  setCycleComplete(false);
                });
                return;
              }

              // Si gratuit → paywall après la 1ère séance avec vraies stats
              if (!isPro) {
                const exos = seanceActive?.exercices || [];
                const totalKg = exos.reduce((acc, ex) => {
                  if (!(ex.chargeKg > 0)) return acc;
                  return acc + ex.chargeKg * (ex.sets || 3) * (parseInt(ex.reps) || 8);
                }, 0);
                const totalReps = exos.reduce((acc, ex) => acc + (ex.sets || 3) * (parseInt(ex.reps) || 8), 0);
                setLastSessionStats({
                  titre: seanceActive?.titre || "Seance",
                  exercices: exos.length || 0,
                  duree: durationMin,
                  totalKg: Math.round(totalKg),
                  totalReps,
                  feedback,
                });
                ecranSuivant = "post-session-upsell";
                return;
              }
            } catch (err) {
              console.error("onFinish error:", err);
            } finally {
              setSeancesCount(prev => prev + 1);
              setSeanceActive(null);
              setActiveTab("dashboard");
              setScreen(ecranSuivant);
            }
          }}
        />
      ) : (
        <>
          {activeTab === "dashboard" && (
            <DashboardScreen
              user={user}
              programme={programmeActif}
              programmeLoading={programmeLoading}
              matchs={matchs}
              derniereSeance={derniereSeance}
              sport={sportActif}
              onOpenMatchs={() => setShowMatchs(true)}
              onResumeSession={(paused) => {
                setResumeState({ exIdx: paused.exIdx, setIdx: paused.setIdx, completedSets: paused.completedSets, elapsed: paused.elapsed });
                localStorage.removeItem("voltra_paused_session");
                setSeanceActive(paused.seance);
              }}
              onStartSession={async (rawSeance) => {
                if (!rawSeance) {
                  console.warn("Pas de séance disponible");
                  return;
                }
                // Verifier si une seance a deja ete faite aujourd'hui
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                  // Offre gratuite : 1 seule séance au total. Pro : on prévient seulement en cas de 2e séance du jour.
                  let requete = supabase
                    .from("seances")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", session.user.id)
                    .eq("statut", "faite");
                  if (isPro) requete = requete.gte("date_realisee", todayStart.toISOString());
                  const { count: doneToday } = await requete;

                  if (!isPro && (doneToday || 0) >= 1) {
                    setLastSessionStats({ titre: rawSeance.titre || "Seance", exercices: 0, duree: 0, totalKg: 0, totalReps: 0, feedback: null });
                    setScreen("post-session-upsell");
                    return;
                  }
                  if (isPro && (doneToday || 0) >= 1) {
                    setPendingSeance(rawSeance);
                    setShowDoubleSessionWarning(true);
                    return;
                  }
                }
                launchSeance(rawSeance);
              }}
            />
          )}
          {activeTab === "historique" && <HistoriqueScreen />}
          {activeTab === "profil" && <ProfilScreen isPro={isPro} user={user} programme={programmeActif} sportActif={sportActif} appTheme={appTheme} onThemeChange={setAppTheme} onLogout={handleLogout} onRegenerateProgram={async (data, shouldRegen = true) => {
            try {
              if (shouldRegen) {
                const prog0 = await generateProgramIA(data);
                const prog = await attachJours(prog0, data.jours);
                if (prog) { setProgrammeActif(prog); setSportActif(data.sport); }
              } else {
                // Juste rafraichir le programme depuis la base
                setSportActif(data.sport);
                const { data: prog } = await supabase.from("programmes").select("*").eq("id", programmeActif?.id).single();
                if (prog) setProgrammeActif(prog);
              }
            } catch (err) { console.error(err); }
          }} />}
          <BottomNav activeTab={activeTab} setTab={setActiveTab} />
        </>
      )}
    </div>
  );
}
