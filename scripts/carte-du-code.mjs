// Génère cerveau/carte-du-code.md : où se trouve chaque chose dans le code, sans avoir à le relire.
// Lancé tout seul à chaque commit (.githooks/pre-commit), ou à la main : npm run cerveau
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const lignes = (fichier) => readFileSync(fichier, "utf8").split("\n");

// Blocs de premier niveau : fonctions, composants et constantes en majuscules
function blocs(contenu) {
  const trouves = [];
  contenu.forEach((ligne, i) => {
    const m = ligne.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/)
      || ligne.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_]+)\s*=>/)
      || ligne.match(/^(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\s*=/);
    if (m) trouves.push({ nom: m[1], debut: i + 1 });
  });
  return trouves.map((b, i) => ({ ...b, fin: (trouves[i + 1]?.debut ?? contenu.length + 1) - 1 }));
}

const uniques = (liste) => [...new Set(liste)].sort();
const chercher = (texte, regex) => uniques([...texte.matchAll(regex)].map(m => m[1]));

function section(fichier) {
  const contenu = lignes(fichier);
  const texte = contenu.join("\n");
  const sortie = [`## ${fichier} (${contenu.length} lignes)`, ""];
  const tables = chercher(texte, /\.from\("([a-z_]+)"\)/g);
  const rpc = chercher(texte, /\.rpc\("([a-z_]+)"/g);
  const secrets = chercher(texte, /Deno\.env\.get\("([A-Z_]+)"\)/g);
  const ecrans = chercher(texte, /screen === "([a-z-]+)"/g);
  if (ecrans.length) sortie.push(`Écrans : ${ecrans.join(", ")}`);
  if (tables.length) sortie.push(`Tables : ${tables.join(", ")}`);
  if (rpc.length) sortie.push(`Fonctions SQL : ${rpc.join(", ")}`);
  if (secrets.length) sortie.push(`Secrets lus (noms seulement) : ${secrets.join(", ")}`);
  if (sortie.length > 2) sortie.push("");
  for (const b of blocs(contenu)) {
    sortie.push(`- ${b.nom} : ${b.debut}-${b.fin}`);
    // Dans les gros composants, on note aussi leurs fonctions internes
    if (b.fin - b.debut < 300) continue;
    for (let i = b.debut; i < b.fin; i++) {
      const m = contenu[i].match(/^  const ([A-Za-z0-9_]+) = (?:async )?(?:\([^)]*\)|[a-zA-Z_]+) =>/);
      if (m) sortie.push(`  - ${m[1]} : ${i + 1}`);
    }
  }
  sortie.push("");
  return sortie;
}

const fonctions = readdirSync("supabase/functions", { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join("supabase/functions", d.name, "index.ts")))
  .map(d => join("supabase/functions", d.name, "index.ts"))
  .sort();
const sources = readdirSync("src").filter(f => /\.(jsx|js)$/.test(f)).map(f => join("src", f)).sort();

const carte = [
  "# Carte du code",
  "",
  "Générée automatiquement à chaque commit : ne pas modifier à la main.",
  "Pour lire un bloc : `sed -n 'début,finp' fichier`.",
  "",
  ...[...sources, ...fonctions].flatMap(section),
].join("\n");

writeFileSync("cerveau/carte-du-code.md", carte);
