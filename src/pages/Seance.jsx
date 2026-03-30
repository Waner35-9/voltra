import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────
const DS = {
  colors: {
    bg: "#0A0A0F", surface: "#13131A", surfaceUp: "#1C1C26", surfaceHigh: "#242433",
    primary: "#6C63FF", primarySoft: "rgba(108,99,255,0.10)", primaryGlow: "rgba(108,99,255,0.25)",
    success: "#00E5A0", successSoft: "rgba(0,229,160,0.12)",
    warning: "#FF6B35", warningSoft: "rgba(255,107,53,0.12)",
    textPrimary: "#F0F0F8", textSec: "#7A7A9A", textDim: "#3A3A50",
    border: "rgba(255,255,255,0.06)", borderAccent: "rgba(108,99,255,0.35)",
  },
  radius: { sm: 10, md: 16, lg: 20, xl: 28, full: 999 },
  shadow: { primary: "0 8px 32px rgba(108,99,255,0.3)", glow: "0 0 40px rgba(108,99,255,0.15)" },
};
const s = {
  mono: { fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
  display: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.03em" },
  heading: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600 },
  body: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400 },
};

// ─────────────────────────────────────────────────────────────
// PROMPT SYSTÈME CLAUDE — génération programme
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un coach sportif expert en préparation physique athlétique.
Tu génères des programmes de musculation structurés en JSON pur.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en JSON valide. Zéro texte avant ou après.
- Jamais de blocs \`\`\`json\`\`\` ni de commentaires.
- Respecte exactement le schéma fourni.
- Adapte chaque exercice au sport spécifié.
- Les charges sont réalistes pour le niveau indiqué.
- Applique une périodisation : S1 activation → S2 accumulation → S3 intensification → S4 décharge.
- Pour la S4 décharge : -40% volume, -15% charges.
- Maximum 5 exercices par séance.
- Les exercices pliométriques ont charge_kg à 0.`;

function buildUserPrompt({ sport, objectif, niveau, frequence }) {
  return `Génère un programme de musculation complet avec ces paramètres :

Sport      : ${sport}
Objectif   : ${objectif}
Niveau     : ${niveau}
Fréquence  : ${frequence} séances par semaine
Durée      : 4 semaines

Retourne UNIQUEMENT ce JSON (sans aucun texte autour) :

{
  "meta": {
    "sport": "${sport}",
    "objectif": "${objectif}",
    "niveau": "${niveau}",
    "frequence": ${frequence},
    "totalSemaines": 4
  },
  "semaines": [
    {
      "numero": 1,
      "theme": "Activation",
      "seances": [
        {
          "id": "s1_j1",
          "jour": 1,
          "titre": "Titre de la séance",
          "type": "force_basse|force_haute|explosivite|gainage",
          "dureeMin": 45,
          "exercices": [
            {
              "id": "ex_001",
              "nom": "Nom exercice",
              "muscles": "Muscle1 · Muscle2",
              "sets": 4,
              "reps": "8",
              "chargeKg": 60,
              "reposSec": 120,
              "ordre": 1,
              "conseil": "Conseil technique court"
            }
          ]
        }
      ]
    }
  ]
}

Génère les 4 semaines complètes avec toutes les séances (${frequence} séances par semaine).`;
}

// ─────────────────────────────────────────────────────────────
// APPEL API CLAUDE
// ─────────────────────────────────────────────────────────────
async function generateProgramWithClaude(userParams) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(userParams) }],
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();

  // Extraire le texte et parser le JSON
  const raw = data.content?.map(b => b.text || "").join("") || "";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    // Tentative de récupération si JSON mal formé
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("JSON invalide reçu de Claude");
  }
}

