import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// DESIGN SYSTEM — tokens centralisés
// ─────────────────────────────────────────────
const DS = {
  colors: {
    bg:           "#0A0A0F",
    surface:      "#13131A",
    surfaceUp:    "#1C1C26",
    surfaceHigh:  "#242433",
    primary:      "#6C63FF",
    primaryGlow:  "rgba(108,99,255,0.18)",
    primarySoft:  "rgba(108,99,255,0.10)",
    success:      "#00E5A0",
    successSoft:  "rgba(0,229,160,0.12)",
    warning:      "#FF6B35",
    warningSoft:  "rgba(255,107,53,0.12)",
    textPrimary:  "#F0F0F8",
    textSec:      "#7A7A9A",
    textDim:      "#3A3A50",
    border:       "rgba(255,255,255,0.06)",
    borderAccent: "rgba(108,99,255,0.35)",
  },
  radius: { sm: 10, md: 16, lg: 20, xl: 28, full: 999 },
  shadow: {
    primary: "0 8px 32px rgba(108,99,255,0.3)",
    card:    "0 4px 24px rgba(0,0,0,0.4)",
    glow:    "0 0 40px rgba(108,99,255,0.15)",
  },
};

// ─────────────────────────────────────────────
// STYLES UTILITAIRES
// ─────────────────────────────────────────────
const s = {
  mono: { fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
  display: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.03em" },
  heading: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600 },
  body: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400 },
};

// ─────────────────────────────────────────────
// COMPOSANTS UI RÉUTILISABLES
// ─────────────────────────────────────────────

