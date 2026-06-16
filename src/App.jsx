// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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

async function generateProgramIA({ sport, objectif, niveau, frequence, cycle }) {
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
      body: JSON.stringify({ sport, objectif, niveau, frequence, cycle: startCycle, startCycle }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur generation");
  return data.programme;
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

    return { success: true, deload };
  } catch (err) {
    console.error("saveCompleteSession:", err);
    return null;
  }
}


// ─────────────────────────────────────────────
// SPORT THEMES
// ─────────────────────────────────────────────
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

function getSportTheme(sport) {
  return SPORT_THEMES[sport] || SPORT_THEMES.default;
}

// Alias for backwards compatibility
const s = {
  mono: { fontFamily: "'Space Mono', 'Courier New', monospace" },
  display: { fontFamily: "'Rajdhani', system-ui, sans-serif", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase" },
  heading: { fontFamily: "'Rajdhani', system-ui, sans-serif", fontWeight: 600 },
  body: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400 },
};

const THEMES = {
  light: {
    bg: "#ECEEF0", surface: "#FFFFFF", surfaceUp: "#F4F5F6", surfaceHigh: "#E4E6E8",
    primary: "#5FAE2E", primarySoft: "rgba(95,174,46,0.12)", primaryGlow: "rgba(95,174,46,0.3)",
    primaryDark: "#4A8A23",
    success: "#3D9B35", successSoft: "rgba(61,155,53,0.12)",
    warning: "#E07800", warningSoft: "rgba(224,120,0,0.10)",
    gold: "#C9A000", goldSoft: "rgba(201,160,0,0.12)",
    textPrimary: "#0D0F10", textSec: "#555B63", textDim: "#9DA3AA",
    border: "rgba(0,0,0,0.10)", borderAccent: "rgba(95,174,46,0.4)",
    shadow: { primary: "0 4px 24px rgba(95,174,46,0.3)", card: "0 2px 16px rgba(0,0,0,0.08)", glow: "0 0 40px rgba(95,174,46,0.2)" },
    navBg: "rgba(255,255,255,0.97)",
    stickyBg: "rgba(236,238,240,0.97)",
    isDark: false,
  },
  dark: {
    bg: "#06060E", surface: "#0D0D18", surfaceUp: "#141420", surfaceHigh: "#1A1A28",
    primary: "#9BE84F", primarySoft: "rgba(155,232,79,0.15)", primaryGlow: "rgba(155,232,79,0.3)",
    primaryDark: "#9BE84F",
    success: "#00FF87", successSoft: "rgba(0,255,135,0.12)",
    warning: "#FF8C00", warningSoft: "rgba(255,140,0,0.12)",
    gold: "#FFE500", goldSoft: "rgba(255,229,0,0.12)",
    textPrimary: "#FFFFFF", textSec: "#6B6B8A", textDim: "#2A2A3A",
    border: "rgba(255,255,255,0.06)", borderAccent: "rgba(155,232,79,0.3)",
    shadow: { primary: "0 8px 32px rgba(155,232,79,0.2)", card: "0 4px 24px rgba(0,0,0,0.6)", glow: "0 0 40px rgba(155,232,79,0.15)" },
    navBg: "rgba(6,6,14,0.95)",
    stickyBg: "rgba(6,6,14,0.92)",
    isDark: true,
  },
};

let DS = (() => {
  const saved = localStorage.getItem("voltra_theme") || "light";
  return { colors: THEMES[saved], radius: { sm: 10, md: 16, lg: 20, xl: 28, full: 9999 }, shadow: THEMES[saved].shadow };
})();

function applyTheme(theme) {
  DS = { colors: THEMES[theme], radius: { sm: 10, md: 16, lg: 20, xl: 28, full: 9999 }, shadow: THEMES[theme].shadow };
}