// ─────────────────────────────────────────────────────────────
// DONNÉES MOCK — programme de démo si pas d'API
// ─────────────────────────────────────────────────────────────
const MOCK_PROGRAMME = {
  meta: { sport: "basketball", objectif: "explosivité", niveau: "intermédiaire", frequence: 3, totalSemaines: 4 },
  semaines: [{
    numero: 1, theme: "Activation",
    seances: [{
      id: "s1_j1", jour: 1,
      titre: "Force & Explosivité", type: "force_basse", dureeMin: 48,
      exercices: [
        { id: "e1", nom: "Squat barre",        muscles: "Quadriceps · Fessiers",      sets: 4, reps: "6-8", chargeKg: 75, reposSec: 120, ordre: 1, conseil: "Descendre sous le parallèle, genoux dans l'axe." },
        { id: "e2", nom: "Romanian Deadlift",  muscles: "Ischio · Lombaires",          sets: 3, reps: "10",  chargeKg: 60, reposSec: 90,  ordre: 2, conseil: "Dos plat, tension dans les ischios en bas." },
        { id: "e3", nom: "Box Jump",           muscles: "Quadriceps · Mollets",        sets: 5, reps: "5",   chargeKg: 0,  reposSec: 150, ordre: 3, conseil: "Atterrissage souple, amorti complet." },
        { id: "e4", nom: "Hip Thrust",         muscles: "Fessiers",                   sets: 3, reps: "12",  chargeKg: 70, reposSec: 75,  ordre: 4, conseil: "Pause 1s en haut, contraction max." },
        { id: "e5", nom: "Kettlebell Swing",   muscles: "Fessiers · Dorsaux",         sets: 4, reps: "12",  chargeKg: 20, reposSec: 90,  ordre: 5, conseil: "Puissance vient des hanches, pas des bras." },
      ],
    }],
  }],
};

