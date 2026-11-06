import { useState } from "react";
import { LogoVoltra } from "./Logo";
import { usePwa, appliquerMaj, estInstallee } from "./pwa";

const STYLES = `
  .vm-toast { animation: vmDescend 560ms var(--ease-spring, ease-out) backwards; }
  .vm-sort { animation: vmSort 180ms ease-in forwards; }
  @keyframes vmDescend { from { opacity: 0; transform: translateY(-130%) scale(0.96); } }
  @keyframes vmSort { to { opacity: 0; transform: translateY(-40%) scale(0.98); } }
  /* L'éclair se charge une fois, à l'arrivée du toast */
  .vm-charge { animation: vmCharge 900ms var(--ease-out, ease-out) 320ms backwards; }
  @keyframes vmCharge { 0% { transform: scale(0.82); opacity: 0.55; } 55% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  .vm-rond { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid rgba(14,16,15,0.3); border-top-color: #0E100F; animation: vmTourne 700ms linear infinite; }
  @keyframes vmTourne { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .vm-toast, .vm-sort, .vm-charge { animation: none !important; }
  }
`;

// Toast « Nouvelle version disponible » : seulement sur un écran où recharger ne fait rien perdre
export function MiseAJour() {
  const { majDispo, calme } = usePwa();
  const [plusTard, setPlusTard] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [enCours, setEnCours] = useState(false);

  if (!majDispo || plusTard || (!calme && !enCours)) return null;

  const mettreAJour = () => {
    setEnCours(true);
    appliquerMaj();
    // Si le navigateur ne recharge pas tout seul
    setTimeout(() => window.location.reload(), 4000);
  };

  return (
    <div
      role="status"
      className={sortie ? "vm-sort" : "vm-toast"}
      style={{ position: "fixed", zIndex: 1500, top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 12, right: 12, maxWidth: 406, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px 9px 9px", borderRadius: 999, background: "#16181C", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 36px rgba(0,0,0,0.32)", fontFamily: "'Inter',sans-serif" }}
    >
      <style>{STYLES}</style>
      <LogoVoltra taille={34} className="vm-charge" style={{ borderRadius: "50%" }} />
      <p style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Nouvelle version disponible</p>
      {!enCours && (
        <button onClick={() => { setSortie(true); setTimeout(() => setPlusTard(true), 190); }} aria-label="Plus tard" style={{ width: 30, height: 34, flexShrink: 0, background: "none", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
        </button>
      )}
      <button onClick={mettreAJour} disabled={enCours} style={{ height: 36, minWidth: 112, flexShrink: 0, padding: "0 14px", border: "none", borderRadius: 999, background: "#9BE84F", color: "#0E100F", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 }}>
        {enCours ? <span className="vm-rond" /> : "Mettre à jour"}
      </button>
    </div>
  );
}

// Barre d'état de l'app installée : l'heure et la batterie sont blanches, illisibles sur le fond clair
export function FondBarreEtat() {
  const { theme } = usePwa();
  if (theme !== "light" || !estInstallee()) return null;
  return <div aria-hidden="true" style={{ position: "fixed", zIndex: 1400, top: 0, left: 0, right: 0, height: "calc(env(safe-area-inset-top, 0px) + 10px)", background: "linear-gradient(180deg, rgba(14,16,15,0.88), rgba(14,16,15,0.7) 70%, rgba(14,16,15,0))", pointerEvents: "none" }} />;
}
