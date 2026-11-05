// Vérifications avant commit : pas de bloc d'aperçu oublié, pas de fonction déclarée deux fois (écran blanc), build qui passe.
import { readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const FICHIER = "src/App.jsx";
const lignes = readFileSync(FICHIER, "utf8").split("\n");
let erreurs = 0;

if (lignes.some(l => /APERCU-LOCAL|window\.__t\b/.test(l))) {
  console.log("Aperçu temporaire encore présent dans", FICHIER);
  erreurs++;
}

// Même nom déclaré deux fois dans le même bloc
const declaration = /^( *)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)\s*=?)/;
const vus = new Map();
lignes.forEach((ligne, i) => {
  const m = ligne.match(declaration);
  if (!m) return;
  const cle = `${m[2] || m[3]}|${m[1].length}`;
  const avant = vus.get(cle);
  if (avant !== undefined) {
    const memeBloc = lignes.slice(avant + 1, i).every(l => !l.trim() || l.length - l.trimStart().length >= m[1].length);
    if (memeBloc) {
      console.log(`Doublon : ${m[2] || m[3]} lignes ${avant + 1} et ${i + 1}`);
      erreurs++;
    }
  }
  vus.set(cle, i);
});

try {
  execSync("npx vite build", { stdio: "pipe" });
  console.log("Build OK");
} catch (e) {
  console.log(String(e.stdout || e.message).slice(-2000));
  erreurs++;
}
rmSync("dist", { recursive: true, force: true });

console.log(erreurs ? `${erreurs} problème(s)` : "Tout est bon");
process.exit(erreurs ? 1 : 0);
