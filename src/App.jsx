// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

async function generateProgramIA({ sport, objectif, niveau, frequence }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Pas de session");
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-program`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ sport, objectif, niveau, frequence }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur generation");
  return data.programme;
}

async function saveCompleteSession(programmeId, seance, completedSetsData, feedback, durationMin) {
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

    return { success: true, deload };
  } catch (err) {
    console.error("saveCompleteSession:", err);
    return null;
  }
}


const DS = {
  colors: {
    bg: "#0A0A0F", surface: "#13131A", surfaceUp: "#1C1C26", surfaceHigh: "#242433",
    primary: "#6C63FF", primarySoft: "rgba(108,99,255,0.10)", primaryGlow: "rgba(108,99,255,0.25)",
    success: "#00E5A0", successSoft: "rgba(0,229,160,0.12)",
    warning: "#FF6B35", warningSoft: "rgba(255,107,53,0.12)",
    gold: "#FFD166", goldSoft: "rgba(255,209,102,0.12)",
    textPrimary: "#F0F0F8", textSec: "#7A7A9A", textDim: "#3A3A50",
    border: "rgba(255,255,255,0.06)", borderAccent: "rgba(108,99,255,0.35)",
  },
  radius: { sm: 10, md: 16, lg: 20, xl: 28, full: 999 },
  shadow: { primary: "0 8px 32px rgba(108,99,255,0.3)", card: "0 4px 24px rgba(0,0,0,0.4)", glow: "0 0 40px rgba(108,99,255,0.15)" },
};
const s = {
  mono: { fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
  display: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.03em" },
  heading: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600 },
  body: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400 },
};

function PrimaryButton({ children, onClick, disabled, style = {} }) {
  const [p, setP] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)}
      style={{
        width: "100%", height: 56,
        background: disabled ? DS.colors.surfaceHigh : `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: DS.radius.md,
        color: disabled ? DS.colors.textDim : "white", fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: p ? "scale(0.96)" : "scale(1)", transition: "all 0.15s ease",
        boxShadow: disabled ? "none" : DS.shadow.primary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        ...s.heading, ...style,
      }}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 52, padding: "0 16px",
          background: DS.colors.surface,
          border: `1px solid ${focused ? DS.colors.primary : DS.colors.border}`,
          borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 16,
          outline: "none", transition: "border 0.2s ease",
          boxShadow: focused ? `0 0 0 3px ${DS.colors.primarySoft}` : "none",
          ...s.body,
        }}
      />
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
      borderRadius: DS.radius.lg, padding: 20, ...style,
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
    <div style={{ height: 4, background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${width}%`,
        background: `linear-gradient(90deg, ${DS.colors.primary}, ${DS.colors.success})`,
        borderRadius: DS.radius.full, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: `0 0 8px ${DS.colors.primary}`,
      }} />
    </div>
  );
}

const Icons = {
  home: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={a ? DS.colors.primary : DS.colors.textDim} strokeWidth="2" strokeLinejoin="round" fill={a ? DS.colors.primarySoft : "none"} /></svg>,
  chart: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 20H21M5 20V12M9 20V8M13 20V14M17 20V4" stroke={a ? DS.colors.primary : DS.colors.textDim} strokeWidth="2" strokeLinecap="round" /></svg>,
  user: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={a ? DS.colors.primary : DS.colors.textDim} strokeWidth="2" /><path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke={a ? DS.colors.primary : DS.colors.textDim} strokeWidth="2" strokeLinecap="round" /></svg>,
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
  { id: "combat", label: "Combat", emoji: "🥊" },
];
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
  { id: "monthly", label: "Mensuel", price: 12.99, unit: "/ mois", priceDetail: "Resiliable a tout moment", savings: null, color: DS.colors.primary, colorSoft: DS.colors.primarySoft, colorBorder: DS.colors.borderAccent, badge: null, highlight: false },
  { id: "annual", label: "Annuel", price: 69.99, unit: "/ an", priceDetail: "soit 5,83 / mois", savings: "Economise 58%", color: DS.colors.success, colorSoft: DS.colors.successSoft, colorBorder: "rgba(0,229,160,0.35)", badge: "Le plus populaire", highlight: true },
  { id: "lifetime", label: "A vie", price: 149, unit: "une fois", priceDetail: "Acces permanent", savings: "Offre de lancement", color: DS.colors.gold, colorSoft: DS.colors.goldSoft, colorBorder: "rgba(255,209,102,0.35)", badge: "Limite", highlight: false, urgency: true },
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
    <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "28px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${color}10, transparent 70%)`, transition: "background 0.5s ease", pointerEvents: "none" }} />
      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.1em" }}>Temps de repos</p>
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

async function getExercicePhoto(nom) {
  const n = (nom || "").toLowerCase();

  // Mapping precis par exercice
  const exactMatch = [
    { keys: ["squat barre", "back squat", "squat"], q: "barbell back squat gym" },
    { keys: ["front squat"], q: "front squat barbell" },
    { keys: ["goblet squat"], q: "goblet squat dumbbell" },
    { keys: ["romanian deadlift", "rdl", "soulevé de terre roumain"], q: "romanian deadlift barbell gym" },
    { keys: ["soulevé de terre", "deadlift"], q: "deadlift barbell powerlifting" },
    { keys: ["sumo deadlift"], q: "sumo deadlift barbell" },
    { keys: ["développé couché", "bench press", "developpe couche"], q: "bench press barbell chest gym" },
    { keys: ["développé incliné", "incline bench", "developpe incline"], q: "incline bench press dumbbell" },
    { keys: ["développé épaules", "overhead press", "military press", "developpe epaules"], q: "overhead press barbell shoulders" },
    { keys: ["traction", "pull up", "tractions"], q: "pull up bar athlete calisthenics" },
    { keys: ["lat pulldown", "tirage nuque", "tirage poitrine"], q: "lat pulldown cable machine" },
    { keys: ["rowing barre", "bent over row"], q: "barbell row bent over back" },
    { keys: ["rowing haltere", "dumbbell row"], q: "dumbbell row single arm back" },
    { keys: ["box jump", "saut boite"], q: "box jump athlete explosive training" },
    { keys: ["saut en longueur", "broad jump"], q: "broad jump athlete training" },
    { keys: ["burpee", "burpees"], q: "burpees athlete hiit training" },
    { keys: ["hip thrust", "pont fessier"], q: "hip thrust barbell glutes gym" },
    { keys: ["fente", "lunge"], q: "lunges barbell dumbbell legs gym" },
    { keys: ["leg press", "presse a cuisses"], q: "leg press machine gym" },
    { keys: ["leg extension", "extension jambes"], q: "leg extension machine quadriceps" },
    { keys: ["leg curl", "curl jambes"], q: "leg curl machine hamstrings" },
    { keys: ["mollet", "calf raise", "mollets"], q: "calf raise standing machine" },
    { keys: ["kettlebell swing", "swing kettlebell"], q: "kettlebell swing athlete training" },
    { keys: ["kettlebell", "girevoy"], q: "kettlebell workout training" },
    { keys: ["planche", "plank", "gainage"], q: "plank core strength athlete" },
    { keys: ["abdos", "crunch", "sit up"], q: "abs workout crunch core athlete" },
    { keys: ["curl biceps", "bicep curl", "curl haltere"], q: "bicep curl dumbbell gym" },
    { keys: ["triceps", "dips triceps", "extension triceps"], q: "triceps extension pushdown gym" },
    { keys: ["pompes", "push up", "pushup"], q: "push ups athlete workout" },
    { keys: ["dips", "dip"], q: "dips parallel bars triceps gym" },
    { keys: ["sprint", "vitesse"], q: "sprint athlete track speed training" },
    { keys: ["corde a sauter", "jump rope", "corde"], q: "jump rope athlete training cardio" },
    { keys: ["sled", "traineau"], q: "sled push athlete power training" },
    { keys: ["battle rope", "corde ondulatoire"], q: "battle ropes athlete training" },
    { keys: ["oiseau", "rear delt", "oiseau haltere"], q: "rear delt fly dumbbell" },
    { keys: ["elevation laterale", "lateral raise"], q: "lateral raise dumbbell shoulders" },
    { keys: ["face pull", "tirage visage"], q: "face pull cable rear deltoid" },
    { keys: ["rowing poulie", "cable row"], q: "seated cable row back machine" },
    { keys: ["step up", "montee marche"], q: "step up box dumbbell legs" },
  ];

  let query = null;
  for (const entry of exactMatch) {
    if (entry.keys.some(k => n.includes(k))) {
      query = entry.q;
      break;
    }
  }

  // Fallback: utilise le nom directement
  if (!query) query = `${nom} exercise gym workout`;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: import.meta.env.VITE_PEXELS_API_KEY } }
    );
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return null;
    // Prend une photo aleatoire parmi les 3 premieres
    const idx = Math.floor(Math.random() * Math.min(3, data.photos.length));
    return data.photos[idx]?.src?.large || null;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// ECRAN SEANCE LIVE
