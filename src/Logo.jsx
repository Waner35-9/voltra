import { FORME_LOGO, VERT_LOGO, FOND_LOGO_HAUT, FOND_LOGO_BAS } from "./logoForme";

// La tuile noire du logo : la même dans les deux thèmes
export function LogoVoltra({ taille = 36, className, style, children }) {
  return (
    <div className={className} style={{ width: taille, height: taille, flexShrink: 0, borderRadius: taille * 0.3, background: `linear-gradient(180deg, ${FOND_LOGO_HAUT}, ${FOND_LOGO_BAS})`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <svg viewBox="0 0 1024 1024" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
        <polygon points={FORME_LOGO} fill={VERT_LOGO} />
      </svg>
      {children}
    </div>
  );
}
