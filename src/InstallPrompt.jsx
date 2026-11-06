import { useState } from "react";
import { LogoVoltra } from "./Logo";
import { usePwa, plateforme, fermerInvitation, lancerInstallation, momentBanniere } from "./pwa";

const STYLES = `
  .vi-entree { animation: viMonte 480ms var(--ease-spring, ease-out) backwards; }
  .vi-sort { animation: viSort 180ms ease-in forwards; }
  @keyframes viMonte { from { opacity: 0; transform: translateY(18px) scale(0.97); } }
  @keyframes viSort { to { opacity: 0; transform: translateY(10px) scale(0.98); } }
  /* Un repère vert passe sur l'étape 1, puis sur l'étape 2, deux fois, puis s'arrête */
  .vi-etape { position: relative; overflow: hidden; }
  .vi-etape::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: #9BE84F; opacity: 0; animation: viRepere 1100ms ease-out 1100ms 2 backwards; }
  .vi-etape svg { animation: viTape 1100ms var(--ease-spring, ease-out) 1100ms 2 backwards; }
  .vi-e2::before, .vi-e2 svg { animation-delay: 1650ms; }
  .vi-etape > * { position: relative; }
  @keyframes viRepere { 0%, 50%, 100% { opacity: 0; } 18% { opacity: 0.3; } }
  @keyframes viTape { 0%, 50%, 100% { transform: scale(1); } 18% { transform: scale(1.22); } }
  @media (prefers-reduced-motion: reduce) {
    .vi-entree, .vi-sort, .vi-etape::before, .vi-etape svg { animation: none !important; }
  }
`;

// Le carré avec la flèche de Safari
const IconePartager = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M8 8.5H6a1.5 1.5 0 0 0-1.5 1.5v9.5A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V10A1.5 1.5 0 0 0 18 8.5h-2" />
    <path d="M12 15V3M8 6.5 12 3l4 3.5" />
  </svg>
);
const IconeAjouter = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

// Bloc « Installe Voltra en 2 taps », placé dans la page : il ne recouvre jamais rien ni ne décale l'écran après coup.
// variante : « accueil » ou « tableau » (le tableau de bord attend le bon moment)
export function InstallPrompt({ variante = "accueil", ds }) {
  const { invitation, installee, fermee } = usePwa();
  const tableau = variante === "tableau";
  const [moment] = useState(() => tableau ? momentBanniere() : { ok: true });
  const [sortie, setSortie] = useState(false);
  const mode = plateforme();

  if (installee || fermee || !moment.ok || (mode === "autre" && !invitation)) return null;

  const c = ds.colors;
  const fermer = () => { setSortie(true); setTimeout(fermerInvitation, 190); };
  const titre = moment.apresSeance ? "Belle séance ! Garde Voltra à portée de main" : "Installe Voltra en 2 taps";
  const etape = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: c.surfaceUp, color: c.textPrimary, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };

  return (
    <div
      className={sortie ? "vi-sort" : "vi-entree"}
      style={{
        fontFamily: "'Inter',sans-serif", background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: "11px 12px", boxShadow: c.shadow?.card, animationDelay: sortie ? "0s" : moment.apresSeance ? "1200ms" : "500ms",
        ...(tableau ? { marginBottom: 16 } : { marginTop: -12, marginBottom: 16 }),
      }}
    >
      <style>{STYLES}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <LogoVoltra taille={28} />
        <p style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 14, lineHeight: 1.2, color: c.textPrimary }}>
          {mode === "ios-autre" ? "Installe l'app Voltra" : titre}
        </p>
        <button onClick={fermer} aria-label="Fermer" style={{ width: 32, height: 32, margin: "-4px -6px -4px 0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: c.textSec, cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
        </button>
      </div>
      {mode === "ios-safari" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
            <span className="vi-etape vi-e1" style={etape}><IconePartager /><span>Partager</span></span>
            <span aria-hidden="true" style={{ color: c.textSec, fontSize: 12, fontWeight: 700 }}>→</span>
            <span className="vi-etape vi-e2" style={etape}><IconeAjouter /><span>Sur l'écran d'accueil</span></span>
          </div>
          <p style={{ fontSize: 11, lineHeight: 1.3, color: c.textSec, marginTop: 7 }}>Pas de bouton Partager ? Regarde dans le menu ⋯</p>
        </>
      )}
      {mode === "ios-autre" && (
        <p style={{ fontSize: 12, lineHeight: 1.4, color: c.textSec, marginTop: 6 }}>Ouvre voltra-app.fr dans Safari pour installer l'app.</p>
      )}
      {mode === "autre" && (
        <button onClick={lancerInstallation} style={{ width: "100%", height: 42, marginTop: 10, border: "none", borderRadius: 999, background: c.primary, color: "#0E100F", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          Installer Voltra
        </button>
      )}
    </div>
  );
}