// ─────────────────────────────────────────────
function SeanceScreen({ seance, onFinish, onBack }) {
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [resting, setResting] = useState(false);
  const [waitingRest, setWaitingRest] = useState(false);
  const [completedSets, setCompletedSets] = useState({}); // { "exIdx-setIdx": { reps, kg } }
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [showCoach, setShowCoach] = useState(false);
  const [coachMessages, setCoachMessages] = useState([
    { role: "assistant", text: "Coach IA pret ! Dis-moi si tu as du mal avec un exercice, si tu ressens une douleur ou si tu veux adapter la seance." }
  ]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [startTime] = useState(() => Date.now());

  const exercices = seance.exercices;
  const currentEx = exercices[exIdx];

  useEffect(() => {
    if (!currentEx) return;
    setPhotoUrl(null);
    getExercicePhoto(currentEx.nom).then(url => setPhotoUrl(url));
  }, [exIdx]);

  if (!currentEx && !showSummary) return null;

  const totalSets = currentEx ? (currentEx.sets || 4) : 4;
  const progressPct = currentEx ? Math.round(((exIdx + setIdx / totalSets) / exercices.length) * 100) : 100;
  const accentColor = getExerciceColor(seance.type, exIdx);

  const sendCoachMessage = async () => {
    if (!coachInput.trim() || coachLoading) return;
    const userMsg = coachInput.trim();
    setCoachInput("");
    setCoachMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setCoachLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            message: userMsg,
            exercice: currentEx,
            seance: { titre: seance?.titre },
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoachMessages(prev => [...prev, { role: "assistant", text: data.reply || "Desolé, erreur." }]);
    } catch (err) {
      console.error("Coach error:", err);
      setCoachMessages(prev => [...prev, { role: "assistant", text: "Erreur. Reessaie dans quelques secondes." }]);
    }
    setCoachLoading(false);
  };

  const handleSetComplete = () => {
    const key = `${exIdx}-${setIdx}`;
    const reps = parseInt(currentEx.reps) || 8;
    const kg = currentEx.chargeKg || 0;
    setCompletedSets(prev => ({ ...prev, [key]: { reps, kg } }));
    const msg = getRandom(MOTIVATION.complete);
    setToast(msg);
    setTimeout(() => setToast(null), 1400);

    if (setIdx < totalSets - 1) {
      setWaitingRest(true);
    } else {
      if (exIdx < exercices.length - 1) {
        setTimeout(() => { setExIdx(i => i + 1); setSetIdx(0); setAnimKey(k => k + 1); }, 400);
      } else {
        setTimeout(() => setShowSummary(true), 600);
      }
    }
  };

  if (showSummary) {
    const totalSetsCount = exercices.reduce((acc, ex) => acc + (ex.sets || 3), 0);
    return (
      <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
          <div style={{ width: 100, height: 100, borderRadius: DS.radius.full, background: `radial-gradient(circle, ${DS.colors.success}30, ${DS.colors.success}10)`, border: `2px solid ${DS.colors.success}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, marginBottom: 24, boxShadow: `0 0 60px ${DS.colors.success}40`, animation: "pulse 2s ease-in-out infinite" }}>
            🏆
          </div>
          <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8, textAlign: "center" }}>
            {getRandom(MOTIVATION.finish)}
          </h1>
          <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32, textAlign: "center" }}>{seance.titre}</p>

          <div style={{ display: "flex", gap: 12, width: "100%", marginBottom: 32 }}>
            {[
              { val: exercices.length, label: "exercices", color: accentColor },
              { val: totalSetsCount, label: "series", color: DS.colors.success },
              { val: `${Math.max(1, Math.round((Date.now() - startTime) / 60000))}m`, label: "minutes", color: DS.colors.warning },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: DS.colors.surface, border: `1px solid ${stat.color}30`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center" }}>
                <div style={{ ...s.mono, fontSize: 26, color: stat.color, fontWeight: 700, marginBottom: 4 }}>{stat.val}</div>
                <div style={{ color: DS.colors.textSec, fontSize: 11 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 16, textAlign: "center" }}>Comment tu te sens ?</p>
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 28 }}>
            {[
              { id: "easy", emoji: "😤", label: "Trop facile", color: DS.colors.primary },
              { id: "good", emoji: "💪", label: "Bien charge", color: DS.colors.success },
              { id: "hard", emoji: "😮‍💨", label: "Dur", color: DS.colors.warning },
            ].map(fb => (
              <button key={fb.id} onClick={() => setFeedback(fb.id)} style={{ flex: 1, padding: "16px 8px", background: feedback === fb.id ? fb.color + "20" : DS.colors.surface, border: `1.5px solid ${feedback === fb.id ? fb.color : DS.colors.border}`, borderRadius: DS.radius.lg, cursor: "pointer", transition: "all 0.2s ease", transform: feedback === fb.id ? "scale(1.04)" : "scale(1)" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{fb.emoji}</div>
                <div style={{ color: feedback === fb.id ? fb.color : DS.colors.textSec, fontSize: 11, ...s.heading }}>{fb.label}</div>
              </button>
            ))}
          </div>

          <button onClick={() => onFinish(feedback, completedSets, exercices, Math.round((Date.now() - startTime) / 60000))} disabled={!feedback} style={{ width: "100%", height: 58, background: feedback ? `linear-gradient(135deg, ${DS.colors.success}, #00C896)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: feedback ? DS.colors.bg : DS.colors.textDim, fontSize: 16, cursor: feedback ? "pointer" : "not-allowed", ...s.heading, boxShadow: feedback ? "0 8px 32px rgba(0,229,160,0.35)" : "none", transition: "all 0.3s ease" }}>
            {feedback ? "Enregistrer & continuer" : "Selectionne ton ressenti"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, maxWidth: 430, margin: "0 auto" }}>
      {/* Toast motivation */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: DS.colors.success, color: DS.colors.bg, padding: "8px 20px", borderRadius: DS.radius.full, fontSize: 14, ...s.heading, zIndex: 200, boxShadow: `0 4px 20px ${DS.colors.success}60`, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "14px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textSec, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{exIdx + 1} / {exercices.length} exercices</p>
            <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{seance.titre}</p>
          </div>
          <div style={{ background: accentColor + "20", border: `1px solid ${accentColor}40`, borderRadius: DS.radius.full, padding: "4px 12px", fontSize: 12, color: accentColor, ...s.mono, fontWeight: 700 }}>
            {seance.dureeMin}m
          </div>
        </div>
        <div style={{ height: 3, background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${accentColor}, ${DS.colors.success})`, transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: `0 0 8px ${accentColor}` }} />
        </div>
      </div>

      <div style={{ padding: "20px 20px 120px" }}>
        {/* Card exercice - Style Lyfta avec photo Unsplash */}
        <div key={animKey} style={{ borderRadius: DS.radius.xl, marginBottom: 16, overflow: "hidden", position: "relative" }}>

          {/* Photo de fond Unsplash */}
          <div style={{
            height: 200,
            backgroundImage: photoUrl ? `url(${photoUrl})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            backgroundColor: DS.colors.surfaceHigh,
          }}>
            {/* Overlay gradient sombre */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, rgba(10,10,15,0.2) 0%, rgba(10,10,15,0.85) 100%)`,
            }} />

            {/* Badge exercice numéro */}
            <div style={{
              position: "absolute", top: 16, left: 16,
              background: "rgba(10,10,15,0.7)", backdropFilter: "blur(10px)",
              border: `1px solid ${accentColor}60`,
              borderRadius: DS.radius.full, padding: "4px 14px",
              color: accentColor, fontSize: 11, ...s.heading,
            }}>
              Exercice {exIdx + 1} / {exercices.length}
            </div>

            {/* Icone muscle en haut à droite */}
            <div style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(10,10,15,0.6)", backdropFilter: "blur(10px)",
              border: `1px solid ${accentColor}30`,
              borderRadius: DS.radius.md, padding: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {getMuscleIcon(currentEx.muscles, accentColor)}
            </div>

            {/* Nom exercice en bas de la photo */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px 20px" }}>
              <h2 style={{ ...s.display, fontSize: 26, color: "white", lineHeight: 1.2, marginBottom: 4, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                {currentEx.nom}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                {currentEx.muscles}
              </p>
            </div>
          </div>

          {/* Stats + conseil en bas */}
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderTop: "none", padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: currentEx.conseil ? 14 : 0 }}>
              {[
                { val: currentEx.sets, label: "series", highlight: true },
                { val: currentEx.reps, label: "reps", highlight: false },
                ...(currentEx.chargeKg > 0 ? [{ val: `${currentEx.chargeKg}kg`, label: "charge", highlight: false }] : []),
                { val: `${currentEx.reposSec || 90}s`, label: "repos", highlight: false },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: stat.highlight ? accentColor + "15" : DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 6px", textAlign: "center", border: stat.highlight ? `1px solid ${accentColor}30` : "none" }}>
                  <div style={{ ...s.mono, fontSize: 18, color: stat.highlight ? accentColor : DS.colors.textPrimary, fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ color: DS.colors.textDim, fontSize: 10, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {currentEx.conseil && (
              <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, lineHeight: 1.5 }}>{currentEx.conseil}</p>
              </div>
            )}
          </div>
        </div>

        {/* Repos ou Sets */}
        {waitingRest ? (
          <button onClick={() => { setWaitingRest(false); setResting(true); }} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${DS.colors.warning}, #E05A20)`, border: "none", borderRadius: DS.radius.md, color: "white", fontSize: 16, cursor: "pointer", ...s.heading, marginBottom: 16, boxShadow: "0 8px 32px rgba(255,107,53,0.35)" }}>
            Demarrer le temps de repos
          </button>
        ) : resting ? (
          <RestTimer seconds={currentEx.reposSec || 90} onComplete={() => { setResting(false); setWaitingRest(false); setSetIdx(i => i + 1); }} />
        ) : (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ background: DS.colors.surfaceHigh, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: DS.colors.textDim, fontSize: 10, ...s.heading, textTransform: "uppercase", letterSpacing: "0.06em" }}>Serie</span>
              <span style={{ flex: 1, color: DS.colors.textDim, fontSize: 10, ...s.heading, textTransform: "uppercase", letterSpacing: "0.06em" }}>Objectif</span>
            </div>
            {Array.from({ length: totalSets }).map((_, i) => {
              const done = completedSets[`${exIdx}-${i}`];
              const isActive = i === setIdx && !done;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < totalSets - 1 ? `1px solid ${DS.colors.border}` : "none", background: isActive ? accentColor + "08" : "transparent", opacity: done ? 0.45 : 1, transition: "all 0.25s ease" }}>
                  <div style={{ width: 28, height: 28, borderRadius: DS.radius.full, background: done ? DS.colors.success + "20" : isActive ? accentColor + "20" : DS.colors.surfaceHigh, border: `1.5px solid ${done ? DS.colors.success : isActive ? accentColor : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, ...s.heading, color: done ? DS.colors.success : isActive ? accentColor : DS.colors.textDim, flexShrink: 0, boxShadow: done ? `0 0 8px ${DS.colors.success}40` : isActive ? `0 0 8px ${accentColor}40` : "none" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ ...s.mono, fontSize: 15, color: isActive ? DS.colors.textPrimary : DS.colors.textSec, fontWeight: done ? 400 : 600 }}>
                      {currentEx.sets} x {currentEx.reps}
                      {currentEx.chargeKg > 0 && <span style={{ color: accentColor }}> @ {currentEx.chargeKg}kg</span>}
                    </p>
                    {isActive && <p style={{ color: accentColor, fontSize: 11, marginTop: 2 }}>Serie active</p>}
                  </div>
                  <button onClick={() => isActive && handleSetComplete()} disabled={!isActive || done} style={{ width: 44, height: 44, borderRadius: DS.radius.md, background: done ? DS.colors.success + "20" : isActive ? accentColor : DS.colors.surfaceHigh, border: `1px solid ${done ? DS.colors.success : isActive ? accentColor : DS.colors.border}`, cursor: isActive && !done ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "all 0.2s ease", boxShadow: isActive && !done ? `0 4px 16px ${accentColor}50` : "none", flexShrink: 0 }}>
                    {done ? <span style={{ color: DS.colors.success }}>✓</span> : <span style={{ color: isActive ? "white" : DS.colors.textDim }}>→</span>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Exercices suivants */}
        {exIdx < exercices.length - 1 && !resting && (
          <div>
            <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ensuite</p>
            {exercices.slice(exIdx + 1, exIdx + 3).map((ex, i) => {
              const nextColor = getExerciceColor(seance.type, exIdx + 1 + i);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 8, opacity: i === 0 ? 0.9 : 0.5 }}>
                  <div style={{ width: 36, height: 36, borderRadius: DS.radius.sm, background: nextColor + "20", border: `1px solid ${nextColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: nextColor, ...s.heading, flexShrink: 0 }}>
                    {exIdx + 2 + i}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{(ex.muscles || "").split(" ")[0]}</p>
                  </div>
                  <span style={{ ...s.mono, color: nextColor, fontSize: 13, fontWeight: 600 }}>{ex.sets}x{ex.reps}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bouton Coach flottant */}
      <button onClick={() => setShowCoach(true)} style={{ position: "fixed", bottom: 32, right: 20, width: 56, height: 56, borderRadius: DS.radius.full, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, border: "none", color: "white", fontSize: 22, cursor: "pointer", boxShadow: DS.shadow.primary, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        🤖
      </button>

      {/* Drawer Coach IA */}
      {showCoach && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowCoach(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "0 0 40px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                <div>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>Coach IA</p>
                  <p style={{ color: DS.colors.success, fontSize: 11, ...s.body }}>En ligne</p>
                </div>
              </div>
              <button onClick={() => setShowCoach(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            {currentEx && (
              <div style={{ margin: "12px 20px 0", background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: DS.radius.md, padding: "8px 12px" }}>
                <p style={{ color: DS.colors.primary, fontSize: 12, ...s.heading }}>{currentEx.nom} - {currentEx.sets}x{currentEx.reps}{currentEx.chargeKg > 0 ? ` @ ${currentEx.chargeKg}kg` : ""}</p>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {coachMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: DS.radius.lg, background: msg.role === "user" ? DS.colors.primary : DS.colors.surfaceHigh, color: "white", fontSize: 14, lineHeight: 1.5 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "10px 16px", borderRadius: DS.radius.lg, background: DS.colors.surfaceHigh, display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: DS.radius.full, background: DS.colors.textSec, animation: `pulse 1s ease ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px 0", display: "flex", gap: 10 }}>
              <input value={coachInput} onChange={e => setCoachInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCoachMessage()} placeholder="J'arrive pas a faire les reps..." style={{ flex: 1, height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 14, outline: "none" }} />
              <button onClick={sendCoachMessage} disabled={!coachInput.trim() || coachLoading} style={{ width: 44, height: 44, borderRadius: DS.radius.full, background: coachInput.trim() ? DS.colors.primary : DS.colors.surfaceHigh, border: "none", color: "white", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>→</button>
            </div>
            <div style={{ padding: "10px 20px 0", display: "flex", gap: 8, overflowX: "auto" }}>
              {["J'arrive pas a finir les reps", "J'ai mal au genou", "C'est trop lourd", "Variante plus facile ?"].map((suggestion, i) => (
                <button key={i} onClick={() => setCoachInput(suggestion)} style={{ flexShrink: 0, padding: "6px 12px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textSec, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{suggestion}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN SPLASH
// ─────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: DS.shadow.primary, animation: "pulse 1.5s ease-in-out infinite" }}>
        ⚡
      </div>
      <p style={{ color: DS.colors.textSec, fontSize: 14, marginTop: 20, ...s.body }}>Chargement...</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN AUTH
// ─────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    if (mode === "signup" && !name) { setError("Entre ton prenom."); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caracteres minimum."); return; }
    setLoading(true);

    if (mode === "signup") {
      const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (e) { setError(e.message === "User already registered" ? "Email deja utilise." : e.message); setLoading(false); return; }
      if (data.user && !data.session) { setSuccess("Verifie ta boite mail !"); setLoading(false); return; }
      onAuth(data.user);
    } else {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) { setError(e.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : e.message); setLoading(false); return; }
      onAuth(data.user);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Entre ton email d'abord."); return; }
    const { error: e } = await supabase.auth.resetPasswordForEmail(email);
    if (e) { setError(e.message); return; }
    setSuccess("Email de reinitialisation envoye !");
  };

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <div style={{ paddingTop: 80, paddingBottom: 48, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>⚡</div>
        <h1 style={{ ...s.display, fontSize: 32, color: DS.colors.textPrimary, marginBottom: 8 }}>Voltra</h1>
        <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>{mode === "login" ? "Content de te revoir" : "Commence ton parcours"}</p>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: 4, marginBottom: 32 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ flex: 1, height: 40, borderRadius: DS.radius.sm - 2, background: mode === m ? DS.colors.primary : "transparent", border: "none", color: mode === m ? "white" : DS.colors.textSec, fontSize: 14, cursor: "pointer", transition: "all 0.2s ease", ...s.heading }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>
        {mode === "signup" && <Input label="Prenom" value={name} onChange={setName} placeholder="Alex" />}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
        <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="Min. 6 caracteres" />
        {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
        {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(0,229,160,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
        {loading ? (
          <div style={{ height: 56, borderRadius: DS.radius.md, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, ...s.heading }}>
            <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
            {mode === "login" ? "Connexion..." : "Creation du compte..."}
          </div>
        ) : (
          <PrimaryButton onClick={handleSubmit}>{mode === "login" ? "Se connecter" : "Creer mon compte"}</PrimaryButton>
        )}
        {mode === "login" && <button onClick={handleForgotPassword} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.body }}>Mot de passe oublie ?</button>}
      </div>
      <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", paddingBottom: 40, ...s.body }}>En continuant, tu acceptes nos CGU.</p>
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
    niveau: null, frequence: 3
  });
  const [loading, setLoading] = useState(false);
  const [animIn, setAnimIn] = useState(true);

  const hasPoste = data.sport && data.sport !== "natation";
  const stepLabels = ["Sport", "Objectif", ...(hasPoste ? ["Poste"] : []), "Douleurs", "Equipement", "Niveau"];
  const totalSteps = stepLabels.length;

  // Step mapping selon si poste existe
  const getStepContent = () => {
    const steps = [0, 1]; // sport, objectif
    if (hasPoste) steps.push(2); // poste
    steps.push(3, 4, 5); // douleurs, equipement, niveau
    return steps[step];
  };
  const contentStep = getStepContent();

  const goNext = () => {
    setAnimIn(false);
    setTimeout(() => { setStep(s => s + 1); setAnimIn(true); }, 200);
  };

  const handleFinish = () => {
    setLoading(true);
    setTimeout(() => {
      onComplete(data, null);
      generateProgramIA(data).then(programme => {
        onComplete(data, programme);
      }).catch(err => console.error(err));
    }, 3200);
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
    if (contentStep === 5) return data.niveau !== null;
    return false;
  })();

  const isLastStep = step === totalSteps - 1;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px" }}>

      {loading && (
        <div style={{ position: "fixed", inset: 0, background: DS.colors.bg, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
          <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 32px" }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke={DS.colors.surfaceHigh} strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={DS.colors.primary} strokeWidth="6" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="276" style={{ animation: "fillCircle 3s ease forwards" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>⚡</div>
          </div>
          <h2 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary, marginBottom: 12 }}>Construction de ton programme...</h2>
          <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32, lineHeight: 1.6 }}>L'IA analyse ton profil complet pour creer un programme sur mesure.</p>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { emoji: "🏋️", text: "Selection des exercices", delay: "0s" },
              { emoji: "📈", text: "Calcul de la progression", delay: "0.7s" },
              { emoji: "⚡", text: "Optimisation pour " + (data.sport || "ton sport"), delay: "1.4s" },
              { emoji: "✓", text: "Finalisation du programme", delay: "2.1s" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 16px", opacity: 0, animation: `fadeIn 0.4s ease ${item.delay} forwards` }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ paddingTop: 60, paddingBottom: 24 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: DS.radius.full, background: i <= step ? DS.colors.primary : DS.colors.surfaceHigh, transition: "background 0.4s ease", boxShadow: i === step ? `0 0 8px ${DS.colors.primary}` : "none" }} />
          ))}
        </div>
        <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading }}>Etape {step + 1} sur {totalSteps}</p>
      </div>

      <div style={{ flex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.25s ease", overflowY: "auto" }}>

        {/* ETAPE 1 - Sport */}
        {contentStep === 0 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Quel est ton sport ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Le programme sera entierement adapte.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {SPORTS.map(sport => (
                <div key={sport.id} onClick={() => setData(d => ({ ...d, sport: sport.id, poste: null }))} style={{ background: data.sport === sport.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.sport === sport.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.md, padding: "16px 8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease", transform: data.sport === sport.id ? "scale(1.03)" : "scale(1)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{sport.emoji}</div>
                  <div style={{ color: data.sport === sport.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 13, ...s.heading }}>{sport.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 2 - Objectif */}
        {contentStep === 1 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Quel est ton objectif ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Les exercices et charges s'adapteront.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(OBJECTIFS_PAR_SPORT[data.sport] || []).map(obj => (
                <div key={obj.id} onClick={() => setData(d => ({ ...d, objectif: obj.id }))} style={{ background: data.objectif === obj.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.objectif === obj.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.2s ease" }}>
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
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Ton poste ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Le programme cible les qualites de ton poste.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(POSTES_PAR_SPORT[data.sport] || []).map(poste => (
                <div key={poste.id} onClick={() => setData(d => ({ ...d, poste: poste.id }))} style={{ background: data.poste === poste.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.poste === poste.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.2s ease" }}>
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
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Des douleurs ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 12 }}>Les exercices s'adapteront automatiquement.</p>
            <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,107,53,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 24, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p style={{ color: DS.colors.warning, fontSize: 12, ...s.body }}>Tu peux selectionner plusieurs zones. Les exercices a risque seront remplaces.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DOULEURS.map(d => {
                const selected = data.douleurs.includes(d.id);
                return (
                  <div key={d.id} onClick={() => toggleDouleur(d.id)} style={{ background: selected ? (d.id === "aucune" ? DS.colors.successSoft : DS.colors.warningSoft) : DS.colors.surface, border: `1px solid ${selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.2s ease" }}>
                    <span style={{ fontSize: 22 }}>{d.emoji}</span>
                    <p style={{ color: selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.textPrimary, fontSize: 15, ...s.heading, flex: 1 }}>{d.label}</p>
                    {selected && <div style={{ width: 20, height: 20, background: d.id === "aucune" ? DS.colors.success : DS.colors.warning, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPE 5 - Equipement */}
        {contentStep === 4 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Ton equipement ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Les exercices seront adaptes a ce que tu as.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {EQUIPEMENTS.map(eq => (
                <div key={eq.id} onClick={() => setData(d => ({ ...d, equipement: eq.id }))} style={{ background: data.equipement === eq.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.equipement === eq.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.2s ease" }}>
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
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Derniers reglages</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 36 }}>Le programme se calibre sur ton profil.</p>
            <div style={{ marginBottom: 36 }}>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Niveau actuel</p>
              <div style={{ display: "flex", gap: 10 }}>
                {NIVEAUX.map(n => (
                  <div key={n} onClick={() => setData(d => ({ ...d, niveau: n.toLowerCase() }))} style={{ flex: 1, padding: "12px 0", textAlign: "center", background: data.niveau === n.toLowerCase() ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.md, color: data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.textSec, fontSize: 14, cursor: "pointer", transition: "all 0.2s ease", ...s.heading }}>{n}</div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seances par semaine</p>
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 20 }}>
                <div style={{ ...s.display, fontSize: 48, color: DS.colors.primary, textAlign: "center", marginBottom: 16 }}>{data.frequence}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[2, 3, 4, 5].map(n => (
                    <div key={n} onClick={() => setData(d => ({ ...d, frequence: n }))} style={{ flex: 1, padding: "10px 0", textAlign: "center", background: data.frequence === n ? DS.colors.primary : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: data.frequence === n ? "white" : DS.colors.textSec, fontSize: 16, cursor: "pointer", transition: "all 0.2s ease", ...s.heading }}>{n}</div>
                  ))}
                </div>
                <p style={{ color: DS.colors.textSec, fontSize: 13, textAlign: "center", marginTop: 12, ...s.body }}>jours / semaine</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 48, paddingTop: 24 }}>
        <PrimaryButton onClick={isLastStep ? handleFinish : goNext} disabled={!canNext}>
          {isLastStep ? "Generer mon programme" : "Continuer"}
        </PrimaryButton>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.body }}>Retour</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN PRICING
// ─────────────────────────────────────────────
function PricingScreen({ onSelectPlan, programme }) {
  const [selected, setSelected] = useState("annual");
  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 47, s: 12 });
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        s--; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; }
        if (h < 0) return prev;
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const currentPlan = PLANS.find(p => p.id === selected);
  const featuresPro = ["Progression automatique des charges", "Programmes illimites + regeneration IA", "Adaptation si seance skippee", "Deload automatique intelligent", "Historique complet + graphiques", "Jusqu'a 5 seances / semaine", "Coach IA integre", "Export PDF du programme"];

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, overflowY: "auto", paddingBottom: 40 }}>
      <div style={{ padding: "60px 20px 0", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading, marginBottom: 10 }}>Programme pret</p>
          <h1 style={{ ...s.display, fontSize: 28, color: DS.colors.textPrimary, lineHeight: 1.2, marginBottom: 16 }}>
            {programme?.titre || "Ton programme est pret"}
          </h1>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            {[
              { val: programme?.data_json?.semaines?.length || 8, label: "semaines" },
              { val: programme?.data_json?.semaines?.[0]?.seances?.[0]?.exercices?.length || 5, label: "exercices/seance" },
              { val: programme?.data_json?.semaines?.[0]?.seances?.length || 3, label: "seances/sem" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: DS.radius.md, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ ...s.mono, fontSize: 20, color: DS.colors.primary, fontWeight: 700 }}>{stat.val}</div>
                <div style={{ color: DS.colors.textSec, fontSize: 10 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>Debloque l'acces complet pour commencer.</p>
        </div>
        <div style={{ background: DS.colors.goldSoft, border: `1px solid rgba(255,209,102,0.25)`, borderRadius: DS.radius.md, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: DS.colors.gold, fontSize: 12, ...s.heading, marginBottom: 2 }}>Offre Lifetime - Prix de lancement</p>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>Expire dans</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[timeLeft.h, timeLeft.m, timeLeft.s].map((val, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.sm, padding: "4px 8px", ...s.mono, fontSize: 18, color: DS.colors.gold, fontWeight: 700, minWidth: 36, textAlign: "center" }}>{pad(val)}</div>
                <span style={{ color: DS.colors.textDim, fontSize: 9, marginTop: 2 }}>{["h", "m", "s"][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {PLANS.map(plan => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{ position: "relative", background: selected === plan.id ? plan.colorSoft : DS.colors.surface, border: `1.5px solid ${selected === plan.id ? plan.colorBorder : DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", cursor: "pointer", transition: "all 0.2s ease" }}>
              {selected === plan.id && <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 2, background: plan.color, borderRadius: DS.radius.full }} />}
              {plan.badge && <div style={{ display: "inline-flex", padding: "3px 10px", background: plan.colorSoft, border: `1px solid ${plan.colorBorder}`, borderRadius: DS.radius.full, color: plan.color, fontSize: 11, ...s.heading, marginBottom: 10 }}>{plan.badge}</div>}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 4 }}>{plan.label}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ ...s.display, fontSize: 32, color: selected === plan.id ? plan.color : DS.colors.textPrimary }}>{plan.price}€</span>
                    <span style={{ color: DS.colors.textSec, fontSize: 14 }}>{plan.unit}</span>
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: DS.radius.full, border: `2px solid ${selected === plan.id ? plan.color : DS.colors.textDim}`, background: selected === plan.id ? plan.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                  {selected === plan.id && <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: "white" }} />}
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ color: DS.colors.textSec, fontSize: 12 }}>{plan.priceDetail}</p>
                {plan.savings && <span style={{ padding: "2px 8px", background: plan.colorSoft, borderRadius: DS.radius.full, color: plan.color, fontSize: 11, ...s.heading }}>{plan.savings}</span>}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => onSelectPlan(selected)} style={{ width: "100%", height: 58, background: currentPlan.highlight ? `linear-gradient(135deg, ${DS.colors.success}, #00C896)` : currentPlan.urgency ? `linear-gradient(135deg, ${DS.colors.gold}, #F0B800)` : `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, border: "1px solid rgba(255,255,255,0.1)", borderRadius: DS.radius.md, color: currentPlan.urgency ? DS.colors.bg : "white", fontSize: 16, cursor: "pointer", boxShadow: DS.shadow.primary, ...s.heading, marginBottom: 12 }}>
          Commencer avec {currentPlan.label}
        </button>
        <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", marginBottom: 24 }}>Paiement securise · Annulation en 1 clic · Remboursement 7 jours</p>
        <button onClick={() => setShowFeatures(v => !v)} style={{ width: "100%", background: "none", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 20px", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", ...s.heading, marginBottom: 8 }}>
          <span>Voir ce qui est inclus</span>
          <span style={{ transform: showFeatures ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>↓</span>
        </button>
        {showFeatures && (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 16, marginBottom: 24 }}>
            {featuresPro.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < featuresPro.length - 1 ? `1px solid ${DS.colors.border}` : "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill={DS.colors.successSoft} /><path d="M7 12.5L10.5 16L17 9" stroke={DS.colors.success} strokeWidth="2.5" strokeLinecap="round" /></svg>
                <span style={{ color: DS.colors.textSec, fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => onSelectPlan("free")} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline", ...s.body }}>Continuer avec le plan gratuit</button>
      </div>
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
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textSec, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <h1 style={{ ...s.display, fontSize: 22, color: DS.colors.textPrimary }}>Mes matchs</h1>
          <button onClick={() => setShowForm(v => !v)} style={{ background: DS.colors.primary, border: "none", borderRadius: DS.radius.full, width: 36, height: 36, color: "white", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.primary }}>+</button>
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
            <button onClick={saveMatch} disabled={saving || !form.titre || !form.date_match} style={{ width: "100%", height: 48, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, border: "none", borderRadius: DS.radius.md, color: "white", fontSize: 15, cursor: "pointer", ...s.heading, boxShadow: DS.shadow.primary }}>
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
function DashboardScreen({ user, programme, matchs, derniereSeance, onStartSession, onOpenMatchs }) {
  const progData = programme?.data_json;
  const seance = progData?.semaines?.[0]?.seances?.[0] || MOCK_PROGRAM.seancesDuJour[0];
  const prog = {
    titre: programme?.titre || MOCK_PROGRAM.titre,
    semaineCourante: programme?.semaine_courante || MOCK_PROGRAM.semaineCourante,
    totalSemaines: programme?.total_semaines || MOCK_PROGRAM.totalSemaines,
    progression: Math.round(((programme?.semaine_courante || 1) / (programme?.total_semaines || 8)) * 100),
  };
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";

  // Logique match le plus proche
  const prochainMatch = matchs?.length > 0 ? matchs[0] : null;
  const daysUntilMatch = prochainMatch ? Math.ceil((new Date(prochainMatch.date_match) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const matchAlert = daysUntilMatch !== null ? (
    daysUntilMatch <= 0 ? { color: DS.colors.warning, text: "Match aujourd'hui - repos ou activation legere", emoji: "⚡" } :
    daysUntilMatch === 1 ? { color: DS.colors.warning, text: `Match demain - seance tres legere`, emoji: "⚠️" } :
    daysUntilMatch <= 3 ? { color: DS.colors.gold, text: `Match dans ${daysUntilMatch} jours - charges reduites`, emoji: "📅" } :
    null
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>Bonjour,</p>
          <p style={{ color: DS.colors.textPrimary, fontSize: 18, ...s.heading }}>{userName} 👋</p>
        </div>
        <div style={{ width: 42, height: 42, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16, ...s.display, boxShadow: DS.shadow.primary }}>
          {userName[0].toUpperCase()}
        </div>
      </div>
      <div style={{ padding: "24px 20px 0" }}>

        {/* Alerte match */}
        {matchAlert && (
          <div onClick={onOpenMatchs} style={{ background: matchAlert.color + "15", border: `1px solid ${matchAlert.color}40`, borderRadius: DS.radius.lg, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <span style={{ fontSize: 22 }}>{matchAlert.emoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: matchAlert.color, fontSize: 13, ...s.heading }}>{prochainMatch.titre}</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{matchAlert.text}</p>
            </div>
            <span style={{ color: DS.colors.textSec, fontSize: 18 }}>→</span>
          </div>
        )}

        {/* Bouton mes matchs */}
        <div onClick={onOpenMatchs} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>Mes matchs</p>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
              {matchs?.length > 0 ? `${matchs.length} match${matchs.length > 1 ? "s" : ""} a venir` : "Synchronise ton calendrier"}
            </p>
          </div>
          {Icons.arrow()}
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, marginBottom: 6 }}>Semaine {prog.semaineCourante} - Seance 1</p>
          <h1 style={{ ...s.display, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1.15, marginBottom: 16 }}>{seance.titre}</h1>
          <ProgressBar value={prog.progression} />
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginTop: 8 }}>Programme {prog.titre} - {prog.progression}% complete</p>
        </div>
        <Card style={{ marginBottom: 24, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${DS.colors.primary}, ${DS.colors.success})` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Badge color="primary">Aujourd'hui</Badge>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: DS.colors.textSec, fontSize: 13 }}>{Icons.clock()} {seance.dureeMin} min</div>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {[
              { val: `${seance.dureeMin || 45}`, label: "minutes", color: DS.colors.textPrimary },
              { val: `${seance.exercices?.length || 0}`, label: "exercices", color: DS.colors.success },
              { val: seance.type === "force_basse" ? "Bas" : seance.type === "force_haute" ? "Haut" : seance.type === "explosivite" ? "Explo" : "Core", label: "du corps", color: DS.colors.warning },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ ...s.mono, fontSize: 24, color: stat.color, fontWeight: 700 }}>{stat.val}</div>
                <div style={{ color: DS.colors.textSec, fontSize: 12 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <PrimaryButton onClick={onStartSession}>Demarrer la seance</PrimaryButton>
        </Card>
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 14 }}>Au programme</p>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {seance.exercices.map((ex, i) => {
              const colors = [DS.colors.primary, DS.colors.success, DS.colors.warning, DS.colors.primary, DS.colors.success];
              const color = colors[i % colors.length];
              return (
                <div key={ex.id} style={{ minWidth: 130, flexShrink: 0, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: color + "20", border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, color, fontSize: 14, ...s.heading }}>{i + 1}</div>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 13, ...s.heading, marginBottom: 4 }}>{ex.nom}</p>
                  <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginBottom: 8 }}>{ex.muscles.split(" ")[0]}</p>
                  <div style={{ ...s.mono, fontSize: 13, color }}>{ex.sets}x{ex.reps}</div>
                  {ex.chargeKg > 0 && <div style={{ ...s.mono, fontSize: 11, color: DS.colors.textSec, marginTop: 2 }}>{ex.chargeKg} kg</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 14 }}>Derniere seance</p>
          {derniereSeance ? (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 4 }}>
                    {new Date(derniereSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>{derniereSeance.titre}</p>
                </div>
                <Badge color="success">Faite</Badge>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[`${derniereSeance.exercices?.length || 0} exercices`, `${derniereSeance.duree_min || 0} min`].map((stat, i) => (
                  <div key={i} style={{ flex: 1, padding: "8px 4px", textAlign: "center", background: DS.colors.surfaceHigh, borderRadius: DS.radius.sm, color: DS.colors.textSec, fontSize: 12 }}>{stat}</div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, textAlign: "center" }}>Aucune seance encore — demarre ta premiere !</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HISTORIQUE
// ─────────────────────────────────────────────
function HistoriqueScreen() {
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

      // Charger logs de performance pour les records
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
    for (const s of sorted) {
      const diff = Math.floor((today - new Date(s.date_realisee)) / (1000 * 60 * 60 * 24));
      if (diff <= count + 2) count++;
      else break;
    }
    return count;
  })();

  // Records par exercice
  const records = {};
  logsPerf.forEach(log => {
    const nom = log.exercices?.nom;
    if (!nom || !log.charge_kg) return;
    if (!records[nom] || log.charge_kg > records[nom]) records[nom] = log.charge_kg;
  });
  const topRecords = Object.entries(records).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Progression des charges pour l'exercice selectionne
  const exosDispos = [...new Set(logsPerf.map(l => l.exercices?.nom).filter(Boolean))];
  const exoSelectionne = selectedExo || exosDispos[0];
  const progressionExo = logsPerf
    .filter(l => l.exercices?.nom === exoSelectionne)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-8);

  // Calendrier du mois
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const seanceDates = new Set(seancesReelles.map(s => new Date(s.date_realisee).getDate()));

  // Grouper par semaine
  const groupeParSemaine = {};
  seancesReelles.forEach(sc => {
    const date = new Date(sc.date_realisee);
    const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate()) / 7)}`;
    if (!groupeParSemaine[weekKey]) groupeParSemaine[weekKey] = [];
    groupeParSemaine[weekKey].push(sc);
  });

  const stats = [
    { value: String(totalSeances || 0), label: "seances", color: DS.colors.primary },
    { value: `${dureeAvg}m`, label: "duree moy.", color: DS.colors.success },
    { value: `${streak}`, label: "streak", color: DS.colors.warning },
  ];

  const feedbackColor = (f) => f === "easy" ? DS.colors.primary : f === "good" ? DS.colors.success : DS.colors.warning;
  const feedbackLabel = (f) => f === "easy" ? "Trop facile" : f === "good" ? "Bien charge" : "Dur";

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "20px 20px 16px" }}>
        <h1 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary }}>Progression</h1>
      </div>

      {/* Drawer detail seance */}
      {selectedSeance && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setSelectedSeance(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p style={{ color: DS.colors.textSec, fontSize: 12, marginBottom: 4 }}>
                  {new Date(selectedSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <h3 style={{ ...s.display, fontSize: 20, color: DS.colors.textPrimary }}>{selectedSeance.titre}</h3>
              </div>
              <button onClick={() => setSelectedSeance(null)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { val: `${selectedSeance.duree_min || 0}m`, label: "duree", color: DS.colors.primary },
                { val: selectedSeance.exercices?.length || 0, label: "exercices", color: DS.colors.success },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ ...s.mono, fontSize: 20, color: stat.color, fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ color: DS.colors.textSec, fontSize: 11 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(selectedSeance.exercices || []).map((ex, i) => (
                <div key={i} style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 12 }}>{ex.muscles?.split(" ")[0]}</p>
                  </div>
                  <p style={{ ...s.mono, color: DS.colors.primary, fontSize: 13 }}>{ex.sets}x{ex.reps}{ex.charge_kg > 0 ? ` @ ${ex.charge_kg}kg` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "24px 20px 0" }}>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {stats.map((stat, i) => (
            <Card key={i} style={{ flex: 1, padding: 16, textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 22, color: stat.color, fontWeight: 700, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ color: DS.colors.textSec, fontSize: 12 }}>{stat.label}</div>
            </Card>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
            <p style={{ color: DS.colors.textSec, fontSize: 14 }}>Chargement...</p>
          </div>
        ) : seancesReelles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🏋️</p>
            <p style={{ color: DS.colors.textPrimary, fontSize: 18, ...s.heading, marginBottom: 8 }}>Aucune seance encore</p>
            <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>Complete ta premiere seance pour voir ta progression ici.</p>
          </div>
        ) : (
          <>
            {/* Graphique cliquable */}
            <Card style={{ marginBottom: 24 }}>
              <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 4 }}>Seances recentes</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 16 }}>Appuie sur une barre pour voir le detail</p>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
                {seancesReelles.slice(0, 8).reverse().map((sc, i) => {
                  const barH = Math.min(80, Math.max(12, (sc.duree_min || 20)));
                  const feedbackColors = { easy: DS.colors.primary, good: DS.colors.success, hard: DS.colors.warning };
                  const color = feedbackColors[sc.feedback] || DS.colors.primary;
                  return (
                    <div key={i} onClick={() => setSelectedSeance(sc)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <div style={{ width: "100%", height: barH, background: `linear-gradient(180deg, ${color}, ${color}80)`, borderRadius: 4, transition: "opacity 0.2s", border: `1px solid ${color}40` }} />
                      <p style={{ color: DS.colors.textDim, fontSize: 8 }}>{new Date(sc.date_realisee).toLocaleDateString("fr-FR", { day: "numeric" })}</p>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                {[{ color: DS.colors.primary, label: "Facile" }, { color: DS.colors.success, label: "Bien" }, { color: DS.colors.warning, label: "Dur" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                    <p style={{ color: DS.colors.textDim, fontSize: 10 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Calendrier du mois */}
            <Card style={{ marginBottom: 24 }}>
              <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 16 }}>
                {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", color: DS.colors.textDim, fontSize: 10, ...s.heading, paddingBottom: 4 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {Array.from({ length: (firstDay === 0 ? 6 : firstDay - 1) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === now.getDate();
                  const hasSeance = seanceDates.has(day);
                  return (
                    <div key={day} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: DS.radius.sm, background: hasSeance ? DS.colors.primary : isToday ? DS.colors.surfaceHigh : "transparent", border: isToday ? `1px solid ${DS.colors.primary}` : "none" }}>
                      <p style={{ color: hasSeance ? "white" : isToday ? DS.colors.primary : DS.colors.textSec, fontSize: 12, ...s.heading }}>{day}</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Progression des charges */}
            {progressionExo.length > 1 && (
              <Card style={{ marginBottom: 24 }}>
                <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 12 }}>Progression des charges</p>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
                  {exosDispos.slice(0, 6).map(exo => (
                    <button key={exo} onClick={() => setSelectedExo(exo)} style={{ flexShrink: 0, padding: "6px 12px", background: exoSelectionne === exo ? DS.colors.primary : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, color: exoSelectionne === exo ? "white" : DS.colors.textSec, fontSize: 12, cursor: "pointer", ...s.heading }}>
                      {exo.split(" ").slice(0, 2).join(" ")}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
                  {progressionExo.map((log, i) => {
                    const maxCharge = Math.max(...progressionExo.map(l => l.charge_kg || 0));
                    const barH = maxCharge > 0 ? Math.max(8, (log.charge_kg / maxCharge) * 80) : 8;
                    const isLast = i === progressionExo.length - 1;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <p style={{ color: isLast ? DS.colors.success : DS.colors.textDim, fontSize: 9, ...s.mono }}>{log.charge_kg}kg</p>
                        <div style={{ width: "100%", height: barH, background: isLast ? `linear-gradient(180deg, ${DS.colors.success}, ${DS.colors.success}60)` : `linear-gradient(180deg, ${DS.colors.primary}80, ${DS.colors.primary}30)`, borderRadius: 4 }} />
                      </div>
                    );
                  })}
                </div>
                {progressionExo.length > 1 && (
                  <p style={{ color: DS.colors.success, fontSize: 12, ...s.body, marginTop: 8 }}>
                    +{progressionExo[progressionExo.length - 1]?.charge_kg - progressionExo[0]?.charge_kg}kg depuis le debut
                  </p>
                )}
              </Card>
            )}

            {/* Records personnels */}
            {topRecords.length > 0 && (
              <Card style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>🏆</span>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>Records personnels</p>
                </div>
                {topRecords.map(([nom, charge], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < topRecords.length - 1 ? `1px solid ${DS.colors.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: DS.radius.full, background: i === 0 ? DS.colors.goldSoft : DS.colors.surfaceHigh, border: `1px solid ${i === 0 ? DS.colors.gold : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <p style={{ ...s.mono, fontSize: 11, color: i === 0 ? DS.colors.gold : DS.colors.textSec }}>{i + 1}</p>
                      </div>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{nom}</p>
                    </div>
                    <p style={{ ...s.mono, color: DS.colors.success, fontSize: 15, fontWeight: 700 }}>{charge} kg</p>
                  </div>
                ))}
              </Card>
            )}

            {/* Historique par semaine */}
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Historique</p>
            {Object.entries(groupeParSemaine).map(([weekKey, seances], wi) => (
              <div key={weekKey} style={{ marginBottom: 20 }}>
                <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {wi === 0 ? "Cette semaine" : `Il y a ${wi} semaine${wi > 1 ? "s" : ""}`}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {seances.map((sc, i) => (
                    <div key={i} onClick={() => setSelectedSeance(sc)} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ color: DS.colors.textSec, fontSize: 12, marginBottom: 4 }}>
                          {new Date(sc.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                        <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>{sc.titre}</p>
                        <p style={{ color: DS.colors.textSec, fontSize: 12, marginTop: 2 }}>{sc.exercices?.length || 0} exercices · {sc.duree_min || 0} min</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {sc.feedback && <span style={{ fontSize: 10, padding: "3px 8px", background: feedbackColor(sc.feedback) + "20", borderRadius: DS.radius.full, color: feedbackColor(sc.feedback), ...s.heading }}>{feedbackLabel(sc.feedback)}</span>}
                        {Icons.arrow()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFIL
// ─────────────────────────────────────────────
function ProfilScreen({ user, programme, onLogout }) {
  const [notifOn, setNotifOn] = useState(true);
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";
  const progData = programme?.data_json;
  const semaineCourante = programme?.semaine_courante || 1;
  const totalSemaines = programme?.total_semaines || 8;
  const progression = Math.round((semaineCourante / totalSemaines) * 100);
  const sport = progData?.sport || user?.user_metadata?.sport || "Sport";
  const objectif = progData?.objectif || user?.user_metadata?.objectif || "Objectif";
  const frequence = progData?.frequence || user?.user_metadata?.frequence || 3;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "20px 20px 16px" }}>
        <h1 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary }}>Profil</h1>
      </div>
      <div style={{ padding: "32px 20px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, ...s.display, color: "white", margin: "0 auto 16px", boxShadow: DS.shadow.primary }}>
            {userName[0].toUpperCase()}
          </div>
          <h2 style={{ ...s.display, fontSize: 22, color: DS.colors.textPrimary, marginBottom: 6 }}>{userName}</h2>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>{user?.email}</p>
        </div>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, textTransform: "uppercase", letterSpacing: "0.06em" }}>Programme actif</p>
            {Icons.arrow()}
          </div>
          <p style={{ color: DS.colors.textPrimary, fontSize: 17, ...s.heading, marginBottom: 4 }}>{programme?.titre || "Aucun programme"}</p>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 14 }}>Semaine {semaineCourante} sur {totalSemaines} - {frequence}x/semaine</p>
          <ProgressBar value={progression} />
          <p style={{ color: DS.colors.textSec, fontSize: 12, textAlign: "right", marginTop: 6, ...s.mono }}>{progression}%</p>
        </Card>
        <Card style={{ marginBottom: 24, padding: 0 }}>
          {[
            { emoji: "🏅", label: "Mon sport", value: sport },
            { emoji: "⚡", label: "Mon objectif", value: objectif },
            { emoji: "📅", label: "Frequence", value: `${frequence} seances / semaine` }
          ].map((item, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${DS.colors.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{item.label}</p>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>{item.value}</p>
                </div>
              </div>
              {Icons.arrow()}
            </div>
          ))}
        </Card>
        <Card style={{ marginBottom: 24, padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>Rappel seance</p>
            </div>
            <div onClick={() => setNotifOn(v => !v)} style={{ width: 48, height: 28, background: notifOn ? DS.colors.success : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s ease" }}>
              <div style={{ position: "absolute", top: 3, left: notifOn ? 23 : 3, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        </Card>
        <button onClick={onLogout} style={{ width: "100%", background: "none", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 0", color: DS.colors.textSec, fontSize: 15, cursor: "pointer", ...s.heading }}>
          Se deconnecter
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
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid ${DS.colors.border}`, padding: "12px 0 28px", display: "flex", maxWidth: 430, margin: "0 auto" }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setTab(tab.id)} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", padding: "4px 0", transition: "transform 0.15s ease", transform: isActive ? "scale(1.05)" : "scale(1)" }}>
            {tab.icon(isActive)}
            <span style={{ color: isActive ? DS.colors.primary : DS.colors.textDim, fontSize: 11, ...s.heading, transition: "color 0.2s ease" }}>{tab.label}</span>
            {isActive && <div style={{ width: 4, height: 4, borderRadius: DS.radius.full, background: DS.colors.primary, boxShadow: `0 0 6px ${DS.colors.primary}`, marginTop: -2 }} />}
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [seanceActive, setSeanceActive] = useState(null);
  const [programmeActif, setProgrammeActif] = useState(null);
  const [matchs, setMatchs] = useState([]);
  const [showMatchs, setShowMatchs] = useState(false);
  const [derniereSeance, setDerniereSeance] = useState(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter', system-ui, sans-serif; }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fillCircle { from { stroke-dashoffset: 276; } to { stroke-dashoffset: 0; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setScreen("app"); }
      else { setScreen("auth"); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else if (_event === "SIGNED_OUT") {
        setUser(null);
        setScreen("auth");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen("auth");
    setUser(null);
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
    supabase
      .from("seances")
      .select("*, exercices(*)")
      .eq("user_id", user.id)
      .eq("statut", "faite")
      .order("date_realisee", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setDerniereSeance(data); });
  }, [screen, user]);

  if (screen === "splash") return <SplashScreen />;
  if (screen === "auth") return <AuthScreen onAuth={(u) => { setUser(u); setScreen("onboarding"); }} />;
  if (screen === "onboarding") return <OnboardingScreen onComplete={(data, programme) => { setProgrammeActif(programme); setScreen("pricing"); }} />;
  if (screen === "pricing") return <PricingScreen programme={programmeActif} onSelectPlan={() => setScreen("app")} />;

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100vh" }}>
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
          seance={seanceActive}
          onBack={() => setSeanceActive(null)}
          onFinish={async (feedback, completedSetsData, exercices, durationMin) => {
            try {
              if (programmeActif?.id && feedback) {
                await saveCompleteSession(programmeActif.id, seanceActive, completedSetsData, feedback, durationMin);
                const { data } = await supabase.from("programmes").select("*").eq("id", programmeActif.id).single();
                if (data) setProgrammeActif(data);
              }
            } catch (err) {
              console.error("onFinish error:", err);
            } finally {
              setSeanceActive(null);
            }
          }}
        />
      ) : (
        <>
          {activeTab === "dashboard" && (
            <DashboardScreen
              user={user}
              programme={programmeActif}
              matchs={matchs}
              derniereSeance={derniereSeance}
              onOpenMatchs={() => setShowMatchs(true)}
              onStartSession={() => {
                const prog = programmeActif?.data_json;
                const seance = prog?.semaines?.[0]?.seances?.[0] || MOCK_PROGRAM.seancesDuJour[0];
                setSeanceActive(seance);
              }}
            />
          )}
          {activeTab === "historique" && <HistoriqueScreen />}
          {activeTab === "profil" && <ProfilScreen user={user} programme={programmeActif} onLogout={handleLogout} />}
          <BottomNav activeTab={activeTab} setTab={setActiveTab} />
        </>
      )}
    </div>
  );
}