function PrimaryButton({ children, onClick, disabled, style = {} }) {
  const [p, setP] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)}
      style={{
        width: "100%", height: 56,
        background: disabled ? DS.colors.surfaceHigh : `linear-gradient(135deg, ${DS.colors.primary}, #00C896)`,
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
          border: `1.5px solid ${focused ? DS.colors.primary : DS.colors.border}`,
          borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 16,
          outline: "none", transition: "border 0.2s ease",
          boxShadow: focused ? `0 0 0 3px ${DS.colors.primarySoft}` : DS.shadow.card,
          fontFamily: "'Inter', system-ui, sans-serif",
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
        height: "100%", width: `${width}%`,
        background: DS.colors.primary,
        borderRadius: DS.radius.full, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
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
    <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "28px 24px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: DS.shadow.card }}>
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
function SeanceScreen({ seance, onFinish, onBack, sport }) {
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [resting, setResting] = useState(false);
  const [waitingRest, setWaitingRest] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [showCoach, setShowCoach] = useState(false);
  const [coachMessages, setCoachMessages] = useState([
    { role: "assistant", text: "Coach IA pret ! Dis-moi si tu as du mal avec un exercice, une douleur ou si tu veux adapter la seance." }
  ]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const theme = getSportTheme(sport);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatElapsed = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

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
  const accentColor = theme.accent;

  const sendCoachMessage = async () => {
    if (!coachInput.trim() || coachLoading) return;
    const userMsg = coachInput.trim();
    setCoachInput("");
    setCoachMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setCoachLoading(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ message: userMsg, exercice: currentEx, seance: { titre: seance?.titre }, history: coachMessages.slice(-6) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoachMessages(prev => [...prev, { role: "assistant", text: data.reply || "Desolé, erreur." }]);
    } catch (err) {
      setCoachMessages(prev => [...prev, { role: "assistant", text: "Erreur. Reessaie." }]);
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
      setWaitingRest(true);
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

  // ── ECRAN RECAPITULATIF ──
  if (showSummary) {
    const totalSetsCount = exercices.reduce((acc, ex) => acc + (ex.sets || 3), 0);
    const durationMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    return (
      <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 300px 300px at 50% 30%, ${accentColor}08, transparent)`, pointerEvents: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40, position: "relative" }}>

          {/* Trophee */}
          <div style={{ width: 100, height: 100, borderRadius: 26, background: accentColor + "15", border: `2px solid ${accentColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, marginBottom: 24, boxShadow: `0 0 60px ${accentColor}30`, animation: "celebrate 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
            🏆
          </div>

          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 8 }}>SEANCE TERMINEE</div>
          <h1 style={{ ...s.display, fontSize: 36, color: "white", marginBottom: 6, textAlign: "center", letterSpacing: "0.02em" }}>{getRandom(MOTIVATION.finish).toUpperCase()}</h1>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, marginBottom: 36, letterSpacing: "0.15em" }}>{(seance.titre || "").toUpperCase()}</p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 36 }}>
            {[
              { val: exercices.length, label: "EXO", color: accentColor },
              { val: totalSetsCount, label: "SERIES", color: DS.colors.success },
              { val: `${durationMin}`, label: "MIN", color: "#FF8C00" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: DS.colors.surface, border: `1px solid ${stat.color}25`, borderRadius: DS.radius.lg, padding: "18px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.1em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Ressenti */}
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>Comment tu te sens ?</p>
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 24 }}>
            {[
              { id: "easy", emoji: "😤", label: "FACILE", color: accentColor },
              { id: "good", emoji: "💪", label: "PARFAIT", color: DS.colors.success },
              { id: "hard", emoji: "🔥", label: "DUR", color: "#FF4500" },
            ].map(fb => (
              <button key={fb.id} onClick={() => setFeedback(fb.id)} style={{ flex: 1, padding: "16px 8px", background: feedback === fb.id ? fb.color + "20" : DS.colors.surface, border: `2px solid ${feedback === fb.id ? fb.color : DS.colors.border}`, borderRadius: DS.radius.lg, cursor: "pointer", transition: "all 0.2s", transform: feedback === fb.id ? "scale(1.05)" : "scale(1)" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{fb.emoji}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", color: feedback === fb.id ? fb.color : DS.colors.textSec, fontSize: 9, letterSpacing: "0.1em" }}>{fb.label}</div>
              </button>
            ))}
          </div>

          <button onClick={() => onFinish(feedback, completedSets, exercices, durationMin)} disabled={!feedback} style={{ width: "100%", height: 56, background: feedback ? `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: feedback ? "#000" : DS.colors.textSec, fontSize: 15, cursor: feedback ? "pointer" : "not-allowed", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", boxShadow: feedback ? `0 8px 32px ${accentColor}40` : "none", transition: "all 0.3s" }}>
            {feedback ? "ENREGISTRER ET CONTINUER" : "SELECTIONNE TON RESSENTI"}
          </button>
        </div>
      </div>
    );
  }

  // ── ECRAN SEANCE LIVE ──
  return (
    <div style={{ minHeight: "100vh", background: "#0E100F", maxWidth: 430, margin: "0 auto", position: "relative" }}>

      {/* Celebration */}
      {celebrate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 80, animation: "celebrate 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>💥</div>
          <div style={{ position: "absolute", fontSize: 40, top: "35%", left: "20%", animation: "floatUp 1s ease forwards", opacity: 0 }}>⚡</div>
          <div style={{ position: "absolute", fontSize: 30, top: "30%", right: "20%", animation: "floatUp 1s ease forwards", animationDelay: "0.15s", opacity: 0 }}>✨</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: accentColor, color: "#000", padding: "8px 20px", borderRadius: DS.radius.full, fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", zIndex: 200, boxShadow: `0 4px 20px ${accentColor}60`, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: DS.colors.stickyBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "12px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textSec, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase" }}>{exIdx + 1} / {exercices.length} EXERCICES</p>
            <p style={{ ...s.display, color: "white", fontSize: 16, letterSpacing: "0.05em" }}>{(seance.titre || "").toUpperCase()}</p>
          </div>
          <div style={{ background: accentColor + "15", border: `1px solid ${accentColor}40`, borderRadius: DS.radius.full, padding: "5px 12px" }}>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: accentColor, fontWeight: 700 }}>{formatElapsed(elapsed)}</p>
          </div>
        </div>
        {/* Barre progression */}
        <div style={{ height: 2, background: DS.colors.surfaceHigh, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: accentColor, transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: `0 0 8px ${accentColor}` }} />
        </div>
      </div>

      <div style={{ padding: "16px 20px 140px" }}>

        {/* Card exercice */}
        <div key={animKey} style={{ borderRadius: DS.radius.xl, marginBottom: 14, overflow: "hidden" }}>

          {/* Photo */}
          <div style={{ height: 220, backgroundImage: photoUrl ? `url(${photoUrl})` : "none", backgroundSize: "cover", backgroundPosition: "center", position: "relative", backgroundColor: DS.colors.surfaceHigh }}>
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(6,6,14,0.1) 0%, rgba(6,6,14,0.9) 100%)` }} />

            {/* Numero exercice */}
            <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(6,6,14,0.8)", backdropFilter: "blur(10px)", border: `1px solid ${accentColor}50`, borderRadius: 8, padding: "3px 10px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.15em" }}>EX {exIdx + 1}/{exercices.length}</p>
            </div>

            {/* Icone muscle */}
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(6,6,14,0.7)", backdropFilter: "blur(10px)", border: `1px solid ${accentColor}30`, borderRadius: DS.radius.md, padding: 8 }}>
              {getMuscleIcon(currentEx.muscles, accentColor)}
            </div>

            {/* Nom exercice */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px 18px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>{currentEx.muscles}</p>
              <h2 style={{ ...s.display, fontSize: 30, color: "white", lineHeight: 0.95, textShadow: "0 2px 12px rgba(0,0,0,0.8)", letterSpacing: "0.01em" }}>
                {(currentEx.nom || "").toUpperCase()}
              </h2>
            </div>
          </div>

          {/* Stats exercice */}
          <div style={{ background: DS.colors.surface, borderTop: "none", padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: currentEx.conseil ? 12 : 0 }}>
              {[
                { val: currentEx.sets, label: "SERIES", hi: true },
                { val: currentEx.reps, label: "REPS", hi: false },
                ...(currentEx.chargeKg > 0 ? [{ val: `${currentEx.chargeKg}kg`, label: "CHARGE", hi: false }] : []),
                { val: `${currentEx.reposSec || 90}s`, label: "REPOS", hi: false },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: stat.hi ? accentColor + "12" : DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 4px", textAlign: "center", border: stat.hi ? `1px solid ${accentColor}25` : "none" }}>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, color: stat.hi ? accentColor : "white", fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: DS.colors.textSec, marginTop: 2, letterSpacing: "0.08em" }}>{stat.label}</div>
                </div>
              ))}
            </div>
            {currentEx.conseil && (
              <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                <p style={{ color: DS.colors.textSec, fontSize: 12, lineHeight: 1.5 }}>{currentEx.conseil}</p>
              </div>
            )}
          </div>
        </div>

        {/* Zone repos / sets */}
        {waitingRest ? (
          <button onClick={() => { setWaitingRest(false); setResting(true); }} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}AA)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontSize: 15, cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, boxShadow: `0 8px 24px ${accentColor}40` }}>
            DEMARRER LE REPOS
          </button>
        ) : resting ? (
          <RestTimer seconds={currentEx.reposSec || 90} onComplete={() => { setResting(false); setWaitingRest(false); setSetIdx(i => i + 1); }} />
        ) : (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, overflow: "hidden", marginBottom: 14 }}>
            {/* Header sets */}
            <div style={{ background: DS.colors.surfaceHigh, padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase", flex: 1 }}>SERIE</p>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase" }}>OBJECTIF</p>
            </div>
            {Array.from({ length: totalSets }).map((_, i) => {
              const done = completedSets[`${exIdx}-${i}`];
              const isActive = i === setIdx && !done;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i < totalSets - 1 ? `1px solid ${DS.colors.border}` : "none", background: isActive ? accentColor + "06" : "transparent", opacity: done ? 0.4 : 1, transition: "all 0.2s" }}>
                  <div style={{ width: 30, height: 30, borderRadius: DS.radius.full, background: done ? DS.colors.success + "20" : isActive ? accentColor + "20" : DS.colors.surfaceHigh, border: `2px solid ${done ? DS.colors.success : isActive ? accentColor : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {done ? <span style={{ color: DS.colors.success, fontSize: 14 }}>✓</span> : <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: isActive ? accentColor : DS.colors.textSec }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: isActive ? "white" : DS.colors.textSec, fontWeight: isActive ? 700 : 400 }}>
                      {currentEx.sets} x {currentEx.reps}
                      {currentEx.chargeKg > 0 && <span style={{ color: accentColor }}> @ {currentEx.chargeKg}kg</span>}
                    </p>
                    {isActive && <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, marginTop: 2, letterSpacing: "0.1em" }}>SERIE ACTIVE</p>}
                  </div>
                  <button onClick={() => isActive && handleSetComplete()} disabled={!isActive || done} style={{ width: 44, height: 44, borderRadius: DS.radius.md, background: done ? DS.colors.success + "15" : isActive ? accentColor : DS.colors.surfaceHigh, border: `1px solid ${done ? DS.colors.success : isActive ? accentColor : DS.colors.border}`, cursor: isActive && !done ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "all 0.2s", boxShadow: isActive && !done ? `0 4px 16px ${accentColor}50` : "none", flexShrink: 0 }}>
                    {done ? <span style={{ color: DS.colors.success }}>✓</span> : <span style={{ color: isActive ? "#000" : DS.colors.textSec, fontWeight: 700 }}>→</span>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Exercices suivants */}
        {exIdx < exercices.length - 1 && !resting && (
          <div>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>ENSUITE</p>
            {exercices.slice(exIdx + 1, exIdx + 3).map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 14px", marginBottom: 8, opacity: i === 0 ? 0.85 : 0.45 }}>
                <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: accentColor + "15", border: `1px solid ${accentColor}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: accentColor }}>{exIdx + 2 + i}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "white", fontSize: 13, ...s.heading }}>{ex.nom}</p>
                  <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{(ex.muscles || "").split(" ")[0]}</p>
                </div>
                <p style={{ fontFamily: "'Space Mono',monospace", color: accentColor, fontSize: 12, fontWeight: 700 }}>{ex.sets}x{ex.reps}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bouton Coach IA flottant */}
      <button onClick={() => setShowCoach(true)} style={{ position: "fixed", bottom: 32, right: 20, width: 54, height: 54, borderRadius: DS.radius.full, background: accentColor, border: "none", color: "#000", fontSize: 22, cursor: "pointer", boxShadow: `0 0 24px ${accentColor}60`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        🤖
      </button>

      {/* Drawer Coach IA */}
      {showCoach && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowCoach(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "0 0 40px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: accentColor + "20", border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                <div>
                  <p style={{ ...s.heading, fontSize: 15, color: "white" }}>Coach IA</p>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.15em" }}>EN LIGNE</p>
                </div>
              </div>
              <button onClick={() => setShowCoach(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 30, height: 30, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            {currentEx && (
              <div style={{ margin: "10px 20px 0", background: accentColor + "10", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.md, padding: "7px 12px" }}>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: accentColor }}>{currentEx.nom} — {currentEx.sets}x{currentEx.reps}{currentEx.chargeKg > 0 ? ` @ ${currentEx.chargeKg}kg` : ""}</p>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {coachMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: DS.radius.lg, background: msg.role === "user" ? accentColor : DS.colors.surfaceHigh, color: msg.role === "user" ? "#000" : "white", fontSize: 14, lineHeight: 1.5, fontWeight: msg.role === "user" ? 600 : 400 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: "flex", gap: 4, padding: "10px 16px", background: DS.colors.surfaceHigh, borderRadius: DS.radius.lg, width: "fit-content" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: DS.radius.full, background: DS.colors.textSec, animation: `pulse 1s ease ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>
            <div style={{ padding: "10px 20px 0", display: "flex", gap: 8 }}>
              <input value={coachInput} onChange={e => setCoachInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCoachMessage()} placeholder="J'arrive pas a finir les reps..." style={{ flex: 1, height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 14, outline: "none" }} />
              <button onClick={sendCoachMessage} disabled={!coachInput.trim() || coachLoading} style={{ width: 44, height: 44, borderRadius: DS.radius.full, background: coachInput.trim() ? accentColor : DS.colors.surfaceHigh, border: "none", color: coachInput.trim() ? "#000" : DS.colors.textSec, cursor: "pointer", fontSize: 18, flexShrink: 0, fontWeight: 700 }}>→</button>
            </div>
            <div style={{ padding: "8px 20px 0", display: "flex", gap: 8, overflowX: "auto" }}>
              {["J'arrive pas a finir", "J'ai mal", "Trop lourd", "Alternative ?"].map((sug, i) => (
                <button key={i} onClick={() => setCoachInput(sug)} style={{ flexShrink: 0, padding: "5px 12px", background: accentColor + "12", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.full, color: accentColor, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Space Mono',monospace" }}>{sug}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CYCLE COMPLETE SCREEN
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
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 400px 400px at 50% 40%, ${theme.accent}08, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>

        {/* Trophée animé */}
        <div style={{ fontSize: 80, marginBottom: 24, animation: "celebrate 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}>
          {msg.emoji}
        </div>

        {/* Titre */}
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.3em", marginBottom: 12 }}>
          CYCLE {cycle} COMPLETE
        </div>
        <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 42, color: "white", lineHeight: 0.95, marginBottom: 12, letterSpacing: "0.02em" }}>
          {msg.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.1em", marginBottom: 40, maxWidth: 300, margin: "0 auto 40px" }}>
          {msg.desc}
        </p>

        {/* Stats du cycle */}
        <div style={{ display: "flex", gap: 10, marginBottom: 40, justifyContent: "center" }}>
          {[
            { val: cycle, label: "CYCLES", color: theme.accent },
            { val: `${(programme?.semaine_courante || 8)}`, label: "SEMAINES", color: "#00FF87" },
            { val: "↑↑↑", label: "NIVEAU", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "14px 16px", textAlign: "center", position: "relative", overflow: "hidden", minWidth: 80 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontFamily: "'Bebas Neue','Rajdhani',sans-serif", fontSize: 24, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: DS.colors.textSec, letterSpacing: "0.1em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Status génération */}
        {cycleLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surface, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, animation: "pulse 1s infinite", boxShadow: `0 0 8px ${theme.accent}` }} />
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: theme.accent, letterSpacing: "0.15em" }}>
              GENERATION DU CYCLE {cycle + 1} EN COURS...
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)", borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "#00FF87", letterSpacing: "0.15em" }}>
              CYCLE {cycle + 1} PRET · PLUS INTENSE
            </p>
          </div>
        )}

        {/* CTA */}
        {showContinue && (
          <button onClick={onContinue} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", boxShadow: `0 8px 32px ${theme.accent}40`, animation: "slideUp 0.5s ease" }}>
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #1B1E1C 0%, #0E100F 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 40%, rgba(155,232,79,0.06), transparent)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 390, position: "relative", zIndex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(30px)", transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 0 40px rgba(155,232,79,0.4)" }}>⚡</div>
          <div style={{ fontFamily: "'Bebas Neue','Rajdhani',sans-serif", fontSize: 32, color: "white", letterSpacing: "0.15em", marginBottom: 8 }}>VOLTRA</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em" }}>CHOISIS TON STYLE</div>
        </div>

        {/* Theme cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 32 }}>
          {themes.map(theme => (
            <div key={theme.id} onClick={() => setSelected(theme.id)} style={{ flex: 1, borderRadius: 24, overflow: "hidden", border: `2px solid ${selected === theme.id ? "#9BE84F" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)", transform: selected === theme.id ? "scale(1.02)" : "scale(1)", boxShadow: selected === theme.id ? "0 0 30px rgba(155,232,79,0.3)" : "none" }}>

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
                  <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15, color: selected === theme.id ? "#16181A" : "white", letterSpacing: "0.08em" }}>{theme.name}</p>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: selected === theme.id ? "#16181A" : "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginTop: 2 }}>{theme.desc}</p>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 9999, border: `2px solid ${selected === theme.id ? "#16181A" : "rgba(255,255,255,0.3)"}`, background: selected === theme.id ? "#16181A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selected === theme.id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", letterSpacing: "0.1em", marginBottom: 24 }}>TU POURRAS CHANGER CA DANS TON PROFIL</p>

        {/* CTA */}
        <button onClick={() => selected && onChoose(selected)} disabled={!selected} style={{ width: "100%", height: 56, background: selected ? "#9BE84F" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 9999, color: selected ? "#16181A" : "rgba(255,255,255,0.3)", fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", cursor: selected ? "pointer" : "not-allowed", transition: "all 0.3s", boxShadow: selected ? "0 8px 32px rgba(155,232,79,0.4)" : "none" }}>
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
  const [phase, setPhase] = useState(0); // 0=logo, 1=features, 2=cta
  const [featureIdx, setFeatureIdx] = useState(0);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    // Phase logo → features → cta
    const t1 = setTimeout(() => { setLogoReady(true); }, 300);
    const t2 = setTimeout(() => setPhase(1), 1800);
    const t3 = setTimeout(() => setPhase(2), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Auto-scroll features
  useEffect(() => {
    if (phase < 1) return;
    const interval = setInterval(() => {
      setFeatureIdx(i => (i + 1) % features.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase]);

  const features = [
    { emoji: "🎯", title: "Programme 100% personnalisé", desc: "L'IA crée ton programme selon ton sport, ton niveau et tes objectifs spécifiques", color: "#00FF87" },
    { emoji: "📈", title: "Progression automatique", desc: "Tes charges augmentent intelligemment chaque semaine pour maximiser tes gains", color: "#FF8C00" },
    { emoji: "🤖", title: "Coach IA en temps réel", desc: "Un coach disponible pendant chaque séance pour adapter et t'encourager", color: "#00C8FF" },
    { emoji: "🏆", title: "Suis tes records", desc: "Visualise ta progression semaine après semaine et bats tes limites", color: "#FFE500" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #1B1E1C 0%, #0E100F 100%)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Glow de fond */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 500px 500px at 50% 30%, rgba(0,255,135,0.07), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 400, height: 400, background: "radial-gradient(circle, rgba(0,200,255,0.04), transparent)", pointerEvents: "none" }} />

      {/* Phase logo */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: phase === 0 ? "center" : "flex-start", paddingTop: phase === 0 ? 0 : 60, transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: phase === 0 ? 0 : 40, transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)", transform: logoReady ? "scale(1)" : "scale(0.5)", opacity: logoReady ? 1 : 0 }}>
          <div style={{ position: "relative", marginBottom: 20 }}>
            {/* Rings animés */}
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "1px solid rgba(0,255,135,0.15)", animation: "pulse 3s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: -36, borderRadius: "50%", border: "1px solid rgba(0,255,135,0.08)", animation: "pulse 3s ease-in-out 0.5s infinite" }} />
            {/* Icone */}
            <div style={{ width: 90, height: 90, borderRadius: 26, background: "linear-gradient(135deg, #00FF87, #00C896)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, boxShadow: "0 0 60px rgba(0,255,135,0.5), 0 0 120px rgba(0,255,135,0.2)", position: "relative", zIndex: 1 }}>
              ⚡
            </div>
          </div>

          <div style={{ fontFamily: "'Bebas Neue','Rajdhani',sans-serif", fontSize: phase === 0 ? 52 : 36, color: "white", letterSpacing: "0.2em", lineHeight: 1, transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)", marginBottom: 8 }}>
            VOLTRA
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.3em", opacity: logoReady ? 1 : 0, transition: "opacity 0.6s ease 0.5s" }}>
            PERFORMANCE · IA · SPORT
          </div>
        </div>

        {/* Features carousel */}
        {phase >= 1 && (
          <div style={{ width: "100%", maxWidth: 390, padding: "0 24px", animation: "slideUp 0.6s ease" }}>

            {/* Feature card principale */}
            <div key={featureIdx} style={{ background: DS.colors.surface, border: `1px solid ${features[featureIdx].color}20`, borderRadius: DS.radius.xl, padding: "28px 24px", marginBottom: 20, position: "relative", overflow: "hidden", animation: "fadeIn 0.4s ease" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: features[featureIdx].color }} />
              <div style={{ position: "absolute", top: -30, right: -20, fontSize: 100, opacity: 0.05, lineHeight: 1 }}>{features[featureIdx].emoji}</div>
              <div style={{ fontSize: 42, marginBottom: 16 }}>{features[featureIdx].emoji}</div>
              <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 24, color: "white", marginBottom: 10, lineHeight: 1.1, letterSpacing: "0.02em" }}>
                {features[featureIdx].title}
              </h2>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em" }}>
                {features[featureIdx].desc}
              </p>
            </div>

            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
              {features.map((_, i) => (
                <div key={i} onClick={() => setFeatureIdx(i)} style={{ width: i === featureIdx ? 24 : 6, height: 6, borderRadius: 3, background: i === featureIdx ? features[featureIdx].color : "rgba(255,255,255,0.15)", transition: "all 0.3s ease", cursor: "pointer", boxShadow: i === featureIdx ? `0 0 8px ${features[featureIdx].color}` : "none" }} />
              ))}
            </div>

            {/* 4 icones features rapides */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {features.map((f, i) => (
                <div key={i} onClick={() => setFeatureIdx(i)} style={{ background: i === featureIdx ? f.color + "15" : DS.colors.surfaceHigh, border: `1px solid ${i === featureIdx ? f.color + "40" : DS.colors.border}`, borderRadius: DS.radius.md, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{f.emoji}</div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: i === featureIdx ? f.color : DS.colors.textSec, letterSpacing: "0.06em", lineHeight: 1.3 }}>{f.title.split(" ")[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA en bas */}
      <div style={{ padding: "0 24px 52px", position: "relative", zIndex: 1, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(40px)", transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s" }}>

        {phase >= 2 && (
          <div style={{ marginBottom: 16, animation: "slideUp 0.5s ease" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {["🏀 Basketball", "⚽ Football", "🥊 Combat", "🏃 Sprint"].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: DS.radius.full, padding: "4px 10px", fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{s}</div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onStart} style={{ width: "100%", height: 60, background: "linear-gradient(135deg, #00FF87, #00C896)", border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Rajdhani',sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", boxShadow: "0 8px 40px rgba(0,255,135,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <span>⚡</span>
          <span>CONSTRUIRE MON PROGRAMME</span>
        </button>

        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", letterSpacing: "0.15em" }}>
          GRATUIT · 2 MINUTES · SANS CARTE BANCAIRE
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
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => onDone && onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #1B1E1C 0%, #0E100F 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 40%, rgba(155,232,79,0.08), transparent)", pointerEvents: "none" }} />

      {/* Logo animé */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.4)", transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <div style={{ position: "absolute", inset: -16, borderRadius: "50%", border: "1px solid rgba(155,232,79,0.2)", animation: phase >= 2 ? "pulse 2s ease infinite" : "none" }} />
          <div style={{ position: "absolute", inset: -32, borderRadius: "50%", border: "1px solid rgba(155,232,79,0.1)", animation: phase >= 2 ? "pulse 2s ease 0.4s infinite" : "none" }} />
          <div style={{ width: 90, height: 90, borderRadius: 26, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, boxShadow: "0 0 60px rgba(155,232,79,0.5)", position: "relative", zIndex: 1 }}>
            ⚡
          </div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue','Rajdhani',sans-serif", fontSize: 52, color: "white", letterSpacing: "0.2em", lineHeight: 1, opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(10px)", transition: "all 0.5s ease 0.3s" }}>
          VOLTRA
        </div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.3em", marginTop: 8, opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.5s ease 0.6s" }}>
          PERFORMANCE · IA · SPORT
        </div>
      </div>

      {/* Loading dots */}
      <div style={{ position: "absolute", bottom: 60, display: "flex", gap: 6, opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.4s ease 0.8s" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#9BE84F", animation: `pulse 1s ease ${i*0.2}s infinite` }} />
        ))}
      </div>
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

  // Detecter si on vient d'un lien reset password
  const isPasswordRecovery = window.location.hash.includes("type=recovery");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    if (mode === "signup" && !name) { setError("Entre ton prénom."); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caractères minimum."); return; }
    setLoading(true);
    if (mode === "signup") {
      const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
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
      <div style={{ minHeight: "100vh", background: DS.colors.surface, display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>🔑</div>
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Nouveau mot de passe</h1>
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
      <div style={{ minHeight: "100vh", background: DS.colors.surface, display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>📧</div>
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Mot de passe oublié ?</h1>
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
    <div style={{ minHeight: "100vh", background: DS.colors.surface, display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <div style={{ paddingTop: 80, paddingBottom: 48, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>⚡</div>
        <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 32, color: DS.colors.textPrimary, marginBottom: 8 }}>Voltra</h1>
        <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 15 }}>{mode === "login" ? "Content de te revoir 👋" : "Commence ton parcours"}</p>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, padding: 4, marginBottom: 32 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ flex: 1, height: 40, borderRadius: DS.radius.full, background: mode === m ? DS.colors.primary : "transparent", border: "none", color: mode === m ? "#000" : DS.colors.textSec, fontSize: 14, fontWeight: mode === m ? 700 : 400, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Inter',sans-serif" }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>
        {mode === "signup" && <Input label="Prénom" value={name} onChange={setName} placeholder="Alex" />}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
        <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="Min. 6 caractères" />
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
      <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", paddingBottom: 40, fontFamily: "'Inter',sans-serif" }}>En continuant, tu acceptes nos CGU.</p>
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
  const [genError, setGenError] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);

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
    setGenError(false);
    setSlideIndex(0);
    const timeout = setTimeout(() => {
      setGenError(true);
    }, 20000);
    onComplete(data, null);
    generateProgramIA(data).then(async programme => {
      clearTimeout(timeout);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("profiles").upsert({ id: session.user.id, sport: data.sport }, { onConflict: "id" });
      }
      onComplete(data, programme);
    }).catch(err => {
      clearTimeout(timeout);
      console.error(err);
      setGenError(true);
    });
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
    if (contentStep === 5) return data.niveau !== null;
    return false;
  })();

  const isLastStep = step === totalSteps - 1;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.surface, display: "flex", flexDirection: "column", padding: "0 20px" }}>

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
                  <div style={{ position: "absolute", top: 8, left: 10, background: "rgba(6,6,14,0.8)", borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: sportTheme.accent }}>EX 1/5</p>
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 10, background: sportTheme.accent + "20", border: `1px solid ${sportTheme.accent}40`, borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: sportTheme.accent, fontWeight: 700 }}>12:34</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: sportTheme.accent, marginBottom: 2 }}>QUADRICEPS</p>
                    <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 20, color: "white" }}>SQUAT BARRE</p>
                  </div>
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, background: i <= 2 ? sportTheme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${i <= 2 ? sportTheme.accent : DS.colors.border}`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: i <= 2 ? sportTheme.accent : DS.colors.textSec }}>{i <= 2 ? "✓" : i}</p>
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
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: DS.colors.textSec }}>S1</p>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: sportTheme.accent }}>+60% EN 7 SEMAINES</p>
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
                <div key={i} style={{ width: i === slideIndex ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIndex ? sportTheme.accent : DS.colors.surfaceHigh, transition: "all 0.3s ease", boxShadow: i === slideIndex ? `0 0 8px ${sportTheme.accent}` : "none" }} />
              ))}
            </div>

            {genError ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
                <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 28, color: "white", marginBottom: 12, letterSpacing: "0.05em" }}>Generation lente...</h2>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, marginBottom: 32, lineHeight: 1.8, letterSpacing: "0.1em" }}>Le serveur prend du temps. Tu peux reessayer ou continuer — le programme se generera en arriere-plan.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <button onClick={retryGeneration} style={{ width: "100%", height: 52, background: DS.colors.primary, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>REESSAYER</button>
                  <button onClick={skipGeneration} style={{ width: "100%", height: 52, background: "transparent", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textSec, fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>CONTINUER SANS PROGRAMME</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }} key={slideIndex}>
                {/* Tag */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sportTheme.accent + "15", border: `1px solid ${sportTheme.accent}30`, borderRadius: 6, padding: "3px 10px", marginBottom: 16, alignSelf: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sportTheme.accent, animation: "pulse 1.5s infinite" }} />
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: sportTheme.accent, letterSpacing: "0.2em" }}>{currentSlide.tag}</p>
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 36, color: "white", lineHeight: 1, marginBottom: 12, letterSpacing: "0.02em", whiteSpace: "pre-line" }}>
                  {currentSlide.title}
                </h2>

                {/* Desc */}
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em", marginBottom: 24 }}>{currentSlide.desc}</p>

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
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.1em" }}>{slideIndex + 1} / {slides.length}</p>
                <button onClick={() => setSlideIndex(i => Math.min(slides.length - 1, i + 1))} style={{ background: slideIndex === slides.length - 1 ? sportTheme.accent : DS.colors.surfaceHigh, border: "none", borderRadius: slideIndex === slides.length - 1 ? DS.radius.full : DS.radius.full, padding: slideIndex === slides.length - 1 ? "0 20px" : "0", width: slideIndex === slides.length - 1 ? "auto" : 44, height: 44, color: slideIndex === slides.length - 1 ? "#000" : DS.colors.textSec, cursor: "pointer", fontSize: slideIndex === slides.length - 1 ? 13 : 18, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: "0.05em", boxShadow: slideIndex === slides.length - 1 ? `0 4px 20px ${sportTheme.accent}50` : "none" }}>
                  {slideIndex === slides.length - 1 ? "VOIR MON PROGRAMME →" : "→"}
                </button>
              </div>
            )}
          </div>
        );
      })()}

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
            <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 38, color: "white", marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>{data.sport === "combat" ? "Choisis ta discipline" : "Quel est ton sport ?"}</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Le programme sera entierement adapte.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {SPORTS.map(sport => (
                <div key={sport.id} onClick={() => setData(d => ({ ...d, sport: sport.id, poste: null }))} style={{ background: data.sport === sport.id ? DS.colors.primary : DS.colors.surface, borderRadius: DS.radius.full, padding: "16px 8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease", transform: data.sport === sport.id ? "scale(1.05)" : "scale(1)", boxShadow: data.sport === sport.id ? DS.shadow.primary : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" }}>
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
            <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 38, color: "white", marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>{data.sport === "combat" ? "Ton objectif de combat ?" : "Quel est ton objectif ?"}</h1>
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
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>{data.sport === "combat" ? "Ta discipline ?" : "Ton poste ?"}</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>{data.sport === "combat" ? "Le programme est adapte a ta discipline de combat." : "Le programme cible les qualites de ton poste."}</p>
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
            <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 38, color: "white", marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>Des douleurs ?</h1>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.15em", marginBottom: 12 }}>Les exercices s'adapteront automatiquement.</p>
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
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.15em", marginBottom: 32 }}>Les exercices seront adaptes a ce que tu as.</p>
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
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.15em", marginBottom: 36 }}>Le programme se calibre sur ton profil.</p>
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
function PricingScreen({ onSelectPlan, programme, frequence }) {
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
  const featuresPro = ["Progression automatique des charges", "Nouveau programme IA genere a chaque cycle", "Adaptation si seance skippee", "Deload automatique intelligent", "Historique complet + graphiques", "Jusqu'a 5 seances / semaine", "Coach IA integre", "Export PDF du programme"];

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
              { val: frequence || programme?.data_json?.semaines?.[0]?.seances?.length || 3, label: "seances/sem" },
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
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 26, color: "white", letterSpacing: "0.1em" }}>MES MATCHS</h1>
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
function DashboardScreen({ user, programme, programmeLoading, matchs, derniereSeance, sport: sportProp, onStartSession, onOpenMatchs }) {
  const progData = programme?.data_json;
  const seance = progData?.semaines?.[0]?.seances?.[0] || null;
  const sport = sportProp || progData?.sport || user?.user_metadata?.sport || "default";
  const theme = getSportTheme(sport);
  const prog = {
    titre: programme?.titre || null,
    semaineCourante: programme?.semaine_courante || 1,
    totalSemaines: programme?.total_semaines || 8,
    progression: Math.round(((programme?.semaine_courante || 1) / (programme?.total_semaines || 8)) * 100),
  };
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";

  // Salutation selon heure
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonne matinee" : hour < 18 ? "Bon apres-midi" : "Bonne soiree";

  // Match le plus proche
  const prochainMatch = matchs?.length > 0 ? matchs[0] : null;
  const daysUntilMatch = prochainMatch ? Math.ceil((new Date(prochainMatch.date_match) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const matchAlert = daysUntilMatch !== null ? (
    daysUntilMatch <= 0 ? { color: theme.accent, text: "Match aujourd'hui - repos ou activation legere", emoji: "⚡" } :
    daysUntilMatch === 1 ? { color: theme.accent, text: "Match demain - seance tres legere", emoji: "⚠️" } :
    daysUntilMatch <= 3 ? { color: theme.accent, text: `Match dans ${daysUntilMatch} jours - charges reduites`, emoji: "📅" } :
    null
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100, position: "relative" }}>
      {/* Sport background glow */}
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none", opacity: 0.5 }} />

      {/* Sport illustration en fond */}
      <div style={{ position: "absolute", top: 20, right: -10, fontSize: 180, opacity: 0.06, pointerEvents: "none", lineHeight: 1, userSelect: "none", zIndex: 0, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || SPORT_EMOJIS[progData?.programme?.sport] || SPORT_EMOJIS[user?.user_metadata?.sport] || "⚡"}
      </div>

      {programmeLoading && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: DS.colors.surface, border: `1px solid ${theme.accent}40`, borderRadius: DS.radius.full, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: `0 8px 32px rgba(0,0,0,0.6)`, whiteSpace: "nowrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: theme.accent, animation: "pulse 1s infinite", boxShadow: `0 0 8px ${theme.accent}` }} />
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: theme.accent, letterSpacing: "0.1em" }}>Generation du programme en cours...</p>
        </div>
      )}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: DS.colors.stickyBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 0 rgba(0,0,0,0.05)" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: 6, padding: "2px 8px", marginBottom: 4 }}>
            <span style={{ fontSize: 11 }}>{SPORT_EMOJIS[sport] || "⚡"}</span>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: theme.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>{sport || "SPORT"}</span>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.2em", marginBottom: 2 }}>{greeting.toUpperCase()},</p>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, color: DS.colors.textPrimary, letterSpacing: "0.06em" }}>{userName.toUpperCase()}</p>
        </div>
        <div style={{ width: 42, height: 42, background: theme.accent + "20", borderRadius: DS.radius.md, border: `1px solid ${theme.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", color: theme.accent, fontSize: 18, fontWeight: 800, fontFamily: "'Rajdhani', sans-serif" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.2em", textTransform: "uppercase" }}>SEMAINE {prog.semaineCourante} / {prog.totalSemaines}</div>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${theme.accent}40, transparent)` }} />
          </div>
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 42, color: "white", lineHeight: 0.92, marginBottom: 16, letterSpacing: "0.02em" }}>{(prog.titre || seance?.titre || "PROGRAMME EN COURS").toUpperCase()}</h1>
          <ProgressBar value={prog.progression} />
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, marginTop: 6, letterSpacing: "0.15em" }}>CYCLE {prog.semaineCourante} · {prog.progression}% · PROGRESSION CONTINUE</p>
        </div>
        {!seance ? (
          <Card style={{ marginBottom: 24, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚡</div>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 20, color: "white", marginBottom: 8, letterSpacing: "0.05em" }}>Programme en preparation</p>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.1em", lineHeight: 1.8 }}>Ton programme IA est en cours de generation. Reviens dans quelques instants.</p>
          </Card>
        ) : (
        <Card style={{ marginBottom: 24, overflow: "hidden", position: "relative", background: DS.colors.surface, border: `1px solid ${theme.accent}20` }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "inline-flex", padding: "3px 10px", background: theme.accent + "15", border: `1px solid ${theme.accent}35`, borderRadius: DS.radius.full, color: theme.accent, fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: "0.1em" }}>AUJOURD'HUI</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: DS.colors.textSec }}>{seance.dureeMin} MIN</div>
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
          <PrimaryButton onClick={onStartSession} style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, boxShadow: `0 8px 24px rgba(${theme.accentRgb},0.3)`, color: "#000", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>▶ DEMARRER LA SEANCE</PrimaryButton>
        </Card>
        )}
        {seance && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 14 }}>Au programme</p>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {(seance.exercices || []).map((ex, i) => {
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
        )}
        {/* Parcours des cycles */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ color: "white", fontSize: 16, ...s.heading }}>Ton parcours</p>
            <div style={{ background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "3px 10px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.12em" }}>CYCLE {programme?.data_json?.cycle || getNiveauCycle(programme?.data_json?.niveau) || 1}</p>
            </div>
          </div>

          {/* Barre de progression des cycles */}
          <div style={{ display: "flex", gap: 0, marginBottom: 14, position: "relative" }}>
            {/* Ligne de connexion */}
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, background: DS.colors.surfaceHigh, zIndex: 0 }} />
            <div style={{ position: "absolute", top: 20, left: 20, height: 2, width: `${Math.min(100, (1 / 4) * 100)}%`, background: theme.accent, zIndex: 0, transition: "width 1s ease", boxShadow: `0 0 8px ${theme.accent}` }} />
            {(() => {
              const currentCycle = programme?.data_json?.cycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
              const startCycle = programme?.data_json?.startCycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
              const getLabel = (n) => n === 1 ? "FONDATIONS" : n === 2 ? "INTENSITE" : n === 3 ? "PUISSANCE" : n === 4 ? "ELITE" : `ELITE+${n-4}`;
              const start = Math.max(1, currentCycle - 1);
              return Array.from({ length: 4 }, (_, i) => ({ num: start + i, label: getLabel(start + i) })).map((c, i) => {
              const isDone = currentCycle > c.num && c.num >= startCycle;
              const isSkipped = c.num < startCycle;
              const isCurrent = currentCycle === c.num;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: DS.radius.full, background: isDone ? theme.accent : isSkipped ? DS.colors.surfaceHigh : isCurrent ? theme.accent + "25" : DS.colors.surfaceHigh, border: `2px solid ${isDone ? theme.accent : isSkipped ? DS.colors.border : isCurrent ? theme.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.4s", boxShadow: isCurrent ? `0 0 16px ${theme.accent}60` : "none" }}>
                    {isDone
                      ? <span style={{ color: "#000", fontSize: 16 }}>✓</span>
                      : isSkipped ? <span style={{ color: DS.colors.textDim, fontSize: 12 }}>—</span>
                      : <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: isCurrent ? theme.accent : DS.colors.textSec, fontWeight: 700 }}>{c.num}</span>
                    }
                  </div>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: isDone || isCurrent ? theme.accent : DS.colors.textSec, letterSpacing: "0.08em", textAlign: "center" }}>{c.label}</p>
                </div>
              );
            });
            })()}
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {(() => {
              const currentCycle = programme?.data_json?.cycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
              const startCycle = programme?.data_json?.startCycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
              const getCycleInfo = (num) => {
                if (num === 1) return { emoji: "🌱", title: "Fondations", desc: "Technique, bases solides. On construit l'athlete.", color: "#00FF87", tag: "DEBUT" };
                if (num === 2) return { emoji: "⚡", title: "Intensification", desc: "Volume augmente, repos reduits. Adaptation rapide.", color: "#FF8C00", tag: "INTENSITE" };
                if (num === 3) return { emoji: "🔥", title: "Puissance max", desc: "Charges lourdes, explosivite maximale.", color: "#FF2D55", tag: "AVANCE" };
                if (num === 4) return { emoji: "💎", title: "Elite", desc: "Protocole athlete professionnel. Peu arrivent ici.", color: "#CC00FF", tag: "ELITE" };
                return { emoji: "🚀", title: `Elite+ ${num - 4}`, desc: `Niveau extreme. Cycle ${num} sur mesure pour toi.`, color: "#00C8FF", tag: `ELITE+ ${num - 4}` };
              };
              // Affiche depuis max(1, currentCycle-1) jusqu'a currentCycle+3
              const start = Math.max(1, currentCycle - 1);
              const cycles = Array.from({ length: 5 }, (_, i) => start + i);
              return cycles.map((num, i) => {
              const c = { num, ...getCycleInfo(num) };
              const isDone = currentCycle > num && num >= startCycle;
              const isCurrent = currentCycle === num;
              const isSkipped = num < startCycle;
              const isLocked = currentCycle < num;
              return (
                <div key={i} style={{ flexShrink: 0, width: 160, background: isCurrent ? c.color + "12" : DS.colors.surface, border: `1px solid ${isCurrent ? c.color + "40" : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "14px 12px", position: "relative", overflow: "hidden", opacity: isLocked ? 0.55 : 1, transition: "all 0.3s" }}>
                  {isCurrent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: c.color }} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{c.emoji}</span>
                    {isLocked && <span style={{ fontSize: 14 }}>🔒</span>}
                    {isDone && <span style={{ fontSize: 14 }}>✅</span>}
                    {isSkipped && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, background: DS.colors.surfaceHigh, padding: "2px 6px", borderRadius: DS.radius.full }}>N/A</span>}
                    {isCurrent && <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, animation: "pulse 1.5s infinite", boxShadow: `0 0 6px ${c.color}` }} />}
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: isCurrent ? c.color : DS.colors.textSec, letterSpacing: "0.12em", marginBottom: 4 }}>{c.tag}</div>
                  <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15, color: isCurrent ? "white" : DS.colors.textSec, marginBottom: 4 }}>{c.title}</p>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: DS.colors.textSec, lineHeight: 1.6, letterSpacing: "0.04em" }}>{c.desc}</p>
                </div>
              );
            });
            })()}
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
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>

      {/* Drawer detail seance */}
      {selectedSeance && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setSelectedSeance(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", marginBottom: 4 }}>
                  {new Date(selectedSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </p>
                <h3 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, color: "white" }}>{selectedSeance.titre}</h3>
              </div>
              <button onClick={() => setSelectedSeance(null)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { val: `${selectedSeance.duree_min || 0}m`, label: "DUREE", color: accentColor },
                { val: selectedSeance.exercices?.length || 0, label: "EXO", color: DS.colors.success },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, color: stat.color, fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, marginTop: 2, letterSpacing: "0.1em" }}>{stat.label}</div>
                </div>
              ))}
              {selectedSeance.feedback && (
                <div style={{ flex: 1, background: feedbackColor(selectedSeance.feedback) + "15", borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", border: `1px solid ${feedbackColor(selectedSeance.feedback)}30` }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{feedbackEmoji(selectedSeance.feedback)}</div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: feedbackColor(selectedSeance.feedback), letterSpacing: "0.08em" }}>{feedbackLabel(selectedSeance.feedback).toUpperCase()}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(selectedSeance.exercices || []).map((ex, i) => (
                <div key={i} style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "white", fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{ex.muscles?.split(" ")[0]}</p>
                  </div>
                  <p style={{ fontFamily: "'Space Mono',monospace", color: accentColor, fontSize: 12, fontWeight: 700 }}>{ex.sets}×{ex.reps}{ex.charge_kg > 0 ? ` @ ${ex.charge_kg}kg` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: DS.colors.stickyBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: DS.colors.textPrimary, letterSpacing: "0.1em" }}>PROGRESSION</h1>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 6, padding: "5px 10px" }}>CE MOIS</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: accentColor, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: DS.colors.textSec }}>Chargement...</p>
        </div>
      ) : (
        <div style={{ padding: "20px 20px 0" }}>

          {/* Hero stat */}
          <div style={{ background: `linear-gradient(135deg, rgba(255,45,85,0.1), rgba(255,45,85,0.03))`, border: `1px solid rgba(255,45,85,0.2)`, borderRadius: DS.radius.xl, padding: "24px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accentColor }} />
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: accentColor, letterSpacing: "0.25em", marginBottom: 8 }}>VOLUME TOTAL</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 72, color: "white", lineHeight: 0.9, letterSpacing: "-0.02em" }}>{totalSeances}</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: 8 }}>SEANCES COMPLETEES</div>
            {streak > 0 && (
              <div style={{ position: "absolute", top: 20, right: 20, background: "rgba(0,255,135,0.15)", border: "1px solid rgba(0,255,135,0.3)", borderRadius: 8, padding: "6px 12px", fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#00FF87", fontWeight: 700 }}>
                🔥 {streak} JOURS
              </div>
            )}
          </div>

          {/* 4 stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { val: streak, label: "STREAK ACTUEL", color: accentColor },
              { val: `${dureeAvg}m`, label: "DUREE MOY.", color: "#00FF87" },
              { val: topRecords[0] ? `${topRecords[0][1]}kg` : "—", label: `RECORD ${(topRecords[0]?.[0] || "").split(" ")[0].toUpperCase()}`, color: "#FFE500" },
              { val: seancesReelles.filter(s => s.feedback === "good" || s.feedback === "easy").length, label: "SEANCES REUSSIES", color: "#00C8FF" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 14px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: stat.color, lineHeight: 1, marginBottom: 6 }}>{stat.val}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Graphique séances par semaine — cliquable */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: DS.radius.xl, padding: "18px 16px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 14 }}>SEANCES SUR 8 SEMAINES · APPUIE POUR DETAIL</div>
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
                    {count > 0 && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: isLast ? accentColor : "rgba(255,255,255,0.3)" }}>{count}</div>}
                    <div style={{ width: "100%", height: h, background: isEmpty ? "rgba(255,255,255,0.04)" : isLast ? accentColor : `rgba(255,45,85,${0.2 + (count/maxSemaine)*0.6})`, borderRadius: "4px 4px 0 0", border: isEmpty ? "1px dashed rgba(255,255,255,0.08)" : "none", boxShadow: isLast && count > 0 ? `0 0 12px rgba(255,45,85,0.5)` : "none", transition: "opacity 0.2s" }} />
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: isLast ? accentColor : "rgba(255,255,255,0.2)" }}>S{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendrier du mois */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: DS.radius.xl, padding: "16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: "white", letterSpacing: "0.08em" }}>{now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}</div>
              {streak > 0 && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.1em" }}>🔥 {streak} JOURS</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
              {["L","M","M","J","V","S","D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "'Space Mono',monospace", fontSize: 7, color: "rgba(255,255,255,0.2)", paddingBottom: 4 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === now.getDate();
                const hasSeance = seanceDates.has(day);
                return (
                  <div key={day} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, background: hasSeance ? accentColor : isToday ? DS.colors.surfaceHigh : "transparent", border: isToday && !hasSeance ? `1px solid ${accentColor}` : "none", boxShadow: hasSeance ? `0 0 8px rgba(255,45,85,0.4)` : "none" }}>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: hasSeance ? "white" : isToday ? accentColor : "rgba(255,255,255,0.25)" }}>{day}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Records personnels */}
          {topRecords.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>RECORDS PERSONNELS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: DS.radius.xl, overflow: "hidden" }}>
                {topRecords.map(([nom, charge], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < topRecords.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: i === 0 ? "rgba(255,229,0,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "rgba(255,229,0,0.3)" : "rgba(255,255,255,0.06)"}`, flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </div>
                    <div style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{nom}</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: "#00FF87", fontWeight: 700 }}>{charge} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique séances récentes */}
          {seancesReelles.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>DERNIERES SEANCES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seancesReelles.slice(0, 6).map((sc, i) => (
                  <div key={i} onClick={() => setSelectedSeance(sc)} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: DS.radius.lg, padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.feedback ? feedbackColor(sc.feedback) + "15" : "rgba(255,255,255,0.05)", border: `1px solid ${sc.feedback ? feedbackColor(sc.feedback) + "30" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {feedbackEmoji(sc.feedback) || "🏋️"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontSize: 14, ...s.heading, marginBottom: 2 }}>{sc.titre}</p>
                      <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.08em" }}>
                        {new Date(sc.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()} · {sc.duree_min || 0}min
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: accentColor, fontWeight: 700 }}>{sc.exercices?.length || 0} EXO</p>
                      {sc.feedback && <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: feedbackColor(sc.feedback), marginTop: 2 }}>{feedbackLabel(sc.feedback).toUpperCase()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seancesReelles.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🏋️</p>
              <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: "white", letterSpacing: "0.08em", marginBottom: 8 }}>AUCUNE SEANCE ENCORE</p>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.1em" }}>Complete ta premiere seance pour voir ta progression ici.</p>
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
function ProfilScreen({ user, programme, sportActif: sportActifProp, appTheme, onThemeChange, onLogout, onRegenerateProgram }) {
  const [notifOn, setNotifOn] = useState(false);
  const [notifHeure, setNotifHeure] = useState("08:00");
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editData, setEditData] = useState({ sport: null, objectif: null, frequence: 3 });
  const [saving, setSaving] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [lastSessionStats, setLastSessionStats] = useState(null);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [streak, setStreak] = useState(0);

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";
  const progData = programme?.data_json;
  const semaineCourante = programme?.semaine_courante || 1;
  const totalSemaines = programme?.total_semaines || 8;
  const progression = Math.round((semaineCourante / totalSemaines) * 100);
  const sport = sportActifProp || progData?.sport || user?.user_metadata?.sport || "default";
  const objectif = progData?.objectif || "Non defini";
  const frequence = progData?.frequence || 3;
  const theme = getSportTheme(sport);

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
    });
  }, []);

  const openEdit = () => {
    setEditData({ sport, objectif: objectif !== "Non defini" ? objectif : null, frequence });
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
          const updatedJson = { ...(programme.data_json || {}), objectif: editData.objectif, frequence: editData.frequence };
          await supabase.from("programmes").update({ data_json: updatedJson }).eq("id", programme.id);
          if (onRegenerateProgram) await onRegenerateProgram(editData, false);
        }
      }
    } catch (err) { console.error(err); }
    setSaving(false);
    setShowEditDrawer(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100, position: "relative", overflow: "hidden" }}>

      {/* Sport bg */}
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      {/* Drawer edition */}
      {showEditDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowEditDrawer(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <p style={{ ...s.display, fontSize: 20, color: DS.colors.textPrimary }}>Modifier mon profil</p>
              <button onClick={() => setShowEditDrawer(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>Sport</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
              {SPORTS.map(sp => (
                <div key={sp.id} onClick={() => setEditData(d => ({ ...d, sport: sp.id, objectif: null }))} style={{ background: editData.sport === sp.id ? theme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${editData.sport === sp.id ? theme.accent : DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{sp.emoji}</div>
                  <div style={{ color: editData.sport === sp.id ? theme.accent : DS.colors.textSec, fontSize: 10, ...s.heading }}>{sp.label}</div>
                </div>
              ))}
            </div>
            {editData.sport && (
              <>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>Objectif</p>
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
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>Seances / semaine</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[2, 3, 4, 5].map(n => (
                <div key={n} onClick={() => setEditData(d => ({ ...d, frequence: n }))} style={{ flex: 1, padding: "14px 0", textAlign: "center", background: editData.frequence === n ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: editData.frequence === n ? "#000" : DS.colors.textSec, fontSize: 18, cursor: "pointer", ...s.display }}>{n}</div>
              ))}
            </div>
            <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,140,0,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ color: DS.colors.warning, fontSize: 12 }}>⚠️ Un nouveau programme IA sera genere.</p>
            </div>
            <button onClick={saveEdit} disabled={saving || !editData.sport || !editData.objectif} style={{ width: "100%", height: 52, background: editData.sport && editData.objectif ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: editData.sport && editData.objectif ? "#000" : DS.colors.textSec, fontSize: 15, cursor: "pointer", ...s.heading, fontWeight: 700, letterSpacing: "0.05em" }}>
              {saving ? (editData.sport !== sport || editData.objectif !== objectif ? "Generation en cours..." : "Sauvegarde...") : (editData.sport !== sport || editData.objectif !== objectif ? "Sauvegarder et regenerer ⚡" : "Sauvegarder les changements")}
            </button>
          </div>
        </div>
      )}

      {/* Header hero */}
      <div style={{ padding: "60px 24px 32px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, background: theme.accent + "20", border: `2px solid ${theme.accent}50`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, ...s.display, color: theme.accent, flexShrink: 0, boxShadow: `0 0 30px ${theme.accent}20` }}>
            {userName[0].toUpperCase()}
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{SPORT_EMOJIS[sport] || "⚡"}</span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>{sport !== "default" ? sport : "Sport"}</span>
            </div>
            <p style={{ ...s.display, fontSize: 24, color: "white", letterSpacing: "0.05em", lineHeight: 1, marginBottom: 4 }}>{userName.toUpperCase()}</p>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec }}>{user?.email}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px", position: "relative", zIndex: 1 }}>

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { val: seancesCount, label: "Seances", color: theme.accent },
            { val: streak, label: "Streak", color: DS.colors.success },
            { val: `${progression}%`, label: "Progres", color: DS.colors.warning },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: stat.color, lineHeight: 1, marginBottom: 4 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.1em", textTransform: "uppercase" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Programme actif */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: 20, marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Programme actif</p>
              <p style={{ color: "white", fontSize: 16, ...s.heading }}>{programme?.titre || "Aucun programme"}</p>
            </div>
            <div style={{ background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "4px 10px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: theme.accent }}>CYCLE {semaineCourante}</p>
            </div>
          </div>
          <ProgressBar value={progression} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec }}>{frequence}x / semaine</p>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent }}>CYCLE {semaineCourante} · {progression}%</p>
          </div>
        </div>

        {/* Modifier profil — 1 seul bouton clair */}
        <div onClick={openEdit} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✏️</div>
            <div>
              <p style={{ color: "white", fontSize: 15, ...s.heading, marginBottom: 2 }}>Modifier mon profil</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, fontFamily: "'Space Mono',monospace" }}>{sport !== "default" ? sport : "?"} · {objectif !== "Non defini" ? objectif : "?"} · {frequence}x/sem</p>
            </div>
          </div>
          <span style={{ color: theme.accent, fontSize: 18 }}>→</span>
        </div>

        {/* Notifications */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: notifOn ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, background: "rgba(255,229,0,0.1)", border: "1px solid rgba(255,229,0,0.2)", borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔔</div>
              <div>
                <p style={{ color: "white", fontSize: 15, ...s.heading, marginBottom: 2 }}>Rappels seance</p>
                <p style={{ color: DS.colors.textSec, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>{notifOn ? `TOUS LES JOURS A ${notifHeure}` : "DESACTIVE"}</p>
              </div>
            </div>
            <div onClick={() => {
              if (!notifOn) {
                if ("Notification" in window) {
                  Notification.requestPermission().then(p => { if (p === "granted") setNotifOn(true); });
                } else { setNotifOn(true); }
              } else { setNotifOn(false); }
            }} style={{ width: 50, height: 28, background: notifOn ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: notifOn ? 25 : 3, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
          {notifOn && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 14px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.1em", flex: 1 }}>HEURE DU RAPPEL</p>
              <input type="time" value={notifHeure} onChange={e => setNotifHeure(e.target.value)}
                style={{ background: "transparent", border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: "6px 10px", color: theme.accent, fontFamily: "'Space Mono',monospace", fontSize: 14, outline: "none", colorScheme: "dark", cursor: "pointer" }} />
            </div>
          )}
        </div>

        {/* Theme */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{DS.colors.isDark ? "🌙" : "☀️"}</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Apparence</p>
              <p style={{ color: DS.colors.textSec, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>{DS.colors.isDark ? "THEME SOMBRE" : "THEME LUMINEUX"}</p>
            </div>
          </div>
          <div onClick={() => { const next = DS.colors.isDark ? "light" : "dark"; DS.colors = THEMES[next]; DS.shadow = THEMES[next].shadow; localStorage.setItem("voltra_theme", next); onThemeChange && onThemeChange(next); }} style={{ width: 50, height: 28, background: DS.colors.isDark ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s", border: `1px solid ${DS.colors.border}` }}>
            <div style={{ position: "absolute", top: 3, left: DS.colors.isDark ? 25 : 3, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              {DS.colors.isDark ? "🌙" : "☀️"}
            </div>
          </div>
        </div>

        {/* Deconnexion */}
        <div onClick={onLogout} style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: DS.radius.xl, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚪</div>
          <p style={{ color: "#FF2D55", fontSize: 15, ...s.heading }}>Se deconnecter</p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME PREVIEW — avant inscription
// ─────────────────────────────────────────────
function ProgrammePreview({ programme, sport, onboardingData, onContinue }) {
  const theme = getSportTheme(sport);
  const progData = programme?.data_json;
  const seance = progData?.semaines?.[0]?.seances?.[0];
  const exercices = seance?.exercices || [];
  const frequence = onboardingData?.frequence || 3;

  const [timeLeft, setTimeLeft] = useState({ m: 59, s: 59 });
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) return { m: 0, s: 0 };
        return { m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
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
  const [inscrits] = useState(() => Math.floor(Math.random() * 80 + 250));

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0E100F 0%, #06060E 100%)", overflowY: "auto", paddingBottom: 48, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none", opacity: 0.4 }} />

      <div style={{ padding: "48px 22px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Bandeau urgence */}
        <div style={{ background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.35)", borderRadius: DS.radius.lg, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: "#FF2D55", marginBottom: 2 }}>🔥 -30% sur le premier mois</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>Offre valable uniquement dans ce delai</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <div style={{ background: "#FF2D55", borderRadius: 6, padding: "5px 9px", textAlign: "center" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 17, color: "white", fontWeight: 700, lineHeight: 1 }}>{pad(timeLeft.m)}</p>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>MIN</p>
            </div>
            <p style={{ color: "#FF2D55", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>:</p>
            <div style={{ background: "#FF2D55", borderRadius: 6, padding: "5px 9px", textAlign: "center" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 17, color: "white", fontWeight: 700, lineHeight: 1 }}>{pad(timeLeft.s)}</p>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>SEC</p>
            </div>
          </div>
        </div>

        {/* Header programme */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.accent + "18", border: `1px solid ${theme.accent}35`, borderRadius: 20, padding: "4px 12px", marginBottom: 12 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: theme.accent, animation: "pulse 1.5s infinite" }} />
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 11, color: theme.accent, letterSpacing: "0.05em" }}>Ton programme est prêt</span>
          </div>
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 36, color: "white", lineHeight: 1, marginBottom: 8, letterSpacing: "0.02em" }}>
            {nomProg.toUpperCase()}
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "0.02em" }}>
            {frequence}x par semaine · Progression continue · IA
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { val: exercices.length || "5+", label: "Exos / séance", color: theme.accent },
            { val: frequence * 8, label: "Séances", color: "#00FF87" },
            { val: "∞", label: "Progression", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "14px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 5 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Aperçu séance */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.accent}20`, borderRadius: DS.radius.xl, overflow: "hidden", marginBottom: 16, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: "white" }}>Aperçu — Séance 1</p>
            <div style={{ background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: DS.radius.full, padding: "3px 10px" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, color: "#FF2D55" }}>🔒 Accès restreint</p>
            </div>
          </div>
          <div style={{ padding: "8px 16px 14px" }}>
            {exercices.slice(0, 2).map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: theme.accent + "15", border: `1px solid ${theme.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: theme.accent, fontWeight: 700 }}>{i + 1}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 14, color: "white", marginBottom: 2 }}>{ex.nom}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{(ex.muscles || "").split(" ")[0]}</p>
                </div>
                <p style={{ fontFamily: "'Space Mono',monospace", color: theme.accent, fontSize: 12, fontWeight: 700 }}>{ex.sets}×{ex.reps}</p>
              </div>
            ))}
            {(exercices.length > 2 || exercices.length === 0) && (
              <div style={{ position: "relative", marginTop: 4 }}>
                {[...Array(Math.max(exercices.length - 2, 3))].map((_, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 12, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: "65%", marginBottom: 4 }} />
                      <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, width: "40%" }} />
                    </div>
                    <div style={{ width: 36, height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} />
                  </div>
                ))}
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(6,6,14,0.65)", backdropFilter: "blur(2px)", borderRadius: DS.radius.md }}>
                  <span style={{ fontSize: 22, marginBottom: 6 }}>🔒</span>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                    {Math.max(exercices.length - 2, 3)} exercices bloqués
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Social proof */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: DS.radius.lg, padding: "11px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex" }}>
            {["🏀","⚽","🥊","🏊"].map((e, i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginLeft: i > 0 ? -7 : 0 }}>{e}</div>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", flex: 1 }}>
            <span style={{ color: "white", fontWeight: 700 }}>{inscrits} athlètes</span> ont rejoint Voltra cette semaine
          </p>
        </div>

        {/* Bloc réduction */}
        <div style={{ background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent}04)`, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: "16px 18px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: "white" }}>Offre de bienvenue</p>
            <div style={{ background: theme.accent, borderRadius: DS.radius.full, padding: "3px 12px" }}>
              <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#000", fontWeight: 700 }}>-30%</p>
            </div>
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            Inscris-toi maintenant et obtiens <span style={{ color: "white", fontWeight: 600 }}>-30% sur ton premier mois</span>. Offre valable uniquement pendant le compte à rebours.
          </p>
        </div>

        {/* CTA */}
        <button onClick={onContinue} style={{ width: "100%", height: 58, background: theme.accent, border: "none", borderRadius: DS.radius.full, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.02em", cursor: "pointer", marginBottom: 12, boxShadow: `0 8px 32px ${theme.accent}45` }}>
          Sauvegarder mon programme →
        </button>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
          Inscription gratuite · 30 secondes · Sans carte bancaire
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// POST SESSION UPSELL
// ─────────────────────────────────────────────
function PostSessionUpsell({ stats, programme, sportActif, onSelectPlan }) {
  const [selected, setSelected] = useState("annual");
  const theme = getSportTheme(sportActif);
  const currentPlan = PLANS.find(p => p.id === selected);
  const totalSemaines = programme?.total_semaines || 8;
  const semaineCourante = programme?.semaine_courante || 1;

  const feedbackMsg = stats?.feedback === "easy" ? "Tu as gere facilement —" :
    stats?.feedback === "good" ? "Seance parfaite —" : "Tu t'es vraiment donne —";

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, overflowY: "auto", paddingBottom: 40, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sportActif] || "⚡"}
      </div>

      <div style={{ padding: "60px 20px 0", maxWidth: 430, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header celebratoire */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: theme.accent + "20", border: `2px solid ${theme.accent}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px", boxShadow: `0 0 60px ${theme.accent}30`, animation: "celebrate 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
            🏆
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: theme.accent, letterSpacing: "0.3em", marginBottom: 10 }}>SEANCE TERMINEE</div>
          <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 32, color: "white", lineHeight: 1, marginBottom: 8, letterSpacing: "0.02em" }}>
            {feedbackMsg}<br />tu progresses !
          </h1>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.12em" }}>{stats?.titre?.toUpperCase()}</p>
        </div>

        {/* Stats personnalisées de la séance */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {[
            { val: stats?.exercices || 0, label: "EXERCICES", color: theme.accent },
            { val: `${stats?.duree || 0}min`, label: "DUREE", color: "#00FF87" },
            { val: stats?.totalKg > 0 ? `${stats.totalKg}kg` : "💪", label: stats?.totalKg > 0 ? "SOULEVE" : "EFFORT", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, background: DS.colors.surface, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: DS.colors.textSec, letterSpacing: "0.1em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Message accrocheur */}
        <div style={{ background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent}04)`, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: theme.accent }} />
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 18, color: "white", marginBottom: 6 }}>
            Ta progression vient de commencer.
          </p>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em" }}>
            Tu viens de terminer ta premiere seance. La vraie transformation commence maintenant — chaque semaine ton programme s'adapte et devient plus intense.
          </p>
        </div>

        {/* Ce qu'il rate */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: DS.colors.textSec, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>CE QUE TU DEBLOQUES</p>
          {[
            { emoji: "📈", title: "Progression automatique", desc: "Tes charges augmentent intelligemment chaque semaine" },
            { emoji: "🤖", title: "Coach IA illimite", desc: "Adaptation en temps reel pendant chaque seance" },
            { emoji: "🏆", title: "Suivi des records", desc: "Visualise tes progres et bats tes records" },
            { emoji: "⚡", title: "Progression sans fin", desc: "Nouveau programme genere automatiquement a chaque cycle" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < 3 ? `1px solid ${DS.colors.border}` : "none" }}>
              <div style={{ width: 36, height: 36, background: theme.accent + "12", border: `1px solid ${theme.accent}20`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{f.emoji}</div>
              <div>
                <p style={{ color: "white", fontSize: 14, ...s.heading, marginBottom: 2 }}>{f.title}</p>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PLANS.map(plan => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{ position: "relative", background: selected === plan.id ? plan.colorSoft : DS.colors.surface, border: `1.5px solid ${selected === plan.id ? plan.colorBorder : DS.colors.border}`, borderRadius: DS.radius.xl, padding: "16px 20px", cursor: "pointer", transition: "all 0.2s" }}>
              {selected === plan.id && <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 2, background: plan.color, borderRadius: DS.radius.full }} />}
              {plan.badge && <div style={{ display: "inline-flex", padding: "2px 8px", background: plan.colorSoft, border: `1px solid ${plan.colorBorder}`, borderRadius: DS.radius.full, color: plan.color, fontSize: 10, ...s.heading, marginBottom: 8 }}>{plan.badge}</div>}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 12, marginBottom: 4 }}>{plan.label}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 28, color: selected === plan.id ? plan.color : DS.colors.textPrimary }}>{plan.price}€</span>
                    <span style={{ color: DS.colors.textSec, fontSize: 13 }}>{plan.unit}</span>
                  </div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: DS.radius.full, border: `2px solid ${selected === plan.id ? plan.color : DS.colors.textDim}`, background: selected === plan.id ? plan.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  {selected === plan.id && <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: "white" }} />}
                </div>
              </div>
              {plan.savings && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ padding: "2px 8px", background: plan.colorSoft, borderRadius: DS.radius.full, color: plan.color, fontSize: 10, ...s.heading }}>{plan.savings}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={() => onSelectPlan(selected)} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", marginBottom: 12, boxShadow: `0 8px 32px ${theme.accent}40` }}>
          CONTINUER MA PROGRESSION →
        </button>
        <p style={{ color: DS.colors.textDim, fontSize: 11, textAlign: "center", marginBottom: 16, fontFamily: "'Space Mono',monospace", letterSpacing: "0.06em" }}>Paiement securise · Annulation en 1 clic</p>
        <button onClick={() => onSelectPlan("free")} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textDim, fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono',monospace", letterSpacing: "0.1em" }}>
          ABANDONNER MA PROGRESSION
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
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: DS.colors.navBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${DS.colors.border}`, padding: "10px 0 28px", display: "flex", width: "100%", maxWidth: 430, boxShadow: DS.colors.isDark ? "none" : "0 -4px 20px rgba(0,0,0,0.06)" }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setTab(tab.id)} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", padding: "4px 0", transition: "transform 0.15s ease", transform: isActive ? "scale(1.05)" : "scale(1)" }}>
            {tab.icon(isActive)}
            <span style={{ color: isActive ? DS.colors.primaryDark : DS.colors.textSec, fontSize: 10, fontFamily: "'Inter',sans-serif", fontWeight: isActive ? 700 : 500, letterSpacing: "0.02em", transition: "color 0.2s ease" }}>{tab.label}</span>
            {isActive && <div style={{ width: 20, height: 3, borderRadius: DS.radius.full, background: DS.colors.primary, marginTop: -2 }} />}
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
  const [programmeActif, setProgrammeActif] = useState(null);
  const [sportActif, setSportActif] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [matchs, setMatchs] = useState([]);
  const [showMatchs, setShowMatchs] = useState(false);
  const [derniereSeance, setDerniereSeance] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [lastSessionStats, setLastSessionStats] = useState(null);
  const [cycleComplete, setCycleComplete] = useState(false);

  useEffect(() => {
    applyTheme(appTheme);
    document.body.style.background = DS.colors.bg;
    document.body.style.color = DS.colors.textPrimary;
  }, [appTheme]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter', system-ui, sans-serif; }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fillCircle { from { stroke-dashoffset: 276; } to { stroke-dashoffset: 0; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes splashPulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(0,255,135,0.5)); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 40px rgba(0,255,135,0.8)); } }
      @keyframes celebrate { 0% { transform: scale(0) rotate(-10deg); opacity: 0; } 50% { transform: scale(1.2) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
      @keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-60px); opacity: 0; } }
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
        const fromEmail = window.location.hash.includes("access_token") || window.location.search.includes("confirmed=true");
        if (fromEmail) {
          window.history.replaceState({}, document.title, window.location.pathname);
          // Si on a des données onboarding, générer le programme maintenant qu'on est connecté
          if (onboardingData) {
            setScreen("pricing");
            setProgrammeLoading(true);
            generateProgramIA(onboardingData).then(prog => {
              if (prog) setProgrammeActif(prog);
              setProgrammeLoading(false);
            }).catch(() => setProgrammeLoading(false));
          } else {
            setScreen("app");
          }
        } else if (splashDone) {
          setScreen("app");
        }
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
      .select("sport, is_pro")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.sport) setSportActif(data.sport);
        if (data?.is_pro) setIsPro(true);
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
  if (screen === "cycle-complete") return <CycleCompleteScreen
    programme={programmeActif}
    sport={sportActif}
    cycleLoading={cycleComplete}
    onContinue={() => setScreen("app")}
  />;
  if (screen === "preview") return <ProgrammePreview
    programme={programmeActif}
    sport={sportActif}
    onboardingData={onboardingData}
    onContinue={() => setScreen("auth")}
  />;
  if (screen === "auth") return <AuthScreen onAuth={async (u) => {
    setUser(u);
    userRef.current = u;
    // Sauvegarder le sport dans le profil
    if (onboardingData?.sport) {
      await supabase.from("profiles").upsert({ id: u.id, sport: onboardingData.sport }, { onConflict: "id" });
    }
    if (onboardingData) {
      // Toujours regenerer apres auth — maintenant on a une session valide
      setScreen("pricing");
      setProgrammeLoading(true);
      generateProgramIA(onboardingData).then(prog => {
        if (prog) setProgrammeActif(prog);
        setProgrammeLoading(false);
      }).catch(() => setProgrammeLoading(false));
    } else {
      setScreen("app");
    }
  }} />;
  if (screen === "onboarding") return <OnboardingScreen onComplete={(data, programme) => {
    if (programme) setProgrammeActif(programme);
    setSportActif(data.sport);
    setOnboardingData(data);
    if (user) {
      setScreen("pricing");
    } else {
      setScreen("preview");
    }
  }} />;
  if (screen === "post-session-upsell") return <PostSessionUpsell
    stats={lastSessionStats}
    programme={programmeActif}
    sportActif={sportActif}
    onSelectPlan={async (plan) => {
      if (plan !== "free") {
        setIsPro(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.from("profiles").upsert({ id: session.user.id, is_pro: true }, { onConflict: "id" });
      }
      setScreen("app");
    }}
  />;
if (screen === "pricing") return <PricingScreen programme={programmeActif} frequence={onboardingData?.frequence} onSelectPlan={async (plan) => {
    if (plan !== "free") {
      setIsPro(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("profiles").upsert({ id: session.user.id, is_pro: true }, { onConflict: "id" });
    }
    setScreen("app");
  }} />;

  return (
    <div key={`${appTheme}-${screen}`} style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100vh" }}>

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
          sport={sportActif}
          onBack={() => setSeanceActive(null)}
          onFinish={async (feedback, completedSetsData, exercices, durationMin) => {
            try {
              if (programmeActif?.id && feedback) {
                await saveCompleteSession(programmeActif.id, seanceActive, completedSetsData, feedback, durationMin);
                const { data } = await supabase.from("programmes").select("*").eq("id", programmeActif.id).single();
                if (data) setProgrammeActif(data);
              }
              // Verifier si le cycle est termine
              const updatedProg = await supabase.from("programmes").select("*").eq("id", programmeActif?.id).single();
              const prog = updatedProg.data;
              if (prog && prog.semaine_courante >= prog.total_semaines) {
                // Cycle termine → generer nouveau programme plus intense
                setCycleComplete(true);
                setScreen("cycle-complete");
                const newData = {
                  sport: sportActif,
                  objectif: prog.data_json?.objectif,
                  niveau: "avance",
                  frequence: prog.data_json?.frequence || 3,
                  cycle: (prog.data_json?.cycle || 1) + 1,
                };
                generateProgramIA(newData).then(async newProg => {
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

              // Si gratuit et premiere seance terminee → paywall personnalise
              if (!isPro) {
                const totalKg = (seanceActive?.exercices || []).reduce((acc, ex) => {
                  return acc + (ex.chargeKg || 0) * (ex.sets || 3) * (parseInt(ex.reps) || 8);
                }, 0);
                setLastSessionStats({
                  titre: seanceActive?.titre || "Seance",
                  exercices: seanceActive?.exercices?.length || 0,
                  duree: durationMin,
                  totalKg: Math.round(totalKg),
                  feedback,
                });
                setScreen("post-session-upsell");
                return;
              }
            } catch (err) {
              console.error("onFinish error:", err);
            } finally {
              setSeancesCount(prev => prev + 1);
              setSeanceActive(null);
              setActiveTab("dashboard");
              setScreen("app");
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
              onStartSession={() => {

                const prog = programmeActif?.data_json;
                const seance = prog?.semaines?.[0]?.seances?.[0] || MOCK_PROGRAM.seancesDuJour[0];
                setSeanceActive(seance);
              }}
            />
          )}
          {activeTab === "historique" && <HistoriqueScreen />}
          {activeTab === "profil" && <ProfilScreen user={user} programme={programmeActif} sportActif={sportActif} appTheme={appTheme} onThemeChange={setAppTheme} onLogout={handleLogout} onRegenerateProgram={async (data, shouldRegen = true) => {
            try {
              if (shouldRegen) {
                const prog = await generateProgramIA(data);
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
