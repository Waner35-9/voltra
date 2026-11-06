// Génère le favicon et les icônes de l'app à partir de la forme du logo : npm run icones
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { FORME_LOGO, VERT_LOGO, FOND_LOGO_HAUT, FOND_LOGO_BAS } from "../src/logoForme.js";

// echelle : taille de la marque dans la tuile. rayon : 0 pour un carré plein (iOS et Android arrondissent eux-mêmes).
function tuile({ echelle = 1, rayon = 0, lueur = true }) {
  const decale = 512 * (1 - echelle);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FOND_LOGO_HAUT}"/><stop offset="1" stop-color="${FOND_LOGO_BAS}"/></linearGradient>
    <radialGradient id="lueur"><stop offset="0" stop-color="${VERT_LOGO}" stop-opacity="0.18"/><stop offset="1" stop-color="${VERT_LOGO}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="${rayon}" fill="url(#fond)"/>
  ${lueur ? '<circle cx="512" cy="512" r="470" fill="url(#lueur)"/>' : ""}
  <polygon transform="translate(${decale} ${decale}) scale(${echelle})" points="${FORME_LOGO}" fill="${VERT_LOGO}"/>
</svg>
`;
}

function png(fichier, svg, taille, opaque = false) {
  const rendu = new Resvg(svg, { fitTo: { mode: "width", value: taille } }).render();
  if (opaque && rendu.pixels.some((v, i) => i % 4 === 3 && v !== 255)) throw new Error(`${fichier} : l'icône doit être sans transparence`);
  writeFileSync(`public/icons/${fichier}`, rendu.asPng());
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/favicon.svg", tuile({ rayon: 230, lueur: false }));
png("icon-192.png", tuile({ rayon: 230 }), 192);
png("icon-512.png", tuile({ rayon: 230 }), 512);
png("icon-maskable-512.png", tuile({ echelle: 0.8 }), 512, true); // marge de sécurité : tout tient dans le cercle central
png("apple-touch-icon.png", tuile({}), 180, true);
console.log("Icônes générées dans public/icons");