// ─────────────────────────────────────────────────────────────
// COMPOSANTS UI
// ─────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = "primary", style = {} }) {
  const [p, setP] = useState(false);
  const variants = {
    primary: { bg: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, color: "white", shadow: DS.shadow.primary },
    success: { bg: `linear-gradient(135deg, ${DS.colors.success}, #00C896)`, color: DS.colors.bg, shadow: "0 8px 32px rgba(0,229,160,0.35)" },
    ghost:   { bg: "transparent", color: DS.colors.textSec, shadow: "none", border: `1px solid ${DS.colors.border}` },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)}
      onMouseLeave={() => setP(false)} onTouchStart={() => setP(true)} onTouchEnd={() => setP(false)}
      style={{
        width: "100%", height: 56, background: disabled ? DS.colors.surfaceHigh : v.bg,
        border: v.border || "1px solid rgba(255,255,255,0.1)",
        borderRadius: DS.radius.md, color: disabled ? DS.colors.textDim : v.color,
        fontSize: 16, cursor: disabled ? "not-allowed" : "pointer",
        transform: p ? "scale(0.96)" : "scale(1)", transition: "all 0.15s ease",
        boxShadow: disabled ? "none" : v.shadow,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        ...s.heading, ...style,
      }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT : TIMER DE REPOS
// ─────────────────────────────────────────────────────────────
function RestTimer({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    setLeft(seconds);
    setRunning(true);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) { onComplete?.(); return; }
    ref.current = setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(ref.current);
  }, [left, running]);

  const pct = ((seconds - left) / seconds) * 100;
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const pad = n => String(n).padStart(2, "0");

  // Couleur dynamique selon le temps restant
  const color = left > seconds * 0.5 ? DS.colors.primary
    : left > seconds * 0.25 ? DS.colors.warning
    : DS.colors.success;

  return (
    <div style={{
      background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
      borderRadius: DS.radius.xl, padding: 28, textAlign: "center",
    }}>
      <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        ⏱ Temps de repos
      </p>

      {/* Cercle SVG */}
      <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 20px" }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r="60" fill="none" stroke={DS.colors.surfaceHigh} strokeWidth="8" />
          <circle cx="70" cy="70" r="60" fill="none" stroke={color}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 60}`}
            strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease",
              filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ ...s.mono, fontSize: 36, color, fontWeight: 700 }}>
            {pad(mins)}:{pad(secs)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={() => setRunning(r => !r)} style={{ height: 44, fontSize: 14 }}>
          {running ? "⏸ Pause" : "▶ Reprendre"}
        </Btn>
        <Btn variant="ghost" onClick={onComplete} style={{ height: 44, fontSize: 14 }}>
          Passer →
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT : TRACKER D'UN SET
// ─────────────────────────────────────────────────────────────
function SetRow({ setNum, reps, chargeKg, completed, onComplete, isActive }) {
  const [inputReps, setInputReps] = useState(reps);
  const [inputKg, setInputKg] = useState(chargeKg);

  const inputStyle = {
    background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`,
    borderRadius: DS.radius.sm, color: DS.colors.textPrimary, textAlign: "center",
    fontSize: 18, ...s.mono, fontWeight: 700, height: 44, outline: "none",
    width: "100%",
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 1fr 1fr 48px",
      gap: 10, alignItems: "center",
      padding: "12px 0",
      borderBottom: `1px solid ${DS.colors.border}`,
      opacity: completed ? 0.5 : 1,
      transition: "opacity 0.3s ease",
    }}>
      {/* Numéro du set */}
      <div style={{
        width: 28, height: 28, borderRadius: DS.radius.full,
        background: completed ? DS.colors.success : isActive ? DS.colors.primarySoft : DS.colors.surfaceHigh,
        border: `1px solid ${completed ? DS.colors.success : isActive ? DS.colors.primary : DS.colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: completed ? DS.colors.bg : isActive ? DS.colors.primary : DS.colors.textSec,
        ...s.heading, transition: "all 0.3s ease",
        boxShadow: completed ? `0 0 8px ${DS.colors.success}60` : "none",
      }}>
        {completed ? "✓" : setNum}
      </div>

      {/* Reps */}
      <div>
        <p style={{ color: DS.colors.textDim, fontSize: 10, ...s.body, marginBottom: 4 }}>REPS</p>
        <input
          type="number"
          value={inputReps}
          onChange={e => setInputReps(e.target.value)}
          disabled={completed || !isActive}
          style={inputStyle}
        />
      </div>

      {/* Charge */}
      <div>
        <p style={{ color: DS.colors.textDim, fontSize: 10, ...s.body, marginBottom: 4 }}>KG</p>
        <input
          type="number"
          value={chargeKg === 0 ? "–" : inputKg}
          onChange={e => setInputKg(e.target.value)}
          disabled={completed || !isActive || chargeKg === 0}
          style={{ ...inputStyle, color: chargeKg === 0 ? DS.colors.textDim : DS.colors.textPrimary }}
        />
      </div>

      {/* Bouton valider */}
      <button
        onClick={() => !completed && isActive && onComplete({ reps: Number(inputReps), kg: Number(inputKg) })}
        disabled={completed || !isActive}
        style={{
          width: 44, height: 44, borderRadius: DS.radius.md,
          background: completed ? DS.colors.successSoft
            : isActive ? DS.colors.primary : DS.colors.surfaceHigh,
          border: `1px solid ${completed ? DS.colors.success : isActive ? DS.colors.primary : DS.colors.border}`,
          cursor: isActive && !completed ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, transition: "all 0.2s ease",
          transform: isActive && !completed ? "scale(1)" : "scale(0.95)",
          boxShadow: isActive && !completed ? DS.shadow.primary : "none",
          flexShrink: 0,
        }}
      >
        {completed ? "✓" : "→"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT : RÉCAP FIN DE SÉANCE
// ─────────────────────────────────────────────────────────────
function SessionSummary({ seance, logs, onClose }) {
  const [feedback, setFeedback] = useState(null);
  const [saved, setSaved] = useState(false);

  const totalSets = logs.reduce((acc, ex) => acc + ex.sets.length, 0);
  const totalReps = logs.reduce((acc, ex) => acc + ex.sets.reduce((a, s) => a + s.reps, 0), 0);

  const feedbacks = [
    { id: "easy",  emoji: "😤", label: "Trop facile" },
    { id: "good",  emoji: "💪", label: "Bien chargé" },
    { id: "hard",  emoji: "😮‍💨", label: "C'était dur" },
  ];

  const handleSave = () => {
    setSaved(true);
    // Ici → appel Supabase pour sauvegarder les logs + feedback
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: DS.colors.bg,
      display: "flex", flexDirection: "column",
      padding: "0 20px", maxWidth: 430, margin: "0 auto",
      animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 60, paddingBottom: 20 }}>
        {/* Confetti header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: DS.radius.full,
            background: DS.colors.successSoft, border: `2px solid ${DS.colors.success}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 20px",
            boxShadow: `0 0 40px ${DS.colors.success}40`,
            animation: "pulse 2s infinite",
          }}>
            🏆
          </div>
          <h1 style={{ ...s.display, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>
            Séance terminée !
          </h1>
          <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>
            {seance.titre}
          </p>
        </div>

        {/* Stats de la séance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
          {[
            { value: seance.exercices.length, label: "exercices", color: DS.colors.primary },
            { value: totalSets, label: "séries", color: DS.colors.success },
            { value: totalReps, label: "répétitions", color: DS.colors.warning },
          ].map((stat, i) => (
            <div key={i} style={{
              background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
              borderRadius: DS.radius.lg, padding: 16, textAlign: "center",
            }}>
              <div style={{ ...s.mono, fontSize: 28, color: stat.color, fontWeight: 700, marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Détail par exercice */}
        <div style={{
          background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.lg, padding: 16, marginBottom: 24,
        }}>
          <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Détail exercices
          </p>
          {logs.map((log, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < logs.length - 1 ? `1px solid ${DS.colors.border}` : "none",
            }}>
              <div>
                <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{log.nom}</p>
                <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body, marginTop: 2 }}>
                  {log.sets.map(s => `${s.reps} reps`).join(" · ")}
                </p>
              </div>
              {log.chargeKg > 0 && (
                <span style={{ ...s.mono, fontSize: 16, color: DS.colors.primary, fontWeight: 700 }}>
                  {log.sets[0]?.kg || log.chargeKg} kg
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Feedback subjectif */}
        <div style={{
          background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.lg, padding: 20, marginBottom: 28,
        }}>
          <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 16, textAlign: "center" }}>
            Comment tu te sens ?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {feedbacks.map(fb => (
              <button key={fb.id} onClick={() => setFeedback(fb.id)} style={{
                flex: 1, padding: "14px 8px",
                background: feedback === fb.id ? DS.colors.primarySoft : DS.colors.surfaceHigh,
                border: `1px solid ${feedback === fb.id ? DS.colors.primary : DS.colors.border}`,
                borderRadius: DS.radius.md, cursor: "pointer",
                transition: "all 0.2s ease",
                transform: feedback === fb.id ? "scale(1.03)" : "scale(1)",
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{fb.emoji}</div>
                <div style={{
                  color: feedback === fb.id ? DS.colors.primary : DS.colors.textSec,
                  fontSize: 11, ...s.heading,
                }}>
                  {fb.label}
                </div>
              </button>
            ))}
          </div>
          <p style={{ color: DS.colors.textDim, fontSize: 11, textAlign: "center", marginTop: 12, ...s.body }}>
            Ce signal ajuste automatiquement ta prochaine séance
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ paddingBottom: 48 }}>
        {saved ? (
          <div style={{
            height: 56, borderRadius: DS.radius.md,
            background: DS.colors.successSoft, border: `1px solid ${DS.colors.success}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            color: DS.colors.success, fontSize: 16, ...s.heading,
          }}>
            ✓ Séance sauvegardée !
          </div>
        ) : (
          <Btn variant="success" onClick={handleSave} disabled={!feedback}>
            {feedback ? "✦ Enregistrer & continuer" : "Sélectionne ton ressenti d'abord"}
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL : SÉANCE LIVE
// ─────────────────────────────────────────────────────────────
function SeanceScreen({ seance, onFinish, onBack }) {
  const [exIdx, setExIdx]       = useState(0);       // exercice actif
  const [setIdx, setSetIdx]     = useState(0);       // set actif
  const [resting, setResting]   = useState(false);   // en repos ?
  const [logs, setLogs]         = useState([]);      // performances loggées
  const [showSummary, setShowSummary] = useState(false);
  const [completedSets, setCompletedSets] = useState({}); // { "exIdx-setIdx": true }

  const exercices = seance.exercices;
  const currentEx = exercices[exIdx];
  const totalSets = currentEx?.sets || 4;
  const progressPct = Math.round(((exIdx + setIdx / totalSets) / exercices.length) * 100);

  const handleSetComplete = useCallback((data) => {
    const key = `${exIdx}-${setIdx}`;

    // Mettre à jour les logs
    setLogs(prev => {
      const newLogs = [...prev];
      const exLog = newLogs[exIdx] || { nom: currentEx.nom, chargeKg: currentEx.chargeKg, sets: [] };
      exLog.sets = [...exLog.sets, { reps: data.reps, kg: data.kg }];
      newLogs[exIdx] = exLog;
      return newLogs;
    });

    // Marquer le set comme complété
    setCompletedSets(prev => ({ ...prev, [key]: true }));

    // Lancer le repos ou passer à l'exercice suivant
    if (setIdx < totalSets - 1) {
      setResting(true);
    } else {
      // Fin de tous les sets → prochain exercice
      if (exIdx < exercices.length - 1) {
        setTimeout(() => {
          setExIdx(i => i + 1);
          setSetIdx(0);
        }, 400);
      } else {
        // Fin de séance
        setTimeout(() => setShowSummary(true), 400);
      }
    }
  }, [exIdx, setIdx, totalSets, currentEx, exercices.length]);

  const handleRestComplete = useCallback(() => {
    setResting(false);
    setSetIdx(i => i + 1);
  }, []);

  if (showSummary) {
    return <SessionSummary seance={seance} logs={logs} onClose={onFinish} />;
  }

  const typeColors = {
    force_basse:  DS.colors.primary,
    force_haute:  "#FF63D4",
    explosivite:  DS.colors.warning,
    gainage:      DS.colors.success,
  };
  const accentColor = typeColors[seance.type] || DS.colors.primary;

  return (
    <div style={{
      minHeight: "100vh", background: DS.colors.bg,
      maxWidth: 430, margin: "0 auto",
    }}>
      {/* Header avec barre de progression */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.92)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DS.colors.border}`,
        padding: "16px 20px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={onBack} style={{
            background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`,
            borderRadius: DS.radius.full, width: 36, height: 36,
            color: DS.colors.textSec, fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            ←
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
              Exercice {exIdx + 1} sur {exercices.length}
            </p>
            <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading }}>
              {seance.titre}
            </p>
          </div>
          <div style={{
            background: DS.colors.surfaceUp, borderRadius: DS.radius.full,
            padding: "4px 12px", fontSize: 12, color: DS.colors.textSec, ...s.mono,
          }}>
            {seance.dureeMin}′
          </div>
        </div>

        {/* Progress bar globale */}
        <div style={{ height: 3, background: DS.colors.surfaceHigh, marginBottom: 0 }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${DS.colors.success})`,
            transition: "width 0.5s ease",
            boxShadow: `0 0 8px ${accentColor}`,
          }} />
        </div>
      </div>

      <div style={{ padding: "24px 20px 120px" }}>
        {/* Exercice actif */}
        <div style={{
          background: DS.colors.surface,
          border: `1.5px solid ${accentColor}40`,
          borderRadius: DS.radius.xl, padding: 24, marginBottom: 20,
          position: "relative", overflow: "hidden",
        }}>
          {/* Fond décoratif */}
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 120, height: 120, borderRadius: DS.radius.full,
            background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{
              background: accentColor + "20", border: `1px solid ${accentColor}40`,
              borderRadius: DS.radius.full, padding: "4px 12px",
              color: accentColor, fontSize: 11, ...s.heading,
            }}>
              {exIdx + 1} / {exercices.length}
            </div>
            {currentEx.chargeKg > 0 && (
              <div style={{ textAlign: "right" }}>
                <span style={{ ...s.mono, fontSize: 28, color: accentColor, fontWeight: 700 }}>
                  {currentEx.chargeKg}
                </span>
                <span style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>  kg</span>
              </div>
            )}
          </div>

          <h2 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary, marginBottom: 6, lineHeight: 1.2 }}>
            {currentEx.nom}
          </h2>

          <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, marginBottom: 16 }}>
            {currentEx.muscles}
          </p>

          {/* Sets × Reps */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{
              flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 16px",
              textAlign: "center",
            }}>
              <span style={{ ...s.mono, fontSize: 22, color: accentColor, fontWeight: 700 }}>
                {currentEx.sets}
              </span>
              <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginTop: 2 }}>séries</p>
            </div>
            <div style={{
              flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 16px",
              textAlign: "center",
            }}>
              <span style={{ ...s.mono, fontSize: 22, color: DS.colors.textPrimary, fontWeight: 700 }}>
                {currentEx.reps}
              </span>
              <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginTop: 2 }}>reps</p>
            </div>
            <div style={{
              flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 16px",
              textAlign: "center",
            }}>
              <span style={{ ...s.mono, fontSize: 22, color: DS.colors.textSec, fontWeight: 700 }}>
                {currentEx.reposSec}″
              </span>
              <p style={{ color: DS.colors.textSec, fontSize: 11, ...s.body, marginTop: 2 }}>repos</p>
            </div>
          </div>

          {/* Conseil coach */}
          {currentEx.conseil && (
            <div style={{
              marginTop: 16,
              background: DS.colors.surfaceHigh, borderRadius: DS.radius.md,
              padding: "10px 14px",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, lineHeight: 1.5 }}>
                {currentEx.conseil}
              </p>
            </div>
          )}
        </div>

        {/* Timer de repos OU tableau des sets */}
        {resting ? (
          <RestTimer seconds={currentEx.reposSec} onComplete={handleRestComplete} />
        ) : (
          <div style={{
            background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
            borderRadius: DS.radius.xl, padding: "4px 20px 16px",
            marginBottom: 20,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 48px", gap: 10, padding: "14px 0 8px" }}>
              <span style={{ color: DS.colors.textDim, fontSize: 11, ...s.heading }}>SET</span>
              <span style={{ color: DS.colors.textDim, fontSize: 11, ...s.heading }}>REPS</span>
              <span style={{ color: DS.colors.textDim, fontSize: 11, ...s.heading }}>KG</span>
              <span />
            </div>
            {Array.from({ length: totalSets }).map((_, i) => (
              <SetRow
                key={i}
                setNum={i + 1}
                reps={currentEx.reps.includes("-") ? parseInt(currentEx.reps.split("-")[1]) : parseInt(currentEx.reps)}
                chargeKg={currentEx.chargeKg}
                completed={completedSets[`${exIdx}-${i}`]}
                isActive={i === setIdx && !completedSets[`${exIdx}-${i}`]}
                onComplete={handleSetComplete}
              />
            ))}
          </div>
        )}

        {/* Exercices suivants */}
        {exIdx < exercices.length - 1 && (
          <div>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ensuite
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {exercices.slice(exIdx + 1, exIdx + 3).map((ex, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.md, padding: "12px 16px",
                  opacity: i === 0 ? 1 : 0.5,
                }}>
                  <div>
                    <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>{ex.muscles.split("·")[0]}</p>
                  </div>
                  <span style={{ ...s.mono, color: DS.colors.textSec, fontSize: 13 }}>
                    {ex.sets}×{ex.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRAN : GÉNÉRATION PROGRAMME (loader IA)
// ─────────────────────────────────────────────────────────────
function GenerationScreen({ userParams, onDone, onError }) {
  const [step, setStep] = useState(0);
  const steps = [
    "Analyse du profil athlétique...",
    "Sélection des exercices basket...",
    "Calcul de la périodisation...",
    "Calibrage des charges...",
    "Programme prêt ✦",
  ];

  useEffect(() => {
    // Avancer les étapes du loader toutes les 700ms
    const interval = setInterval(() => {
      setStep(s => s < steps.length - 1 ? s + 1 : s);
    }, 700);

    // Lancer l'appel IA en parallèle
    generateProgramWithClaude(userParams)
      .then(programme => {
        clearInterval(interval);
        setStep(steps.length - 1);
        setTimeout(() => onDone(programme), 800);
      })
      .catch(err => {
        clearInterval(interval);
        console.warn("API error, using mock:", err.message);
        // Fallback sur le mock si pas de clé API
        setTimeout(() => onDone(MOCK_PROGRAMME), 500);
      });

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: DS.colors.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 32px", textAlign: "center",
    }}>
      {/* Orbe animée */}
      <div style={{ position: "relative", width: 120, height: 120, marginBottom: 40 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: DS.radius.full,
          background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`,
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", inset: 10, borderRadius: DS.radius.full,
          background: DS.colors.primarySoft,
          border: `2px solid ${DS.colors.borderAccent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40,
        }}>
          ✦
        </div>
      </div>

      <h2 style={{ ...s.display, fontSize: 26, color: DS.colors.textPrimary, marginBottom: 32 }}>
        Génération en cours
      </h2>

      {/* Étapes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
        {steps.map((label, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            opacity: i <= step ? 1 : 0.25,
            transition: "opacity 0.4s ease",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: DS.radius.full, flexShrink: 0,
              background: i < step ? DS.colors.success : i === step ? DS.colors.primary : DS.colors.surfaceHigh,
              border: `1.5px solid ${i < step ? DS.colors.success : i === step ? DS.colors.primary : DS.colors.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, transition: "all 0.4s ease",
              boxShadow: i === step ? `0 0 10px ${DS.colors.primary}` : "none",
            }}>
              {i < step ? "✓" : i === step ? (
                <div style={{
                  width: 6, height: 6, borderRadius: DS.radius.full,
                  background: "white", animation: "pulse 1s infinite",
                }} />
              ) : null}
            </div>
            <span style={{
              color: i < step ? DS.colors.success : i === step ? DS.colors.textPrimary : DS.colors.textDim,
              fontSize: 14, ...s.body, transition: "color 0.4s ease",
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP DÉMO — assemble tout
// ─────────────────────────────────────────────────────────────
export default function VoltraPart2() {
  // "generating" | "session" | "done"
  const [view, setView]           = useState("session");
  const [programme, setProgramme] = useState(MOCK_PROGRAMME);

  const mockUser = { sport: "basketball", objectif: "explosivité", niveau: "intermédiaire", frequence: 3 };
  const seance   = programme.semaines[0].seances[0];

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      body { background: ${DS.colors.bg}; }
      ::-webkit-scrollbar { display: none; }
      input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.05)} }
      @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Boutons de démo pour naviguer entre les vues
  const DemoNav = () => (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 999,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {[
        { label: "🤖 Génération IA", v: "generating" },
        { label: "🏋️ Séance live",  v: "session"    },
      ].map(({ label, v }) => (
        <button key={v} onClick={() => setView(v)} style={{
          padding: "8px 14px", background: view === v ? DS.colors.primary : DS.colors.surfaceUp,
          border: `1px solid ${view === v ? DS.colors.primary : DS.colors.border}`,
          borderRadius: DS.radius.md, color: DS.colors.textPrimary,
          fontSize: 12, cursor: "pointer", ...s.heading,
          boxShadow: view === v ? DS.shadow.primary : "none",
        }}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ background: DS.colors.bg, minHeight: "100vh" }}>
      <DemoNav />

      {view === "generating" && (
        <GenerationScreen
          userParams={mockUser}
          onDone={prog => { setProgramme(prog); setView("session"); }}
          onError={err => console.error(err)}
        />
      )}

      {view === "session" && (
        <SeanceScreen
          seance={seance}
          onFinish={() => setView("done")}
          onBack={() => {}}
        />
      )}

      {view === "done" && (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 20, padding: 32,
        }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <h2 style={{ ...s.display, fontSize: 28, color: DS.colors.textPrimary, textAlign: "center" }}>
            Programme terminé
          </h2>
          <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body, textAlign: "center" }}>
            La progression automatique est calculée.<br />Prochaine séance adaptée.
          </p>
          <button onClick={() => setView("session")} style={{
            marginTop: 16, padding: "14px 32px",
            background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`,
            borderRadius: DS.radius.md, color: DS.colors.primary,
            fontSize: 15, cursor: "pointer", ...s.heading,
          }}>
            ← Recommencer la démo
          </button>
        </div>
      )}
    </div>
  );
}