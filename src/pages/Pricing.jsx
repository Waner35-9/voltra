import { useState, useEffect } from "react";

// ─── DESIGN SYSTEM (identique Voltra) ───────────────────────────
const DS = {
  colors: {
    bg: "#0A0A0F", surface: "#13131A", surfaceUp: "#1C1C26", surfaceHigh: "#242433",
    primary: "#6C63FF", primaryGlow: "rgba(108,99,255,0.18)", primarySoft: "rgba(108,99,255,0.10)",
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

// ─── DONNÉES DES PLANS ──────────────────────────────────────────
const PLANS = [
  {
    id: "monthly",
    label: "Mensuel",
    price: 12.99,
    unit: "/ mois",
    priceDetail: "Résiliable à tout moment",
    color: DS.colors.primary,
    colorSoft: DS.colors.primarySoft,
    colorBorder: DS.colors.borderAccent,
    badge: null,
    cta: "Commencer maintenant",
    highlight: false,
  },
  {
    id: "annual",
    label: "Annuel",
    price: 69.99,
    unit: "/ an",
    priceDetail: "soit 5,83€ / mois",
    savings: "Économise 58%",
    color: DS.colors.success,
    colorSoft: DS.colors.successSoft,
    colorBorder: "rgba(0,229,160,0.35)",
    badge: "Le plus populaire",
    cta: "Choisir l'annuel",
    highlight: true,
  },
  {
    id: "lifetime",
    label: "À vie",
    price: 149,
    unit: "une fois",
    priceDetail: "Accès permanent · Toutes les futures features",
    savings: "Offre de lancement",
    color: DS.colors.gold,
    colorSoft: DS.colors.goldSoft,
    colorBorder: "rgba(255,209,102,0.35)",
    badge: "⏳ Limité au lancement",
    cta: "Saisir l'offre",
    highlight: false,
    urgency: true,
  },
];

const FEATURES_FREE = [
  "1 programme généré (4 semaines)",
  "3 séances / semaine",
  "Suivi basique sets & reps",
  "Historique 2 semaines",
];

const FEATURES_PRO = [
  { text: "Programmes illimités + regénération IA", hot: true },
  { text: "Progression automatique des charges", hot: true },
  { text: "Adaptation si séance skippée", hot: false },
  { text: "Déload automatique intelligent", hot: false },
  { text: "Historique complet + graphiques avancés", hot: false },
  { text: "Jusqu'à 5 séances / semaine", hot: false },
  { text: "Coach IA intégré (questions libres)", hot: true },
  { text: "Export PDF du programme", hot: false },
  { text: "Accès prioritaire nouveaux sports", hot: false },
];

// ─── COMPOSANTS ─────────────────────────────────────────────────

function CheckIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill={color + "20"} />
      <path d="M7 12.5L10.5 16L17 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill={DS.colors.surfaceHigh} />
      <path d="M9 9L15 15M15 9L9 15" stroke={DS.colors.textDim} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlanCard({ plan, selected, onSelect }) {
  const [pressed, setPressed] = useState(false);
  const isHighlight = plan.highlight;

  return (
    <div
      onClick={() => onSelect(plan.id)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        position: "relative",
        background: selected ? plan.colorSoft : DS.colors.surface,
        border: `1.5px solid ${selected ? plan.colorBorder : DS.colors.border}`,
        borderRadius: DS.radius.xl,
        padding: isHighlight ? "22px 20px" : "18px 20px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: pressed ? "scale(0.98)" : selected && isHighlight ? "scale(1.01)" : "scale(1)",
        boxShadow: selected ? `0 0 32px ${plan.color}20` : DS.shadow.card,
      }}
    >
      {/* Ligne de couleur en haut si sélectionné */}
      {selected && (
        <div style={{
          position: "absolute", top: 0, left: 20, right: 20, height: 2,
          background: plan.color, borderRadius: DS.radius.full,
          boxShadow: `0 0 12px ${plan.color}`,
        }} />
      )}

      {/* Badge */}
      {plan.badge && (
        <div style={{
          display: "inline-flex", alignItems: "center",
          padding: "3px 10px",
          background: plan.colorSoft,
          border: `1px solid ${plan.colorBorder}`,
          borderRadius: DS.radius.full,
          color: plan.color, fontSize: 11,
          ...s.heading,
          marginBottom: 12,
        }}>
          {plan.badge}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 4 }}>
            {plan.label}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ ...s.display, fontSize: 32, color: selected ? plan.color : DS.colors.textPrimary }}>
              {plan.price}€
            </span>
            <span style={{ color: DS.colors.textSec, fontSize: 14, ...s.body }}>
              {plan.unit}
            </span>
          </div>
        </div>

        {/* Radio indicator */}
        <div style={{
          width: 24, height: 24,
          borderRadius: DS.radius.full,
          border: `2px solid ${selected ? plan.color : DS.colors.textDim}`,
          background: selected ? plan.color : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease",
          flexShrink: 0,
          boxShadow: selected ? `0 0 10px ${plan.color}60` : "none",
        }}>
          {selected && (
            <div style={{
              width: 8, height: 8, borderRadius: DS.radius.full,
              background: "white",
            }} />
          )}
        </div>
      </div>

      {/* Détail prix */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
          {plan.priceDetail}
        </p>
        {plan.savings && (
          <span style={{
            padding: "2px 8px",
            background: plan.colorSoft,
            borderRadius: DS.radius.full,
            color: plan.color, fontSize: 11,
            ...s.heading,
          }}>
            {plan.savings}
          </span>
        )}
      </div>
    </div>
  );
}