// Bouton principal violet
function PrimaryButton({ children, onClick, disabled, style = {} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: "100%",
        height: 56,
        background: disabled
          ? DS.colors.surfaceHigh
          : `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
        border: `1px solid rgba(255,255,255,0.12)`,
        borderRadius: DS.radius.md,
        color: disabled ? DS.colors.textDim : DS.colors.textPrimary,
        fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "all 0.15s ease",
        boxShadow: disabled ? "none" : DS.shadow.primary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        ...s.heading,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Bouton secondaire (outline)
function SecondaryButton({ children, onClick, style = {} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        width: "100%",
        height: 48,
        background: "transparent",
        border: `1px solid ${DS.colors.border}`,
        borderRadius: DS.radius.md,
        color: DS.colors.textSec,
        fontSize: 15,
        cursor: "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "all 0.15s ease",
        ...s.heading,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Card de base
function Card({ children, style = {}, onClick, glow = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: DS.colors.surface,
        border: `1px solid ${hovered && onClick ? DS.colors.borderAccent : DS.colors.border}`,
        borderRadius: DS.radius.lg,
        padding: 20,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        boxShadow: glow && hovered ? DS.shadow.glow : DS.shadow.card,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Badge pill
function Badge({ children, color = "primary", style = {} }) {
  const colors = {
    primary: { bg: DS.colors.primarySoft, text: DS.colors.primary, border: DS.colors.borderAccent },
    success: { bg: DS.colors.successSoft, text: DS.colors.success, border: "rgba(0,229,160,0.25)" },
    warning: { bg: DS.colors.warningSoft, text: DS.colors.warning, border: "rgba(255,107,53,0.25)" },
  };
  const c = colors[color];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 12px",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: DS.radius.full,
      color: c.text, fontSize: 12,
      ...s.heading,
      ...style,
    }}>
      {children}
    </span>
  );
}

// Progress bar animée
function ProgressBar({ value, style = {} }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 100);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{
      height: 4, background: DS.colors.surfaceHigh,
      borderRadius: DS.radius.full, overflow: "hidden",
      ...style,
    }}>
      <div style={{
        height: "100%", width: `${width}%`,
        background: `linear-gradient(90deg, ${DS.colors.primary}, ${DS.colors.success})`,
        borderRadius: DS.radius.full,
        transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: `0 0 8px ${DS.colors.primary}`,
      }} />
    </div>
  );
}

// Icônes SVG inline
const Icons = {
  home: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
        stroke={active ? DS.colors.primary : DS.colors.textDim}
        strokeWidth="2" strokeLinejoin="round"
        fill={active ? DS.colors.primarySoft : "none"} />
    </svg>
  ),
  chart: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 20H21M5 20V12M9 20V8M13 20V14M17 20V4"
        stroke={active ? DS.colors.primary : DS.colors.textDim}
        strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  user: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4"
        stroke={active ? DS.colors.primary : DS.colors.textDim} strokeWidth="2" />
      <path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20"
        stroke={active ? DS.colors.primary : DS.colors.textDim}
        strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  bolt: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={DS.colors.primary}>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
  ),
  check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 13L9 17L19 7" stroke={DS.colors.success} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  arrow: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 18L15 12L9 6" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={DS.colors.textSec} strokeWidth="2" />
      <path d="M12 7V12L15 15" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  fire: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={DS.colors.warning}>
      <path d="M12 2C12 2 8 7 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9 14 6 12 2Z
               M6 18C6 20.21 8.69 22 12 22C15.31 22 18 20.21 18 18C18 16.5 17 15 16 14
               C15.5 15.5 14 17 12 17C10 17 8.5 15.5 8 14C7 15 6 16.5 6 18Z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────
// DONNÉES MOCK (simulées pour le MVP)
// ─────────────────────────────────────────────
const MOCK_USER = {
  name: "Alex",
  sport: "basketball",
  objectif: "explosivité",
  niveau: "intermédiaire",
  frequence: 3,
};

const MOCK_PROGRAM = {
  titre: "Explosivité Basketball",
  semaineCourante: 3,
  totalSemaines: 8,
  progression: 62,
  seancesDuJour: [
    {
      id: "s3_j1",
      titre: "Force & Explosivité",
      type: "force_basse",
      statut: "a_faire",
      dureeMin: 48,
      exercices: [
        { id: "e1", nom: "Squat barre", muscles: "Quadriceps · Fessiers", sets: 4, reps: "6–8", chargeKg: 75 },
        { id: "e2", nom: "Romanian Deadlift", muscles: "Ischio · Lombaires", sets: 3, reps: "10", chargeKg: 60 },
        { id: "e3", nom: "Box Jump", muscles: "Quadriceps · Mollets", sets: 5, reps: "5", chargeKg: 0 },
        { id: "e4", nom: "Hip Thrust", muscles: "Fessiers", sets: 3, reps: "12", chargeKg: 70 },
        { id: "e5", nom: "Kettlebell Swing", muscles: "Fessiers · Dorsaux", sets: 4, reps: "12", chargeKg: 20 },
      ],
    },
  ],
  derniereSeance: {
    titre: "Haut du Corps",
    joursPassés: 2,
    statut: "faite",
    dureeMin: 42,
    nbExercices: 5,
    gainKg: 2.5,
  },
};

const SPORTS = [
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "rugby", label: "Rugby", emoji: "🏉" },
  { id: "natation", label: "Natation", emoji: "🏊" },
  { id: "sprint", label: "Sprint", emoji: "🏃" },
];

const OBJECTIFS = [
  { id: "explosivite", label: "Explosivité", desc: "Puissance & vitesse", emoji: "⚡" },
  { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
  { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
  { id: "detente", label: "Détente verticale", desc: "Jump & réactivité", emoji: "🚀" },
];

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé"];

// ─────────────────────────────────────────────
// ÉCRAN 1 — ONBOARDING
// ─────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0); // 0: sport, 1: objectif, 2: niveau+fréquence
  const [data, setData] = useState({ sport: null, objectif: null, niveau: null, frequence: 3 });
  const [loading, setLoading] = useState(false);
  const [animIn, setAnimIn] = useState(true);

  const steps = ["Sport", "Objectif", "Configuration"];

  const goNext = () => {
    setAnimIn(false);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimIn(true);
    }, 200);
  };

  const handleFinish = async () => {
    setLoading(true);
    // Simule génération IA (1.5s)
    setTimeout(() => {
      onComplete({ ...data, name: "Alex" });
    }, 1800);
  };

  const canNext = [
    data.sport !== null,
    data.objectif !== null,
    data.niveau !== null,
  ][step];

  return (
    <div style={{
      minHeight: "100vh",
      background: DS.colors.bg,
      display: "flex", flexDirection: "column",
      padding: "0 20px",
    }}>
      {/* Header */}
      <div style={{ paddingTop: 60, paddingBottom: 32 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3,
              borderRadius: DS.radius.full,
              background: i <= step ? DS.colors.primary : DS.colors.surfaceHigh,
              transition: "background 0.4s ease",
              boxShadow: i === step ? `0 0 8px ${DS.colors.primary}` : "none",
            }} />
          ))}
        </div>

        <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading, marginBottom: 8 }}>
          Étape {step + 1} sur 3
        </p>
      </div>

      {/* Content animé */}
      <div style={{
        flex: 1,
        opacity: animIn ? 1 : 0,
        transform: animIn ? "translateY(0)" : "translateY(12px)",
        transition: "all 0.25s ease",
      }}>
        {step === 0 && (
          <StepSport data={data} setData={setData} />
        )}
        {step === 1 && (
          <StepObjectif data={data} setData={setData} />
        )}
        {step === 2 && (
          <StepConfig data={data} setData={setData} />
        )}
      </div>

      {/* CTA */}
      <div style={{ paddingBottom: 48, paddingTop: 24 }}>
        {loading ? (
          <GeneratingLoader />
        ) : (
          <>
            <PrimaryButton
              onClick={step < 2 ? goNext : handleFinish}
              disabled={!canNext}
            >
              {step < 2 ? "Continuer →" : "✦ Générer mon programme"}
            </PrimaryButton>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                width: "100%", marginTop: 12, background: "none", border: "none",
                color: DS.colors.textSec, fontSize: 14, cursor: "pointer",
                ...s.body,
              }}>
                ← Retour
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepSport({ data, setData }) {
  return (
    <div>
      <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8, lineHeight: 1.2 }}>
        Quel est<br />ton sport ?
      </h1>
      <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>
        Le programme sera adapté à tes besoins athlétiques.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {SPORTS.map(sport => (
          <SportCard
            key={sport.id}
            sport={sport}
            selected={data.sport === sport.id}
            onSelect={() => setData(d => ({ ...d, sport: sport.id }))}
          />
        ))}
      </div>
    </div>
  );
}

function SportCard({ sport, selected, onSelect }) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? DS.colors.primarySoft : DS.colors.surface,
        border: `1px solid ${selected ? DS.colors.primary : DS.colors.border}`,
        borderRadius: DS.radius.md,
        padding: "16px 8px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: selected ? "scale(1.02)" : "scale(1)",
        boxShadow: selected ? DS.shadow.glow : "none",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{sport.emoji}</div>
      <div style={{
        color: selected ? DS.colors.primary : DS.colors.textPrimary,
        fontSize: 13,
        ...s.heading,
      }}>
        {sport.label}
      </div>
    </div>
  );
}

function StepObjectif({ data, setData }) {
  return (
    <div>
      <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8, lineHeight: 1.2 }}>
        Quel est<br />ton objectif ?
      </h1>
      <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>
        On adaptera les exercices, charges et filières.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {OBJECTIFS.map(obj => (
          <div
            key={obj.id}
            onClick={() => setData(d => ({ ...d, objectif: obj.id }))}
            style={{
              background: data.objectif === obj.id ? DS.colors.primarySoft : DS.colors.surface,
              border: `1px solid ${data.objectif === obj.id ? DS.colors.primary : DS.colors.border}`,
              borderRadius: DS.radius.lg,
              padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: data.objectif === obj.id ? DS.shadow.glow : "none",
            }}
          >
            <span style={{ fontSize: 26 }}>{obj.emoji}</span>
            <div>
              <div style={{
                color: data.objectif === obj.id ? DS.colors.primary : DS.colors.textPrimary,
                fontSize: 16, ...s.heading, marginBottom: 2,
              }}>
                {obj.label}
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>
                {obj.desc}
              </div>
            </div>
            {data.objectif === obj.id && (
              <div style={{ marginLeft: "auto" }}>
                <div style={{
                  width: 20, height: 20,
                  background: DS.colors.primary,
                  borderRadius: DS.radius.full,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepConfig({ data, setData }) {
  return (
    <div>
      <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8, lineHeight: 1.2 }}>
        Derniers<br />réglages
      </h1>
      <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 36 }}>
        Le programme se calibre sur ton profil.
      </p>

      {/* Niveau */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Niveau actuel
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {NIVEAUX.map(n => (
            <div
              key={n}
              onClick={() => setData(d => ({ ...d, niveau: n.toLowerCase() }))}
              style={{
                flex: 1, padding: "12px 0", textAlign: "center",
                background: data.niveau === n.toLowerCase() ? DS.colors.primarySoft : DS.colors.surface,
                border: `1px solid ${data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.border}`,
                borderRadius: DS.radius.md,
                color: data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.textSec,
                fontSize: 14, cursor: "pointer",
                transition: "all 0.2s ease",
                ...s.heading,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* Fréquence */}
      <div>
        <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Séances par semaine
        </p>
        <div style={{
          background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.lg, padding: 20,
        }}>
          <div style={{
            ...s.display, fontSize: 48, color: DS.colors.primary,
            textAlign: "center", marginBottom: 16,
          }}>
            {data.frequence}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[2, 3, 4, 5].map(n => (
              <div
                key={n}
                onClick={() => setData(d => ({ ...d, frequence: n }))}
                style={{
                  flex: 1, padding: "10px 0", textAlign: "center",
                  background: data.frequence === n ? DS.colors.primary : DS.colors.surfaceHigh,
                  borderRadius: DS.radius.md,
                  color: data.frequence === n ? "white" : DS.colors.textSec,
                  fontSize: 16, cursor: "pointer",
                  transition: "all 0.2s ease",
                  ...s.heading,
                  boxShadow: data.frequence === n ? DS.shadow.primary : "none",
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, textAlign: "center", marginTop: 12, ...s.body }}>
            jours / semaine
          </p>
        </div>
      </div>
    </div>
  );
}

function GeneratingLoader() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`,
      borderRadius: DS.radius.md, padding: "20px 24px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 36, height: 36,
        background: DS.colors.primary, borderRadius: DS.radius.full,
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulse 1s infinite",
        flexShrink: 0,
      }}>
        ✦
      </div>
      <div>
        <p style={{ color: DS.colors.primary, fontSize: 15, ...s.heading, marginBottom: 2 }}>
          Génération du programme{".".repeat(dots)}
        </p>
        <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>
          L'IA calibre ton programme 8 semaines
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN 2 — DASHBOARD
// ─────────────────────────────────────────────
function DashboardScreen({ user, onStartSession }) {
  const prog = MOCK_PROGRAM;
  const seance = prog.seancesDuJour[0];

  return (
    <div style={{
      minHeight: "100vh",
      background: DS.colors.bg,
      paddingBottom: 100,
    }}>
      {/* Header sticky */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DS.colors.border}`,
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>Bonjour,</p>
          <p style={{ color: DS.colors.textPrimary, fontSize: 18, ...s.heading }}>
            {user.name} 👋
          </p>
        </div>
        <div style={{
          width: 42, height: 42,
          background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
          borderRadius: DS.radius.full,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 16, ...s.display,
          boxShadow: DS.shadow.primary,
        }}>
          {user.name[0]}
        </div>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        {/* Hero block */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, marginBottom: 6 }}>
            Semaine {prog.semaineCourante} · Séance {seance.id.split("_")[1].replace("j", "")}
          </p>
          <h1 style={{
            ...s.display, fontSize: 36,
            color: DS.colors.textPrimary,
            lineHeight: 1.15, marginBottom: 16,
          }}>
            {seance.titre}
          </h1>
          <div style={{ marginBottom: 8 }}>
            <ProgressBar value={prog.progression} />
          </div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>
            Programme {prog.titre} · {prog.progression}% complété
          </p>
        </div>

        {/* Carte séance du jour */}
        <Card style={{ marginBottom: 24, overflow: "hidden", position: "relative" }} glow>
          {/* Gradient top border */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${DS.colors.primary}, ${DS.colors.success})`,
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Badge color="primary">⚡ Aujourd'hui</Badge>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: DS.colors.textSec, fontSize: 13, ...s.body }}>
              {Icons.clock()} {seance.dureeMin} min
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 24, color: DS.colors.textPrimary, fontWeight: 700 }}>
                {seance.exercices.length}
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>exercices</div>
            </div>
            <div style={{ width: 1, background: DS.colors.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 24, color: DS.colors.success, fontWeight: 700 }}>
                +2.5
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>kg vs S{prog.semaineCourante - 1}</div>
            </div>
            <div style={{ width: 1, background: DS.colors.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 24, color: DS.colors.warning, fontWeight: 700 }}>
                Bas
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>du corps</div>
            </div>
          </div>

          <PrimaryButton onClick={onStartSession}>
            ◉ Démarrer la séance
          </PrimaryButton>
        </Card>

        {/* Aperçu exercices — scroll horizontal */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>Au programme</p>
            <button style={{ background: "none", border: "none", color: DS.colors.primary, fontSize: 13, cursor: "pointer", ...s.heading }}>
              Tout voir
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {seance.exercices.map((ex, i) => (
              <ExercicePreviewCard key={ex.id} ex={ex} index={i} />
            ))}
          </div>
        </div>

        {/* Dernière séance */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 14 }}>
            Dernière séance
          </p>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 4 }}>
                  Il y a {prog.derniereSeance.joursPassés} jours
                </p>
                <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>
                  {prog.derniereSeance.titre}
                </p>
              </div>
              <Badge color="success">✓ Faite</Badge>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                `${prog.derniereSeance.nbExercices} exercices`,
                `${prog.derniereSeance.dureeMin} min`,
                `+${prog.derniereSeance.gainKg} kg`,
              ].map((stat, i) => (
                <div key={i} style={{
                  flex: 1, padding: "8px 4px", textAlign: "center",
                  background: DS.colors.surfaceHigh, borderRadius: DS.radius.sm,
                  color: DS.colors.textSec, fontSize: 12, ...s.body,
                }}>
                  {stat}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExercicePreviewCard({ ex, index }) {
  const [hovered, setHovered] = useState(false);
  const colors = ["#6C63FF", "#00E5A0", "#FF6B35", "#6C63FF", "#00E5A0"];
  const color = colors[index % colors.length];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 130, flexShrink: 0,
        background: DS.colors.surface,
        border: `1px solid ${hovered ? color + "60" : DS.colors.border}`,
        borderRadius: DS.radius.lg, padding: 14,
        transition: "all 0.2s ease",
        boxShadow: hovered ? `0 0 20px ${color}20` : "none",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: DS.radius.sm,
        background: color + "20", border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 10, color: color, fontSize: 14, ...s.heading,
      }}>
        {index + 1}
      </div>
      <p style={{ color: DS.colors.textPrimary, fontSize: 13, ...s.heading, marginBottom: 4 }}>
        {ex.nom}
      </p>
      <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginBottom: 8 }}>
        {ex.muscles.split("·")[0].trim()}
      </p>
      <div style={{ ...s.mono, fontSize: 13, color }}>
        {ex.sets}×{ex.reps}
      </div>
      {ex.chargeKg > 0 && (
        <div style={{ ...s.mono, fontSize: 11, color: DS.colors.textSec, marginTop: 2 }}>
          {ex.chargeKg} kg
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN 3 — HISTORIQUE
// ─────────────────────────────────────────────
function HistoriqueScreen() {
  const stats = [
    { value: "18", label: "séances", color: DS.colors.primary },
    { value: "+12kg", label: "Squat", color: DS.colors.success },
    { value: "94%", label: "assiduité", color: DS.colors.warning },
  ];

  const historique = [
    { semaine: 3, seances: [
      { titre: "Force & Explosivité", date: "Mar 25 mars", duree: 48, exercices: 5, statut: "faite" },
      { titre: "Haut du Corps", date: "Jeu 27 mars", duree: 42, exercices: 5, statut: "faite" },
    ]},
    { semaine: 2, seances: [
      { titre: "Force & Base Basse", date: "Lun 18 mars", duree: 51, exercices: 5, statut: "faite" },
      { titre: "Explosivité", date: "Mer 20 mars", duree: 45, exercices: 4, statut: "faite" },
      { titre: "Haut du Corps", date: "Ven 22 mars", duree: 38, exercices: 5, statut: "faite" },
    ]},
  ];

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DS.colors.border}`,
        padding: "20px 20px 16px",
      }}>
        <h1 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary }}>Progression</h1>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {stats.map((stat, i) => (
            <Card key={i} style={{ flex: 1, padding: 16, textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 22, color: stat.color, fontWeight: 700, marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Graphique simplifié */}
        <Card style={{ marginBottom: 28, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>Squat barre</p>
            <Badge color="success">+15 kg</Badge>
          </div>
          <MiniChart />
        </Card>

        {/* Historique séances */}
        {historique.map(semaine => (
          <div key={semaine.semaine} style={{ marginBottom: 24 }}>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              — Semaine {semaine.semaine}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {semaine.seances.map((s_, i) => (
                <Card key={i} onClick={() => {}} style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 4 }}>{s_.date}</p>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>{s_.titre}</p>
                      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginTop: 4 }}>
                        {s_.exercices} exercices · {s_.duree} min
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Badge color="success">✓</Badge>
                      {Icons.arrow()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini graphique SVG
function MiniChart() {
  const points = [65, 67.5, 70, 72.5, 72.5, 75, 77.5, 80];
  const w = 300, h = 80;
  const min = Math.min(...points) - 5;
  const max = Math.max(...points) + 5;
  const toX = (i) => (i / (points.length - 1)) * w;
  const toY = (v) => h - ((v - min) / (max - min)) * h;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p)}`).join(" ");
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80, overflow: "visible" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={DS.colors.primary} stopOpacity="0.3" />
          <stop offset="100%" stopColor={DS.colors.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke={DS.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p)} r={i === points.length - 1 ? 5 : 3}
          fill={i === points.length - 1 ? DS.colors.primary : DS.colors.bg}
          stroke={DS.colors.primary} strokeWidth="2" />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN 4 — PROFIL
// ─────────────────────────────────────────────
function ProfilScreen({ user }) {
  const [notifOn, setNotifOn] = useState(true);
  const settings = [
    { label: "Mon sport", value: "Basketball", emoji: "🏀" },
    { label: "Mon objectif", value: "Explosivité", emoji: "⚡" },
    { label: "Fréquence", value: "3 séances / semaine", emoji: "📅" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DS.colors.border}`,
        padding: "20px 20px 16px",
      }}>
        <h1 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary }}>Profil</h1>
      </div>

      <div style={{ padding: "32px 20px 0" }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80,
            background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
            borderRadius: DS.radius.full,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, ...s.display, color: "white",
            margin: "0 auto 16px",
            boxShadow: DS.shadow.primary,
          }}>
            {user.name[0]}
          </div>
          <h2 style={{ ...s.display, fontSize: 22, color: DS.colors.textPrimary, marginBottom: 6 }}>
            {user.name}
          </h2>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>
            Basketball · Intermédiaire
          </p>
        </div>

        {/* Programme actif */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Programme actif
            </p>
            {Icons.arrow()}
          </div>
          <p style={{ color: DS.colors.textPrimary, fontSize: 17, ...s.heading, marginBottom: 4 }}>
            Explosivité Basketball
          </p>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 14 }}>
            Semaine 3 sur 8 · 3×/semaine
          </p>
          <ProgressBar value={62} />
          <p style={{ color: DS.colors.textSec, fontSize: 12, textAlign: "right", marginTop: 6, ...s.mono }}>62%</p>
        </Card>

        {/* Préférences */}
        <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Préférences
        </p>
        <Card style={{ marginBottom: 24, padding: 0 }}>
          {settings.map((setting, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: i < settings.length - 1 ? `1px solid ${DS.colors.border}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 20 }}>{setting.emoji}</span>
                <div>
                  <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{setting.label}</p>
                  <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>{setting.value}</p>
                </div>
              </div>
              {Icons.arrow()}
            </div>
          ))}
        </Card>

        {/* Notifications */}
        <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Notifications
        </p>
        <Card style={{ marginBottom: 24, padding: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>Rappel séance</p>
            </div>
            <div
              onClick={() => setNotifOn(v => !v)}
              style={{
                width: 48, height: 28,
                background: notifOn ? DS.colors.success : DS.colors.surfaceHigh,
                borderRadius: DS.radius.full, position: "relative", cursor: "pointer",
                transition: "background 0.25s ease",
                boxShadow: notifOn ? `0 0 12px ${DS.colors.success}60` : "none",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: notifOn ? 23 : 3,
                width: 22, height: 22,
                background: "white", borderRadius: DS.radius.full,
                transition: "left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
        </Card>

        {/* Régénérer */}
        <SecondaryButton style={{ marginBottom: 24 }}>
          🔄 Regénérer mon programme
        </SecondaryButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BOTTOM NAVIGATION
// ─────────────────────────────────────────────
function BottomNav({ activeTab, setTab }) {
  const tabs = [
    { id: "dashboard", label: "Aujourd'hui", icon: Icons.home },
    { id: "historique", label: "Progression", icon: Icons.chart },
    { id: "profil", label: "Profil", icon: Icons.user },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,10,15,0.92)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      borderTop: `1px solid ${DS.colors.border}`,
      padding: "12px 0 28px",
      display: "flex",
      maxWidth: 430,
      margin: "0 auto",
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            style={{
              flex: 1, background: "none", border: "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              cursor: "pointer", padding: "4px 0",
              transition: "transform 0.15s ease",
              transform: isActive ? "scale(1.05)" : "scale(1)",
            }}
          >
            {tab.icon(isActive)}
            <span style={{
              color: isActive ? DS.colors.primary : DS.colors.textDim,
              fontSize: 11, ...s.heading,
              transition: "color 0.2s ease",
            }}>
              {tab.label}
            </span>
            {isActive && (
              <div style={{
                width: 4, height: 4, borderRadius: DS.radius.full,
                background: DS.colors.primary,
                boxShadow: `0 0 6px ${DS.colors.primary}`,
                marginTop: -2,
              }} />
            )}
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
  // "onboarding" | "app"
  const [screen, setScreen] = useState("onboarding");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);

  const handleOnboardingComplete = (userData) => {
    setUser(userData);
    setScreen("app");
  };

  const handleStartSession = () => {
    // Partie 2 : navigation vers l'écran séance
    alert("🏋️ Écran Séance → intégré en Partie 2 !");
  };

  // Styles globaux injectés
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter', system-ui, sans-serif; }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  if (screen === "onboarding") {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100vh" }}>
      {activeTab === "dashboard" && (
        <DashboardScreen user={user || MOCK_USER} onStartSession={handleStartSession} />
      )}
      {activeTab === "historique" && <HistoriqueScreen />}
      {activeTab === "profil" && <ProfilScreen user={user || MOCK_USER} />}
      <BottomNav activeTab={activeTab} setTab={setActiveTab} />
    </div>
  );
}