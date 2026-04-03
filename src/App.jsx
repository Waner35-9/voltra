import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
// Appel réel à l'Edge Function generate-program
async function generateProgramIA({ sport, objectif, niveau, frequence }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-program`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ sport, objectif, niveau, frequence }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur génération");
  return data.programme;
} 
// ─────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// COMPOSANTS UI
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// DONNÉES MOCK
// ─────────────────────────────────────────────
const MOCK_PROGRAM = {
  titre: "Explosivité Basketball", semaineCourante: 3, totalSemaines: 8, progression: 62,
  seancesDuJour: [{
    id: "s3_j1", titre: "Force & Explosivité", type: "force_basse", dureeMin: 48,
    exercices: [
      { id: "e1", nom: "Squat barre", muscles: "Quadriceps · Fessiers", sets: 4, reps: "6-8", chargeKg: 75 },
      { id: "e2", nom: "Romanian Deadlift", muscles: "Ischio · Lombaires", sets: 3, reps: "10", chargeKg: 60 },
      { id: "e3", nom: "Box Jump", muscles: "Quadriceps · Mollets", sets: 5, reps: "5", chargeKg: 0 },
      { id: "e4", nom: "Hip Thrust", muscles: "Fessiers", sets: 3, reps: "12", chargeKg: 70 },
      { id: "e5", nom: "Kettlebell Swing", muscles: "Fessiers · Dorsaux", sets: 4, reps: "12", chargeKg: 20 },
    ],
  }],
  derniereSeance: { titre: "Haut du Corps", joursPassés: 2, dureeMin: 42, nbExercices: 5, gainKg: 2.5 },
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
const PLANS = [
  { id: "monthly", label: "Mensuel", price: 12.99, unit: "/ mois", priceDetail: "Résiliable à tout moment", savings: null, color: DS.colors.primary, colorSoft: DS.colors.primarySoft, colorBorder: DS.colors.borderAccent, badge: null, highlight: false },
  { id: "annual", label: "Annuel", price: 69.99, unit: "/ an", priceDetail: "soit 5,83€ / mois", savings: "Économise 58%", color: DS.colors.success, colorSoft: DS.colors.successSoft, colorBorder: "rgba(0,229,160,0.35)", badge: "⭐ Le plus populaire", highlight: true },
  { id: "lifetime", label: "À vie", price: 149, unit: "une fois", priceDetail: "Accès permanent · Toutes les features", savings: "Offre de lancement", color: DS.colors.gold, colorSoft: DS.colors.goldSoft, colorBorder: "rgba(255,209,102,0.35)", badge: "⏳ Limité", highlight: false, urgency: true },
];

// ─────────────────────────────────────────────
// ÉCRAN SPLASH — chargement initial
// ─────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: DS.radius.xl,
        background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, boxShadow: DS.shadow.primary,
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        ⚡
      </div>
      <p style={{ color: DS.colors.textSec, fontSize: 14, marginTop: 20, ...s.body }}>Chargement...</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN AUTH — Connexion / Inscription réelle
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
    setError("");
    setSuccess("");
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    if (mode === "signup" && !name) { setError("Entre ton prénom."); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caractères minimum."); return; }

    setLoading(true);

    if (mode === "signup") {
      // ── Inscription Supabase ──
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (signUpError) {
        setError(signUpError.message === "User already registered"
          ? "Cet email est déjà utilisé. Connecte-toi."
          : signUpError.message);
        setLoading(false);
        return;
      }

      // Supabase peut demander de confirmer l'email
      if (data.user && !data.session) {
        setSuccess("Vérifie ta boîte mail pour confirmer ton compte !");
        setLoading(false);
        return;
      }

      onAuth(data.user);

    } else {
      // ── Connexion Supabase ──
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : signInError.message);
        setLoading(false);
        return;
      }

      onAuth(data.user);
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Entre ton email d'abord."); return; }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) { setError(resetError.message); return; }
    setSuccess("Email de réinitialisation envoyé !");
  };

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 24px" }}>
      {/* Logo */}
      <div style={{ paddingTop: 80, paddingBottom: 48, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: DS.radius.xl,
          background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary,
        }}>
          ⚡
        </div>
        <h1 style={{ ...s.display, fontSize: 32, color: DS.colors.textPrimary, marginBottom: 8 }}>Voltra</h1>
        <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>
          {mode === "login" ? "Content de te revoir 👋" : "Commence ton parcours"}
        </p>
      </div>

      <div style={{ flex: 1 }}>
        {/* Toggle */}
        <div style={{
          display: "flex", background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.md, padding: 4, marginBottom: 32,
        }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{
              flex: 1, height: 40, borderRadius: DS.radius.sm - 2,
              background: mode === m ? DS.colors.primary : "transparent",
              border: "none", color: mode === m ? "white" : DS.colors.textSec,
              fontSize: 14, cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: mode === m ? DS.shadow.primary : "none", ...s.heading,
            }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <Input label="Prénom" value={name} onChange={setName} placeholder="Alex" />
        )}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
        <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

        {error && (
          <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ color: DS.colors.warning, fontSize: 13, ...s.body }}>⚠️ {error}</p>
          </div>
        )}

        {success && (
          <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(0,229,160,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ color: DS.colors.success, fontSize: 13, ...s.body }}>✓ {success}</p>
          </div>
        )}

        {loading ? (
          <div style={{
            height: 56, borderRadius: DS.radius.md,
            background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            color: DS.colors.primary, fontSize: 15, ...s.heading,
          }}>
            <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
            {mode === "login" ? "Connexion..." : "Création du compte..."}
          </div>
        ) : (
          <PrimaryButton onClick={handleSubmit}>
            {mode === "login" ? "Se connecter →" : "Créer mon compte →"}
          </PrimaryButton>
        )}

        {mode === "login" && (
          <button onClick={handleForgotPassword} style={{
            width: "100%", marginTop: 16, background: "none", border: "none",
            color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.body,
          }}>
            Mot de passe oublié ?
          </button>
        )}
      </div>

      <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", paddingBottom: 40, ...s.body }}>
        En continuant, tu acceptes nos CGU et politique de confidentialité.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN ONBOARDING
// ─────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ sport: null, objectif: null, niveau: null, frequence: 3 });
  const [loading, setLoading] = useState(false);
  const [animIn, setAnimIn] = useState(true);

  const goNext = () => {
    setAnimIn(false);
    setTimeout(() => { setStep(s => s + 1); setAnimIn(true); }, 200);
  };

  const handleFinish = () => {
    setLoading(true);
    setTimeout(() => onComplete(data), 1500);
  };

  const canNext = [data.sport !== null, data.objectif !== null, data.niveau !== null][step];

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 20px" }}>
      <div style={{ paddingTop: 60, paddingBottom: 32 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: DS.radius.full, background: i <= step ? DS.colors.primary : DS.colors.surfaceHigh, transition: "background 0.4s ease", boxShadow: i === step ? `0 0 8px ${DS.colors.primary}` : "none" }} />
          ))}
        </div>
        <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading }}>Étape {step + 1} sur 3</p>
      </div>

      <div style={{ flex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.25s ease" }}>
        {step === 0 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Quel est<br />ton sport ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>Le programme sera adapté à tes besoins.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {SPORTS.map(sport => (
                <div key={sport.id} onClick={() => setData(d => ({ ...d, sport: sport.id }))} style={{
                  background: data.sport === sport.id ? DS.colors.primarySoft : DS.colors.surface,
                  border: `1px solid ${data.sport === sport.id ? DS.colors.primary : DS.colors.border}`,
                  borderRadius: DS.radius.md, padding: "16px 8px", textAlign: "center", cursor: "pointer",
                  transition: "all 0.2s ease", transform: data.sport === sport.id ? "scale(1.02)" : "scale(1)",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{sport.emoji}</div>
                  <div style={{ color: data.sport === sport.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 13, ...s.heading }}>{sport.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Quel est<br />ton objectif ?</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 32 }}>On adaptera les exercices et charges.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {OBJECTIFS.map(obj => (
                <div key={obj.id} onClick={() => setData(d => ({ ...d, objectif: obj.id }))} style={{
                  background: data.objectif === obj.id ? DS.colors.primarySoft : DS.colors.surface,
                  border: `1px solid ${data.objectif === obj.id ? DS.colors.primary : DS.colors.border}`,
                  borderRadius: DS.radius.lg, padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.2s ease",
                }}>
                  <span style={{ fontSize: 26 }}>{obj.emoji}</span>
                  <div>
                    <div style={{ color: data.objectif === obj.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{obj.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{obj.desc}</div>
                  </div>
                  {data.objectif === obj.id && (
                    <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, marginBottom: 8 }}>Derniers<br />réglages</h1>
            <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, marginBottom: 36 }}>Le programme se calibre sur ton profil.</p>
            <div style={{ marginBottom: 36 }}>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Niveau actuel</p>
              <div style={{ display: "flex", gap: 10 }}>
                {NIVEAUX.map(n => (
                  <div key={n} onClick={() => setData(d => ({ ...d, niveau: n.toLowerCase() }))} style={{
                    flex: 1, padding: "12px 0", textAlign: "center",
                    background: data.niveau === n.toLowerCase() ? DS.colors.primarySoft : DS.colors.surface,
                    border: `1px solid ${data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.border}`,
                    borderRadius: DS.radius.md, color: data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.textSec,
                    fontSize: 14, cursor: "pointer", transition: "all 0.2s ease", ...s.heading,
                  }}>{n}</div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Séances par semaine</p>
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 20 }}>
                <div style={{ ...s.display, fontSize: 48, color: DS.colors.primary, textAlign: "center", marginBottom: 16 }}>{data.frequence}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[2, 3, 4, 5].map(n => (
                    <div key={n} onClick={() => setData(d => ({ ...d, frequence: n }))} style={{
                      flex: 1, padding: "10px 0", textAlign: "center",
                      background: data.frequence === n ? DS.colors.primary : DS.colors.surfaceHigh,
                      borderRadius: DS.radius.md, color: data.frequence === n ? "white" : DS.colors.textSec,
                      fontSize: 16, cursor: "pointer", transition: "all 0.2s ease", ...s.heading,
                      boxShadow: data.frequence === n ? DS.shadow.primary : "none",
                    }}>{n}</div>
                  ))}
                </div>
                <p style={{ color: DS.colors.textSec, fontSize: 13, textAlign: "center", marginTop: 12, ...s.body }}>jours / semaine</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 48, paddingTop: 24 }}>
        {loading ? (
          <div style={{ background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: DS.radius.md, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 1s infinite", flexShrink: 0 }}>✦</div>
            <div>
              <p style={{ color: DS.colors.primary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Génération du programme...</p>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>L'IA calibre ton programme 8 semaines</p>
            </div>
          </div>
        ) : (
          <>
            <PrimaryButton onClick={step < 2 ? goNext : handleFinish} disabled={!canNext}>
              {step < 2 ? "Continuer →" : "✦ Générer mon programme"}
            </PrimaryButton>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.body }}>
                ← Retour
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ÉCRAN PRICING
// ─────────────────────────────────────────────
function PricingScreen({ onSelectPlan }) {
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
  const featuresPro = [
    "Progression automatique des charges ⚡",
    "Programmes illimités + regénération IA",
    "Adaptation si séance skippée",
    "Déload automatique intelligent",
    "Historique complet + graphiques",
    "Jusqu'à 5 séances / semaine",
    "Coach IA intégré",
    "Export PDF du programme",
  ];

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, overflowY: "auto", paddingBottom: 40 }}>
      <div style={{ padding: "60px 20px 0", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading, marginBottom: 10 }}>Ton programme est prêt ✦</p>
          <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, lineHeight: 1.2, marginBottom: 10 }}>Choisis ton plan<br />pour commencer</h1>
          <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>Accès complet à la progression automatique et à l'IA.</p>
        </div>

        {/* Urgence */}
        <div style={{ background: DS.colors.goldSoft, border: `1px solid rgba(255,209,102,0.25)`, borderRadius: DS.radius.md, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: DS.colors.gold, fontSize: 12, ...s.heading, marginBottom: 2 }}>⏳ Offre Lifetime — Prix de lancement</p>
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

        {/* Plans */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {PLANS.map(plan => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{
              position: "relative",
              background: selected === plan.id ? plan.colorSoft : DS.colors.surface,
              border: `1.5px solid ${selected === plan.id ? plan.colorBorder : DS.colors.border}`,
              borderRadius: DS.radius.xl, padding: "18px 20px", cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: selected === plan.id ? `0 0 32px ${plan.color}20` : DS.shadow.card,
            }}>
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

        <button onClick={() => onSelectPlan(selected)} style={{
          width: "100%", height: 58,
          background: currentPlan.highlight ? `linear-gradient(135deg, ${DS.colors.success}, #00C896)` : currentPlan.urgency ? `linear-gradient(135deg, ${DS.colors.gold}, #F0B800)` : `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: DS.radius.md,
          color: currentPlan.urgency ? DS.colors.bg : "white", fontSize: 16, cursor: "pointer",
          boxShadow: DS.shadow.primary, ...s.heading, marginBottom: 12,
        }}>
          Commencer avec {currentPlan.label} →
        </button>

        <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", marginBottom: 24 }}>
          🔒 Paiement sécurisé · Annulation en 1 clic · Remboursement 7 jours
        </p>

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

        <button onClick={() => onSelectPlan("free")} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline", ...s.body }}>
          Continuer avec le plan gratuit
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function DashboardScreen({ user, onStartSession }) {
  const prog = MOCK_PROGRAM;
  const seance = prog.seancesDuJour[0];
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";

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
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, marginBottom: 6 }}>Semaine {prog.semaineCourante} · Séance 1</p>
          <h1 style={{ ...s.display, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1.15, marginBottom: 16 }}>{seance.titre}</h1>
          <ProgressBar value={prog.progression} />
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginTop: 8 }}>Programme {prog.titre} · {prog.progression}% complété</p>
        </div>

        <Card style={{ marginBottom: 24, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${DS.colors.primary}, ${DS.colors.success})` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Badge color="primary">⚡ Aujourd'hui</Badge>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: DS.colors.textSec, fontSize: 13 }}>{Icons.clock()} {seance.dureeMin} min</div>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {[
              { val: seance.exercices.length, label: "exercices", color: DS.colors.textPrimary },
              { val: "+2.5", label: `kg vs S${prog.semaineCourante - 1}`, color: DS.colors.success },
              { val: "Bas", label: "du corps", color: DS.colors.warning },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ ...s.mono, fontSize: 24, color: stat.color, fontWeight: 700 }}>{stat.val}</div>
                <div style={{ color: DS.colors.textSec, fontSize: 12 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <PrimaryButton onClick={onStartSession}>◉ Démarrer la séance</PrimaryButton>
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
                  <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginBottom: 8 }}>{ex.muscles.split("·")[0].trim()}</p>
                  <div style={{ ...s.mono, fontSize: 13, color }}>{ex.sets}×{ex.reps}</div>
                  {ex.chargeKg > 0 && <div style={{ ...s.mono, fontSize: 11, color: DS.colors.textSec, marginTop: 2 }}>{ex.chargeKg} kg</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 14 }}>Dernière séance</p>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 4 }}>Il y a {prog.derniereSeance.joursPassés} jours</p>
                <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>{prog.derniereSeance.titre}</p>
              </div>
              <Badge color="success">✓ Faite</Badge>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[`${prog.derniereSeance.nbExercices} exercices`, `${prog.derniereSeance.dureeMin} min`, `+${prog.derniereSeance.gainKg} kg`].map((stat, i) => (
                <div key={i} style={{ flex: 1, padding: "8px 4px", textAlign: "center", background: DS.colors.surfaceHigh, borderRadius: DS.radius.sm, color: DS.colors.textSec, fontSize: 12 }}>{stat}</div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HISTORIQUE
// ─────────────────────────────────────────────
function HistoriqueScreen() {
  const stats = [
    { value: "18", label: "séances", color: DS.colors.primary },
    { value: "+12kg", label: "Squat", color: DS.colors.success },
    { value: "94%", label: "assiduité", color: DS.colors.warning },
  ];
  const historique = [
    { semaine: 3, seances: [{ titre: "Force & Explosivité", date: "Mar 25 mars", duree: 48, exercices: 5 }, { titre: "Haut du Corps", date: "Jeu 27 mars", duree: 42, exercices: 5 }] },
    { semaine: 2, seances: [{ titre: "Force & Base Basse", date: "Lun 18 mars", duree: 51, exercices: 5 }, { titre: "Explosivité", date: "Mer 20 mars", duree: 45, exercices: 4 }] },
  ];
  const points = [65, 67.5, 70, 72.5, 72.5, 75, 77.5, 80];
  const w = 300, h = 80, min = 60, max = 85;
  const toX = i => (i / (points.length - 1)) * w;
  const toY = v => h - ((v - min) / (max - min)) * h;
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p)}`).join(" ");
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div style={{ minHeight: "100vh", background: DS.colors.bg, paddingBottom: 100 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: "20px 20px 16px" }}>
        <h1 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary }}>Progression</h1>
      </div>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {stats.map((stat, i) => (
            <Card key={i} style={{ flex: 1, padding: 16, textAlign: "center" }}>
              <div style={{ ...s.mono, fontSize: 22, color: stat.color, fontWeight: 700, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ color: DS.colors.textSec, fontSize: 12 }}>{stat.label}</div>
            </Card>
          ))}
        </div>
        <Card style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>Squat barre</p>
            <Badge color="success">+15 kg</Badge>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80 }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DS.colors.primary} stopOpacity="0.3" /><stop offset="100%" stopColor={DS.colors.primary} stopOpacity="0" /></linearGradient></defs>
            <path d={areaD} fill="url(#g)" />
            <path d={pathD} fill="none" stroke={DS.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => <circle key={i} cx={toX(i)} cy={toY(p)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? DS.colors.primary : DS.colors.bg} stroke={DS.colors.primary} strokeWidth="2" />)}
          </svg>
        </Card>
        {historique.map(sem => (
          <div key={sem.semaine} style={{ marginBottom: 24 }}>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>— Semaine {sem.semaine}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sem.seances.map((sc, i) => (
                <Card key={i} style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginBottom: 4 }}>{sc.date}</p>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>{sc.titre}</p>
                      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginTop: 4 }}>{sc.exercices} exercices · {sc.duree} min</p>
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

// ─────────────────────────────────────────────
// PROFIL
// ─────────────────────────────────────────────
function ProfilScreen({ user, onLogout }) {
  const [notifOn, setNotifOn] = useState(true);
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";

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
          <p style={{ color: DS.colors.textPrimary, fontSize: 17, ...s.heading, marginBottom: 4 }}>Explosivité Basketball</p>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 14 }}>Semaine 3 sur 8 · 3×/semaine</p>
          <ProgressBar value={62} />
          <p style={{ color: DS.colors.textSec, fontSize: 12, textAlign: "right", marginTop: 6, ...s.mono }}>62%</p>
        </Card>

        <Card style={{ marginBottom: 24, padding: 0 }}>
          {[{ emoji: "🏀", label: "Mon sport", value: "Basketball" }, { emoji: "⚡", label: "Mon objectif", value: "Explosivité" }, { emoji: "📅", label: "Fréquence", value: "3 séances / semaine" }].map((item, i, arr) => (
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
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>Rappel séance</p>
            </div>
            <div onClick={() => setNotifOn(v => !v)} style={{ width: 48, height: 28, background: notifOn ? DS.colors.success : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s ease" }}>
              <div style={{ position: "absolute", top: 3, left: notifOn ? 23 : 3, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        </Card>

        <button onClick={onLogout} style={{ width: "100%", background: "none", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 0", color: DS.colors.textSec, fontSize: 15, cursor: "pointer", ...s.heading }}>
          Se déconnecter
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
  // "splash" | "auth" | "onboarding" | "pricing" | "app"
  const [screen, setScreen] = useState("splash");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter', system-ui, sans-serif; }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    // ── Vérifier la session existante au démarrage ──
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setScreen("app"); // Déjà connecté → aller direct au dashboard
      } else {
        setScreen("auth");
      }
    });

    // ── Écouter les changements d'auth ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
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

  if (screen === "splash") return <SplashScreen />;
  if (screen === "auth") return <AuthScreen onAuth={(u) => { setUser(u); setScreen("onboarding"); }} />;
  if (screen === "onboarding") return <OnboardingScreen onComplete={() => setScreen("pricing")} />;
  if (screen === "pricing") return <PricingScreen onSelectPlan={() => setScreen("app")} />;

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100vh" }}>
      {activeTab === "dashboard" && <DashboardScreen user={user} onStartSession={() => alert("🏋️ Séance live — bientôt !")} />}
      {activeTab === "historique" && <HistoriqueScreen />}
      {activeTab === "profil" && <ProfilScreen user={user} onLogout={handleLogout} />}
      <BottomNav activeTab={activeTab} setTab={setActiveTab} />
    </div>
  );
}