function CTAButton({ plan, onClick }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: "100%", height: 58,
        background: plan.highlight
          ? `linear-gradient(135deg, ${DS.colors.success}, #00C896)`
          : plan.urgency
          ? `linear-gradient(135deg, ${DS.colors.gold}, #F0B800)`
          : `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: DS.radius.md,
        color: plan.urgency ? "#0A0A0F" : "white",
        fontSize: 16,
        cursor: "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "all 0.15s ease",
        boxShadow: plan.highlight
          ? `0 8px 32px rgba(0,229,160,0.35)`
          : plan.urgency
          ? `0 8px 32px rgba(255,209,102,0.35)`
          : DS.shadow.primary,
        ...s.heading,
      }}
    >
      {plan.cta} →
    </button>
  );
}

// ─── ÉCRAN PRICING PRINCIPAL ─────────────────────────────────────
function PricingScreen({ onClose, trigger = "manual" }) {
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [showFeatures, setShowFeatures] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 47, s: 12 });

  // Compte à rebours urgence lifetime
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) return prev;
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const currentPlan = PLANS.find(p => p.id === selectedPlan);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: DS.colors.bg,
      overflowY: "auto",
      maxWidth: 430, margin: "0 auto",
    }}>
      <div style={{ padding: "0 20px 100px" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 56, paddingBottom: 32,
        }}>
          <div />
          {onClose && (
            <button onClick={onClose} style={{
              background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`,
              borderRadius: DS.radius.full, width: 36, height: 36,
              color: DS.colors.textSec, fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              ×
            </button>
          )}
        </div>

        {/* Titre contextuel selon le déclencheur */}
        <div style={{ marginBottom: 32 }}>
          {trigger === "end_week" ? (
            <>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px",
                background: DS.colors.successSoft, border: `1px solid rgba(0,229,160,0.3)`,
                borderRadius: DS.radius.full, marginBottom: 16,
              }}>
                <span style={{ color: DS.colors.success, fontSize: 13, ...s.heading }}>
                  🎯 Semaine 1 terminée
                </span>
              </div>
              <h1 style={{ ...s.display, fontSize: 30, color: DS.colors.textPrimary, lineHeight: 1.2, marginBottom: 10 }}>
                Tu as progressé de<br />
                <span style={{ color: DS.colors.success }}>+2.5 kg</span> sur le Squat.
              </h1>
              <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>
                La semaine 2 est prête. Continue avec Voltra Pro.
              </p>
            </>
          ) : (
            <>
              <p style={{ color: DS.colors.primary, fontSize: 13, ...s.heading, marginBottom: 10 }}>
                Voltra Pro
              </p>
              <h1 style={{ ...s.display, fontSize: 32, color: DS.colors.textPrimary, lineHeight: 1.15, marginBottom: 10 }}>
                L'app qui progresse<br />avec toi.
              </h1>
              <p style={{ color: DS.colors.textSec, fontSize: 15, ...s.body }}>
                Charges automatiques, IA intégrée, zéro réflexion.
              </p>
            </>
          )}
        </div>

        {/* Urgence lifetime */}
        <div style={{
          background: DS.colors.goldSoft,
          border: `1px solid rgba(255,209,102,0.25)`,
          borderRadius: DS.radius.md,
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <p style={{ color: DS.colors.gold, fontSize: 12, ...s.heading, marginBottom: 2 }}>
              ⏳ Offre Lifetime — Prix de lancement
            </p>
            <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
              Expire dans
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[timeLeft.h, timeLeft.m, timeLeft.s].map((val, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  background: DS.colors.surface,
                  border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.sm, padding: "4px 8px",
                  ...s.mono, fontSize: 18, color: DS.colors.gold, fontWeight: 700,
                  minWidth: 36, textAlign: "center",
                }}>
                  {pad(val)}
                </div>
                <span style={{ color: DS.colors.textDim, fontSize: 9, marginTop: 2, ...s.body }}>
                  {["h", "m", "s"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan === plan.id}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>

        {/* CTA principal */}
        <div style={{ marginBottom: 16 }}>
          <CTAButton plan={currentPlan} onClick={() => alert(`✅ Redirection paiement — Plan : ${currentPlan.label}`)} />
        </div>

        {/* Garantie */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 28,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7V12C3 16.97 6.84 21.54 12 23C17.16 21.54 21 16.97 21 12V7L12 2Z"
              stroke={DS.colors.textDim} strokeWidth="2" />
            <path d="M9 12L11 14L15 10" stroke={DS.colors.textDim} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p style={{ color: DS.colors.textDim, fontSize: 12, ...s.body }}>
            Paiement sécurisé · Annulation en 1 clic · Remboursement 7 jours
          </p>
        </div>

        {/* Comparaison Free vs Pro */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowFeatures(v => !v)}
            style={{
              width: "100%", background: "none", border: `1px solid ${DS.colors.border}`,
              borderRadius: DS.radius.md, padding: "14px 20px",
              color: DS.colors.textSec, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              ...s.heading,
            }}
          >
            <span>Voir la comparaison gratuit / pro</span>
            <span style={{ transition: "transform 0.2s", transform: showFeatures ? "rotate(180deg)" : "rotate(0deg)" }}>
              ↓
            </span>
          </button>

          {showFeatures && (
            <div style={{
              marginTop: 2,
              background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
              borderRadius: "0 0 " + DS.radius.md + "px " + DS.radius.md + "px",
              overflow: "hidden",
              animation: "fadeIn 0.2s ease",
            }}>
              {/* Header tableau */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 80px",
                padding: "12px 16px",
                background: DS.colors.surfaceHigh,
                borderBottom: `1px solid ${DS.colors.border}`,
              }}>
                <span style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading }}>Feature</span>
                <span style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, textAlign: "center" }}>Free</span>
                <span style={{ color: DS.colors.primary, fontSize: 12, ...s.heading, textAlign: "center" }}>Pro</span>
              </div>

              {/* Rows Free */}
              {FEATURES_FREE.map((f, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 80px",
                  padding: "11px 16px",
                  borderBottom: `1px solid ${DS.colors.border}`,
                  alignItems: "center",
                }}>
                  <span style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{f}</span>
                  <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon color={DS.colors.textSec} /></div>
                  <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon color={DS.colors.primary} /></div>
                </div>
              ))}

              {/* Rows Pro uniquement */}
              {FEATURES_PRO.map((f, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 80px",
                  padding: "11px 16px",
                  borderBottom: i < FEATURES_PRO.length - 1 ? `1px solid ${DS.colors.border}` : "none",
                  background: f.hot ? DS.colors.primarySoft : "transparent",
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: f.hot ? DS.colors.textPrimary : DS.colors.textSec, fontSize: 13, ...s.body }}>
                      {f.text}
                    </span>
                    {f.hot && (
                      <span style={{
                        padding: "1px 6px", background: DS.colors.primarySoft,
                        border: `1px solid ${DS.colors.borderAccent}`,
                        borderRadius: DS.radius.full, color: DS.colors.primary, fontSize: 10,
                        ...s.heading,
                      }}>
                        IA
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}><CrossIcon /></div>
                  <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon color={DS.colors.primary} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Social proof */}
        <div style={{
          background: DS.colors.surface, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.lg, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "flex", gap: -8, marginBottom: 12 }}>
            {["A", "M", "T", "R", "J"].map((l, i) => (
              <div key={i} style={{
                width: 28, height: 28,
                background: [DS.colors.primary, DS.colors.success, DS.colors.warning, "#FF63D4", DS.colors.primary][i],
                borderRadius: DS.radius.full, border: `2px solid ${DS.colors.bg}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "white", ...s.heading,
                marginLeft: i > 0 ? -8 : 0,
              }}>
                {l}
              </div>
            ))}
            <span style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginLeft: 12, display: "flex", alignItems: "center" }}>
              +214 athlètes ce mois
            </span>
          </div>
          <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, lineHeight: 1.6 }}>
            <span style={{ color: DS.colors.textPrimary }}>⭐⭐⭐⭐⭐</span><br />
            "La progression automatique des charges, c'est la feature qui change tout. J'ai pris 15 kg au squat en 6 semaines."
          </p>
          <p style={{ color: DS.colors.textDim, fontSize: 12, marginTop: 8, ...s.body }}>— Marcus, Basketball D3</p>
        </div>

        {/* Plan gratuit — lien discret */}
        <button style={{
          width: "100%", background: "none", border: "none",
          color: DS.colors.textDim, fontSize: 13, cursor: "pointer",
          textDecoration: "underline", textDecorationColor: DS.colors.textDim,
          ...s.body,
        }}>
          Continuer avec le plan gratuit
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${DS.colors.bg}; }
        ::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── DEMO WRAPPER ────────────────────────────────────────────────
export default function App() {
  const [trigger, setTrigger] = useState("manual");

  return (
    <div style={{ background: DS.colors.bg, minHeight: "100vh" }}>
      {/* Boutons demo pour tester les 2 contextes d'affichage */}
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 300,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <button
          onClick={() => setTrigger("manual")}
          style={{
            padding: "8px 14px", background: DS.colors.primary,
            border: "none", borderRadius: 10, color: "white",
            fontSize: 12, cursor: "pointer", ...s.heading,
          }}
        >
          Vue normale
        </button>
        <button
          onClick={() => setTrigger("end_week")}
          style={{
            padding: "8px 14px", background: DS.colors.success,
            border: "none", borderRadius: 10, color: DS.colors.bg,
            fontSize: 12, cursor: "pointer", ...s.heading,
          }}
        >
          Vue fin S1
        </button>
      </div>

      <PricingScreen trigger={trigger} />
    </div>
  );
}