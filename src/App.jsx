// @ts-nocheck
import { Fragment, useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ficheExercice, alternativesDisponibles, machinesParCategorie } from "./catalogueEquipements";
import { IllustrationMachine, aUneIllustration } from "./illustrationsMachines";
import { LogoVoltra } from "./Logo";
import { InstallPrompt } from "./InstallPrompt";
import { signalerEcran, marquerSeanceTerminee } from "./pwa";

// Lien de confirmation d'email : on lit l'URL tout de suite, avant que Supabase ne la nettoie
const URL_AU_CHARGEMENT = window.location.hash + window.location.search;
let confirmationEmail = /type=signup|confirmed=true/.test(URL_AU_CHARGEMENT) ? "ok"
  : /error_code=/.test(URL_AU_CHARGEMENT) && !/type=recovery/.test(URL_AU_CHARGEMENT) ? "erreur"
  : null;

// Lien d'invitation : le code reste sur l'appareil jusqu'à la création du compte
const CLE_INVITATION = "voltra_invitation";
function lireInvitation() { try { return localStorage.getItem(CLE_INVITATION); } catch { return null; } }
function oublierInvitation() {
  try { localStorage.removeItem(CLE_INVITATION); } catch {}
  if (new URLSearchParams(window.location.search).has("invitation")) window.history.replaceState({}, document.title, window.location.pathname);
}
// L'adresse garde le code jusqu'à l'activation : « Ouvrir dans Safari » depuis WhatsApp ou Instagram doit le transmettre
const codeInvitationUrl = new URLSearchParams(window.location.search).get("invitation");
if (codeInvitationUrl) {
  try { localStorage.setItem(CLE_INVITATION, codeInvitationUrl); } catch {}
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getNiveauCycle(niveau) {
  if (!niveau) return 1;
  const n = niveau.toLowerCase();
  if (n === "avance" || n === "avancé") return 3;
  if (n === "intermediaire" || n === "intermédiaire") return 2;
  return 1;
}

async function generateProgramIA({ sport, objectif, niveau, frequence, cycle, equipement, materiel, chargeMaison, douleurs, poste, poids, age, taille, jours, rythme }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Pas de session");
  const startCycle = cycle || getNiveauCycle(niveau);
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-program`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ sport, objectif, niveau, frequence, cycle: startCycle, startCycle, equipement, materiel, chargeMaison, douleurs, poste, poids, age, taille, jours, rythme }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur generation");
  return data.programme;
}

const DAY_OPTIONS = [{ i: 1, l: "Lun" }, { i: 2, l: "Mar" }, { i: 3, l: "Mer" }, { i: 4, l: "Jeu" }, { i: 5, l: "Ven" }, { i: 6, l: "Sam" }, { i: 0, l: "Dim" }];
const DAY_NAMES = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
const DEFAULT_JOURS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };

// Le mot de la compétition selon le sport : un boxeur fait des combats, un nageur des courses
const COMPETITIONS = {
  combat: { nom: "combat", pl: "combats", f: false },
  natation: { nom: "course", pl: "courses", f: true },
  sprint: { nom: "course", pl: "courses", f: true },
};
// Le dernier sport connu est gardé sur le téléphone : pas de « match » affiché le temps que le profil charge
let SPORT_COURANT = (() => { try { return localStorage.getItem("voltra_sport") || "default"; } catch { return "default"; } })();
const definirSport = (sport) => {
  if (!sport || sport === SPORT_COURANT) return;
  SPORT_COURANT = sport;
  try { localStorage.setItem("voltra_sport", sport); } catch {}
};
function motsSport(sport = SPORT_COURANT) {
  const c = COMPETITIONS[sport] || { nom: "match", pl: "matchs", f: false };
  const maj = (t) => t[0].toUpperCase() + t.slice(1);
  return { ...c, Nom: maj(c.nom), Pl: maj(c.pl), un: `${c.f ? "une" : "un"} ${c.nom}`, Un: `${c.f ? "Une" : "Un"} ${c.nom}`, le: `${c.f ? "la" : "le"} ${c.nom}`, du: c.f ? `de la ${c.nom}` : `du ${c.nom}`, ton: `${c.f ? "ta" : "ton"} ${c.nom}`, prochain: `${c.f ? "ta prochaine" : "ton prochain"} ${c.nom}`, e: c.f ? "e" : "" };
}

// Rythme du club : jours d'entraînement, jour de match habituel, période de la saison
const SAISONS = [
  { id: "pre", l: "Pré-saison", s: "On construit la forme", ic: "🏗️" },
  { id: "saison", l: "En saison", get s() { return `En pleine période de ${motsSport().pl}`; }, ic: "🏆" },
  { id: "treve", l: "Trêve", s: "Pause entre deux saisons", ic: "🌴" },
];
const RYTHME_DEFAUT = { club: [], match: null, saison: "saison" };

// Club + match + Voltra : au-delà, la fatigue blesse. La trêve laisse de la marge.
function frequenceConseillee(rythme) {
  const charge = (rythme?.club?.length || 0) + (rythme?.match != null ? 1 : 0);
  const plafond = rythme?.saison === "pre" || rythme?.saison === "treve" ? 6 : 5;
  return Math.max(2, Math.min(5, plafond - charge));
}

// Les meilleurs jours Voltra : jamais le jour du match, si possible ni la veille ni un jour de club, et espacés
function joursConseilles(freq, rythme) {
  const club = rythme?.club || [], match = rythme?.match ?? null;
  const cout = (d) => (d === match ? 100 : 0) + (match !== null && (match - d + 7) % 7 === 1 ? 4 : 0) + (club.includes(d) ? 3 : 0) + (match !== null && (d - match + 7) % 7 === 1 ? 1 : 0);
  const ordre = [1, 2, 3, 4, 5, 6, 0];
  let meilleur = DEFAULT_JOURS[freq] || [1, 3, 5], record = Infinity;
  const essayer = (debut, choix) => {
    if (choix.length === freq) {
      const pos = choix.map(d => (d + 6) % 7);
      const serres = pos.filter((p, i) => (((pos[(i + 1) % pos.length] - p + 7) % 7) || 7) < 2).length;
      const score = choix.reduce((t, d) => t + cout(d), 0) + serres * 2;
      if (score < record) { record = score; meilleur = choix; }
      return;
    }
    for (let i = debut; i < 7; i++) essayer(i + 1, [...choix, ordre[i]]);
  };
  essayer(0, []);
  return meilleur;
}

// Types de séances : même nom que dans generate-program
const TYPES_SEANCE = {
  renforcement: { ic: "💪", l: "Renforcement", c: "#9BE84F" },
  cardio: { ic: "❤️", l: "Cardio", c: "#FF6B6B" },
  vitesse: { ic: "⚡", l: "Vitesse", c: "#FFB020" },
  mobilite: { ic: "🧘", l: "Mobilité", c: "#5AC8FA" },
};
const typeSeance = (seance) => TYPES_SEANCE[seance?.type] || null;
// Durée lisible : 30 s, 2 min, 1 min 30
const duree = (sec) => { const n = Math.round(Number(sec) || 0); return n < 60 ? `${n} s` : `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60}` : ""}`; };
// Ce qu'il faut faire : 3×8, 10×30 s, 20 min
const dosage = (ex) => Number(ex?.travailSec) > 0 ? `${ex.sets > 1 ? `${ex.sets}×` : ""}${duree(ex.travailSec)}` : `${ex?.sets || 1}×${ex?.reps ?? ""}`;

// ─────────────────────────────────────────────
// Garde-fous de charges (mêmes règles que la fonction serveur generate-program) :
// corrige aussi les programmes créés avant (ex. 90 kg d'haltères par main).
// Haltères et kettlebells : charge PAR MAIN / par unité.
// ─────────────────────────────────────────────
const RATIOS_CHARGE = {
  barre: { squat: [0.6, 0.9, 1.25], hinge: [0.7, 1.1, 1.5], bench: [0.45, 0.7, 0.95], ohp: [0.3, 0.45, 0.6], row: [0.4, 0.6, 0.8], thrust: [0.7, 1.1, 1.6], lunge: [0.3, 0.45, 0.65], olympic: [0.3, 0.5, 0.75], curl: [0.15, 0.25, 0.35], defaut: [0.3, 0.45, 0.6] },
  halteres: { squat: [0.12, 0.2, 0.3], hinge: [0.15, 0.25, 0.35], bench: [0.15, 0.25, 0.35], ohp: [0.1, 0.16, 0.22], row: [0.15, 0.25, 0.35], lunge: [0.1, 0.17, 0.25], curl: [0.06, 0.1, 0.14], raise: [0.04, 0.07, 0.11], olympic: [0.1, 0.15, 0.22], defaut: [0.08, 0.14, 0.2] },
  haltere_unique: { squat: [0.2, 0.3, 0.4], thrust: [0.2, 0.3, 0.45], defaut: [0.15, 0.25, 0.35] },
  kettlebell: { swing: [0.2, 0.3, 0.4], squat: [0.2, 0.3, 0.4], defaut: [0.12, 0.2, 0.28] },
  machine: { legpress: [1.0, 1.6, 2.4], squat: [0.5, 0.9, 1.3], bench: [0.35, 0.55, 0.8], ohp: [0.2, 0.35, 0.5], row: [0.35, 0.55, 0.8], curl: [0.12, 0.2, 0.3], raise: [0.1, 0.18, 0.25], triceps: [0.2, 0.3, 0.45], legext: [0.25, 0.45, 0.65], legcurl: [0.2, 0.35, 0.5], thrust: [0.6, 1.0, 1.5], hanche: [0.3, 0.45, 0.65], mollets: [0.4, 0.8, 1.2], abdos: [0.15, 0.3, 0.45], pecdeck: [0.25, 0.4, 0.6], defaut: [0.4, 0.6, 0.9] },
  poulie: { row: [0.3, 0.5, 0.7], curl: [0.1, 0.18, 0.25], triceps: [0.15, 0.25, 0.35], raise: [0.05, 0.1, 0.15], defaut: [0.2, 0.3, 0.45] },
};
const KETTLEBELLS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48];
const MEDBALLS = [2, 3, 4, 5, 6, 8, 10];
const SANS_CHARGE = /push[- ]?up|pull[- ]?up|chin[- ]?up|plank|jump|sprint|burpee|hop|bound|skip|crunch|sit[- ]?up|mountain climber|bear crawl|dip\b|bodyweight|body weight|band|elastic|wall sit|dead bug|bird dog|stretch|mobility|shuffle|carioca|run|drill|leg raise|hollow|superman/;

function detecterMateriel(ex) {
  const m = String(ex.materiel || "").toLowerCase();
  const n = `${ex.nomEn || ""} ${ex.nom || ""}`.toLowerCase();
  // Cardio, mobilité et tout ce qui se fait au chrono : jamais de charge
  if (m === "cardio" || m === "mobilite" || Number(ex.travailSec) > 0) return "poids_du_corps";
  if (/assisted|glute ham|back extension|captain|roman chair|sled|battle rope|rowing machine|air bike|ski ?erg/.test(n)) return "poids_du_corps";
  if (/medicine ball|med ball|medball/.test(n) || m === "medball") return "medball";
  if (/kettlebell|\bkb\b/.test(n) || m === "kettlebell") return "kettlebell";
  if (/dumbbell|\bdb\b|halt[eè]re/.test(n) || m === "halteres" || m === "haltere") {
    return /goblet|single dumbbell|one dumbbell|hip thrust|glute bridge/.test(n) ? "haltere_unique" : "halteres";
  }
  if (/cable|pulley|poulie/.test(n) || m === "poulie") return "poulie";
  if (/machine|leg press|lever|smith|hack squat|pendulum squat|belt squat|leg extension|leg curl|pec deck|lat pulldown|calf raise|presse/.test(n) || m === "machine") return "machine";
  if (/barbell|trap bar|hex bar|ez bar|\bbar\b|barre/.test(n) || m === "barre") return "barre";
  if (/weighted|lest/.test(n)) return "halteres";
  if (SANS_CHARGE.test(n) || m === "poids_du_corps" || m === "elastique") return "poids_du_corps";
  return m || "inconnu";
}

function detecterMouvement(ex) {
  const n = `${ex.nomEn || ""} ${ex.nom || ""}`.toLowerCase();
  if (/calf|mollet/.test(n)) return "mollets";
  if (/leg press|presse/.test(n)) return "legpress";
  if (/leg curl/.test(n)) return "legcurl";
  if (/leg extension/.test(n)) return "legext";
  if (/abduct|adduct|multi hip|kickback/.test(n)) return "hanche";
  if (/triceps|pushdown|seated dip/.test(n)) return "triceps";
  if (/abdominal|crunch|torso/.test(n)) return "abdos";
  if (/reverse pec|reverse fly|rear delt/.test(n)) return "raise";
  if (/pec deck|butterfly/.test(n)) return "pecdeck";
  if (/clean|snatch|jerk|epaul|arrach/.test(n)) return "olympic";
  if (/swing/.test(n)) return "swing";
  if (/hip thrust|glute bridge/.test(n)) return "thrust";
  if (/lunge|split squat|step[- ]?up|fente/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/deadlift|rdl|romanian|good morning|hinge|soulev/.test(n)) return "hinge";
  if (/bench|chest press|floor press|couch/.test(n)) return "bench";
  if (/overhead|shoulder press|military|push press|arnold|militaire/.test(n)) return "ohp";
  if (/row|pulldown|pull-down|rowing|tirage/.test(n)) return "row";
  if (/curl/.test(n)) return "curl";
  if (/raise|fly|flye|[eé]l[eé]vation/.test(n)) return "raise";
  return "defaut";
}

function securiserExercice(ex, p) {
  const materiel = detecterMateriel(ex);
  const mouvement = detecterMouvement(ex);
  const lvl = /^av/.test(String(p.niveau || "").toLowerCase()) ? 2 : /^inter/.test(String(p.niveau || "").toLowerCase()) ? 1 : 0;
  let max;
  if (!p.avecCharges || materiel === "poids_du_corps") max = 0;
  else if (materiel === "medball") max = [4, 6, 8][lvl];
  else {
    const table = RATIOS_CHARGE[materiel] || RATIOS_CHARGE.halteres;
    const poids = p.poids >= 30 && p.poids <= 250 ? p.poids : 65;
    const age = p.age || 25;
    const reps = Number((String(ex.reps ?? "").match(/\d+/) || [8])[0]);
    max = poids * (table[mouvement] || table.defaut)[lvl]
      * (age < 16 ? 0.7 : age < 18 ? 0.85 : age >= 55 ? 0.85 : 1)
      * (1 + Math.min(Math.max((p.cycle || 1) - 1, 0), 3) * 0.05)
      * (reps >= 15 ? 0.7 : reps >= 10 ? 0.85 : 1)
      * 1.1; // marge pour la semaine 3 (+10 %)
    // À la maison : jamais plus lourd que l'haltère ou la kettlebell la plus lourde
    if (p.plafond && ["halteres", "haltere_unique", "kettlebell"].includes(materiel)) max = Math.min(max, p.plafond);
  }
  let charge = Number(ex.chargeKg) || 0;
  if (max === 0) charge = 0;
  else if (charge <= 0) charge = max * 0.7;
  else charge = Math.min(charge, max);
  if (charge > 0) {
    if (materiel === "kettlebell") charge = [...KETTLEBELLS].reverse().find(k => k <= charge) ?? 4;
    else if (materiel === "medball") charge = [...MEDBALLS].reverse().find(k => k <= charge) ?? 2;
    else if (materiel === "halteres" || materiel === "haltere_unique") charge = Math.max(2, Math.floor(charge / 2) * 2);
    else if (materiel === "machine") charge = Math.max(5, Math.floor(charge / 5) * 5);
    else if (materiel === "barre") charge = Math.max(mouvement === "curl" ? 10 : 20, Math.floor(charge / 2.5) * 2.5);
    else charge = Math.max(2.5, Math.floor(charge / 2.5) * 2.5);
  }
  return { ...ex, chargeKg: charge, materiel, chargeUnite: materiel === "halteres" ? "par main" : (ex.chargeUnite || "") };
}

// Enregistre les jours d'entrainement choisis dans le programme
async function attachJours(prog, jours) {
  if (!prog?.id || !jours?.length) return prog;
  const dj = { ...(prog.data_json || {}), jours };
  try { await supabase.from("programmes").update({ data_json: dj }).eq("id", prog.id); } catch (e) { console.error(e); }
  return { ...prog, data_json: dj };
}

// Selecteur de jours (max = nombre de seances par semaine). Le jour du match n'est pas proposé.
function DayPicker({ jours, max, onChange, accent, rythme, sport }) {
  const m = motsSport(sport);
  const toggle = (i) => {
    if (i === rythme?.match) return;
    if (jours.includes(i)) onChange(jours.filter(d => d !== i));
    else if (jours.length < max) onChange([...jours, i]);
    else onChange([...jours.slice(1), i]);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        {DAY_OPTIONS.map(d => {
          const on = jours.includes(d.i);
          const match = d.i === rythme?.match;
          const tag = match ? m.Nom : rythme?.club?.includes(d.i) ? "Club" : "";
          return (
            <div key={d.i} onClick={() => toggle(d.i)} style={{ flex: 1, padding: tag ? "8px 0 6px" : "12px 0", textAlign: "center", borderRadius: 12, cursor: match ? "not-allowed" : "pointer", opacity: match ? 0.55 : 1, background: on ? accent : DS.colors.surfaceHigh, color: on ? "#000" : DS.colors.textSec, border: `1px solid ${on ? accent : DS.colors.border}`, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, transition: "var(--t-choix)" }}>
              {d.l}
              {tag && <span style={{ display: "block", fontSize: 9, fontWeight: 700, marginTop: 2, color: on ? "#000" : match ? "#E07800" : DS.colors.textDim }}>{tag}</span>}
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: jours.length === max ? accent : DS.colors.textSec, textAlign: "center", marginTop: 10 }}>
        {jours.length === max ? "✓ Jours choisis" : `Choisis ${max - jours.length} jour${max - jours.length > 1 ? "s" : ""} de plus`}
      </p>
    </div>
  );
}

// Saison, jours de club et jour de match (inscription et profil)
function RythmeClub({ rythme, onChange, accent, sport }) {
  const m = motsSport(sport);
  const r = { ...RYTHME_DEFAUT, ...(rythme || {}) };
  const police = { fontFamily: "'Inter',sans-serif" };
  const titre = { ...police, color: DS.colors.textSec, fontSize: 13, fontWeight: 700, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" };
  const jour = (on) => ({ ...police, flex: 1, padding: "12px 0", textAlign: "center", borderRadius: 12, cursor: "pointer", background: on ? accent : DS.colors.surfaceHigh, color: on ? "#000" : DS.colors.textSec, border: `1px solid ${on ? accent : DS.colors.border}`, fontSize: 12, fontWeight: 700, transition: "var(--t-choix)" });
  return (
    <div>
      <p style={titre}>Où en es-tu dans ta saison ?</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {SAISONS.map(sa => {
          const on = r.saison === sa.id;
          return (
            <button key={sa.id} onClick={() => onChange({ ...r, saison: sa.id })} style={{ ...police, flex: 1, padding: "12px 6px", borderRadius: 16, cursor: "pointer", textAlign: "center", background: on ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${on ? accent : DS.colors.border}`, color: DS.colors.textPrimary, transition: "var(--t-choix)" }}>
              <span style={{ display: "block", fontSize: 20 }}>{sa.ic}</span>
              <b style={{ display: "block", fontSize: 13, fontWeight: 800, marginTop: 4 }}>{sa.l}</b>
              <span style={{ display: "block", fontSize: 11, color: DS.colors.textSec, marginTop: 2, lineHeight: 1.3 }}>{sa.id === "saison" ? `En pleine période de ${m.pl}` : sa.s}</span>
            </button>
          );
        })}
      </div>
      <p style={titre}>Entraînements avec ton club</p>
      <div style={{ display: "flex", gap: 6 }}>
        {DAY_OPTIONS.map(d => {
          const on = r.club.includes(d.i);
          return <button key={d.i} onClick={() => onChange({ ...r, club: on ? r.club.filter(x => x !== d.i) : [...r.club, d.i] })} style={jour(on)}>{d.l}</button>;
        })}
      </div>
      <p style={{ ...police, fontSize: 12, color: DS.colors.textSec, margin: "8px 0 28px" }}>{r.club.length ? `${r.club.length} entraînement${r.club.length > 1 ? "s" : ""} par semaine` : "Pas de club ? Laisse vide."}</p>
      <p style={titre}>Jour de {m.nom} habituel</p>
      <div style={{ display: "flex", gap: 6 }}>
        {DAY_OPTIONS.map(d => {
          const on = r.match === d.i;
          return <button key={d.i} onClick={() => onChange({ ...r, match: on ? null : d.i })} style={jour(on)}>{d.l}</button>;
        })}
      </div>
      <button onClick={() => onChange({ ...r, match: null })} style={{ ...police, width: "100%", marginTop: 10, padding: 10, borderRadius: 12, cursor: "pointer", background: r.match === null ? DS.colors.primarySoft : "none", border: `1px solid ${r.match === null ? accent : DS.colors.border}`, color: DS.colors.textPrimary, fontSize: 13, fontWeight: 700 }}>Pas de {m.nom} régulier{m.e}</button>
    </div>
  );
}

// Titre + sous-titre d'une étape d'onboarding
function StepTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.02em", color: DS.colors.textPrimary, marginBottom: 8 }}>{title}</h1>
      {sub && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, lineHeight: 1.5, color: DS.colors.textSec }}>{sub}</p>}
    </div>
  );
}

// Règle graduée : on fait glisser, la graduation au centre est choisie (verticale = plus grand en haut)
const RULER_TICK = 12;
function RulerPicker({ min, max, value, onChange, vertical = false }) {
  const ref = useRef(null);
  const list = Array.from({ length: max - min + 1 }, (_, i) => vertical ? max - i : min + i);
  const [live, setLive] = useState(Math.max(0, list.indexOf(value)));
  const axis = vertical ? "scrollTop" : "scrollLeft";
  useEffect(() => { if (ref.current) ref.current[axis] = live * RULER_TICK; }, []);
  const onScroll = () => {
    const i = Math.min(list.length - 1, Math.max(0, Math.round(ref.current[axis] / RULER_TICK)));
    if (i !== live) { setLive(i); onChange(list[i]); }
  };
  const size = vertical ? 320 : 96;
  const spacer = `calc(50% - ${RULER_TICK / 2}px)`;
  const mask = `linear-gradient(${vertical ? "180deg" : "90deg"}, transparent, #000 25%, #000 75%, transparent)`;
  return (
    <div style={{ position: "relative", width: vertical ? 120 : "100%", height: size }}>
      <div ref={ref} onScroll={onScroll} style={{ display: "flex", flexDirection: vertical ? "column" : "row", width: "100%", height: "100%", overflowX: vertical ? "hidden" : "scroll", overflowY: vertical ? "scroll" : "hidden", scrollSnapType: `${vertical ? "y" : "x"} mandatory`, scrollbarWidth: "none", WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ flexShrink: 0, [vertical ? "height" : "width"]: spacer }} />
        {list.map((v, i) => {
          const major = v % 10 === 0, mid = v % 5 === 0;
          const len = major ? 40 : mid ? 28 : 16;
          const near = Math.abs(i - live) < 1;
          return (
            <div key={v} onClick={() => ref.current.scrollTo({ [vertical ? "top" : "left"]: i * RULER_TICK, behavior: "smooth" })} style={{ flexShrink: 0, position: "relative", scrollSnapAlign: "center", cursor: "pointer", display: "flex", flexDirection: vertical ? "row" : "column", alignItems: vertical ? "center" : "center", justifyContent: vertical ? "flex-end" : "flex-start", [vertical ? "height" : "width"]: RULER_TICK, [vertical ? "width" : "height"]: "100%" }}>
              <div style={{ [vertical ? "width" : "height"]: len, [vertical ? "height" : "width"]: 2, borderRadius: 1, background: near ? "transparent" : major ? DS.colors.textSec : DS.colors.textDim }} />
              {major && (
                <span style={{ position: "absolute", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, color: DS.colors.textSec, whiteSpace: "nowrap", ...(vertical ? { right: 56, top: "50%", transform: "translateY(-50%)" } : { top: 52, left: "50%", transform: "translateX(-50%)" }) }}>{v}</span>
              )}
            </div>
          );
        })}
        <div style={{ flexShrink: 0, [vertical ? "height" : "width"]: spacer }} />
      </div>
      {/* Repère central */}
      <div style={{ position: "absolute", pointerEvents: "none", background: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark, borderRadius: 2, boxShadow: `0 0 12px ${DS.colors.primaryGlow}`, ...(vertical ? { right: 0, top: "50%", width: 46, height: 4, transform: "translateY(-50%)" } : { top: 0, left: "50%", width: 4, height: 44, transform: "translateX(-50%)" }) }} />
    </div>
  );
}

async function saveCompleteSession(programmeId, seance, completedSetsData, feedback, durationMin) {
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const userId = session.user.id;
  try {
    const { data: seanceRecord, error: seanceError } = await supabase
      .from("seances")
      .insert({ programme_id: programmeId, user_id: userId, semaine: 1, jour: 1, titre: seance.titre, type: seance.type || "force_basse", duree_min: durationMin, statut: "faite", date_realisee: new Date().toISOString() })
      .select().single();
    if (seanceError) throw seanceError;

    for (let exI = 0; exI < seance.exercices.length; exI++) {
      const ex = seance.exercices[exI];
      // Échauffement et retour au calme ne sont pas enregistrés : ils ne comptent ni dans les charges ni dans la carte du corps
      if (ex.phase && ex.phase !== "principal") continue;
      // Cardio et mobilité : enregistrés sans muscle, pour ne pas colorer la carte du corps
      const sansMuscle = ["cardio", "mobilite"].includes(ex.materiel) || ["cardio", "mobilite"].includes(seance.type);
      const kgReels = Array.from({ length: ex.sets || 3 }, (_, setI) => completedSetsData[`${exI}-${setI}`]?.kg).filter(kg => kg > 0);
      const chargeReelle = kgReels.length ? Math.max(...kgReels) : (ex.chargeKg || 0);
      // Séance allégée (fatigue, gêne) : elle ne fait ni monter ni baisser les charges suivantes
      const chargePrevue = seance.allegee && ex.chargeKg > 0 ? Math.max(ex.chargeKg, chargeReelle) : (ex.chargeKg || 0);
      const { data: exRecord, error: exErr } = await supabase
        .from("exercices")
        .insert({ seance_id: seanceRecord.id, nom: ex.nom, muscles: sansMuscle ? "" : ex.muscles, sets: ex.sets, reps: String(ex.reps), charge_kg: chargePrevue, repos_sec: ex.reposSec || 90, ordre: exI + 1, conseil: ex.conseil })
        .select().single();
      if (exErr) continue;

      const repsParSet = [];
      for (let setI = 0; setI < (ex.sets || 3); setI++) {
        const setData = completedSetsData[`${exI}-${setI}`];
        repsParSet.push(setData?.reps || parseInt(ex.reps) || 8);
      }
      const repsCible = parseInt(ex.reps) || 8;
      const taux = repsParSet.filter(r => r >= repsCible).length / repsParSet.length;

      await supabase.from("logs_performance").insert({
        exercice_id: exRecord.id, seance_id: seanceRecord.id, user_id: userId,
        reps_par_set: repsParSet, charge_kg: chargeReelle, feedback: seance.allegee ? "good" : feedback,
        statut: taux === 1 ? "reussite" : taux >= 0.5 ? "partiel" : "echec",
      });
    }

    await supabase.rpc("calculer_progression", { p_user_id: userId, p_seance_id: seanceRecord.id, p_feedback: feedback });
    const { data: deload } = await supabase.rpc("check_deload_needed", { p_user_id: userId });
    if (deload) await supabase.rpc("appliquer_deload", { p_user_id: userId, p_raison: deload });

    let cycleTermine = false;
    // Faire progresser reellement la semaine du programme selon les JOURS DISTINCTS entraines
    // (et non le nombre brut de seances - evite qu'une double seance le meme jour ne fasse
    // avancer artificiellement la structure du programme sans le temps de recuperation reel)
    const { data: progData } = await supabase.from("programmes").select("frequence, total_semaines, semaine_courante").eq("id", programmeId).single();
    if (progData) {
      const { data: seancesDates } = await supabase
        .from("seances")
        .select("date_realisee")
        .eq("programme_id", programmeId)
        .eq("statut", "faite");
      const joursDistincts = new Set((seancesDates || []).map(s => new Date(s.date_realisee).toDateString())).size;
      const freq = progData.frequence || 3;
      const totalSem = progData.total_semaines || 4;
      const nouvelleSemaine = Math.min(Math.floor((joursDistincts || 1) / freq) + 1, totalSem);
      // Le cycle se termine quand toutes les séances prévues sont faites, pas au début de la dernière semaine
      cycleTermine = joursDistincts >= freq * totalSem;
      if (nouvelleSemaine !== progData.semaine_courante) {
        await supabase.from("programmes").update({ semaine_courante: nouvelleSemaine }).eq("id", programmeId);
      }
    }

    return { success: true, deload, cycleTermine };
  } catch (err) {
    console.error("saveCompleteSession:", err);
    return null;
  }
}


// ─────────────────────────────────────────────
// SPORT THEMES
// ─────────────────────────────────────────────
// Avatar du coach IA "Ace" - style manga guerrier
function AceAvatar({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: "50%", flexShrink: 0 }}>
      <defs>
        <linearGradient id="aceSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A2A2E" />
          <stop offset="100%" stopColor="#141416" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="#0A0A0C" />
      <path d="M30 38 Q30 20 50 20 Q70 20 70 38 L70 55 Q70 68 58 74 L50 78 L42 74 Q30 68 30 55 Z" fill="url(#aceSkin)" stroke="#9BE84F" strokeWidth="1.2" />
      <path d="M28 34 L22 14 L34 26 L38 8 L44 24 L50 6 L56 24 L62 8 L66 26 L78 14 L72 34" fill="#0A0A0C" stroke="#9BE84F" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M35 42 L45 45" stroke="#9BE84F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M65 42 L55 45" stroke="#9BE84F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M36 49 L44 49" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 49 L64 49" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 50 L48 60 L52 60" stroke="#5A5A5E" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M43 67 Q50 70 57 67" stroke="#9BE84F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M60 34 L64 46" stroke="#9BE84F" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

const SPORT_THEMES = {
  basketball: { accent: "#FF8C00", accentRgb: "255,140,0", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,140,0,0.06), transparent)" },
  football:   { accent: "#00D94F", accentRgb: "0,217,79",  bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(0,217,79,0.06), transparent)" },
  tennis:     { accent: "#FFE500", accentRgb: "255,229,0", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,229,0,0.06), transparent)" },
  rugby:      { accent: "#FF4500", accentRgb: "255,69,0",  bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,69,0,0.07), transparent)" },
  natation:   { accent: "#00C8FF", accentRgb: "0,200,255", bg: "radial-gradient(ellipse 400px 200px at 50% 0%, rgba(0,200,255,0.07), transparent)" },
  sprint:     { accent: "#FF2D55", accentRgb: "255,45,85", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(255,45,85,0.06), transparent)" },
  combat:     { accent: "#CC00FF", accentRgb: "204,0,255", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(204,0,255,0.07), transparent)" },
  default:    { accent: "#9BE84F", accentRgb: "155,232,79", bg: "radial-gradient(ellipse 300px 300px at 80% 0%, rgba(155,232,79,0.06), transparent)" },
};

// Couleur d'accent lisible : assombrie en thème clair pour rester lisible sur fond blanc
function accentLisible(hex) {
  if (DS.colors.isDark || !/^#[0-9a-f]{6}$/i.test(hex || "")) return hex;
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(c * 0.62);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function getSportTheme(sport) {
  return SPORT_THEMES[sport] || SPORT_THEMES.default;
}

// Alias for backwards compatibility
const s = {
  mono: { fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" },
  display: { fontFamily: "'Inter',sans-serif", fontWeight: 900, letterSpacing: "-0.02em", textTransform: "uppercase" },
  heading: { fontFamily: "'Inter',sans-serif", fontWeight: 700 },
  body: { fontFamily: "'Inter',sans-serif", fontWeight: 400 },
};

const THEMES = {
  light: {
    // Style B — Apple aesthetic, light
    bg: "#F5F5F7", surface: "#FFFFFF", surfaceUp: "#F5F5F7", surfaceHigh: "#E8E8ED",
    surfaceDark: "#ECEEF0", // light theme - slightly darker surface
    primary: "#9BE84F", primarySoft: "rgba(155,232,79,0.15)", primaryGlow: "rgba(155,232,79,0.3)",
    primaryDark: "#5FAE2E",
    success: "#34C759", successSoft: "rgba(52,199,89,0.12)",
    warning: "#FF9500", warningSoft: "rgba(255,149,0,0.10)",
    gold: "#FFD60A", goldSoft: "rgba(255,214,10,0.12)",
    textPrimary: "#1D1D1F", textSec: "#86868B", textDim: "#C7C7CC",
    border: "rgba(0,0,0,0.06)", borderAccent: "rgba(155,232,79,0.4)",
    shadow: { primary: "0 4px 24px rgba(155,232,79,0.3)", card: "0 2px 12px rgba(0,0,0,0.06)", glow: "0 0 40px rgba(155,232,79,0.2)" },
    navBg: "rgba(255,255,255,0.92)",
    stickyBg: "rgba(245,245,247,0.95)",
    heroText: "#FFFFFF",
    isDark: false,
  },
  dark: {
    // Style B — Apple aesthetic, dark
    bg: "#000000", surface: "#1C1C1E", surfaceUp: "#2C2C2E", surfaceHigh: "#3A3A3C",
    surfaceDark: "#1C1C1E",
    primary: "#9BE84F", primarySoft: "rgba(155,232,79,0.15)", primaryGlow: "rgba(155,232,79,0.3)",
    primaryDark: "#9BE84F",
    success: "#30D158", successSoft: "rgba(48,209,88,0.12)",
    warning: "#FF9F0A", warningSoft: "rgba(255,159,10,0.12)",
    gold: "#FFD60A", goldSoft: "rgba(255,214,10,0.12)",
    textPrimary: "#FFFFFF", textSec: "rgba(255,255,255,0.5)", textDim: "rgba(255,255,255,0.2)",
    border: "rgba(255,255,255,0.08)", borderAccent: "rgba(155,232,79,0.3)",
    shadow: { primary: "0 8px 32px rgba(155,232,79,0.2)", card: "none", glow: "0 0 40px rgba(155,232,79,0.15)" },
    navBg: "rgba(0,0,0,0.92)",
    stickyBg: "rgba(0,0,0,0.92)",
    heroText: "#FFFFFF",
    isDark: true,
  },
};

let DS = (() => {
  const saved = localStorage.getItem("voltra_theme") || "light";
  return { colors: THEMES[saved], radius: { sm: 10, md: 14, lg: 20, xl: 24, full: 9999 }, shadow: THEMES[saved].shadow };
})();

function applyTheme(theme) {
  DS = { colors: THEMES[theme], radius: { sm: 10, md: 14, lg: 20, xl: 24, full: 9999 }, shadow: THEMES[theme].shadow };
}

// Dégradé avec une courbe douce : pas de ligne visible derrière les boutons fixés en bas
const fonduBas = () => {
  const c = DS.colors.bg;
  return `linear-gradient(${c}00, ${c}1A 6%, ${c}59 13%, ${c}A6 20%, ${c}E6 27%, ${c} 34%)`;
};

// Marge du haut : identique dans Safari, et sous l'encoche dans l'app installée
const hautSur = (px) => `max(${px}px, calc(env(safe-area-inset-top, 0px) + 12px))`;

// Apparition en cascade seulement à la première visite d'un onglet : on y revient trop souvent pour la rejouer
const ongletsVus = new Set();
function useStaggerUneFois(cle) {
  const [premiere] = useState(() => !ongletsVus.has(cle));
  useEffect(() => { ongletsVus.add(cle); }, [cle]);
  return premiere ? "v-stagger" : undefined;
}

function PrimaryButton({ children, onClick, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", height: 56,
        background: disabled ? DS.colors.surfaceHigh : `linear-gradient(135deg, ${DS.colors.primary}, #7ED63A)`,
        border: "none", borderRadius: DS.radius.full,
        color: disabled ? DS.colors.textDim : "#0B0B0C", fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : DS.shadow.primary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative", overflow: "hidden",
        fontFamily: "'Inter',sans-serif", fontWeight: 700, ...style,
      }}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: DS.colors.textSec, fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 600, display: "block", marginBottom: 8, paddingLeft: 4 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        inputMode={type === "email" ? "email" : undefined}
        autoCapitalize={type === "text" ? undefined : "none"}
        autoCorrect={type === "text" ? undefined : "off"}
        autoComplete={type === "email" ? "email" : type === "password" ? "current-password" : undefined}
        placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 52, padding: "0 16px",
          background: DS.colors.surface,
          border: `1.5px solid ${focused ? DS.colors.primary : DS.colors.border}`,
          borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 16,
          outline: "none", transition: "border-color 160ms ease, box-shadow 160ms ease",
          boxShadow: focused ? `0 0 0 3px ${DS.colors.primarySoft}` : DS.shadow.card,
          fontFamily: "'Inter',sans-serif",
        }}
      />
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: DS.colors.surface,
      borderRadius: DS.radius.xl,
      padding: 20,
      boxShadow: DS.shadow.card,
      ...style,
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
    <div style={{ height: 6, background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: "100%", transform: `translateX(${width - 100}%)`,
        background: DS.colors.primary,
        borderRadius: DS.radius.full, transition: "transform 500ms var(--ease-out)",
        boxShadow: `0 0 8px ${DS.colors.primaryGlow}`,
      }} />
    </div>
  );
}

const Icons = {
  home: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinejoin="round" fill={a ? DS.colors.primarySoft : "none"} /></svg>,
  chart: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 20H21M5 20V12M9 20V8M13 20V14M17 20V4" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  user: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" /><path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke={a ? DS.colors.primaryDark : DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  arrow: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
  clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={DS.colors.textSec} strokeWidth="2" /><path d="M12 7V12L15 15" stroke={DS.colors.textSec} strokeWidth="2" strokeLinecap="round" /></svg>,
};

const MOCK_PROGRAM = {
  titre: "Explosivite Basketball", semaineCourante: 3, totalSemaines: 8, progression: 62,
  seancesDuJour: [{
    id: "s3_j1", titre: "Force & Explosivite", type: "force_basse", dureeMin: 48,
    exercices: [
      { id: "e1", nom: "Squat barre", muscles: "Quadriceps Fessiers", sets: 4, reps: "6-8", chargeKg: 75, reposSec: 120, conseil: "Descendre sous le parallele, genoux dans l'axe." },
      { id: "e2", nom: "Romanian Deadlift", muscles: "Ischio Lombaires", sets: 3, reps: "10", chargeKg: 60, reposSec: 90, conseil: "Dos plat, tension dans les ischios en bas." },
      { id: "e3", nom: "Box Jump", muscles: "Quadriceps Mollets", sets: 5, reps: "5", chargeKg: 0, reposSec: 150, conseil: "Atterrissage souple, amorti complet." },
      { id: "e4", nom: "Hip Thrust", muscles: "Fessiers", sets: 3, reps: "12", chargeKg: 70, reposSec: 75, conseil: "Pause 1s en haut, contraction max." },
      { id: "e5", nom: "Kettlebell Swing", muscles: "Fessiers Dorsaux", sets: 4, reps: "12", chargeKg: 20, reposSec: 90, conseil: "Puissance vient des hanches, pas des bras." },
    ],
  }],
  derniereSeance: { titre: "Haut du Corps", joursPasses: 2, dureeMin: 42, nbExercices: 5, gainKg: 2.5 },
};

const SPORTS = [
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "rugby", label: "Rugby", emoji: "🏉" },
  { id: "natation", label: "Natation", emoji: "🏊" },
  { id: "sprint", label: "Sprint", emoji: "🏃" },
  { id: "combat", label: "Combat", emoji: "🥊" },
];
const SPORT_EMOJIS = {
  basketball: "🏀", football: "⚽", tennis: "🎾",
  rugby: "🏉", natation: "🏊", sprint: "🏃", combat: "🥊", default: "⚡"
};

const OBJECTIFS_PAR_SPORT = {
  basketball: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "detente", label: "Detente verticale", desc: "Jump & reactivite", emoji: "🚀" },
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  football: [
    { id: "explosivite", label: "Explosivite", desc: "Accel & sprint", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
    { id: "force", label: "Force", desc: "Puissance physique", emoji: "🏋️" },
  ],
  tennis: [
    { id: "explosivite", label: "Explosivite", desc: "Reactivite & vitesse", emoji: "⚡" },
    { id: "force", label: "Force", desc: "Puissance de frappe", emoji: "🏋️" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  rugby: [
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
  ],
  natation: [
    { id: "endurance", label: "Endurance", desc: "Cardio & resistance", emoji: "🫁" },
    { id: "force", label: "Force haut du corps", desc: "Epaules & dorsaux", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
  ],
  sprint: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance & vitesse", emoji: "⚡" },
    { id: "force", label: "Force", desc: "Charges maximales", emoji: "🏋️" },
    { id: "detente", label: "Detente", desc: "Puissance impulsion", emoji: "🚀" },
  ],
  combat: [
    { id: "explosivite", label: "Explosivite", desc: "Puissance et vitesse de frappe", emoji: "⚡" },
    { id: "endurance", label: "Endurance", desc: "Cardio et resistance", emoji: "🫁" },
    { id: "force", label: "Force", desc: "Puissance maximale", emoji: "🏋️" },
    { id: "masse", label: "Masse musculaire", desc: "Hypertrophie", emoji: "💪" },
  ],
};
const OBJECTIFS = [];
const NIVEAUX = ["Debutant", "Intermediaire", "Avance"];
const PLANS = [
  { id: "annual", label: "Annuel", price: 74.99, displayPrice: "6,25 €", unit: "/ mois", priceDetail: "7 jours gratuits, puis 56,24 € la 1ère année (−25 %), puis 74,99 €/an", savings: "−58 %", badge: "LE PLUS POPULAIRE" },
  { id: "monthly", label: "Mensuel", price: 14.99, displayPrice: "14,99 €", unit: "/ mois", priceDetail: "7 jours gratuits, puis 14,99 €/mois", savings: null, badge: null },
];

// ─────────────────────────────────────────────
// MUSCLE ICONS SVG
// ─────────────────────────────────────────────
function getMuscleIcon(muscles, color) {
  const m = (muscles || "").toLowerCase();
  if (m.includes("quad")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="28" rx="7" ry="12" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="28" rx="7" ry="12" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="24" rx="4" ry="8" fill={color + "60"}/>
      <ellipse cx="32" cy="24" rx="4" ry="8" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("fessier")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="30" rx="10" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="30" rx="10" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="28" rx="6" ry="6" fill={color + "60"}/>
      <ellipse cx="32" cy="28" rx="6" ry="6" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("pectoral") || m.includes("chest")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M8 20 Q16 12 24 16 Q32 12 40 20 L40 32 Q32 38 24 34 Q16 38 8 32 Z" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <path d="M12 22 Q20 16 24 18 L24 32 Q16 36 12 30 Z" fill={color + "50"}/>
      <path d="M36 22 Q28 16 24 18 L24 32 Q32 36 36 30 Z" fill={color + "50"}/>
    </svg>
  );
  if (m.includes("dorsal") || m.includes("dos")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M8 12 Q16 8 24 10 Q32 8 40 12 L38 36 Q30 42 24 40 Q18 42 10 36 Z" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <path d="M12 14 Q20 10 24 12 L22 36 Q16 40 12 34 Z" fill={color + "50"}/>
      <path d="M36 14 Q28 10 24 12 L26 36 Q32 40 36 34 Z" fill={color + "50"}/>
    </svg>
  );
  if (m.includes("ischio")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="26" rx="7" ry="13" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="26" rx="7" ry="13" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="28" rx="4" ry="9" fill={color + "60"}/>
      <ellipse cx="32" cy="28" rx="4" ry="9" fill={color + "60"}/>
    </svg>
  );
  if (m.includes("mollet")) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="16" cy="30" rx="6" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="32" cy="30" rx="6" ry="10" fill={color + "30"} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="16" cy="32" rx="3" ry="6" fill={color + "60"}/>
      <ellipse cx="32" cy="32" rx="3" ry="6" fill={color + "60"}/>
    </svg>
  );
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="18" fill={color + "20"} stroke={color} strokeWidth="1.5"/>
      <path d="M16 24 Q20 16 24 20 Q28 16 32 24 Q28 32 24 28 Q20 32 16 24Z" fill={color + "60"}/>
    </svg>
  );
}

function getExerciceColor(type, index) {
  const palettes = {
    force_basse: ["#6C63FF", "#7B6EFF", "#8A7AFF", "#9B8BFF", "#AC9CFF"],
    force_haute: ["#FF63D4", "#FF70DA", "#FF7EE0", "#FF8CE6", "#FF9AEC"],
    explosivite: ["#FF6B35", "#FF7A45", "#FF8A55", "#FF9A66", "#FFAA77"],
    gainage: ["#00E5A0", "#10EBA8", "#20F1B0", "#30F7B8", "#40FDC0"],
  };
  const colors = palettes[type] || palettes.force_basse;
  return colors[index % colors.length];
}

const MOTIVATION = {
  rest: ["Recupere bien.", "Souffle, t'as bien bosse.", "Presque fini.", "Tu geres.", "Keep going."],
  complete: ["Propre !", "Excellent !", "Belle serie !", "On continue.", "Top !"],
  finish: ["Seance terminee", "Travail accompli.", "Champion.", "Incroyable.", "Respect."],
};
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─────────────────────────────────────────────
// TIMER DE REPOS
// ─────────────────────────────────────────────
function RestTimer({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(true);
  const ref = useRef(null);
  const [motivText] = useState(() => getRandom(MOTIVATION.rest));

  useEffect(() => { setLeft(seconds); setRunning(true); }, [seconds]);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) { onComplete?.(); return; }
    ref.current = setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(ref.current);
  }, [left, running]);

  const pct = ((seconds - left) / seconds) * 100;
  const pad = n => String(n).padStart(2, "0");
  const color = left > seconds * 0.6 ? DS.colors.primary : left > seconds * 0.3 ? DS.colors.warning : DS.colors.success;
  const circumference = 2 * Math.PI * 54;

  return (
    <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "28px 24px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: DS.shadow.card }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${color}10, transparent 70%)`, transition: "background 0.5s ease", pointerEvents: "none" }} />
      <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.heading, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>Temps de repos</p>
      <div style={{ position: "relative", width: 148, height: 148, margin: "0 auto 16px" }}>
        <svg width="148" height="148" viewBox="0 0 148 148" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="74" cy="74" r="54" fill="none" stroke={DS.colors.surfaceHigh} strokeWidth="10" />
          <circle cx="74" cy="74" r="54" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...s.mono, fontSize: 38, color, fontWeight: 700, lineHeight: 1, transition: "color 0.5s ease" }}>
            {pad(Math.floor(left / 60))}:{pad(left % 60)}
          </span>
          <span style={{ color: DS.colors.textDim, fontSize: 11, marginTop: 4 }}>sec</span>
        </div>
      </div>
      <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body, marginBottom: 20, fontStyle: "italic" }}>"{motivText}"</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setRunning(r => !r)} style={{ flex: 1, height: 44, background: "transparent", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textSec, fontSize: 14, cursor: "pointer", ...s.heading }}>
          {running ? "Pause" : "Reprendre"}
        </button>
        <button onClick={onComplete} style={{ flex: 1, height: 44, background: DS.colors.successSoft, border: `1px solid rgba(0,229,160,0.3)`, borderRadius: DS.radius.md, color: DS.colors.success, fontSize: 14, cursor: "pointer", ...s.heading }}>
          Passer
        </button>
      </div>
    </div>
  );
}

// Cache local + Edge Function pour les GIFs animés ExerciseDB
// ─────────────────────────────────────────────
// ECRAN SEANCE LIVE
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ANIMATIONS D'EXERCICES — motion design dessiné par l'app (rien à télécharger)
// Un athlète vectoriel, vu de profil, fait le mouvement en boucle avec son matériel.
// Une pose = position du bassin, inclinaison du buste, cibles des mains et des pieds ;
// genoux et coudes sont calculés automatiquement (cinématique inverse).
// Cible : [x, y] absolu, ["S", dx, dy] relatif à l'épaule, ["H", dx, dy] relatif au bassin.
// ─────────────────────────────────────────────
const SEG = { buste: 28, cou: 4, tete: 6, bras: 14, avantBras: 13, cuisse: 21, tibia: 20 };
const SOL = 92;

// Articulation intermédiaire (genou, coude) entre une origine et une cible ; sens = côté du pli
function ik2(o, cible, a, b, sens) {
  const dx = cible[0] - o[0], dy = cible[1] - o[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
  const t = Math.atan2(dy, dx) + sens * Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const mid = [o[0] + a * Math.cos(t), o[1] + a * Math.sin(t)];
  const dir = Math.atan2(cible[1] - mid[1], cible[0] - mid[0]);
  return [mid, [mid[0] + b * Math.cos(dir), mid[1] + b * Math.sin(dir)]];
}

const lerp = (a, b, k) => a + (b - a) * k;
function lerpCible(a, b, k) {
  if (typeof a[0] === "string" && a[0] === b[0]) return [a[0], lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
function resoudre(c, epaule, bassin) {
  if (c[0] === "S") return [epaule[0] + c[1], epaule[1] + c[2]];
  if (c[0] === "H") return [bassin[0] + c[1], bassin[1] + c[2]];
  return c;
}

const epauleDe = (hip, tDeg) => [hip[0] + SEG.buste * Math.sin(tDeg * Math.PI / 180), hip[1] - SEG.buste * Math.cos(tDeg * Math.PI / 180)];

// Cible intermédiaire : même repère -> on interpole dans ce repère ; repères différents -> on interpole les positions réelles
function cibleEntre(a, b, k, A, B, epaule, bassin) {
  if (typeof a[0] === "string" && a[0] === b[0]) return resoudre(lerpCible(a, b, k), epaule, bassin);
  const pa = resoudre(a, epauleDe(A.hip, A.t), A.hip), pb = resoudre(b, epauleDe(B.hip, B.t), B.hip);
  return [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
}

function calculerPose(A, B, k, def) {
  const bassin = [lerp(A.hip[0], B.hip[0], k), lerp(A.hip[1], B.hip[1], k)];
  const t = lerp(A.t, B.t, k) * Math.PI / 180;
  const epaule = epauleDe(bassin, lerp(A.t, B.t, k));
  const r = SEG.cou + SEG.tete;
  const tete = [epaule[0] + r * Math.sin(t + 0.12), epaule[1] - r * Math.cos(t + 0.12)];
  const jambes = [0, 1].map(i => {
    const pied = cibleEntre(A.pieds[i], B.pieds[i], k, A, B, epaule, bassin);
    return [bassin, ...ik2(bassin, pied, SEG.cuisse, SEG.tibia, def.sensJambe ?? -1)];
  });
  const bras = [0, 1].map(i => {
    const main = cibleEntre(A.mains[i], B.mains[i], k, A, B, epaule, bassin);
    return [epaule, ...ik2(epaule, main, SEG.bras, SEG.avantBras, def.sensBras ?? 1)];
  });
  return { bassin, epaule, tete, t, jambes, bras };
}

// Bibliothèque de mouvements (varie selon le matériel)
const DEBOUT = { hip: [50, 52], t: 2, pieds: [[52, SOL], [49, SOL]] };
const PEND = [["S", 1, 26], ["S", 0, 26]];
function construireMotif(motif, materiel) {
  switch (motif) {
    case "squat": {
      const mainsA = materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]]
        : materiel === "haltere_unique" || materiel === "kettlebell" ? [["S", 9, 6], ["S", 8, 6]]
        : materiel === "halteres" ? PEND : [["S", 4, 24], ["S", 3, 24]];
      const mainsB = materiel === "poids_du_corps" || materiel === "inconnu" ? [["S", 25, 2], ["S", 24, 2]] : mainsA;
      return { periode: 2.6, A: { ...DEBOUT, t: 4, mains: mainsA }, B: { hip: [40, 70], t: 40, pieds: DEBOUT.pieds, mains: mainsB }, equipDos: materiel === "barre" };
    }
    case "hinge":
      return { periode: 2.8, A: { ...DEBOUT, t: 4, mains: PEND }, B: { hip: [35, 58], t: 72, pieds: DEBOUT.pieds, mains: [["S", -2, 26], ["S", -3, 26]] } };
    case "swing":
      return { periode: 1.6, A: { hip: [37, 60], t: 62, pieds: DEBOUT.pieds, mains: [["H", 9, 13], ["H", 8, 13]] }, B: { ...DEBOUT, t: -3, mains: [["S", 25, 3], ["S", 24, 3]] } };
    case "ohp":
      return { periode: 2.4, A: { ...DEBOUT, t: 0, mains: [["S", 7, -1], ["S", 6, -1]] }, B: { ...DEBOUT, t: 0, mains: [["S", 2, -26], ["S", 1, -26]] } };
    case "bench":
      return { periode: 2.4, scene: "banc", sensBras: 1, A: { hip: [58, 63], t: -90, pieds: [[78, SOL], [75, SOL]], mains: [[39, 52], [38, 52]] }, B: { hip: [58, 63], t: -90, pieds: [[78, SOL], [75, SOL]], mains: [[30, 37], [29, 37]] } };
    case "row":
      return { periode: 2.2, A: { hip: [38, 57], t: 68, pieds: DEBOUT.pieds, mains: [["S", 0, 25], ["S", -1, 25]] }, B: { hip: [38, 57], t: 68, pieds: DEBOUT.pieds, mains: [["S", -7, 9], ["S", -8, 9]] } };
    case "lunge":
      return { periode: 2.6, A: { hip: [48, 55], t: 3, pieds: [[62, SOL], [32, SOL]], mains: materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]] : PEND }, B: { hip: [46, 70], t: 4, pieds: [[62, SOL], [32, SOL]], mains: materiel === "barre" ? [["S", -6, -1], ["S", -5, -1]] : PEND }, equipDos: materiel === "barre" };
    case "jump":
      return { periode: 1.5, ombre: true, A: { hip: [46, 65], t: 38, pieds: DEBOUT.pieds, mains: [["S", -12, 20], ["S", -13, 20]] }, B: { hip: [50, 36], t: 2, pieds: [[52, 76], [49, 76]], mains: [["S", 4, -25], ["S", 3, -25]] } };
    case "slam":
      return { periode: 1.4, A: { ...DEBOUT, t: -4, mains: [["S", 3, -25], ["S", 2, -25]] }, B: { hip: [40, 64], t: 55, pieds: DEBOUT.pieds, mains: [[63, 85], [62, 85]] } };
    case "pushup":
      return { periode: 2.2, A: { hip: [43, 74], t: 64, pieds: [[6, SOL], [7, SOL]], mains: [[68, SOL], [66, SOL]] }, B: { hip: [45, 85], t: 82, pieds: [[6, SOL], [7, SOL]], mains: [[68, SOL], [66, SOL]] } };
    case "plank":
      return { periode: 3.2, A: { hip: [40, 80], t: 74, pieds: [[6, SOL], [7, SOL]], mains: [[80, SOL], [78, SOL]] }, B: { hip: [40, 78], t: 73, pieds: [[6, SOL], [7, SOL]], mains: [[80, SOL], [78, SOL]] } };
    case "pullup":
      return { periode: 2.6, scene: "barre_traction", A: { hip: [50, 54], t: 0, pieds: [["H", -10, 36], ["H", -12, 36]], mains: [[46, -4], [54, -4]] }, B: { hip: [50, 30], t: 4, pieds: [["H", -10, 36], ["H", -12, 36]], mains: [[46, -4], [54, -4]] } };
    case "curl":
      return { periode: 2.2, A: { ...DEBOUT, t: 0, mains: [["S", 2, 26], ["S", 1, 26]] }, B: { ...DEBOUT, t: 0, mains: [["S", 9, 5], ["S", 8, 5]] } };
    case "raise":
      return { periode: 2.4, A: { ...DEBOUT, t: 0, mains: [["S", 1, 26], ["S", 0, 26]] }, B: { ...DEBOUT, t: 0, mains: [["S", 26, 0], ["S", 25, 0]] } };
    case "sprint":
      return { periode: 0.8, aller: true, A: { hip: [50, 54], t: 12, pieds: [[62, 80], [34, SOL]], mains: [["S", -10, 17], ["S", 13, 8]] }, B: { hip: [50, 54], t: 12, pieds: [[34, SOL], [62, 80]], mains: [["S", 13, 8], ["S", -10, 17]] } };
    case "thrust":
      return { periode: 2.4, scene: "banc_thrust", A: { hip: [48, 84], t: -45, pieds: [[72, SOL], [69, SOL]], mains: [["H", -2, -3], ["H", -3, -3]] }, B: { hip: [52, 64], t: -88, pieds: [[72, SOL], [69, SOL]], mains: [["H", -2, -3], ["H", -3, -3]] } };
    default:
      return construireMotif("squat", materiel);
  }
}

// Quel mouvement montrer pour cet exercice
function motifExercice(ex) {
  const n = `${ex?.nomEn || ""} ${ex?.nom || ""}`.toLowerCase();
  const materiel = detecterMateriel(ex || {});
  let motif = detecterMouvement(ex || {});
  const animationFiche = ficheExercice(ex)?.animation;
  if (animationFiche) motif = animationFiche;
  else if (/push[- ]?up|pompe/.test(n)) motif = "pushup";
  else if (/pull[- ]?up|chin[- ]?up|traction|pulldown|pull-down/.test(n)) motif = "pullup";
  else if (/plank|gainage|dead bug|bird dog|hollow|crunch|sit[- ]?up|pallof|mountain climber/.test(n)) motif = "plank";
  else if (/sprint|run|course|skip|high knee|carioca|shuffle|accel/.test(n)) motif = "sprint";
  else if (/jump|saut|hop|bound|burpee|plyo/.test(n)) motif = "jump";
  else if (materiel === "medball" || /slam|throw|lancer/.test(n)) motif = "slam";
  else if (motif === "olympic") motif = "jump";
  else if (motif === "legpress") motif = "squat";
  else if (motif === "defaut") motif = "squat";
  return { motif, materiel };
}

function ExerciseAnimation({ exercice, accent = "#9BE84F", couleur = "#F4F4F5" }) {
  const { motif, materiel } = motifExercice(exercice);
  const def = construireMotif(motif, materiel);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setPhase(0.46); return; }
    let raf, debut;
    const boucle = (ts) => {
      debut = debut ?? ts;
      setPhase(((ts - debut) / (def.periode * 1000)) % 1);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [motif, materiel]);

  // Aller (42 %), pause, retour (42 %), pause — courbe douce ; la course alterne sans pause
  const doux = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const k = def.aller
    ? (phase < 0.5 ? doux(phase * 2) : 1 - doux((phase - 0.5) * 2))
    : phase < 0.42 ? doux(phase / 0.42) : phase < 0.5 ? 1 : phase < 0.92 ? 1 - doux((phase - 0.5) / 0.42) : 0;
  const p = calculerPose(def.A, def.B, k, def);

  const membre = (pts, w, op) => <polyline points={pts.map(q => q.join(",")).join(" ")} fill="none" stroke={couleur} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={op} />;
  const mainsMilieu = [(p.bras[0][2][0] + p.bras[1][2][0]) / 2, (p.bras[0][2][1] + p.bras[1][2][1]) / 2];

  // Matériel dessiné dans les mains (ou sur le dos)
  const disque = (c, r) => (
    <g>
      <circle cx={c[0]} cy={c[1]} r={r} fill="#14161A" stroke={accent} strokeWidth="2.4" />
      <circle cx={c[0]} cy={c[1]} r={r * 0.28} fill={accent} />
    </g>
  );
  const haltere = (c, op) => (
    <g opacity={op} transform={`translate(${c[0]},${c[1]})`}>
      <rect x="-4.5" y="-0.9" width="9" height="1.8" rx="0.9" fill={accent} />
      <rect x="-5.5" y="-2.8" width="2.6" height="5.6" rx="1" fill={accent} />
      <rect x="2.9" y="-2.8" width="2.6" height="5.6" rx="1" fill={accent} />
    </g>
  );
  let equip = null;
  if (materiel === "barre") {
    const dos = def.equipDos ? [p.epaule[0] - 6 * Math.cos(p.t), p.epaule[1] - 6 * Math.sin(p.t) + 1] : mainsMilieu;
    equip = disque(dos, 8.5);
  } else if (materiel === "halteres") {
    equip = <>{haltere(p.bras[1][2], 0.45)}{haltere(p.bras[0][2], 1)}</>;
  } else if (materiel === "haltere_unique") {
    equip = <g transform={`rotate(90 ${mainsMilieu[0]} ${mainsMilieu[1]})`}>{haltere(mainsMilieu, 1)}</g>;
  } else if (materiel === "kettlebell") {
    equip = (
      <g>
        <path d={`M ${mainsMilieu[0] - 2.6} ${mainsMilieu[1] + 1.5} Q ${mainsMilieu[0]} ${mainsMilieu[1] - 3} ${mainsMilieu[0] + 2.6} ${mainsMilieu[1] + 1.5}`} fill="none" stroke={accent} strokeWidth="1.6" />
        <circle cx={mainsMilieu[0]} cy={mainsMilieu[1] + 5.5} r="4.6" fill={accent} />
      </g>
    );
  } else if (materiel === "medball") {
    equip = <circle cx={mainsMilieu[0]} cy={mainsMilieu[1] + 1} r="5.2" fill={accent} />;
  } else if (materiel === "poulie") {
    equip = <><line x1={mainsMilieu[0]} y1={mainsMilieu[1]} x2="96" y2="30" stroke={accent} strokeWidth="1.2" strokeDasharray="2 1.5" /><circle cx="96" cy="30" r="2.6" fill={accent} /></>;
  }

  const sceneCouleur = "rgba(255,255,255,0.14)";
  const hauteurSaut = Math.max(0, SOL - Math.max(p.jambes[0][2][1], p.jambes[1][2][1]));

  return (
    <svg viewBox="0 -14 100 112" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", overflow: "visible" }} aria-label={`Animation : ${exercice?.nom || "exercice"}`} role="img">
      <defs>
        <radialGradient id="voltraSol" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Sol et ombre */}
      <line x1="2" y1={SOL + 1.6} x2="98" y2={SOL + 1.6} stroke={sceneCouleur} strokeWidth="0.8" />
      <ellipse cx={p.bassin[0] + 2} cy={SOL + 1.6} rx={Math.max(8, 20 - hauteurSaut * 0.5)} ry="2.4" fill="url(#voltraSol)" />
      {/* Décor selon l'exercice */}
      {def.scene === "banc" && <g fill={sceneCouleur}><rect x="14" y="66" width="58" height="4.5" rx="2" /><rect x="20" y="70" width="2.5" height="22" /><rect x="64" y="70" width="2.5" height="22" /></g>}
      {def.scene === "banc_thrust" && <g fill={sceneCouleur}><rect x="4" y="66" width="28" height="4.5" rx="2" /><rect x="8" y="70" width="2.5" height="22" /><rect x="26" y="70" width="2.5" height="22" /></g>}
      {def.scene === "barre_traction" && <g><line x1="22" y1="-4" x2="78" y2="-4" stroke={sceneCouleur} strokeWidth="2.4" strokeLinecap="round" /><line x1="24" y1="-4" x2="24" y2={SOL} stroke={sceneCouleur} strokeWidth="1.2" /><line x1="76" y1="-4" x2="76" y2={SOL} stroke={sceneCouleur} strokeWidth="1.2" /></g>}
      {/* Membres du côté éloigné (en retrait) */}
      {membre(p.jambes[1], 6.4, 0.32)}
      {membre(p.bras[1], 5, 0.32)}
      {def.equipDos && equip}
      {/* Corps */}
      <line x1={p.bassin[0]} y1={p.bassin[1]} x2={p.epaule[0]} y2={p.epaule[1]} stroke={couleur} strokeWidth="9" strokeLinecap="round" />
      <circle cx={p.tete[0]} cy={p.tete[1]} r={SEG.tete} fill={couleur} />
      {membre(p.jambes[0], 7, 1)}
      {membre(p.bras[0], 5.4, 1)}
      {!def.equipDos && equip}
    </svg>
  );
}

// Faute de frappe probable (800 au lieu de 80) : très loin du poids prévu
const poidsAnormal = (kg, prevu) => kg > 500 || (kg > prevu * 1.5 && kg - prevu >= 15) || (kg < prevu * 0.4 && prevu - kg >= 10);

function ChampSerie({ label, valeur, unite, pas, onChange, accent }) {
  const changer = (delta) => onChange(String(Math.max(0, Math.round(((Number(valeur) || 0) + delta) * 100) / 100)));
  const bouton = { width: 40, height: 44, flexShrink: 0, borderRadius: 12, background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: 22, fontWeight: 700, cursor: "pointer" };
  return (
    <div style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "10px 8px" }}>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 4 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button aria-label={`${label} moins`} onClick={() => changer(-pas)} style={bouton}>−</button>
        <input aria-label={label} inputMode="decimal" value={valeur} onChange={e => onChange(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))} style={{ flex: 1, minWidth: 0, width: "100%", background: "none", border: "none", outline: "none", color: accent, fontFamily: "inherit", fontSize: 30, fontWeight: 900, textAlign: "center", padding: 0 }} />
        <button aria-label={`${label} plus`} onClick={() => changer(pas)} style={bouton}>+</button>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 4 }}>{unite}</p>
    </div>
  );
}

function SeanceScreen({ seance, onFinish, onBack, sport, isPro, resumeState, absentes = [], onRemplacer }) {
  const [saisieKg, setSaisieKg] = useState("");
  const [saisieReps, setSaisieReps] = useState("");
  const [aConfirmer, setAConfirmer] = useState(null);
  const poidsConfirme = useRef(null);
  const [exercices, setExercices] = useState(seance?.exercices || []);
  const [showRemplacer, setShowRemplacer] = useState(false);
  const [retenirAbsente, setRetenirAbsente] = useState(false);
  const [exIdx, setExIdx] = useState(resumeState?.exIdx || 0);
  const [setIdx, setSetIdx] = useState(resumeState?.setIdx || 0);
  const [resting, setResting] = useState(false);
  const [waitingRest, setWaitingRest] = useState(false);
  const [completedSets, setCompletedSets] = useState(resumeState?.completedSets || {});
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [startTime] = useState(() => resumeState?.elapsed ? Date.now() - resumeState.elapsed * 1000 : Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const theme = getSportTheme(sport);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Compte à rebours repos plein écran
  const [restLeft, setRestLeft] = useState(0);
  useEffect(() => {
    if (!resting) return;
    setRestLeft(currentEx?.reposSec || 90);
    const t = setInterval(() => {
      setRestLeft(p => {
        if (p <= 1) {
          clearInterval(t);
          setResting(false);
          enchainer.current = Number(currentEx?.travailSec) > 0;
          setSetIdx(i => i + 1);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resting]);

  const formatElapsed = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const currentEx = exercices[exIdx] || null;
  // Échauffement, corps de séance, retour au calme ; cardio et mobilité se font au chrono
  const phase = currentEx?.phase || "principal";
  const auChrono = Number(currentEx?.travailSec) > 0;
  const nbPhase = exercices.filter(e => (e.phase || "principal") === phase).length;
  const rangPhase = exercices.slice(0, exIdx + 1).filter(e => (e.phase || "principal") === phase).length;
  const [chrono, setChrono] = useState(null);
  const enchainer = useRef(false);
  // Nouvelle série : le chrono repart à zéro, ou démarre seul après la récupération d'un fractionné
  useEffect(() => {
    setChrono(enchainer.current && auChrono ? Number(currentEx.travailSec) : null);
    enchainer.current = false;
  }, [exIdx, setIdx]);
  useEffect(() => {
    if (!chrono || chrono <= 0) return;
    const t = setTimeout(() => setChrono(c => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [chrono]);
  useEffect(() => {
    if (chrono !== 0) return;
    setChrono(null);
    try { navigator.vibrate?.(300); } catch (e) {}
    validerSerie();
  }, [chrono]);
  const ficheCourante = ficheExercice(currentEx);
  const avecCharge = currentEx?.chargeKg > 0;
  const repsChiffrees = /^\d+(\s*[-–]\s*\d+)?$/.test(String(currentEx?.reps ?? "").trim());
  // Chaque série repart de la précédente, sinon de ce qui est prévu
  useEffect(() => {
    if (!currentEx) return;
    const deja = completedSets[`${exIdx}-${setIdx}`] || completedSets[`${exIdx}-${setIdx - 1}`];
    setSaisieKg(String(deja?.kg || currentEx.chargeKg || 0));
    setSaisieReps(String(deja?.reps || parseInt(currentEx.reps) || 8));
  }, [exIdx, setIdx, currentEx?.nom]);
  const alternatives = ficheCourante && ["machine", "poulie"].includes(ficheCourante.type) ? alternativesDisponibles(ficheCourante, absentes).slice(0, 4) : [];
  const remplacerCourant = (alt) => {
    const nouveau = onRemplacer(currentEx, alt, retenirAbsente && ficheCourante.id);
    setExercices(liste => liste.map((ex, i) => i === exIdx ? nouveau : ex));
    setShowRemplacer(false);
    setRetenirAbsente(false);
    setAnimKey(k => k + 1);
  };

  // Message coach proactif quand exercice change
  useEffect(() => {
    if (!currentEx) return;
    const intro = phase !== "principal"
      ? `${phase === "echauffement" ? "Échauffement" : "Retour au calme"} : **${currentEx.nom}**${auChrono ? ` pendant ${duree(currentEx.travailSec)}` : currentEx.reps ? `, ${currentEx.reps}` : ""}. ${currentEx.conseil || ""}`
      : auChrono
      ? `**${currentEx.nom}** : ${dosage(currentEx)}${currentEx.reposSec > 0 && currentEx.sets > 1 ? `, ${duree(currentEx.reposSec)} de récupération` : ""}. ${currentEx.intensite || ""}`
      : exIdx === 0
      ? `Séance lancée ! On commence par **${currentEx.nom}** — ${currentEx.sets} séries de ${currentEx.reps} reps. ${currentEx.chargeKg > 0 ? `Charge : ${currentEx.chargeKg}kg.` : ""} Je suis là si tu as besoin d'adapter. 💪`
      : `Exercice ${exIdx + 1}/${exercices.length} — **${currentEx.nom}**. ${currentEx.muscles ? `Muscles ciblés : ${currentEx.muscles}.` : ""} ${currentEx.chargeKg > 0 ? `${currentEx.chargeKg}kg, ${currentEx.sets}×${currentEx.reps}.` : `${currentEx.sets}×${currentEx.reps}.`}`;
    setCoachMessages([{ role: "assistant", text: intro }]);
  }, [exIdx, currentEx?.nom]);

  if (exercices.length === 0 && !showSummary) {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <Bloom echelle={0.8} />
        <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
        <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 24, color: DS.colors.textPrimary, marginBottom: 8 }}>Séance introuvable</h2>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, marginBottom: 24 }}>Le programme n'a pas encore d'exercices. Attends que la génération soit terminée.</p>
        <button onClick={() => onFinish && onFinish("skip", {}, 0)} style={{ padding: "12px 24px", background: DS.colors.primary, border: "none", borderRadius: DS.radius.full, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Retour au dashboard</button>
      </div>
    );
  }

  if (!currentEx && !showSummary) return null;

  const totalSets = currentEx ? (currentEx.sets || 4) : 4;
  const progressPct = currentEx ? Math.round(((exIdx + setIdx / totalSets) / exercices.length) * 100) : 100;
  const accentColor = theme.accent;

  const freeCoachMessages = coachMessages.filter(m => m.role === "user").length;
  const coachBlocked = !isPro && freeCoachMessages >= 2;

  const sendCoachMessage = async () => {
    if (!coachInput.trim() || coachLoading || coachBlocked) return;
    const userMsg = coachInput.trim();
    setCoachInput("");
    setCoachMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setCoachLoading(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      // Contexte complet de la séance
      const setsCompletes = Object.keys(completedSets).filter(k => k.startsWith(`${exIdx}-`)).length;
      const totalSetsEx = currentEx?.sets || 4;
      const exercicesCompletes = exercices.slice(0, exIdx).map(ex => ex.nom);
      const dureeMin = Math.floor(elapsed / 60);

      const sessionContext = {
        seance_titre: seance?.titre,
        adaptation_du_jour: seance?.adaptation,
        sport,
        exercice_actuel: {
          nom: currentEx?.nom,
          muscles: currentEx?.muscles,
          sets_total: totalSetsEx,
          sets_completes: setsCompletes,
          reps: currentEx?.reps,
          charge_kg: currentEx?.chargeKg || 0,
          index: exIdx + 1,
          total: exercices.length,
        },
        progression_seance: {
          exercices_completes: exercicesCompletes,
          exercices_restants: exercices.slice(exIdx + 1).map(ex => ex.nom),
          duree_ecoulee_min: dureeMin,
          pourcentage: Math.round(((exIdx + setsCompletes / totalSetsEx) / exercices.length) * 100),
        },
      };

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          message: userMsg,
          context: sessionContext,
          history: coachMessages.slice(-8),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoachMessages(prev => [...prev, { role: "assistant", text: data.reply || "Désolé, erreur." }]);
    } catch (err) {
      setCoachMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion. Réessaie." }]);
    }
    setCoachLoading(false);
  };

  const handleSetComplete = () => {
    const kg = Number(saisieKg);
    const deja = poidsConfirme.current;
    if (avecCharge && kg > 0 && poidsAnormal(kg, currentEx.chargeKg) && !(deja?.exIdx === exIdx && deja?.kg === kg)) {
      setAConfirmer(kg);
      return;
    }
    validerSerie();
  };

  const validerSerie = () => {
    const key = `${exIdx}-${setIdx}`;
    setCompletedSets(prev => ({ ...prev, [key]: {
      reps: repsChiffrees ? (Number(saisieReps) || parseInt(currentEx.reps) || 8) : (parseInt(currentEx.reps) || 8),
      kg: avecCharge ? (Number(saisieKg) || currentEx.chargeKg) : 0,
    } }));
    const msg = getRandom(MOTIVATION.complete);
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
    if (setIdx < totalSets - 1) {
      // Repos plein écran directement (sauf mobilité enchaînée sans pause)
      if (auChrono && !(currentEx.reposSec > 0)) setSetIdx(i => i + 1);
      else setResting(true);
    } else {
      if (exIdx < exercices.length - 1) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1200);
        setTimeout(() => { setExIdx(i => i + 1); setSetIdx(0); setAnimKey(k => k + 1); }, 500);
      } else {
        setTimeout(() => setShowSummary(true), 600);
      }
    }
  };

  const handlePause = () => {
    try {
      localStorage.setItem("voltra_paused_session", JSON.stringify({
        seance: { ...seance, exercices }, exIdx, setIdx, completedSets, elapsed, sport, savedAt: Date.now()
      }));
    } catch (e) {}
    setShowExitModal(false);
    onBack();
  };

  // ── ECRAN RECAPITULATIF ──
  if (showSummary) {
    const totalSetsCount = exercices.reduce((acc, ex) => acc + (ex.sets || 3), 0);
    const durationMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 20px", maxWidth: 430, margin: "0 auto", overflow: "hidden" }}>
        <Bloom echelle={0.8} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 300px 300px at 50% 30%, ${accentColor}08, transparent)`, pointerEvents: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40, position: "relative" }}>

          {/* Trophee */}
          <div style={{ width: 100, height: 100, borderRadius: 26, background: `${accentColor}15`, border: `2px solid ${accentColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, marginBottom: 24, boxShadow: `0 0 60px ${accentColor}30`, animation: "celebrate 0.6s var(--ease-spring)" }}>
            🏆
          </div>

          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>SEANCE TERMINEE</div>
          <h1 style={{ ...s.display, fontSize: 36, color: DS.colors.textPrimary, marginBottom: 6, textAlign: "center", letterSpacing: "0.02em" }}>{getRandom(MOTIVATION.finish).toUpperCase()}</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginBottom: 36, letterSpacing: "0.06em" }}>{(seance.titre || "").toUpperCase()}</p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 36 }}>
            {[
              { val: exercices.length, label: "EXO", color: accentColor },
              { val: totalSetsCount, label: "SERIES", color: DS.colors.success },
              { val: `${durationMin}`, label: "MIN", color: "#FF8C00" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: DS.colors.surface, border: `1px solid ${stat.color}25`, borderRadius: DS.radius.lg, padding: "18px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Ressenti */}
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Comment tu te sens ?</p>
          <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 24 }}>
            {[
              { id: "easy", emoji: "😤", label: "FACILE", color: accentColor },
              { id: "good", emoji: "💪", label: "PARFAIT", color: DS.colors.success },
              { id: "hard", emoji: "🔥", label: "DUR", color: "#FF4500" },
            ].map(fb => (
              <button key={fb.id} onClick={() => setFeedback(fb.id)} style={{ flex: 1, padding: "16px 8px", background: feedback === fb.id ? fb.color + "20" : DS.colors.surface, border: `2px solid ${feedback === fb.id ? fb.color : DS.colors.border}`, borderRadius: DS.radius.lg, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", transform: feedback === fb.id ? "scale(1.05)" : "scale(1)" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{fb.emoji}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", color: feedback === fb.id ? fb.color : DS.colors.textSec, fontSize: 10, letterSpacing: "0.06em" }}>{fb.label}</div>
              </button>
            ))}
          </div>

          <button onClick={() => onFinish(feedback, completedSets, exercices, durationMin)} disabled={!feedback} style={{ width: "100%", height: 56, background: feedback ? `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: feedback ? "#000" : DS.colors.textSec, fontSize: 15, cursor: feedback ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", boxShadow: feedback ? `0 8px 32px ${accentColor}40` : "none", transition: "var(--t-choix)" }}>
            {feedback ? "ENREGISTRER ET CONTINUER" : "SELECTIONNE TON RESSENTI"}
          </button>
        </div>
      </div>
    );
  }

  // ── ÉCRAN REPOS PLEIN ÉCRAN ──
  if (resting) {
    const restTotal = currentEx?.reposSec || 90;
    const restPct = (restLeft / restTotal) * 100;
    const nextSetNum = setIdx + 2; // série suivante (1-indexed)
    return (
      <div style={{ fontFamily: "'Inter',sans-serif", background: "linear-gradient(180deg, #0A2540 0%, #051426 100%)", minHeight: "100dvh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(10,132,255,0.25), transparent 70%)", pointerEvents: "none" }} />

        <div style={{ padding: `${hautSur(52)} 24px 0`, display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>EX {exIdx + 1}/{exercices.length}</p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.35em", color: "#5AC8FA", marginBottom: 12 }}>💨 RÉCUPÉRATION</p>
          <p style={{ fontSize: 140, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", textShadow: "0 0 60px rgba(90,200,250,0.4)" }}>{restLeft}</p>
          <div style={{ width: 200, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 4, marginTop: 24, overflow: "hidden" }}>
            <div style={{ width: "100%", transform: `translateX(${restPct - 100}%)`, height: "100%", background: "#5AC8FA", borderRadius: 4, transition: "transform 1s linear" }} />
          </div>
        </div>

        <div style={{ padding: "0 20px 32px", position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 18px", marginBottom: 14 }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginBottom: 6 }}>ENSUITE</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800 }}>{currentEx.nom} — Série {nextSetNum}/{totalSets}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{auChrono ? `${duree(currentEx.travailSec)}${currentEx.intensite ? ` · ${currentEx.intensite}` : ""} · démarre tout seul` : `${currentEx.reps} reps${avecCharge ? ` · ${saisieKg} kg` : ""}`}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(90,200,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎯</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRestLeft(r => r + 30)} style={{ flex: 1, height: 52, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>+30 sec</button>
            <button onClick={() => { setResting(false); enchainer.current = auChrono; setSetIdx(i => i + 1); }} style={{ flex: 2, height: 52, background: "#5AC8FA", border: "none", borderRadius: 16, color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Reprendre →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉCRAN EFFORT — photo + zone focus ──
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", minHeight: "100dvh", background: "#000", maxWidth: 430, margin: "0 auto", position: "relative", display: "flex", flexDirection: "column", color: "white" }}>

      {/* Celebration */}
      {celebrate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 80, animation: "celebrate 0.6s var(--ease-spring) forwards" }}>💥</div>
          <div style={{ position: "absolute", fontSize: 40, top: "35%", left: "20%", animation: "floatUp 1s ease forwards", opacity: 0 }}>⚡</div>
          <div style={{ position: "absolute", fontSize: 30, top: "30%", right: "20%", animation: "floatUp 1s ease forwards", animationDelay: "0.15s", opacity: 0 }}>✨</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: `calc(${hautSur(50)} + 30px)`, left: "50%", transform: "translateX(-50%)", background: accentColor, color: "#000", padding: "8px 20px", borderRadius: 999, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 800, zIndex: 200, boxShadow: `0 4px 20px ${accentColor}60`, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Modal de sortie — stats + pause */}
      {showExitModal && (() => {
        const doneSets = Object.keys(completedSets).length;
        const setsWithWeight = Object.values(completedSets).filter(s => s.kg > 0);
        const kgTotal = Math.round(setsWithWeight.reduce((a, s) => a + (s.kg * (s.reps || 8)), 0));
        const totalReps = Object.values(completedSets).reduce((a, s) => a + (s.reps || 8), 0);
        const exosRestants = exercices.length - exIdx;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
            <div style={{ width: "100%", maxWidth: 360, background: "#101418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "28px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>😳</p>
              <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 22, color: "white", marginBottom: 8, lineHeight: 1.15 }}>Tu abandonnes maintenant ?</h2>
              {doneSets > 0 ? (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
                  Tu as déjà validé <strong style={{ color: accentColor }}>{doneSets} série{doneSets > 1 ? "s" : ""}</strong>{kgTotal > 0 ? <> et soulevé <strong style={{ color: accentColor }}>{kgTotal} kg</strong></> : totalReps > 0 ? <> et fait <strong style={{ color: accentColor }}>{totalReps} répétitions</strong></> : null}. Il ne reste que <strong style={{ color: "white" }}>{exosRestants} exercice{exosRestants > 1 ? "s" : ""}</strong>.
                </p>
              ) : (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
                  La séance vient de commencer — c'est maintenant que tout se joue.
                </p>
              )}
              <button onClick={() => setShowExitModal(false)} style={{ width: "100%", height: 56, background: accentColor, border: "none", borderRadius: 999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 17, fontWeight: 900, cursor: "pointer", marginBottom: 10, boxShadow: `0 8px 32px ${accentColor}40` }}>
                JE CONTINUE 💪
              </button>
              <button onClick={handlePause} style={{ width: "100%", height: 48, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
                ⏸ Mettre en pause — je reviens
              </button>
              <button onClick={() => { setShowExitModal(false); onBack(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                Quitter sans sauvegarder
              </button>
            </div>
          </div>
        );
      })()}

      {aConfirmer !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div role="alertdialog" aria-label="Confirmer le poids" style={{ width: "100%", maxWidth: 360, background: "#16181C", borderRadius: 24, padding: "24px 20px", color: "white", textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Tu confirmes {aConfirmer} kg ?</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, marginBottom: 18 }}>C'est très différent des {currentEx.chargeKg} kg prévus. Ta prochaine séance partira de ce poids.</p>
            <button onClick={() => setAConfirmer(null)} style={{ width: "100%", height: 52, borderRadius: 16, background: accentColor, border: "none", color: "#000", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Corriger</button>
            <button onClick={() => { poidsConfirme.current = { exIdx, kg: aConfirmer }; setAConfirmer(null); validerSerie(); }} style={{ width: "100%", height: 48, marginTop: 8, borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Oui, {aConfirmer} kg</button>
          </div>
        </div>
      )}

      {showRemplacer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowRemplacer(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: "#16181C", borderRadius: "24px 24px 0 0", padding: "22px 20px calc(24px + env(safe-area-inset-bottom, 0px))", color: "white" }}>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Par quoi remplacer ?</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>Mêmes muscles que {currentEx.nom}. La charge est recalculée pour toi.</p>
            {alternatives.map(alt => (
              <button key={alt.id} onClick={() => remplacerCourant(alt)} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{alt.fr}</span>
                <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{alt.muscle}</span>
              </button>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", fontSize: 13, color: "rgba(255,255,255,0.75)", cursor: "pointer" }}>
              <input type="checkbox" checked={retenirAbsente} onChange={e => setRetenirAbsente(e.target.checked)} style={{ width: 18, height: 18, accentColor }} />
              Il n'y en a pas dans ma salle : ne plus me la proposer
            </label>
            <button onClick={() => setShowRemplacer(false)} style={{ width: "100%", height: 44, marginTop: 6, background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Garder cet exercice</button>
          </div>
        </div>
      )}

      {/* ── Photo immersive ── */}
      <div key={animKey} style={{ position: "relative", height: "34vh", minHeight: 200, overflow: "hidden", flexShrink: 0 }}>
        {/* Démo animée du mouvement (dessinée par l'app, instantanée) */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 62%, ${accentColor}26, transparent 70%), linear-gradient(180deg, #0B0D10 0%, #000 100%)` }} />
        <div key={currentEx?.nom} className="v-pop" style={{ position: "absolute", left: "10%", right: "10%", top: `calc(${hautSur(50)} + 28px)`, bottom: 30 }}>
          {phase !== "principal" || auChrono || ["cardio", "mobilite"].includes(currentEx?.materiel) ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
              <span style={{ fontSize: 52 }}>{phase === "echauffement" ? "🔥" : phase === "retour" || currentEx?.materiel === "mobilite" ? "🧘" : "❤️"}</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{phase === "echauffement" ? "Échauffement" : phase === "retour" ? "Retour au calme" : currentEx?.materiel === "mobilite" ? "Mobilité" : "Cardio"}</p>
            </div>
          ) : aUneIllustration(ficheCourante) ? <IllustrationMachine fiche={ficheCourante} accent={accentColor} />
          : ficheCourante && !ficheCourante.animation ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
              <span style={{ fontSize: 44 }}>💪</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{ficheCourante.muscle}</p>
            </div>
          ) : <ExerciseAnimation exercice={currentEx} accent={accentColor} />}
        </div>

        {/* Header sur la photo */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: `${hautSur(50)} 20px 0`, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
          <button onClick={() => setShowExitModal(true)} style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 15, cursor: "pointer" }}>✕</button>
          <div style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "6px 14px", border: "1px solid rgba(255,255,255,0.15)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</p>
          </div>
          <button onClick={() => setShowCoach(true)} style={{ width: 36, height: 36, borderRadius: 18, background: `${accentColor}30`, backdropFilter: "blur(10px)", border: `1px solid ${accentColor}60`, cursor: "pointer", padding: 3, display: "flex", alignItems: "center", justifyContent: "center" }}><AceAvatar size={28} /></button>
        </div>

        {/* Par-dessus l'animation : la note ne doit pas pousser le bouton de validation hors de l'écran */}
        {seance?.adaptation && exIdx === 0 && setIdx === 0 && (
          <p style={{ position: "absolute", bottom: 26, left: 20, right: 20, zIndex: 2, margin: 0, fontSize: 12, lineHeight: 1.4, color: "white", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 12px" }}>{seance.adaptation}</p>
        )}

        {/* Progression exercices — segments */}
        <div style={{ position: "absolute", bottom: 12, left: 20, right: 20, zIndex: 2, display: "flex", gap: 4 }}>
          {exercices.map((_, i) => {
            const fill = i < exIdx ? 1 : i === exIdx ? setIdx / totalSets : 0;
            return (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                <div style={{ width: "100%", transform: `translateX(${fill * 100 - 100}%)`, height: "100%", background: accentColor, borderRadius: 2, transition: "transform 240ms var(--ease-out)" }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Zone Focus ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px 36px" }}>

        {/* Nom */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: accentColor, marginBottom: 6 }}>{phase === "echauffement" ? "🔥 ÉCHAUFFEMENT" : phase === "retour" ? "🧘 RETOUR AU CALME" : "EXERCICE"} {rangPhase}/{nbPhase}{phase === "principal" && currentEx.muscles ? ` · ${(currentEx.muscles || "").split(/[\s,]+/)[0].toUpperCase()}` : ""}</p>
          <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", color: "white" }}>{currentEx.nom}</h1>
          {currentEx.conseil && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8, fontStyle: "italic" }}>💡 {currentEx.conseil}</p>}
          {currentEx.ajustement && <p style={{ fontSize: 12, fontWeight: 700, color: accentColor, marginTop: 8 }}>{currentEx.ajustement}</p>}
          {currentEx.remplace && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8 }}>Remplace {currentEx.remplace}</p>}
          {alternatives.length > 0 && onRemplacer && <button onClick={() => setShowRemplacer(true)} style={{ marginTop: 8, padding: "6px 10px", background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>{ficheCourante.type === "poulie" ? "Poulie prise ou absente ?" : "Machine prise ou absente ?"}</button>}
        </div>

        {/* Chiffre géant */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {totalSets > 1 && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{auChrono ? "BLOC" : "SÉRIE"} {setIdx + 1} SUR {totalSets}</p>}
          {auChrono ? (
            <>
              <span style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: chrono != null ? "white" : accentColor, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{formatElapsed(chrono ?? Number(currentEx.travailSec))}</span>
              {currentEx.intensite && <p style={{ fontSize: 14, fontWeight: 700, color: accentColor, marginTop: 8, textAlign: "center" }}>{currentEx.intensite}</p>}
              {currentEx.sets > 1 && currentEx.reposSec > 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>Puis {duree(currentEx.reposSec)} de récupération</p>}
            </>
          ) : phase === "principal" && (avecCharge || repsChiffrees) ? (
            <>
              <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 8 }}>
                {avecCharge && <ChampSerie label="POIDS" valeur={saisieKg} unite={currentEx.chargeUnite === "par main" ? "kg par main" : "kg"} pas={currentEx.materiel === "halteres" || currentEx.materiel === "haltere_unique" ? 2 : 2.5} onChange={setSaisieKg} accent={accentColor} />}
                {repsChiffrees && <ChampSerie label="RÉPÉTITIONS" valeur={saisieReps} unite="reps" pas={1} onChange={setSaisieReps} accent={accentColor} />}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8 }}>Prévu : {currentEx.reps} reps{avecCharge ? ` · ${currentEx.chargeKg} kg` : ""}</p>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: String(currentEx.reps).length > 6 ? 40 : 72, fontWeight: 900, lineHeight: 1, color: accentColor, letterSpacing: "-0.04em", textAlign: "center" }}>{currentEx.reps || "✓"}</span>
              {/^\d+$/.test(String(currentEx.reps)) && <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>reps</span>}
            </div>
          )}

          {/* Séries cercles */}
          <div style={{ display: totalSets > 1 ? "flex" : "none", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 20 }}>
            {Array.from({ length: totalSets }).map((_, i) => {
              const done = !!completedSets[`${exIdx}-${i}`];
              const current = i === setIdx && !done;
              return (
                <div key={i} style={{ width: 38, height: 38, borderRadius: 19, background: done ? accentColor : current ? `${accentColor}20` : "rgba(255,255,255,0.06)", border: `2px solid ${done || current ? accentColor : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: done ? "#000" : current ? accentColor : "rgba(255,255,255,0.3)", boxShadow: current ? `0 0 16px ${accentColor}50` : "none", transition: "var(--t-choix)" }}>
                  {done ? "✓" : i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bouton massif */}
        <button onClick={auChrono && chrono == null ? () => setChrono(Number(currentEx.travailSec)) : auChrono ? () => { setChrono(null); validerSerie(); } : handleSetComplete} style={{ width: "100%", height: 64, background: auChrono && chrono != null ? "rgba(255,255,255,0.12)" : accentColor, border: "none", borderRadius: 20, color: auChrono && chrono != null ? "white" : "#000", fontSize: 18, fontWeight: 900, letterSpacing: "-0.01em", cursor: "pointer", boxShadow: auChrono && chrono != null ? "none" : `0 8px 40px ${accentColor}40`, fontFamily: "'Inter',sans-serif" }}>
          {auChrono ? (chrono == null ? "▶ DÉMARRER" : "TERMINÉ ✓") : phase !== "principal" || totalSets === 1 ? "C'EST FAIT ✓" : "SÉRIE VALIDÉE ✓"}
        </button>
      </div>



      {/* Drawer Coach IA */}
      {showCoach && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowCoach(false)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "0 0 40px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: accentColor + "20", border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><AceAvatar size={30} /></div>
                <div>
                  <p style={{ ...s.heading, fontSize: 15, color: DS.colors.textPrimary }}>Coach IA</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em" }}>EN LIGNE</p>
                </div>
              </div>
              <button onClick={() => setShowCoach(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 30, height: 30, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            {/* Contexte exercice actuel */}
            {currentEx && (
              <div style={{ margin: "8px 16px 0", background: accentColor + "12", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.md, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: accentColor, marginBottom: 1 }}>{currentEx.nom}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>
                    {Object.keys(completedSets).filter(k => k.startsWith(`${exIdx}-`)).length}/{currentEx.sets} séries · {currentEx.reps} reps{currentEx.chargeKg > 0 ? ` · ${currentEx.chargeKg}kg` : ""}
                  </p>
                </div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>
                  {exIdx + 1}/{exercices.length}
                </div>
              </div>
            )}
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {coachMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, marginBottom: 2 }}><AceAvatar size={28} /></div>
                  )}
                  <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? accentColor : "rgba(255,255,255,0.08)", color: msg.role === "user" ? "#000" : "white", fontSize: 13, lineHeight: 1.6, fontFamily: "'Inter',sans-serif", fontWeight: msg.role === "user" ? 600 : 400 }}>
                    {msg.text.split("**").map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><AceAvatar size={28} /></div>
                  <div style={{ display: "flex", gap: 4, padding: "12px 16px", background: DS.colors.surfaceHigh, borderRadius: "18px 18px 18px 4px" }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, animation: `pulse 1s ease ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>
            {/* Message bloqué si limite atteinte */}
            {coachBlocked && (
              <div style={{ margin: "8px 16px", background: "rgba(155,232,79,0.08)", border: "1px solid rgba(155,232,79,0.2)", borderRadius: DS.radius.lg, padding: "12px 14px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentColor, fontWeight: 600, marginBottom: 4 }}>⚡ Limite gratuite atteinte</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec, marginBottom: 8 }}>Tu as utilisé tes 2 messages gratuits. Passe à l'offre payante pour parler à Ace autant que tu veux.</p>
                <button onClick={() => setShowUpsell(true)} style={{ background: accentColor, border: "none", borderRadius: DS.radius.full, padding: "6px 16px", color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Débloquer le coach →</button>
              </div>
            )}
            {/* Suggestions rapides contextuelles */}
            <div style={{ padding: "6px 16px 0", display: "flex", gap: 6, overflowX: "auto", opacity: coachBlocked ? 0.3 : 1, pointerEvents: coachBlocked ? "none" : "auto" }}>
              {[
                "Trop lourd 😓",
                "Alternative ?",
                "J'ai mal 🤕",
                "Forme correcte ?",
                "Prochain exo ?",
              ].map((sug, i) => (
                <button key={i} onClick={() => setCoachInput(sug)} style={{ flexShrink: 0, padding: "5px 12px", background: accentColor + "10", border: `1px solid ${accentColor}25`, borderRadius: DS.radius.full, color: accentColor, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>{sug}</button>
              ))}
            </div>
            {/* Input */}
            <div style={{ padding: "8px 16px 4px", display: "flex", gap: 8 }}>
              <input enterKeyHint="send" value={coachInput} onChange={e => !coachBlocked && setCoachInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCoachMessage()} placeholder={coachBlocked ? "Passe à l'offre payante pour continuer" : "Parle à Ace..."} style={{ flex: 1, height: 44, padding: "0 16px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 14, outline: "none", fontFamily: "'Inter',sans-serif" }} />
              <button onClick={sendCoachMessage} disabled={!coachInput.trim() || coachLoading} style={{ width: 44, height: 44, borderRadius: DS.radius.full, background: coachInput.trim() ? accentColor : "rgba(255,255,255,0.08)", border: "none", color: coachInput.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, flexShrink: 0, fontWeight: 700 }}>→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYMENT SUCCESS SCREEN
// ─────────────────────────────────────────────
function PaymentSuccessScreen({ plan, essai, onContinue }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const planLabel = plan === "annual" ? "Annuel" : "Mensuel";
  const planEmoji = plan === "annual" ? "⚡" : "🚀";

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", overflow: "hidden" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 40%, rgba(155,232,79,0.1), transparent)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>
        {/* Icône animée */}
        <div style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.9)", transition: "opacity 360ms var(--ease-out), transform 360ms var(--ease-spring)", marginBottom: 32 }}>
          <div style={{ width: 100, height: 100, borderRadius: 28, background: "#9BE84F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, margin: "0 auto", boxShadow: "0 0 60px rgba(155,232,79,0.5)" }}>
            {planEmoji}
          </div>
        </div>

        {/* Texte */}
        <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(12px)", transition: "opacity 300ms var(--ease-out), transform 300ms var(--ease-out)" }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), fontWeight: 800, letterSpacing: "0.06em", marginBottom: 14 }}>PAIEMENT CONFIRMÉ</p>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: "-0.03em" }}>
            BIENVENUE DANS<br />L'ÉQUIPE PRO ⚡
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, marginBottom: 8, lineHeight: 1.6 }}>
            {essai ? "Essai de 7 jours lancé" : "Abonnement activé"} sur le plan <strong style={{ color: DS.colors.textPrimary }}>{planLabel}</strong>. Ton programme personnalisé est en cours de génération.
          </p>

          {/* Features débloquées */}
          <div style={{ background: "rgba(155,232,79,0.06)", border: "1px solid rgba(155,232,79,0.2)", borderRadius: 20, padding: "20px 20px", marginTop: 28, marginBottom: 32, textAlign: "left" }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), fontWeight: 800, letterSpacing: "0.06em", marginBottom: 14 }}>CE QUE TU VIENS DE DÉBLOQUER</p>
            {[
              { emoji: "📈", text: "Séances illimitées" },
              { emoji: "🤖", text: "Coach IA en temps réel" },
              { emoji: "⚡", text: "Progression automatique des charges" },
              { emoji: "🏆", text: "Cycles infinis de progression" },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ fontSize: 16 }}>{f.emoji}</span>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textPrimary, fontWeight: 500 }}>{f.text}</p>
                <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#9BE84F" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
            ))}
          </div>

          <button onClick={onContinue} style={{ width: "100%", height: 56, background: "#9BE84F", border: "none", borderRadius: 9999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(155,232,79,0.4)" }}>
            Voir mon programme →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME GENERATION LOADING SCREEN
// ─────────────────────────────────────────────
function ProgrammeGeneratingScreen({ sport, onDone, programmeActif, programmeLoading, onboardingData }) {
  const theme = getSportTheme(sport);
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");
  const [checkIdx, setCheckIdx] = useState(0);

  const steps = [
    { emoji: "🔍", text: "Analyse de ton profil sportif", duration: 3000 },
    { emoji: "🧠", text: "L'IA construit ta structure", duration: 4000 },
    { emoji: "💪", text: "Sélection des exercices clés", duration: 3000 },
    { emoji: "📈", text: "Calibration des progressions", duration: 4000 },
    { emoji: "⚡", text: "Optimisation pour ton sport", duration: 3000 },
    { emoji: "🎯", text: "Personnalisation finale", duration: 2000 },
    { emoji: "✅", text: "Programme prêt !", duration: 1000 },
  ];

  // Checklist personnalisée construite avec les vraies données de l'utilisateur
  const equipLabels = { salle_complete: "salle complète", salle_basique: "salle basique", maison: "entraînement maison", terrain: "extérieur" };
  const niveauLabels = { debutant: "débutant", intermediaire: "intermédiaire", avance: "avancé" };
  const checklist = [
    `Exercices sélectionnés pour ton poste`,
    `Charges calibrées sur ton niveau ${niveauLabels[onboardingData?.niveau] || ""}`,
    `Programme adapté pour "${equipLabels[onboardingData?.equipement] || "ton équipement"}"`,
    ...(onboardingData?.douleurs?.length > 0 && !onboardingData.douleurs.includes("aucune")
      ? [`Exercices remplacés pour protéger ${onboardingData.douleurs.length > 1 ? "tes zones sensibles" : "ta zone sensible"}`]
      : ["Aucune contrainte détectée — intensité maximale"]),
    `Progression sur 4 semaines programmée`,
    `Fréquence ${onboardingData?.frequence || 3}x/semaine intégrée`,
  ];

  useEffect(() => {
    let elapsed = 0;
    const timers = [];
    steps.forEach((s, i) => {
      if (i < steps.length - 1) timers.push(setTimeout(() => setStep(i), elapsed));
      elapsed += s.duration;
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Si programme déjà prêt et on a dépassé les étapes visuelles
  // On attend le VRAI programme : on n'entre dans l'app que quand il est prêt
  // (ou si la génération a échoué, le dashboard proposera de réessayer)
  useEffect(() => {
    if (step < steps.length - 2) return;
    if (programmeActif) { setStep(steps.length - 1); const t = setTimeout(() => onDone(), 900); return () => clearTimeout(t); }
    if (!programmeLoading) { const t = setTimeout(() => onDone(), 1500); return () => clearTimeout(t); }
  }, [programmeActif, programmeLoading, step]);

  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 400);
    return () => clearInterval(d);
  }, []);

  useEffect(() => {
    const c = setInterval(() => setCheckIdx(p => Math.min(p + 1, checklist.length)), 1800);
    return () => clearInterval(c);
  }, []);

  const progress = Math.round((step / (steps.length - 1)) * 100);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", overflow: "hidden" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 400px 400px at 50% 40%, ${theme.accent}08, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 390 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px", boxShadow: `0 0 50px ${theme.accent}50`, animation: "pulse 2s ease infinite" }}>⚡</div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 10 }}>GÉNÉRATION EN COURS</p>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, lineHeight: 1.1, letterSpacing: "0.02em" }}>
            Ton programme<br />se construit{dots}
          </h1>
        </div>

        {/* Barre de progression */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>PROGRESSION</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>{progress}%</p>
          </div>
          <div style={{ background: DS.colors.surface, borderRadius: 9999, height: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", transform: `translateX(${progress - 100}%)`, background: theme.accent, borderRadius: 9999, transition: "transform 500ms var(--ease-out)", boxShadow: `0 0 12px ${theme.accent}80` }} />
          </div>
        </div>

        {/* Étapes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: i < step ? theme.accent + "08" : i === step ? theme.accent + "15" : "rgba(255,255,255,0.02)", border: `1px solid ${i <= step ? theme.accent + "25" : "rgba(255,255,255,0.04)"}`, borderRadius: 14, transition: "var(--t-choix)", opacity: i > step ? 0.35 : 1 }}>
              <span style={{ fontSize: 16, filter: i > step ? "grayscale(1)" : "none", transition: "filter 0.3s" }}>{s.emoji}</span>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: i <= step ? DS.colors.textPrimary : DS.colors.textSec, fontWeight: i === step ? 600 : 400, flex: 1 }}>{s.text}</p>
              {i < step && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round"/></svg>
              )}
              {i === step && (
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${theme.accent}`, borderTopColor: "transparent", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Checklist de personnalisation en direct */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}20`, borderRadius: 16, padding: "16px 18px" }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 12 }}>CONSTRUIT SPÉCIALEMENT POUR TOI</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checklist.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i < checkIdx ? 1 : 0.25, transition: "opacity 240ms ease" }}>
                {i < checkIdx ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: i === checkIdx - 1 ? "pop 0.4s var(--ease-spring)" : "none" }}><circle cx="12" cy="12" r="11" fill={theme.accent} /><path d="M7 12.5L10.5 16L17 8" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <div style={{ width: 15, height: 15, borderRadius: "50%", border: `1px solid ${DS.colors.border}`, flexShrink: 0 }} />
                )}
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: i < checkIdx ? DS.colors.textPrimary : DS.colors.textSec, fontWeight: i < checkIdx ? 600 : 400 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
function CycleCompleteScreen({ programme, sport, cycleLoading, onContinue, onTests }) {
  const theme = getSportTheme(sport);
  const cycle = (programme?.data_json?.cycle || 1);
  const [showContinue, setShowContinue] = useState(false);
  // Bilan réel du cycle : séances faites sur les 4 dernières semaines
  const [faites, setFaites] = useState(null);
  useEffect(() => {
    if (!programme?.user_id) return;
    supabase.from("seances").select("id", { count: "exact", head: true }).eq("user_id", programme.user_id).eq("statut", "faite")
      .gte("date_realisee", new Date(Date.now() - 28 * JOUR_MS).toISOString())
      .then(({ count }) => setFaites(count ?? null));
  }, [programme?.user_id]);

  useEffect(() => {
    if (!cycleLoading) {
      const t = setTimeout(() => setShowContinue(true), 1000);
      return () => clearTimeout(t);
    }
  }, [cycleLoading]);

  const getCycleMsg = (n) => {
    if (n === 1) return { emoji: "🏆", title: "Cycle 1 termine !", desc: "Tu as complete ton premier cycle. Tu es deja plus fort." };
    if (n === 2) return { emoji: "⚡", title: "Cycle 2 accompli !", desc: "Plus intense, plus cible. Ton corps s'est adapte." };
    if (n === 3) return { emoji: "🔥", title: "Niveau avance atteint !", desc: "Tu fais partie des rares qui vont aussi loin." };
    if (n === 4) return { emoji: "💎", title: "Elite !", desc: "Peu d'athletes atteignent ce niveau. Impressionnant." };
    return { emoji: "🚀", title: `Elite+ ${n - 4} accompli !`, desc: `Cycle ${n} termine. Tu repousses des limites que peu connaissent.` };
  };
  const msg = getCycleMsg(cycle);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", overflow: "hidden" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 400px 400px at 50% 40%, ${theme.accent}08, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>

        {/* Trophée animé */}
        <div style={{ fontSize: 80, marginBottom: 24, animation: "celebrate 0.8s var(--ease-spring)" }}>
          {msg.emoji}
        </div>

        {/* Titre */}
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", marginBottom: 12 }}>
          CYCLE {cycle} COMPLETE
        </div>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 42, color: DS.colors.textPrimary, lineHeight: 0.95, marginBottom: 12, letterSpacing: "0.02em" }}>
          {msg.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.06em", marginBottom: 40, maxWidth: 300, margin: "0 auto 40px" }}>
          {msg.desc}
        </p>

        {/* Stats du cycle */}
        <div style={{ display: "flex", gap: 10, marginBottom: 40, justifyContent: "center" }}>
          {[
            { val: cycle, label: "CYCLES", color: accentLisible(theme.accent) },
            { val: 4, label: "SEMAINES", color: accentLisible("#9BE84F") },
            { val: faites ?? "…", label: "SÉANCES", color: "#FF8C00" },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surfaceHigh, border: `1px solid ${stat.color}20`, borderRadius: DS.radius.lg, padding: "14px 16px", textAlign: "center", position: "relative", overflow: "hidden", minWidth: 80 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, color: stat.color, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{stat.val}</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Status génération */}
        {cycleLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, animation: "pulse 1s infinite", boxShadow: `0 0 8px ${theme.accent}` }} />
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em" }}>
              GENERATION DU CYCLE {cycle + 1} EN COURS...
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)", borderRadius: DS.radius.full, padding: "12px 20px", marginBottom: 24, justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible("#9BE84F"), letterSpacing: "0.06em" }}>
              CYCLE {cycle + 1} PRET · PLUS INTENSE
            </p>
          </div>
        )}

        {/* CTA */}
        {showContinue && (
          <button onClick={onContinue} style={{ width: "100%", height: 56, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", boxShadow: `0 8px 32px ${theme.accent}40`, animation: "slideUp 280ms var(--ease-out)" }}>
            ATTAQUER LE CYCLE {cycle + 1} →
          </button>
        )}
        {showContinue && onTests && (
          <button onClick={onTests} style={{ width: "100%", marginTop: 10, padding: 14, background: "none", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            📊 Faire mes tests de fin de cycle
          </button>
        )}
        {showContinue && onTests && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, marginTop: 8, lineHeight: 1.45 }}>Refais les tests de ton sport pour voir ce que ces 4 semaines t'ont fait gagner.</p>}
      </div>
    </div>
  );
}

function WelcomeScreen({ onStart, onLogin }) {
  const [featureIdx, setFeatureIdx] = useState(0);
  const accentTexte = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;

  const features = [
    { emoji: "🎯", title: "Programme 100% personnalisé", desc: "L'IA crée ton programme selon ton sport, ton poste, ton niveau et tes objectifs." },
    { emoji: "📈", title: "Progression automatique", desc: "Tes charges augmentent intelligemment chaque semaine pour maximiser tes gains." },
    { emoji: "🤖", title: "Ace, ton coach IA", desc: "Il t'accompagne pendant chaque séance, adapte les charges et te motive." },
    { emoji: "🏆", title: "Suis tes records", desc: "Visualise ta progression semaine après semaine et bats tes limites." },
  ];

  // Carrousel automatique, façon « stories »
  useEffect(() => {
    const t = setTimeout(() => setFeatureIdx(i => (i + 1) % features.length), 3200);
    return () => clearTimeout(t);
  }, [featureIdx]);

  const sports = ["🏀 Basketball", "⚽ Football", "🎾 Tennis", "🏉 Rugby", "🏊 Natation", "🏃 Sprint", "🥊 Combat"];
  const f = features[featureIdx];

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", top: -160, right: -120, width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`, pointerEvents: "none" }} />

      <div className="v-stagger" style={{ flex: 1, padding: `${hautSur(56)} 24px 0`, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <LogoVoltra taille={36} />
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: "0.04em", color: DS.colors.textPrimary }}>VOLTRA</span>
        </div>

        {/* Titre */}
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 40, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 14 }}>
          Ta prépa<br />physique<br /><span style={{ color: accentTexte }}>sur mesure</span>
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, lineHeight: 1.5, color: DS.colors.textSec, marginBottom: 28, maxWidth: 320 }}>
          Un programme créé par l'IA pour ton sport, et un coach qui t'accompagne à chaque séance.
        </p>

        {/* Le code d'invitation n'existe que dans ce navigateur : le compte d'abord, l'installation ensuite */}
        {!lireInvitation() && <InstallPrompt variante="accueil" ds={DS} />}

        {/* Carte fonctionnalité, qui défile toute seule */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 24, padding: "18px 20px 20px", boxShadow: DS.shadow.card }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {features.map((_, i) => (
              <div key={i} onClick={() => setFeatureIdx(i)} style={{ flex: 1, height: 4, borderRadius: 2, background: DS.colors.surfaceHigh, overflow: "hidden", cursor: "pointer" }}>
                <div key={featureIdx} style={{ height: "100%", borderRadius: 2, background: DS.colors.primary, width: i < featureIdx ? "100%" : "0%", animation: i === featureIdx ? "vProgress 3.2s linear forwards" : "none" }} />
              </div>
            ))}
          </div>
          <div key={featureIdx} className="v-up" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div className="v-float" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 16, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{f.emoji}</div>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 17, color: DS.colors.textPrimary, marginBottom: 4 }}>{f.title}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.5, color: DS.colors.textSec }}>{f.desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau des sports qui défile */}
      <div style={{ overflow: "hidden", margin: "28px 0 20px", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content", animation: "vMarquee 22s linear infinite" }}>
          {[...sports, ...sports].map((sp, i) => (
            <span key={i} style={{ whiteSpace: "nowrap", background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: "8px 14px", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13, color: DS.colors.textPrimary }}>{sp}</span>
          ))}
        </div>
      </div>

      {/* Bouton */}
      <div className="v-up" style={{ padding: "0 24px 40px", position: "relative", zIndex: 1, animationDelay: "0.35s" }}>
        <PrimaryButton onClick={onStart} style={{ height: 58 }}>
          <span className="v-shine" style={{ position: "absolute", inset: 0, borderRadius: DS.radius.full }} />
          Construire mon programme
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </PrimaryButton>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, textAlign: "center", marginTop: 12 }}>
          {lireInvitation() ? "🎁 Tu es invité : accès offert, sans carte bancaire" : "2 minutes · 7 jours d'essai gratuit"}
        </p>
        <button onClick={onLogin} style={{ width: "100%", height: 52, marginTop: 16, borderRadius: DS.radius.full, background: "transparent", border: `1.5px solid ${DS.colors.border}`, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Se connecter
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN SPLASH
// ─────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 150);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => onDone && onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${DS.colors.primaryGlow}, transparent 70%)`, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.8)", transition: "opacity 800ms var(--ease-out), transform 800ms var(--ease-out)", pointerEvents: "none" }} />

      {phase >= 1 && (
        <LogoVoltra taille={92} className="v-pop v-glow" style={{ position: "relative", zIndex: 1, marginBottom: 26 }}>
          <span className="v-shine" style={{ position: "absolute", inset: 0, borderRadius: 28 }} />
        </LogoVoltra>
      )}

      <div style={{ display: "flex", position: "relative", zIndex: 1 }}>
        {"VOLTRA".split("").map((l, i) => (
          <span key={i} style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 44, letterSpacing: "0.04em", color: DS.colors.textPrimary, opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "none" : "translateY(14px)", transition: `opacity 400ms var(--ease-out) ${i * 0.04}s, transform 400ms var(--ease-out) ${i * 0.04}s` }}>{l}</span>
        ))}
      </div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: "0.12em", color: DS.colors.textSec, marginTop: 10, opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.6s ease 0.5s", position: "relative", zIndex: 1 }}>
        PERFORMANCE · IA · SPORT
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN AUTH
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DOCUMENTS LEGAUX
// ─────────────────────────────────────────────
const LEGAL_EMAIL = "contact.voltra1@gmail.com";
const LEGAL_DATE = "6 novembre 2026";
// À compléter par Erwan : affichés automatiquement dès qu'ils sont renseignés
const LEGAL_SIRET = "";
const LEGAL_STATUT = "";
const LEGAL_MEDIATEUR = "";
const LEGAL_DOCS = {
  cgu: {
    label: "CGU",
    title: "Conditions générales d'utilisation et de vente",
    sections: [
      ["1. Objet", "Voltra est une application web de préparation physique qui génère des programmes d'entraînement personnalisés grâce à l'intelligence artificielle, et propose un coach virtuel (Ace). Les présentes conditions encadrent l'utilisation de l'application et la vente des abonnements. En créant un compte, tu les acceptes."],
      ["2. Éditeur", `Voltra, édité par Erwan Mantouba, Rennes (35000), France. Contact : ${LEGAL_EMAIL}.`],
      ["3. Compte et âge", `Tu dois avoir au moins 15 ans pour créer un compte. L'abonnement doit être souscrit par une personne majeure ou par un parent. Si un mineur s'est abonné sans cet accord, son représentant légal peut écrire à ${LEGAL_EMAIL} : l'abonnement est arrêté et remboursé, et le compte supprimé sur simple demande. Tu es responsable de la confidentialité de tes identifiants et des informations que tu fournis, qui doivent être exactes.`],
      ["4. Offres et prix", "Voltra propose deux abonnements, mensuel et annuel, avec un essai gratuit de 7 jours. Une carte bancaire est demandée pour démarrer l'essai, mais aucun paiement n'est prélevé pendant celui-ci. Sans résiliation avant la fin de l'essai, l'abonnement démarre automatiquement et le premier paiement est prélevé. Un e-mail de rappel est envoyé avant la fin de l'essai. L'essai n'est proposé qu'une seule fois par adresse e-mail : si tu as déjà été abonné, le premier paiement est prélevé dès la souscription. Les tarifs en vigueur sont affichés dans l'application, toutes taxes comprises, avant le paiement. Les paiements sont traités de façon sécurisée par Stripe ; Voltra n'a jamais accès à tes données bancaires."],
      ["5. Abonnements et résiliation", `Les abonnements se renouvellent automatiquement à chaque échéance (mensuelle ou annuelle) jusqu'à résiliation. Tu peux résilier à tout moment, en quelques clics, depuis ton profil (« Gérer mon abonnement »), ou en écrivant à ${LEGAL_EMAIL} ; la résiliation prend effet à la prochaine échéance et l'accès Pro reste actif jusqu'à la fin de la période déjà payée. Une réduction de bienvenue peut s'appliquer à la première année de l'abonnement annuel uniquement, dans les conditions affichées lors de l'offre.`],
      ["6. Droit de rétractation", `Tu disposes de 14 jours à compter de ta souscription pour te rétracter, sans avoir à te justifier et sans frais.\n\nComment faire : dans ton profil, ouvre « Gérer mon abonnement », choisis « Renoncer au contrat ici », puis « Confirmer la rétractation ». Tu peux aussi nous écrire à ${LEGAL_EMAIL}, avec le modèle ci-dessous ou toute autre déclaration claire. Nous t'envoyons un accusé de réception par e-mail.\n\nEffets : ton abonnement et ton accès Pro s'arrêtent immédiatement, et nous te remboursons intégralement tous les paiements effectués, au plus tard 14 jours après ta demande, par le même moyen de paiement. Pendant l'essai gratuit, rien n'a été prélevé : il n'y a rien à rembourser.\n\nModèle de rétractation :\nÀ l'attention de Voltra, Erwan Mantouba, Rennes (35000), France, ${LEGAL_EMAIL}.\nJe vous notifie par la présente ma rétractation du contrat portant sur l'abonnement Voltra Pro.\nSouscrit le : ...\nNom et e-mail du compte : ...\nDate : ...`],
      ["7. Santé et sécurité — important", "Voltra fournit des conseils sportifs généraux et ne remplace en aucun cas un avis médical. Avant de commencer un programme, consulte un médecin, surtout en cas de blessure, de douleur, de pathologie, de grossesse ou de reprise après une longue pause. Les programmes et les réponses du coach IA sont générés automatiquement : ils peuvent comporter des erreurs et doivent être adaptés à ta condition. Tu t'entraînes sous ta seule responsabilité et tu arrêtes immédiatement en cas de douleur ou de malaise. Dans la mesure permise par la loi, Voltra ne peut être tenu responsable des blessures liées à une mauvaise utilisation du service."],
      ["8. Utilisation acceptable", "Tu t'engages à ne pas détourner l'application (piratage, extraction automatisée, partage de ton compte, contournement des limites de l'essai gratuit) ni à demander au coach IA des contenus illicites ou dangereux. Voltra peut suspendre un compte en cas d'abus."],
      ["9. Propriété intellectuelle", "L'application, son design, sa marque et ses contenus sont protégés. Tu bénéficies d'un droit d'usage personnel, non exclusif et non transférable. Les programmes générés pour toi sont à ton usage personnel."],
      ["10. Disponibilité", "Voltra met tout en œuvre pour assurer un service continu mais ne garantit pas une disponibilité permanente (maintenance, incident, dépendance à des services tiers). Les fonctionnalités peuvent évoluer."],
      ["11. Suppression du compte", `Tu peux demander la suppression de ton compte et de tes données à tout moment à ${LEGAL_EMAIL}. Elle est effectuée dans un délai maximum de 30 jours.`],
      ["12. Droit applicable et litiges", `Les présentes conditions sont soumises au droit français. En cas de litige, contacte-nous d'abord à ${LEGAL_EMAIL} pour trouver une solution amiable. Tu peux aussi recourir gratuitement à un médiateur de la consommation${LEGAL_MEDIATEUR ? ` (${LEGAL_MEDIATEUR})` : ""} ou à la plateforme européenne de règlement en ligne des litiges, et tu conserves la faculté de saisir les tribunaux compétents.`],
      ["Dernière mise à jour", LEGAL_DATE],
    ],
  },
  privacy: {
    label: "Confidentialité",
    title: "Politique de confidentialité",
    sections: [
      ["Responsable du traitement", `Voltra, édité par Erwan Mantouba, Rennes (35000), France — ${LEGAL_EMAIL}.`],
      ["Données que nous collectons", "• Compte : prénom, adresse e-mail, mot de passe (stocké chiffré, jamais lisible).\n• Profil sportif : sport, objectif, poste ou discipline, niveau, fréquence et jours d'entraînement, équipement.\n• Données de santé : zones de douleur ou de blessure, poids, âge, taille. Ces informations sont facultatives et servent uniquement à adapter tes programmes.\n• Activité : séances réalisées, charges, répétitions, historique, records.\n• Photo de profil (facultative).\n• Échanges avec le coach IA.\n• Paiement : géré par Stripe ; nous recevons seulement l'état de ton abonnement, jamais ton numéro de carte."],
      ["Pourquoi (finalités et bases légales)", "• Créer ton compte et fournir le service, générer tes programmes et le coach IA : exécution du contrat.\n• Traiter tes données de santé (blessures, poids, âge) pour personnaliser l'entraînement : ton consentement explicite, que tu donnes en les renseignant et que tu peux retirer à tout moment.\n• Gérer les paiements et obligations comptables : exécution du contrat et obligation légale.\n• T'envoyer des rappels d'entraînement par e-mail : intérêt légitime. Tu peux les désactiver dans ton profil ou par le lien présent dans chaque e-mail.\n• Sécuriser le service et prévenir les abus : intérêt légitime."],
      ["Intelligence artificielle", "Pour générer ton programme, écrire ton bilan de la semaine et répondre au coach, les informations utiles de ton profil (sport, objectif, niveau, blessures, poids, âge, séance en cours, charges et records) et tes messages sont transmis à notre prestataire d'IA (Anthropic). Ton adresse e-mail et ton identité ne sont pas nécessaires à cette génération. Les décisions prises par l'IA (programme, conseils) ne produisent pas d'effet juridique sur toi."],
      ["Prestataires et transferts hors UE", "Nous faisons appel à : Supabase (base de données, authentification, stockage), Vercel (hébergement de l'application), Stripe (paiement), Anthropic (intelligence artificielle), Resend (envoi des e-mails). Certains sont situés aux États-Unis ou ailleurs hors Union européenne ; les transferts sont encadrés par des garanties appropriées (clauses contractuelles types de la Commission européenne ou équivalent). Nous ne vendons jamais tes données."],
      ["Durée de conservation", "Tes données sont conservées tant que ton compte est actif, puis supprimées dans un délai de 30 jours après la suppression du compte. Les données de facturation sont conservées 10 ans (obligation légale comptable) par notre prestataire de paiement."],
      ["Tes droits", `Tu disposes des droits d'accès, de rectification, d'effacement, de limitation, d'opposition, de portabilité et du droit de retirer ton consentement à tout moment. Pour les exercer : ${LEGAL_EMAIL} (réponse sous 1 mois). Tu peux aussi modifier tes informations directement dans ton profil. En cas de désaccord, tu peux saisir la CNIL (www.cnil.fr).`],
      ["Cookies et stockage local", "Voltra utilise uniquement le stockage de ton navigateur pour le fonctionnement de l'application (session de connexion, thème clair/sombre, séance en pause). Nous n'utilisons pas de cookies publicitaires."],
      ["Mineurs", `Voltra est accessible dès 15 ans. Sur demande d'un représentant légal à ${LEGAL_EMAIL}, nous supprimons sans délai le compte et les données d'un mineur.`],
      ["Sécurité", "Les échanges sont chiffrés (HTTPS) et l'accès aux données est protégé par des règles d'accès par utilisateur. Aucun système n'étant infaillible, nous t'informerons en cas d'incident te concernant, conformément à la loi."],
      ["Dernière mise à jour", LEGAL_DATE],
    ],
  },
  mentions: {
    label: "Mentions légales",
    title: "Mentions légales",
    sections: [
      ["Éditeur du site", `Voltra — édité par Erwan Mantouba.\nAdresse : Rennes (35000), France.\nEmail : ${LEGAL_EMAIL}\nDirecteur de la publication : Erwan Mantouba.${LEGAL_STATUT ? `\nStatut : ${LEGAL_STATUT}` : ""}${LEGAL_SIRET ? `\nSIRET : ${LEGAL_SIRET}` : ""}`],
      ["Hébergement", "Application hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (+1 415 398 5463). Base de données et authentification : Supabase Pte. Ltd., Singapour (supabase.com)."],
      ["Propriété intellectuelle", "L'ensemble des éléments de l'application (marque Voltra, logo, textes, design, programmes) est protégé par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite."],
      ["Contact", `Pour toute question ou réclamation : ${LEGAL_EMAIL}.`],
    ],
  },
};

function LegalScreen({ initial = "cgu", onBack }) {
  const [tab, setTab] = useState(initial);
  const doc = LEGAL_DOCS[tab];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "sticky", top: 0, background: DS.colors.bg, borderBottom: `1px solid ${DS.colors.border}`, padding: `${hautSur(52)} 16px 12px`, zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: 20, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 16, cursor: "pointer" }}>←</button>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 18, color: DS.colors.textPrimary, margin: 0 }}>Informations légales</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(LEGAL_DOCS).map(k => (
            <div key={k} onClick={() => setTab(k)} style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", background: tab === k ? DS.colors.primary : DS.colors.surfaceHigh, color: tab === k ? "#000" : DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700 }}>{LEGAL_DOCS[k].label}</div>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 20px 80px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 22, color: DS.colors.textPrimary, margin: "0 0 20px", letterSpacing: "-0.01em" }}>{doc.title}</h1>
        {doc.sections.map(([h, p], i) => (
          <div key={tab + i} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: DS.colors.textPrimary, margin: "0 0 6px" }}>{h}</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.6, color: DS.colors.textSec, margin: 0, whiteSpace: "pre-line" }}>{p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// L'adresse qui attend son code, gardée si l'iPhone recharge l'app pendant qu'on lit ses mails
const CLE_CODE_EMAIL = "voltra_code_email";
function lireCodeEmail() {
  try {
    const { email, le } = JSON.parse(localStorage.getItem(CLE_CODE_EMAIL));
    return Date.now() - le < 60 * 60 * 1000 ? email : null;
  } catch { return null; }
}
function garderCodeEmail(email) {
  try {
    if (email) localStorage.setItem(CLE_CODE_EMAIL, JSON.stringify({ email, le: Date.now() }));
    else localStorage.removeItem(CLE_CODE_EMAIL);
  } catch {}
}

// Réseau muet ou coupé : un message clair plutôt qu'un chargement sans fin
function avecDelai(appel) {
  const sansReseau = { data: {}, error: { message: "La connexion ne répond pas. Vérifie ton réseau et réessaie." } };
  const reponse = appel.then(r => r.error?.name === "AuthRetryableFetchError" ? sansReseau : r);
  return Promise.race([reponse, new Promise(ok => setTimeout(() => ok(sansReseau), 25000))]);
}

function AuthScreen({ onAuth, onBack, confirmation, onboardingData }) {
  const [codeEmail, setCodeEmail] = useState(() => confirmation ? null : lireCodeEmail());
  const [code, setCode] = useState("");
  const [attente, setAttente] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(confirmation === "erreur" ? "Ce lien de confirmation a expiré ou a déjà servi. Essaie de te connecter ; sinon, recrée ton compte." : "");
  const [success, setSuccess] = useState(confirmation === "ok" ? "Compte confirmé ! Connecte-toi pour continuer." : "");

  // Detecter si on vient d'un lien reset password
  const isPasswordRecovery = window.location.hash.includes("type=recovery");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente(a => a - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  // Un lien d'e-mail s'ouvrirait dans Safari, hors de l'app installée : on valide le compte avec un code
  const demanderCode = (adresse) => {
    garderCodeEmail(adresse);
    setCodeEmail(adresse);
    setCode("");
    setAttente(60);
  };

  const validerCode = async (valeur = code) => {
    setError(""); setSuccess("");
    if (valeur.length < 6) { setError("Entre le code reçu par e-mail."); return; }
    setLoading(true);
    const { data, error: e } = await avecDelai(supabase.auth.verifyOtp({ email: codeEmail, token: valeur, type: "email" }));
    if (e) {
      setError(e.status === 429 ? "Trop d'essais. Attends quelques minutes avant de réessayer."
        : e.code === "otp_expired" ? "Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau."
        : "Impossible de vérifier le code. Vérifie ta connexion et réessaie.");
      setLoading(false);
      return;
    }
    garderCodeEmail(null);
    await onAuth(data.user);
    setLoading(false);
  };

  const renvoyerCode = async () => {
    setError(""); setSuccess("");
    const { error: e } = await supabase.auth.resend({ type: "signup", email: codeEmail });
    if (e) { setError(e.status === 429 ? "Attends une minute avant de demander un nouveau code." : "Impossible d'envoyer le code. Vérifie ta connexion et réessaie."); return; }
    setCode("");
    setAttente(60);
    setSuccess("Nouveau code envoyé !");
  };

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Remplis tous les champs."); return; }
    if (mode === "signup" && !name) { setError("Entre ton prénom."); return; }
    if (mode === "signup" && !accepted) { setError("Accepte les CGU et la politique de confidentialité pour continuer."); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caractères minimum."); return; }
    setLoading(true);
    if (mode === "signup") {
      // Les réponses de l'onboarding sont gardées avec le compte, pour les retrouver même si l'email est confirmé ailleurs
      const { data, error: e } = await avecDelai(supabase.auth.signUp({ email, password, options: { data: { name, ...(onboardingData ? { onboarding: onboardingData } : {}) }, emailRedirectTo: `${window.location.origin}/?confirmed=true` } }));
      if (e) { setError(e.message === "User already registered" ? "Email déjà utilisé." : e.message); setLoading(false); return; }
      if (data.user && !data.session) {
        // Adresse déjà confirmée : Supabase répond sans identité et n'envoie aucun e-mail
        if (data.user.identities?.length === 0) setError("Email déjà utilisé.");
        else demanderCode(email);
        setLoading(false);
        return;
      }
      onAuth(data.user);
    } else {
      const { data, error: e } = await avecDelai(supabase.auth.signInWithPassword({ email, password }));
      if (e?.code === "email_not_confirmed") {
        // Compte jamais validé : on renvoie un code plutôt que de le bloquer ici
        await supabase.auth.resend({ type: "signup", email });
        demanderCode(email);
        setLoading(false);
        return;
      }
      if (e) { setError(e.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : e.message); setLoading(false); return; }
      onAuth(data.user);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(""); setSuccess("");
    if (!email) { setError("Entre ton email d'abord."); return; }
    setLoading(true);
    const redirectUrl = `${window.location.origin}${window.location.pathname}#type=recovery`;
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess("Email envoyé ! Vérifie ta boîte mail et clique sur le lien.");
  };

  const handleResetPassword = async () => {
    setError(""); setSuccess("");
    if (!newPassword || !confirmPassword) { setError("Remplis les deux champs."); return; }
    if (newPassword.length < 6) { setError("Minimum 6 caractères."); return; }
    if (newPassword !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (e) { setError(e.message); return; }
    // Nettoyer le hash et rediriger
    window.history.replaceState({}, document.title, window.location.pathname);
    setSuccess("Mot de passe mis à jour !");
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) onAuth(session.user);
      });
    }, 1500);
  };

  // Ecran reset password (vient du lien email)
  if (isPasswordRecovery) {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <Bloom echelle={0.8} />
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>🔑</div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Nouveau mot de passe</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec }}>Choisis un nouveau mot de passe sécurisé</p>
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Nouveau mot de passe" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 caractères" />
          <Input label="Confirmer le mot de passe" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Répète ton mot de passe" />
          {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
          {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
          {loading ? (
            <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
              <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
              Mise à jour...
            </div>
          ) : (
            <PrimaryButton onClick={handleResetPassword}>Mettre à jour mon mot de passe</PrimaryButton>
          )}
        </div>
      </div>
    );
  }

  // Ecran du code reçu par e-mail
  if (codeEmail) {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <Bloom echelle={0.8} />
        <div className="v-stagger" style={{ paddingTop: "calc(64px + env(safe-area-inset-top, 0px))", paddingBottom: 32 }}>
          <LogoVoltra taille={52} style={{ marginBottom: 24 }} />
          <h1 className="v-up" style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 10 }}>
            Entre ton<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>code</span>
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 15, lineHeight: 1.5, overflowWrap: "anywhere" }}>On vient de l'envoyer à <strong style={{ color: DS.colors.textPrimary }}>{codeEmail}</strong>. Regarde dans tes mails (et tes spams), puis reviens ici.</p>
        </div>
        <div className="v-up" style={{ flex: 1, animationDelay: "0.15s" }}>
          <input
            value={code}
            onChange={e => {
              const valeur = e.target.value.replace(/\D/g, "").slice(0, 10);
              // Code collé ou proposé par le clavier : on valide tout de suite
              const colle = valeur.length >= 6 && valeur.length - code.length > 1;
              setCode(valeur);
              if (colle && !loading) validerCode(valeur);
            }}
            onKeyDown={e => { if (e.key === "Enter" && !loading) validerCode(); }}
            inputMode="numeric" autoComplete="one-time-code" enterKeyHint="done" aria-label="Code reçu par e-mail" placeholder="000000"
            style={{ width: "100%", height: 68, padding: "0 12px", marginBottom: 16, background: DS.colors.surface, border: `1.5px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, color: DS.colors.textPrimary, fontSize: 30, fontWeight: 800, letterSpacing: "0.22em", textAlign: "center", outline: "none", boxShadow: DS.shadow.card, fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" }}
          />
          {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
          {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
          {loading ? (
            <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
              <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
              Vérification...
            </div>
          ) : (
            <PrimaryButton onClick={() => validerCode()}>Valider mon compte</PrimaryButton>
          )}
          <button onClick={renvoyerCode} disabled={attente > 0} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: attente > 0 ? DS.colors.textDim : DS.colors.textPrimary, fontSize: 14, fontWeight: 600, cursor: attente > 0 ? "default" : "pointer", fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {attente > 0 ? `Renvoyer le code dans ${attente} s` : "Renvoyer le code"}
          </button>
          <button onClick={() => { garderCodeEmail(null); setEmail(codeEmail); setCodeEmail(null); setError(""); setSuccess(""); }} style={{ width: "100%", marginTop: 14, marginBottom: 32, background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Changer d'adresse e-mail
          </button>
        </div>
      </div>
    );
  }

  // Mode mot de passe oublié
  if (mode === "forgot") {
    return (
      <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <Bloom echelle={0.8} />
        <div style={{ paddingTop: 80, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: DS.shadow.primary }}>📧</div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 8 }}>Mot de passe oublié ?</h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, lineHeight: 1.6 }}>Entre ton email et on t'envoie un lien pour réinitialiser ton mot de passe.</p>
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
          {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
          {success && (
            <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "16px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>📬</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, color: DS.colors.success, fontSize: 14, marginBottom: 4 }}>Email envoyé !</p>
              <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 13 }}>Vérifie ta boîte mail et clique sur le lien de réinitialisation.</p>
            </div>
          )}
          {!success && (
            loading ? (
              <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
                Envoi en cours...
              </div>
            ) : (
              <PrimaryButton onClick={handleForgotPassword}>Envoyer le lien</PrimaryButton>
            )
          )}
          <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <Bloom echelle={0.8} />
      {onBack && <button onClick={onBack} style={{ position: "absolute", top: "calc(20px + env(safe-area-inset-top, 0px))", left: 24, zIndex: 1, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: "pointer", padding: 0 }}>← Retour</button>}
      <div className="v-stagger" style={{ paddingTop: "calc(64px + env(safe-area-inset-top, 0px))", paddingBottom: 32 }}>
        <LogoVoltra taille={52} style={{ marginBottom: 24 }} />
        <h1 key={mode} className="v-up" style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, marginBottom: 10 }}>
          {mode === "login" ? <>Content de<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>te revoir</span></> : <>Crée ton<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>compte</span></>}
        </h1>
        <p style={{ fontFamily: "'Inter',sans-serif", color: DS.colors.textSec, fontSize: 15 }}>{mode === "login" ? "Ton programme t'attend." : "30 secondes pour sauvegarder ton programme."}</p>
      </div>
      <div className="v-up" style={{ flex: 1, animationDelay: "0.15s" }}>
        <div style={{ position: "relative", display: "flex", background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, padding: 4, marginBottom: 28 }}>
          <div style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: "calc(50% - 4px)", borderRadius: DS.radius.full, background: DS.colors.primary, boxShadow: DS.shadow.primary, transform: mode === "signup" ? "translateX(100%)" : "none", transition: "transform 220ms var(--ease-out)" }} />
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ position: "relative", zIndex: 1, flex: 1, height: 42, borderRadius: DS.radius.full, background: "transparent", border: "none", color: mode === m ? "#0B0B0C" : DS.colors.textSec, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "color 0.25s", fontFamily: "'Inter',sans-serif" }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>
        {mode === "signup" && <Input label="Prénom" value={name} onChange={setName} placeholder="Alex" />}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="alex@email.com" />
        <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="Min. 6 caractères" />
        {mode === "signup" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
            <div onClick={() => setAccepted(a => !a)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, cursor: "pointer", background: accepted ? DS.colors.primary : "transparent", border: `2px solid ${accepted ? DS.colors.primary : DS.colors.textSec}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 13, fontWeight: 800 }}>{accepted ? "✓" : ""}</div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, lineHeight: 1.5, color: DS.colors.textSec, margin: 0 }}>
              J'ai au moins 15 ans et j'accepte les <span onClick={() => setShowLegal("cgu")} style={{ color: DS.colors.primary, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>CGU</span> et la <span onClick={() => setShowLegal("privacy")} style={{ color: DS.colors.primary, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>politique de confidentialité</span>, et que mes données de santé facultatives (blessures, poids, âge) soient utilisées pour personnaliser mon programme.
            </p>
          </div>
        )}
        {error && <div style={{ background: DS.colors.warningSoft, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.warning, fontSize: 13 }}>⚠ {error}</p></div>}
        {success && <div style={{ background: DS.colors.successSoft, border: `1px solid rgba(76,175,80,0.3)`, borderRadius: DS.radius.md, padding: "12px 16px", marginBottom: 16 }}><p style={{ color: DS.colors.success, fontSize: 13 }}>✓ {success}</p></div>}
        {loading ? (
          <div style={{ height: 56, borderRadius: DS.radius.full, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: DS.colors.primary, fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
            <div style={{ width: 16, height: 16, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite" }} />
            {mode === "login" ? "Connexion..." : "Création du compte..."}
          </div>
        ) : (
          <PrimaryButton onClick={handleSubmit}>{mode === "login" ? "Se connecter" : "Créer mon compte"}</PrimaryButton>
        )}
        {mode === "login" && (
          <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            Mot de passe oublié ?
          </button>
        )}
      </div>
      <p style={{ color: DS.colors.textDim, fontSize: 12, textAlign: "center", paddingBottom: 40, fontFamily: "'Inter',sans-serif" }}>
        <span onClick={() => setShowLegal("cgu")} style={{ textDecoration: "underline", cursor: "pointer" }}>CGU</span> · <span onClick={() => setShowLegal("privacy")} style={{ textDecoration: "underline", cursor: "pointer" }}>Confidentialité</span> · <span onClick={() => setShowLegal("mentions")} style={{ textDecoration: "underline", cursor: "pointer" }}>Mentions légales</span>
      </p>
      {showLegal && <LegalScreen initial={showLegal} onBack={() => setShowLegal(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN ONBOARDING - 6 etapes personnalisees
// ─────────────────────────────────────────────
const POSTES_PAR_SPORT = {
  basketball: [
    { id: "meneur", label: "Meneur", desc: "Vitesse, agilite, cardio", emoji: "⚡" },
    { id: "ailier", label: "Ailier", desc: "Polyvalence, athletisme", emoji: "🏃" },
    { id: "ailier_fort", label: "Ailier-fort", desc: "Force, rebonds", emoji: "💪" },
    { id: "pivot", label: "Pivot", desc: "Puissance, domination", emoji: "🏋️" },
  ],
  football: [
    { id: "gardien", label: "Gardien", desc: "Reflexes, detente", emoji: "🧤" },
    { id: "defenseur", label: "Defenseur", desc: "Force, duels aeriens", emoji: "🛡️" },
    { id: "milieu", label: "Milieu", desc: "Endurance, polyvalence", emoji: "⚙️" },
    { id: "attaquant", label: "Attaquant", desc: "Explosivite, vitesse", emoji: "🎯" },
  ],
  tennis: [
    { id: "fond_de_court", label: "Fond de court", desc: "Endurance, regularite", emoji: "🔄" },
    { id: "serve_volley", label: "Serveur-volleyeur", desc: "Explosivite, reflexes", emoji: "⚡" },
  ],
  rugby: [
    { id: "pilier", label: "Pilier / Talonneur", desc: "Force brute, puissance", emoji: "🏋️" },
    { id: "troisieme_ligne", label: "3eme ligne", desc: "Force + endurance", emoji: "💪" },
    { id: "demi", label: "Demi", desc: "Agilite, explosivite", emoji: "⚡" },
    { id: "trois_quarts", label: "Trois-quarts", desc: "Vitesse, detente", emoji: "🏃" },
    { id: "arriere", label: "Arriere", desc: "Vitesse, vision du jeu", emoji: "🎯" },
  ],
  sprint: [
    { id: "60m", label: "60m / 100m", desc: "Acceleration pure", emoji: "💨" },
    { id: "200m", label: "200m", desc: "Puissance + vitesse", emoji: "⚡" },
    { id: "400m", label: "400m", desc: "Endurance lactique", emoji: "🔥" },
  ],
  combat: [
    { id: "mma", label: "MMA", desc: "Combat complet, polyvalence", emoji: "🥊" },
    { id: "boxe_anglaise", label: "Boxe anglaise", desc: "Vitesse, explosivite des poings", emoji: "👊" },
    { id: "boxe_francaise", label: "Boxe francaise", desc: "Vitesse, coordination pieds-poings", emoji: "🦵" },
    { id: "judo", label: "Judo", desc: "Force, equilibre, explosivite", emoji: "🥋" },
    { id: "jiu_jitsu", label: "Jiu-jitsu bresilien", desc: "Force fonctionnelle, gainage", emoji: "💪" },
    { id: "boxe_thai", label: "Boxe thai", desc: "Puissance, endurance, genoux/coudes", emoji: "🔥" },
  ],
};

const DOULEURS = [
  { id: "aucune", label: "Aucune douleur", emoji: "✅", exclusive: true },
  { id: "epaule", label: "Epaule", emoji: "💪" },
  { id: "genou", label: "Genou", emoji: "🦵" },
  { id: "dos", label: "Dos / Lombaires", emoji: "🦴" },
  { id: "cheville", label: "Cheville", emoji: "🦶" },
  { id: "poignet", label: "Poignet / Coude", emoji: "✋" },
];

const EQUIPEMENTS = [
  { id: "salle_complete", label: "Salle complète", desc: "Machines, barres, haltères", emoji: "🏋️" },
  { id: "salle_basique", label: "Salle basique", desc: "Barres et haltères, sans machines", emoji: "⚙️" },
  { id: "maison", label: "Maison", desc: "Avec ton propre matériel", emoji: "🏠" },
  { id: "terrain", label: "Extérieur", desc: "Parc, stade, rue", emoji: "🌿" },
];
// Matériel à la maison ou dehors : mêmes repères que la séance de dépannage, lus par le serveur
const MATERIEL_LIEU = {
  maison: [
    { id: "halteres", l: "Haltères", ic: "🏋️" }, { id: "kettlebell", l: "Kettlebell", ic: "🔔" },
    { id: "elastique", l: "Élastiques", ic: "🪢" }, { id: "barre de traction", l: "Barre de traction", ic: "🪜" },
    { id: "banc ou chaise", l: "Banc ou chaise", ic: "🪑" }, { id: "corde a sauter", l: "Corde à sauter", ic: "➰" },
    { id: "medball", l: "Médecine-ball", ic: "🏐" }, { id: "sangles", l: "Sangles TRX", ic: "🎗️" },
    { id: "sac leste", l: "Sac ou gilet lesté", ic: "🎒" }, { id: "marche", l: "Marche ou escalier", ic: "🪜" },
    { id: "espace pour courir", l: "Jardin ou rue pour courir", ic: "🏃" },
  ],
  terrain: [
    { id: "terrain", l: "Terrain ou piste", ic: "🏟️" }, { id: "cote", l: "Une côte", ic: "⛰️" },
    { id: "escaliers", l: "Des escaliers", ic: "🪜" }, { id: "barre fixe", l: "Barre fixe", ic: "🤸" },
    { id: "banc public", l: "Banc", ic: "🪑" }, { id: "elastique", l: "Élastiques", ic: "🪢" },
    { id: "corde a sauter", l: "Corde à sauter", ic: "➰" }, { id: "sac leste", l: "Sac ou gilet lesté", ic: "🎒" },
  ],
};
const CHARGES_MAISON = [6, 10, 14, 20, 24, 32];

// Choix du matériel quand on s'entraîne à la maison ou dehors
function MaterielLieu({ lieu, sport, materiel = [], chargeMaison, onChange, accent }) {
  const ac = accent ? accentLisible(accent) : (DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark);
  const options = [...(MATERIEL_LIEU[lieu] || []), ...(MATERIEL_DEPANNAGE_SPORT[sport] || []).filter(o => !(MATERIEL_LIEU[lieu] || []).some(x => x.id === o.id))];
  const basculer = (id) => onChange({ materiel: materiel.includes(id) ? materiel.filter(x => x !== id) : [...materiel, id], chargeMaison });
  const lourd = materiel.some(m => m === "halteres" || m === "kettlebell");
  const puce = (on) => ({ padding: "9px 12px", borderRadius: 999, border: `1px solid ${on ? ac : DS.colors.border}`, background: on ? DS.colors.primarySoft : DS.colors.surface, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" });
  const titre = { fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textSec, margin: "0 0 10px" };
  return (
    <div style={{ marginTop: 20 }}>
      <p style={titre}>{lieu === "terrain" ? "Ce que tu as autour de toi" : "Ton matériel à la maison"}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(o => <button key={o.id} type="button" onClick={() => basculer(o.id)} style={puce(materiel.includes(o.id))}>{o.ic} {o.l}</button>)}
      </div>
      {!materiel.length && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: "10px 0 0" }}>Rien ? Pas de souci : séances au poids du corps.</p>}
      {lourd && <>
        <p style={{ ...titre, marginTop: 18 }}>Ton haltère ou ta kettlebell la plus lourde</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHARGES_MAISON.map(kg => <button key={kg} type="button" onClick={() => onChange({ materiel, chargeMaison: kg })} style={puce(chargeMaison === kg)}>{kg === 32 ? "32 kg et +" : `${kg} kg`}</button>)}
        </div>
      </>}
    </div>
  );
}

const TOTAL_STEPS = 6;

function OnboardingScreen({ onComplete, onLogin }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    sport: null, objectif: null, poste: null,
    douleurs: [], equipement: null, materiel: [], chargeMaison: null,
    niveau: null, frequence: 3, jours: [1, 3, 5], rythme: RYTHME_DEFAUT,
    poids: null, age: null, taille: null,
  });
  definirSport(data.sport);
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [reaction, setReaction] = useState(null);
  const [showCoachDemo, setShowCoachDemo] = useState(false);

  const hasPoste = data.sport && data.sport !== "natation";
  const stepLabels = ["Sport", "Objectif", ...(hasPoste ? ["Poste"] : []), "Douleurs", "Equipement", "Club", "Niveau", "Profil"];
  const totalSteps = stepLabels.length;

  // Step mapping selon si poste existe
  const getStepContent = () => {
    const steps = [0, 1]; // sport, objectif
    if (hasPoste) steps.push(2); // poste
    steps.push(3, 4, 7, 5, 6); // douleurs, equipement, club, niveau, profil (âge, taille, poids)
    return steps[step];
  };
  const contentStep = getStepContent();

  // Âge, taille, poids : facultatifs, sur un seul écran. « Continuer » garde les valeurs affichées, « Passer » n'enregistre rien.
  const PROFIL_DEFAUTS = { age: 20, taille: 175, poids: 70 };
  const etapeProfil = contentStep === 6;

  const goNext = () => {
    // Après le club : séances conseillées et meilleurs jours, modifiables à l'étape suivante
    if (contentStep === 7) setData(d => {
      const frequence = Math.min(d.frequence, frequenceConseillee(d.rythme));
      return { ...d, frequence, jours: joursConseilles(frequence, d.rythme) };
    });
    // Génère un message de réaction personnalisé selon l'étape
    const msg = getReactionMessage();
    if (msg) {
      setReaction(msg);
      setAnimIn(false);
      setTimeout(() => {
        setReaction(null);
        setStep(s => s + 1);
        setAnimIn(true);
      }, 1100);
    } else {
      setAnimIn(false);
      setTimeout(() => { setStep(s => s + 1); setAnimIn(true); }, 200);
    }
  };

  const getReactionMessage = () => {
    const sportLabel = SPORTS.find(s => s.id === data.sport)?.label || data.sport;
    if (contentStep === 0) {
      const reactions = {
        basketball: "On va cibler ta détente verticale 🚀",
        football: "Programme calibré pour la vitesse et l'endurance ⚡",
        tennis: "On travaille explosivité et réactivité 🎾",
        rugby: "Préparation physique impact et puissance 🏉",
        natation: "Endurance et puissance de nage en approche 🏊",
        sprint: "On va chercher chaque dixième de seconde ⏱️",
        combat: "Puissance et cardio de combattant en approche 🥊",
      };
      return reactions[data.sport] || `Programme ${sportLabel} en préparation 🎯`;
    }
    if (contentStep === 1) {
      const reactions = {
        explosivite: "Objectif explosivité noté — on va bosser le fast-twitch 💥",
        force: "Objectif force noté — charges progressives à venir 🏋️",
        endurance: "Objectif endurance noté — cardio et volume adaptés 🔥",
        masse: "Objectif prise de masse noté — volume et surcharge calibrés 📈",
        detente: "Objectif détente noté — pliométrie au programme 🚀",
      };
      return reactions[data.objectif] || "Objectif noté, programme ajusté 🎯";
    }
    if (contentStep === 2) {
      return `Parfait, on cible les qualités clés de ton poste 🎯`;
    }
    if (contentStep === 3) {
      if (data.douleurs.includes("aucune") || data.douleurs.length === 0) {
        return "Aucune contrainte — on peut pousser fort 💪";
      }
      return "On adapte tes exercices pour te protéger 🛡️";
    }
    if (contentStep === 4) {
      const eqLabel = EQUIPEMENTS.find(e => e.id === data.equipement)?.label || "";
      return `Exercices sélectionnés pour "${eqLabel}" ✅`;
    }
    if (contentStep === 7) {
      return data.rythme?.club?.length || data.rythme?.match != null ? "Tes séances se calent autour de ton club 📅" : "On organise ta semaine 📅";
    }
    return null;
  };

  const handleFinish = () => {
    setLoading(true);
    setGenError(false);
    setSlideIndex(0);
    const timeout = setTimeout(() => {
      setGenError(true);
    }, 20000);
    // La génération est lancée une seule fois par l'App (startGeneration)
    onComplete(data, null);
  };

  const retryGeneration = () => {
    setGenError(false);
    handleFinish();
  };

  const skipGeneration = () => {
    setLoading(false);
    setGenError(false);
    onComplete(data, null);
  };

  const toggleDouleur = (id) => {
    if (id === "aucune") {
      setData(d => ({ ...d, douleurs: d.douleurs.includes("aucune") ? [] : ["aucune"] }));
    } else {
      setData(d => ({
        ...d,
        douleurs: d.douleurs.includes("aucune")
          ? [id]
          : d.douleurs.includes(id)
            ? d.douleurs.filter(x => x !== id)
            : [...d.douleurs, id]
      }));
    }
  };

  const canNext = (() => {
    if (contentStep === 0) return data.sport !== null;
    if (contentStep === 1) return data.objectif !== null;
    if (contentStep === 2) return data.poste !== null;
    if (contentStep === 3) return data.douleurs.length > 0;
    if (contentStep === 4) return data.equipement !== null;
    if (contentStep === 5) return data.niveau !== null && (data.jours || []).length === data.frequence;
    if (contentStep >= 6) return true; // profil physique optionnel, club facultatif
    return false;
  })();

  const isLastStep = step === totalSteps - 1;

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: "0 20px" }}>
      <Bloom echelle={0.8} />

      {/* Écran demo coach IA — avant génération */}
      {showCoachDemo && (() => {
        const CoachDemoContent = () => {
          const [msgVisible, setMsgVisible] = useState(0);
          useEffect(() => {
            const t1 = setTimeout(() => setMsgVisible(1), 500);
            const t2 = setTimeout(() => setMsgVisible(2), 1600);
            const t3 = setTimeout(() => setMsgVisible(3), 2900);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
          }, []);
          return (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, minHeight: 180 }}>
                {msgVisible >= 1 && (
                  <div style={{ alignSelf: "flex-end", maxWidth: "78%", background: "#9BE84F", color: "#000", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, animation: "fadeIn 240ms var(--ease-out)" }}>
                    Je suis épuisé, j'y arrive plus 😮‍💨
                  </div>
                )}
                {msgVisible >= 2 && (
                  <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 8, animation: "fadeIn 240ms var(--ease-out)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><AceAvatar size={26} /></div>
                    <div style={{ maxWidth: "78%", background: DS.colors.surface, color: DS.colors.textPrimary, padding: "10px 14px", borderRadius: "18px 18px 18px 4px", fontFamily: "'Inter',sans-serif", fontSize: 13 }}>
                      Pas de souci, on baisse la charge de <strong>15%</strong> pour cette série. On garde le volume, on protège ta forme 💪
                    </div>
                  </div>
                )}
                {msgVisible >= 3 && (
                  <div style={{ alignSelf: "center", background: "rgba(155,232,79,0.12)", border: "1px solid rgba(155,232,79,0.3)", borderRadius: 12, padding: "6px 14px", marginTop: 4, animation: "fadeIn 240ms var(--ease-out)" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.isDark ? "#9BE84F" : DS.colors.primaryDark, fontWeight: 600 }}>✓ Série adaptée en temps réel</p>
                  </div>
                )}
              </div>
              <button onClick={() => { setShowCoachDemo(false); handleFinish(); }} style={{ width: "100%", height: 56, background: "#9BE84F", border: "none", borderRadius: 9999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(155,232,79,0.4)" }}>
                Générer mon programme →
              </button>
            </>
          );
        };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 300, background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", animation: "fadeIn 240ms var(--ease-out)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 400px at 50% 20%, rgba(155,232,79,0.08), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 360 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden", margin: "0 auto 14px", boxShadow: "0 0 40px rgba(155,232,79,0.4)" }}><AceAvatar size={56} /></div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 11, color: DS.colors.isDark ? "#9BE84F" : DS.colors.primaryDark, letterSpacing: "0.06em", marginBottom: 8 }}>ACE — TON COACH IA</p>
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, lineHeight: 1.2 }}>Il s'adapte à toi,<br />en temps réel</h2>
              </div>
              <CoachDemoContent />
            </div>
          </div>
        );
      })()}


      {reaction && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", animation: "fadeIn 240ms var(--ease-out)" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: DS.colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20, boxShadow: DS.shadow.primary, animation: "pop 0.4s var(--ease-spring)" }}>
            ✓
          </div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 19, color: DS.colors.textPrimary, textAlign: "center", lineHeight: 1.4 }}>
            {reaction}
          </p>
        </div>
      )}

      {loading && (() => {
        const sportTheme = getSportTheme(data.sport);
        const slides = [
          {
            emoji: "⚡",
            tag: "GENERATION EN COURS",
            title: "Ton programme\nest en creation",
            desc: "L'IA analyse ton profil pour creer un programme sur mesure adapte a ton sport et tes objectifs.",
            visual: (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {[
                  { emoji: "🏋️", text: "Selection des exercices", delay: "0s" },
                  { emoji: "📈", text: "Calcul des progressions", delay: "0.5s" },
                  { emoji: "⚡", text: `Optimisation ${data.sport || "sport"}`, delay: "1s" },
                  { emoji: "✓", text: "Finalisation", delay: "1.5s" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, padding: "10px 14px", opacity: 0, animation: `fadeIn 0.4s ease ${item.delay} forwards` }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <p style={{ color: DS.colors.textSec, fontSize: 13 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            emoji: "🏃",
            tag: "SEANCES LIVE",
            title: "Suis chaque\nexercice en temps reel",
            desc: "Photos, chrono, series guidees. Chaque rep est tracee pour maximiser ta progression.",
            visual: (
              <div style={{ background: DS.colors.surface, border: `1px solid ${sportTheme.accent}20`, borderRadius: DS.radius.xl, overflow: "hidden", width: "100%" }}>
                <div style={{ height: 90, background: DS.colors.surfaceHigh, position: "relative", display: "flex", alignItems: "flex-end", padding: "10px 14px" }}>
                  <div style={{ position: "absolute", top: 8, left: 10, background: DS.colors.isDark ? "rgba(6,6,14,0.8)" : "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent) }}>EX 1/5</p>
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 10, background: sportTheme.accent + "20", border: `1px solid ${sportTheme.accent}40`, borderRadius: 6, padding: "2px 8px" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), fontWeight: 700 }}>12:34</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), marginBottom: 2 }}>QUADRICEPS</p>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 20, color: DS.colors.textPrimary }}>SQUAT BARRE</p>
                  </div>
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, background: i <= 2 ? sportTheme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${i <= 2 ? sportTheme.accent : DS.colors.border}`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: i <= 2 ? sportTheme.accent : DS.colors.textSec }}>{i <= 2 ? "✓" : i}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
          {
            emoji: "🤖",
            tag: "COACH IA",
            title: "Un coach\ntoujours disponible",
            desc: "Pendant chaque seance, ton coach IA repond a tes questions, adapte les charges et te motive.",
            visual: (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { role: "user", text: "J'arrive pas a finir mes reps" },
                  { role: "ai", text: "Reduis la charge de 10% et concentre-toi sur la forme. Tu fais du super travail !" },
                  { role: "user", text: "Merci j'ai mal au genou" },
                  { role: "ai", text: "Je remplace le squat par du leg press pour proteger ton genou. Continue !" },
                ].map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", opacity: 0, animation: `fadeIn 0.3s ease ${i * 0.4}s forwards` }}>
                    <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: DS.radius.md, background: msg.role === "user" ? sportTheme.accent : DS.colors.surface, border: msg.role === "ai" ? `1px solid ${DS.colors.border}` : "none" }}>
                      <p style={{ color: msg.role === "user" ? "#000" : DS.colors.textPrimary, fontSize: 12, lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            emoji: "📈",
            tag: "PROGRESSION",
            title: "Vois tes records\nbattre semaine apres semaine",
            desc: "Charges, series, temps — tout est tracé. Tu vois exactement ou tu en es et ce qui t'attend.",
            visual: (
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "14px 16px", width: "100%" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 60, marginBottom: 8 }}>
                  {[40, 55, 50, 70, 65, 85, 100].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 6 ? sportTheme.accent : `rgba(${sportTheme.accentRgb},${0.2 + i * 0.08})`, borderRadius: "3px 3px 0 0", boxShadow: i === 6 ? `0 0 10px ${sportTheme.accent}50` : "none" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>S1</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent) }}>+60% EN 7 SEMAINES</p>
                </div>
              </div>
            ),
          },
        ];
        const currentSlide = slides[Math.min(slideIndex, slides.length - 1)];
        return (
          <div style={{ position: "fixed", inset: 0, background: DS.colors.bg, zIndex: 200, display: "flex", flexDirection: "column", padding: "0 24px 40px" }}>
            {/* Glow */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 300px 300px at 50% 30%, ${sportTheme.accent}06, transparent)`, pointerEvents: "none" }} />

            {/* Dots navigation */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingTop: hautSur(52), marginBottom: 32, position: "relative", zIndex: 2 }}>
              {slides.map((_, i) => (
                <div key={i} style={{ width: i === slideIndex ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIndex ? sportTheme.accent : DS.colors.surfaceHigh, transition: "width 240ms var(--ease-out), background 240ms ease", boxShadow: i === slideIndex ? `0 0 8px ${sportTheme.accent}` : "none" }} />
              ))}
            </div>

            {genError ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 28, color: DS.colors.textPrimary, marginBottom: 12, letterSpacing: "0.05em" }}>Generation lente...</h2>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginBottom: 32, lineHeight: 1.8, letterSpacing: "0.06em" }}>Le serveur prend du temps. Tu peux reessayer ou continuer — le programme se generera en arriere-plan.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <button onClick={retryGeneration} style={{ width: "100%", height: 52, background: DS.colors.primary, border: "none", borderRadius: DS.radius.md, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer" }}>REESSAYER</button>
                  <button onClick={skipGeneration} style={{ width: "100%", height: 52, background: "transparent", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 11, letterSpacing: "0.06em", cursor: "pointer" }}>CONTINUER SANS PROGRAMME</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }} key={slideIndex}>
                {/* Tag */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sportTheme.accent + "15", border: `1px solid ${sportTheme.accent}30`, borderRadius: 6, padding: "3px 10px", marginBottom: 16, alignSelf: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sportTheme.accent, animation: "pulse 1.5s infinite" }} />
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(sportTheme.accent), letterSpacing: "0.06em" }}>{currentSlide.tag}</p>
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 36, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: "0.02em", whiteSpace: "pre-line" }}>
                  {currentSlide.title}
                </h2>

                {/* Desc */}
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, lineHeight: 1.8, letterSpacing: "0.08em", marginBottom: 24 }}>{currentSlide.desc}</p>

                {/* Visual */}
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  {currentSlide.visual}
                </div>
              </div>
            )}

            {/* Bottom nav */}
            {!genError && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2, paddingTop: 16 }}>
                <button onClick={() => setSlideIndex(i => Math.max(0, i - 1))} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 44, height: 44, color: DS.colors.textSec, cursor: "pointer", fontSize: 18, opacity: slideIndex === 0 ? 0.3 : 1 }}>←</button>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>{slideIndex + 1} / {slides.length}</p>
                <button onClick={() => setSlideIndex(i => Math.min(slides.length - 1, i + 1))} style={{ background: slideIndex === slides.length - 1 ? sportTheme.accent : DS.colors.surfaceHigh, border: "none", borderRadius: slideIndex === slides.length - 1 ? DS.radius.full : DS.radius.full, padding: slideIndex === slides.length - 1 ? "0 20px" : "0", width: slideIndex === slides.length - 1 ? "auto" : 44, height: 44, color: slideIndex === slides.length - 1 ? "#000" : DS.colors.textSec, cursor: "pointer", fontSize: slideIndex === slides.length - 1 ? 13 : 18, fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: "0.05em", boxShadow: slideIndex === slides.length - 1 ? `0 4px 20px ${sportTheme.accent}50` : "none" }}>
                  {slideIndex === slides.length - 1 ? "VOIR MON PROGRAMME →" : "→"}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Barre du haut : retour + progression */}
      <div style={{ paddingTop: hautSur(52), paddingBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => step > 0 && setStep(st => st - 1)} aria-label="Retour" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: DS.radius.full, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.shadow.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: step > 0 ? "pointer" : "default", opacity: step > 0 ? 1 : 0, transition: "opacity 0.2s ease" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke={DS.colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, height: 6, borderRadius: DS.radius.full, background: DS.colors.surfaceHigh, overflow: "hidden" }}>
          <div style={{ width: "100%", transform: `translateX(${((step + 1) / totalSteps) * 100 - 100}%)`, height: "100%", borderRadius: DS.radius.full, background: DS.colors.primary, boxShadow: `0 0 10px ${DS.colors.primaryGlow}`, transition: "transform 260ms var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ flex: 1, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "opacity 220ms var(--ease-out), transform 220ms var(--ease-out)", overflowY: "auto" }}>

        {/* ETAPE 1 - Sport */}
        {contentStep === 0 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Choisis ta discipline" : "Quel est ton sport ?"} sub="Ton programme sera entièrement adapté." />
            <div className="v-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {SPORTS.map(sport => (
                <div key={sport.id} onClick={() => setData(d => ({ ...d, sport: sport.id, poste: null }))} style={{ background: data.sport === sport.id ? DS.colors.primary : DS.colors.surface, borderRadius: DS.radius.full, padding: "16px 8px", textAlign: "center", cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", transform: data.sport === sport.id ? "scale(1.05)" : "scale(1)", boxShadow: data.sport === sport.id ? DS.shadow.primary : DS.colors.isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{sport.emoji}</div>
                  <div style={{ color: data.sport === sport.id ? "#16181A" : DS.colors.textPrimary, fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{sport.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 2 - Objectif */}
        {contentStep === 1 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Ton objectif de combat ?" : "Quel est ton objectif ?"} sub="Les exercices et les charges s'adapteront." />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(OBJECTIFS_PAR_SPORT[data.sport] || []).map(obj => (
                <div key={obj.id} onClick={() => setData(d => ({ ...d, objectif: obj.id }))} style={{ background: data.objectif === obj.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.objectif === obj.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{obj.emoji}</span>
                  <div>
                    <div style={{ color: data.objectif === obj.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{obj.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{obj.desc}</div>
                  </div>
                  {data.objectif === obj.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 3 - Poste (sauf natation) */}
        {contentStep === 2 && (
          <div>
            <StepTitle title={data.sport === "combat" ? "Ta discipline ?" : "Ton poste ?"} sub={data.sport === "combat" ? "Le programme est adapté à ta discipline de combat." : "Le programme cible les qualités de ton poste."} />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(POSTES_PAR_SPORT[data.sport] || []).map(poste => (
                <div key={poste.id} onClick={() => setData(d => ({ ...d, poste: poste.id }))} style={{ background: data.poste === poste.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.poste === poste.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{poste.emoji}</span>
                  <div>
                    <div style={{ color: data.poste === poste.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{poste.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{poste.desc}</div>
                  </div>
                  {data.poste === poste.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETAPE 4 - Douleurs */}
        {contentStep === 3 && (
          <div>
            <StepTitle title="Des douleurs ?" sub="Les exercices s'adapteront automatiquement." />
            <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,107,53,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 24, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p style={{ color: DS.colors.warning, fontSize: 12, ...s.body }}>Tu peux selectionner plusieurs zones. Les exercices a risque seront remplaces.</p>
            </div>
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DOULEURS.map(d => {
                const selected = data.douleurs.includes(d.id);
                const solutions = {
                  epaule: "On évite le développé militaire et privilégie les mouvements en amplitude contrôlée",
                  genou: "On adapte les squats en amplitude partielle et priorise les mouvements à faible impact",
                  dos: "On remplace le soulevé de terre par des variantes protégées, gainage renforcé",
                  cheville: "On évite les sauts à fort impact, on privilégie les mouvements au sol",
                  poignet: "On remplace les appuis directs par des prises neutres ou sangles",
                };
                return (
                  <div key={d.id}>
                    <div onClick={() => toggleDouleur(d.id)} style={{ background: selected ? (d.id === "aucune" ? DS.colors.successSoft : DS.colors.warningSoft) : DS.colors.surface, border: `1px solid ${selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.border}`, borderRadius: DS.radius.md, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)" }}>
                      <span style={{ fontSize: 22 }}>{d.emoji}</span>
                      <p style={{ color: selected ? (d.id === "aucune" ? DS.colors.success : DS.colors.warning) : DS.colors.textPrimary, fontSize: 15, ...s.heading, flex: 1 }}>{d.label}</p>
                      {selected && <div style={{ width: 20, height: 20, background: d.id === "aucune" ? DS.colors.success : DS.colors.warning, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                    </div>
                    {selected && solutions[d.id] && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 14px 4px 18px", animation: "fadeIn 240ms var(--ease-out)" }}>
                        <span style={{ fontSize: 13, marginTop: 1 }}>🛡️</span>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, lineHeight: 1.5 }}>{solutions[d.id]}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPE 5 - Equipement */}
        {contentStep === 4 && (
          <div>
            <StepTitle title="Ton équipement ?" sub="Les exercices seront adaptés à ce que tu as." />
            <div className="v-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {EQUIPEMENTS.map(eq => (
                <div key={eq.id} onClick={() => setData(d => ({ ...d, equipement: eq.id }))} style={{ background: data.equipement === eq.id ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.equipement === eq.id ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", boxShadow: DS.colors.isDark ? "none" : DS.shadow.card }}>
                  <span style={{ fontSize: 26 }}>{eq.emoji}</span>
                  <div>
                    <div style={{ color: data.equipement === eq.id ? DS.colors.primary : DS.colors.textPrimary, fontSize: 16, ...s.heading, marginBottom: 2 }}>{eq.label}</div>
                    <div style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>{eq.desc}</div>
                  </div>
                  {data.equipement === eq.id && <div style={{ marginLeft: "auto", width: 20, height: 20, background: DS.colors.primary, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                </div>
              ))}
            </div>
            {MATERIEL_LIEU[data.equipement] && <MaterielLieu lieu={data.equipement} sport={data.sport} materiel={data.materiel} chargeMaison={data.chargeMaison} onChange={(m) => setData(d => ({ ...d, ...m }))} />}
          </div>
        )}

        {/* ETAPE - Club : saison, entraînements, match */}
        {contentStep === 7 && (
          <div>
            <StepTitle title="Ton club" sub={`Voltra organise ta semaine autour de tes entraînements et de tes ${motsSport(data.sport).pl}.`} />
            <RythmeClub sport={data.sport} rythme={data.rythme} accent={DS.colors.primary} onChange={(r) => setData(d => ({ ...d, rythme: r }))} />
          </div>
        )}

        {/* ETAPE 6 - Niveau + Frequence */}
        {contentStep === 5 && (
          <div>
            <StepTitle title="Ton rythme" sub="Le programme se calibre sur ton niveau et ton planning." />
            <div style={{ marginBottom: 36 }}>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Niveau actuel</p>
              <div style={{ display: "flex", gap: 10 }}>
                {NIVEAUX.map(n => (
                  <div key={n} onClick={() => setData(d => ({ ...d, niveau: n.toLowerCase() }))} style={{ flex: 1, padding: "12px 0", textAlign: "center", background: data.niveau === n.toLowerCase() ? DS.colors.primarySoft : DS.colors.surface, border: `1px solid ${data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.border}`, borderRadius: DS.radius.md, color: data.niveau === n.toLowerCase() ? DS.colors.primary : DS.colors.textSec, fontSize: 14, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", ...s.heading }}>{n}</div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seances par semaine</p>
              <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: 20 }}>
                <div style={{ ...s.display, fontSize: 48, color: DS.colors.primary, textAlign: "center", marginBottom: 16 }}>{data.frequence}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[2, 3, 4, 5].map(n => (
                    <div key={n} onClick={() => setData(d => ({ ...d, frequence: n, jours: joursConseilles(n, d.rythme) }))} style={{ flex: 1, padding: "10px 0", textAlign: "center", background: data.frequence === n ? DS.colors.primary : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: data.frequence === n ? "#000" : DS.colors.textSec, fontSize: 16, cursor: "pointer", transition: "var(--t-choix), transform 160ms var(--ease-out)", ...s.heading }}>{n}</div>
                  ))}
                </div>
                <p style={{ color: DS.colors.textSec, fontSize: 13, textAlign: "center", marginTop: 12, ...s.body }}>séances Voltra / semaine</p>
              </div>
              {data.frequence > frequenceConseillee(data.rythme) && (
                <p style={{ color: DS.colors.textPrimary, fontSize: 13, lineHeight: 1.45, background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.35)", borderRadius: 14, padding: "10px 12px", marginTop: 12, ...s.body }}>
                  ⚠️ Avec {data.rythme.club.length} entraînement{data.rythme.club.length > 1 ? "s" : ""}{data.rythme.match != null ? ` et ${motsSport(data.sport).un}` : ""}, on te conseille {frequenceConseillee(data.rythme)} séances : au-delà, la fatigue augmente le risque de blessure.{" "}
                  <span onClick={() => { const n = frequenceConseillee(data.rythme); setData(d => ({ ...d, frequence: n, jours: joursConseilles(n, d.rythme) })); }} style={{ fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>Passer à {frequenceConseillee(data.rythme)}</span>
                </p>
              )}
            </div>
            <div style={{ marginTop: 28 }}>
              <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.heading, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tes jours Voltra</p>
              <DayPicker sport={data.sport} jours={data.jours || []} max={data.frequence} accent={DS.colors.primary} rythme={data.rythme} onChange={(j) => setData(d => ({ ...d, jours: j }))} />
              {(data.rythme?.club?.length > 0 || data.rythme?.match != null) && <p style={{ color: DS.colors.textSec, fontSize: 12, textAlign: "center", marginTop: 6, ...s.body }}>Choisis loin {motsSport(data.sport).du} si possible : on a déjà placé les meilleurs jours.</p>}
            </div>
          </div>
        )}

        {/* ETAPE 7 - Âge, taille, poids */}
        {contentStep === 6 && (
          <div>
            <StepTitle title="Ton profil" sub="Pour doser tes charges et ta récupération." />
            {[["age", "Âge", "ans", 15, 70], ["taille", "Taille", "cm", 130, 220], ["poids", "Poids", "kg", 35, 160]].map(([k, label, unite, min, max]) => (
              <div key={k} style={{ marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px" }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: DS.colors.textSec }}>{label}</span>
                  <span>
                    <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: DS.colors.textPrimary, fontVariantNumeric: "tabular-nums" }}>{data[k] ?? PROFIL_DEFAUTS[k]}</span>
                    <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 15, color: DS.colors.textSec, marginLeft: 5 }}>{unite}</span>
                  </span>
                </div>
                <RulerPicker min={min} max={max} value={data[k] ?? PROFIL_DEFAUTS[k]} onChange={v => setData(d => ({ ...d, [k]: v }))} />
              </div>
            ))}
          </div>
        )}
      </div>

      {[3, 6].includes(contentStep) && (
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, lineHeight: 1.45, color: DS.colors.textSec, marginTop: 14 }}>
          🔒 Donnée de santé facultative. En la renseignant, tu acceptes qu'elle serve uniquement à adapter ton programme. Tu peux retirer ton accord à tout moment.
        </p>
      )}

      {/* Bouton principal, toujours visible en bas */}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))", background: fonduBas() }}>
        <PrimaryButton disabled={!canNext} onClick={() => {
          if (etapeProfil) setData(d => ({ ...d, age: d.age ?? PROFIL_DEFAUTS.age, taille: d.taille ?? PROFIL_DEFAUTS.taille, poids: d.poids ?? PROFIL_DEFAUTS.poids }));
          isLastStep ? setShowCoachDemo(true) : goNext();
        }}>
          {isLastStep ? "Générer mon programme" : "Continuer"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </PrimaryButton>
        {etapeProfil && (
          <button onClick={() => { setData(d => ({ ...d, age: null, taille: null, poids: null })); isLastStep ? setShowCoachDemo(true) : goNext(); }} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>
            Passer cette étape
          </button>
        )}
        {step === 0 && onLogin && (
          <button onClick={onLogin} style={{ width: "100%", marginTop: 12, padding: 8, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: "pointer" }}>
            J'ai déjà un compte · <span style={{ color: DS.colors.textPrimary, fontWeight: 700 }}>Me connecter</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN PRICING
// ─────────────────────────────────────────────
const MESSAGES_INVITATION = {
  indisponible: "Ton invitation n'a pas pu être activée pour l'instant. Tu n'as rien à payer : ferme et rouvre Voltra dans quelques minutes.",
  deja_utilisee: "Ce compte a déjà utilisé une invitation.",
};

function PricingScreen({ programme, user, cible, invitationErreur, onBack, onLogout }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const [selected, setSelected] = useState("annual");
  const [loading, setLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [essai, setEssai] = useState(true);
  const annuel = selected === "annual";
  const prixPremierPaiement = annuel ? "56,24 €" : "14,99 €";
  const premierPaiement = new Date(Date.now() + 7 * JOUR_MS).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const aDate = cible?.date && !cible.open && joursAvant(cible.date) >= 0;
  const seances = programme?.data_json?.semaines?.[0]?.seances || [];

  const appelerCheckout = async (session, corps) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(corps),
      }
    );
    return res.json();
  };

  // Le serveur décide de l'essai : ici, on évite juste d'annoncer « rien à payer » à un ancien abonné
  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const data = await appelerCheckout(session, { action: "eligibilite" });
        if (actif && data.essai === false) setEssai(false);
      } catch {}
    })();
    return () => { actif = false; };
  }, []);

  const handleStripeCheckout = async (planId) => {
    setLoading(true);
    setStripeError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStripeError("Connecte-toi pour continuer."); setLoading(false); return; }
      const data = await appelerCheckout(session, {
        plan: planId,
        success_url: window.location.origin + window.location.pathname,
        cancel_url: window.location.origin + window.location.pathname,
      });
      if (data.url) { window.location.href = data.url; return; }
      setStripeError("Erreur lors de la redirection. Réessaie.");
    } catch (err) {
      setStripeError("Erreur de connexion. Réessaie.");
    }
    setLoading(false);
  };

  const avantages = [
    ["🗓️", "Ton plan complet, semaine par semaine"],
    ["🏆", `Séances adaptées à tes ${motsSport().pl}`],
    ["📈", "Test de performance chaque mois"],
    ["🤖", "Coach IA illimité pendant tes séances"],
  ];

  return (
    <div style={{ minHeight: "100dvh", maxWidth: 430, margin: "0 auto", background: DS.colors.bg, color: DS.colors.textPrimary, position: "relative", isolation: "isolate", overflowX: "clip", padding: `${hautSur(48)} 22px calc(24px + env(safe-area-inset-bottom, 0px))`, fontFamily: "'Inter',sans-serif" }}>
      <Bloom echelle={0.9} />
      {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>}
      {invitationErreur && <p style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 14, background: DS.colors.surface, boxShadow: DS.shadow.card, fontSize: 13, lineHeight: 1.45, color: DS.colors.textPrimary }}>🎁 {MESSAGES_INVITATION[invitationErreur] || "Ce lien d'invitation n'est plus valable. Demande-en un nouveau à la personne qui t'a invité."}</p>}
      <p className="v-in" style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: ac }}>TON PLAN T'ATTEND</p>
      <h1 className="v-in" style={{ "--i": 1, fontWeight: 900, fontSize: 32, lineHeight: 1.02, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "8px 0" }}>
        {aDate ? <>Sois prêt<br />le <span style={{ color: ac }}>{dateLongue(cible.date)}</span></> : <>Lance <span style={{ color: ac }}>ton plan</span></>}
      </h1>

      <div className="v-in" style={{ "--i": 2, marginTop: 8 }}>
        {avantages.map(([ic, t]) => (
          <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14, fontWeight: 700, padding: "8px 0" }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 12, background: DS.colors.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{ic}</span>{t}
          </div>
        ))}
      </div>

      {seances.length > 0 && (
        <div className="v-in" style={{ "--i": 3, background: DS.colors.surface, borderRadius: 18, boxShadow: DS.shadow.card, marginTop: 10, overflow: "hidden" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: ac, padding: "12px 14px 4px" }}>TA PREMIÈRE SEMAINE EST PRÊTE</p>
          {seances.slice(0, 4).map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderTop: i ? `1px solid ${DS.colors.border}` : "none" }}>
              <span>{s.titre || `Séance ${i + 1}`}</span><span style={{ color: DS.colors.textSec, fontWeight: 500, whiteSpace: "nowrap" }}>{s.dureeMin || 45} min</span>
            </div>
          ))}
        </div>
      )}

      <div className="v-in" style={{ "--i": 4, display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        {PLANS.map(plan => {
          const on = selected === plan.id;
          return (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{ position: "relative", padding: "16px 18px", borderRadius: 22, background: DS.colors.surface, border: `2px solid ${on ? DS.colors.primary : DS.colors.border}`, boxShadow: on ? `0 0 0 4px ${DS.colors.primarySoft}` : DS.shadow.card, cursor: "pointer" }}>
              {plan.badge && <span style={{ position: "absolute", top: -11, left: 16, padding: "4px 10px", borderRadius: 99, background: DS.colors.primary, color: "#0B0B0C", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em" }}>{plan.badge}</span>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DS.colors.textSec }}>{plan.label}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>{plan.displayPrice}</span>
                    <span style={{ fontSize: 13, color: DS.colors.textSec }}>{plan.unit}</span>
                    {plan.savings && <span style={{ padding: "2px 8px", borderRadius: 99, background: DS.colors.primarySoft, color: ac, fontSize: 11, fontWeight: 800 }}>{plan.savings}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: DS.colors.textSec, marginTop: 3, lineHeight: 1.4 }}>{essai ? plan.priceDetail : plan.priceDetail.replace("7 jours gratuits, puis ", "")}</p>
                </div>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${on ? DS.colors.primary : DS.colors.textDim}`, background: on ? DS.colors.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0B0B0C", fontSize: 13, fontWeight: 900 }}>{on ? "✓" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>

      {essai ? (
        <div className="v-in" style={{ "--i": 5, display: "flex", margin: "18px 0 16px" }}>
          {[["Aujourd'hui", "Accès complet"], ["Jour 4", "Rappel par e-mail"], [premierPaiement, `1er paiement : ${prixPremierPaiement}`]].map(([t, d], i) => (
            <div key={t} style={{ flex: 1, position: "relative", paddingTop: 18, fontSize: 11, color: DS.colors.textSec, lineHeight: 1.3 }}>
              <span style={{ position: "absolute", top: 3, left: 0, width: 10, height: 10, borderRadius: "50%", background: DS.colors.primary }} />
              {i < 2 && <span style={{ position: "absolute", top: 7, left: 10, right: 0, height: 2, background: DS.colors.surfaceHigh }} />}
              <b style={{ display: "block", color: DS.colors.textPrimary, fontSize: 12 }}>{t}</b>{d}
            </div>
          ))}
        </div>
      ) : (
        <p className="v-in" style={{ "--i": 5, margin: "18px 0 16px", fontSize: 13, color: DS.colors.textSec, lineHeight: 1.45 }}>
          Tu as déjà profité de ton essai gratuit. <b style={{ color: DS.colors.textPrimary }}>Premier paiement aujourd'hui : {prixPremierPaiement}.</b>
        </p>
      )}

      {stripeError && <p style={{ color: "#FF2D55", fontSize: 12, textAlign: "center", marginBottom: 8 }}>⚠ {stripeError}</p>}
      <PrimaryButton onClick={() => handleStripeCheckout(selected)} disabled={loading} style={{ height: 58 }}>
        {loading ? "Redirection vers Stripe..." : essai ? "Essayer 7 jours gratuitement" : "Continuer vers le paiement"}
      </PrimaryButton>
      <p style={{ fontSize: 12, color: DS.colors.textSec, textAlign: "center", marginTop: 10, lineHeight: 1.4 }}>{essai ? `Carte demandée · Rien à payer aujourd'hui · Annule avant le ${premierPaiement} en quelques clics` : "Paiement aujourd'hui · Résiliable depuis ton profil"}</p>
      <p style={{ fontSize: 11, color: DS.colors.textSec, textAlign: "center", marginTop: 6, lineHeight: 1.4 }}>L'abonnement doit être souscrit par une personne majeure ou par un parent.</p>
      {onLogout && <button onClick={onLogout} style={{ display: "block", width: "100%", marginTop: 12, padding: 8, background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer" }}>Se déconnecter</button>}
    </div>
  );
}

// ─────────────────────────────────────────────
// ECRAN MATCHS
// ─────────────────────────────────────────────
function MatchsScreen({ user, onBack }) {
  const [matchs, setMatchs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titre: "", date_match: "", adversaire: "", lieu: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMatchs(); }, []);

  const loadMatchs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("matchs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date_match", new Date().toISOString().split("T")[0])
      .order("date_match", { ascending: true });
    if (data) setMatchs(data);
    setLoading(false);
  };

  const saveMatch = async () => {
    if (!form.titre || !form.date_match) return;
    setSaving(true);
    await supabase.from("matchs").insert({ ...form, user_id: user.id });
    setForm({ titre: "", date_match: "", adversaire: "", lieu: "" });
    setShowForm(false);
    await loadMatchs();
    setSaving(false);
  };

  const deleteMatch = async (id) => {
    await supabase.from("matchs").delete().eq("id", id);
    setMatchs(m => m.filter(x => x.id !== id));
  };

  const getDaysUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getMatchColor = (days) => {
    if (days <= 1) return DS.colors.warning;
    if (days <= 3) return DS.colors.gold;
    return DS.colors.success;
  };

  const getMatchLabel = (days) => {
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `Dans ${days} jours`;
  };

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", paddingBottom: 100 }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${DS.colors.border}`, padding: `${hautSur(14)} 20px 14px` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} style={{ background: DS.colors.surfaceUp, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textSec, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 26, color: DS.colors.textPrimary, letterSpacing: "0.06em" }}>MES {motsSport().Pl.toUpperCase()}</h1>
          <button onClick={() => setShowForm(v => !v)} style={{ background: DS.colors.primary, border: "none", borderRadius: DS.radius.full, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.primary }}>+</button>
        </div>
      </div>

      <div style={{ padding: "24px 20px 0" }}>

        {showForm && (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.borderAccent}`, borderRadius: DS.radius.xl, padding: 20, marginBottom: 24 }}>
            <p style={{ color: DS.colors.primary, fontSize: 14, ...s.heading, marginBottom: 16 }}>{motsSport().f ? "Nouvelle" : "Nouveau"} {motsSport().nom}</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre *</label>
              <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Championnat, tournoi…" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date *</label>
              <input type="date" value={form.date_match} onChange={e => setForm(f => ({ ...f, date_match: e.target.value }))} style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", colorScheme: "dark" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Adversaire</label>
                <input value={form.adversaire} onChange={e => setForm(f => ({ ...f, adversaire: e.target.value }))} placeholder="Optionnel" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.colors.textSec, fontSize: 11, ...s.heading, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lieu</label>
                <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Optionnel" style={{ width: "100%", height: 44, padding: "0 14px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, outline: "none", ...s.body }} />
              </div>
            </div>
            <button onClick={saveMatch} disabled={saving || !form.titre || !form.date_match} style={{ width: "100%", height: 48, background: `linear-gradient(135deg, ${DS.colors.primary}, #5A52E0)`, border: "none", borderRadius: DS.radius.md, color: DS.colors.textPrimary, fontSize: 15, cursor: "pointer", ...s.heading, boxShadow: DS.shadow.primary }}>
              {saving ? "Enregistrement..." : `Ajouter ${motsSport().le}`}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: DS.colors.primary, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          </div>
        ) : matchs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📅</p>
            <p style={{ color: DS.colors.textPrimary, fontSize: 18, ...s.heading, marginBottom: 8 }}>Aucun{motsSport().e} {motsSport().nom} programmé{motsSport().e}</p>
            <p style={{ color: DS.colors.textSec, fontSize: 14, ...s.body, lineHeight: 1.6 }}>Ajoute tes {motsSport().pl} pour que Voltra adapte automatiquement tes séances.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {matchs.map(match => {
              const days = getDaysUntil(match.date_match);
              const color = getMatchColor(days);
              return (
                <div key={match.id} style={{ background: DS.colors.surface, border: `1px solid ${color}30`, borderRadius: DS.radius.xl, padding: 20, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "inline-flex", padding: "3px 10px", background: color + "20", border: `1px solid ${color}40`, borderRadius: DS.radius.full, color, fontSize: 11, ...s.heading, marginBottom: 8 }}>
                        {getMatchLabel(days)}
                      </div>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 17, ...s.heading, marginBottom: 4 }}>{match.titre}</p>
                      {match.adversaire && <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>vs {match.adversaire}</p>}
                      {match.lieu && <p style={{ color: DS.colors.textSec, fontSize: 13, ...s.body }}>📍 {match.lieu}</p>}
                    </div>
                    <button onClick={() => deleteMatch(match.id)} style={{ background: "none", border: "none", color: DS.colors.textDim, fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
                  </div>
                  <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "10px 14px" }}>
                    <p style={{ color: DS.colors.textSec, fontSize: 12, ...s.body }}>
                      {days <= 1 ? "⚡ Seance tres legere aujourd'hui - preserve ton energie" :
                       days <= 3 ? `⚠️ Charges réduites : approche ${motsSport().du}` :
                       days <= 5 ? `💪 Programme normal : fin de cycle avant ${motsSport().le}` :
                       `✅ Programme complet : ${motsSport().nom} encore loin`}
                    </p>
                  </div>
                  <p style={{ color: DS.colors.textDim, fontSize: 11, ...s.mono, marginTop: 8 }}>
                    {new Date(match.date_match).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
function DashboardScreen({ user, isPro, programme, programmeLoading, matchs, derniereSeance, sport: sportProp, onStartSession, onOpenMatchs, onResumeSession, cible, onEditCible, onMissionSuivante, onAbonnement, ouvrirTests, onTestsOuverts }) {
  const stagger = useStaggerUneFois("dashboard");
  const sport = sportProp || "default";
  const [depannage, setDepannage] = useState(false);
  const ouvrirDepannage = () => isPro ? setDepannage(true) : onAbonnement?.();
  const { tests, charger: chargerTests, liste } = useTests(user, sport);
  const [vueTest, setVueTest] = useState(ouvrirTests ? "test" : null);
  useEffect(() => { if (ouvrirTests) onTestsOuverts?.(); }, []);
  // Séance en pause récupérable (< 2h)
  const [pausedSession] = useState(() => {
    try {
      const raw = localStorage.getItem("voltra_paused_session");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.savedAt > 2 * 60 * 60 * 1000) {
        localStorage.removeItem("voltra_paused_session");
        return null;
      }
      return data;
    } catch { return null; }
  });
  const theme = getSportTheme(sport);
  const progData = programme?.data_json;

  // Determiner la vraie seance du jour selon la progression reelle
  const [seanceIdxDansSemaine, setSeanceIdxDansSemaine] = useState(0);
  useEffect(() => {
    if (!programme?.id) return;
    const freq = programme?.frequence || 1;
    supabase
      .from("seances")
      .select("id", { count: "exact", head: true })
      .eq("programme_id", programme.id)
      .eq("statut", "faite")
      .then(({ count }) => setSeanceIdxDansSemaine((count || 0) % freq));
  }, [programme?.id, programme?.frequence]);

  const semaineIdx = Math.max(0, Math.min((programme?.semaine_courante || 1) - 1, (progData?.semaines?.length || 1) - 1));
  const seancesSemaine = progData?.semaines?.[semaineIdx]?.seances || progData?.semaines?.[0]?.seances || [];
  const seance = seancesSemaine[seanceIdxDansSemaine] || seancesSemaine[0] || null;
  const exercices = seance?.exercices || [];

  const prog = {
    titre: programme?.titre || null,
    semaineCourante: programme?.semaine_courante || 1,
    totalSemaines: programme?.total_semaines || 8,
    progression: Math.round(((programme?.semaine_courante || 1) / (programme?.total_semaines || 8)) * 100),
  };

  const userName = user?.user_metadata?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Athlète";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après‑midi" : "Bonsoir";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const currentCycle = programme?.data_json?.cycle || getNiveauCycle(programme?.data_json?.niveau) || 1;
  const startCycle = programme?.data_json?.startCycle || getNiveauCycle(programme?.data_json?.niveau) || 1;

  if (vueTest === "carrousel") return <CarrouselScreen tests={tests} liste={liste} onBack={() => setVueTest("test")} />;
  if (vueTest === "test") return <TestScreen user={user} tests={tests} liste={liste} onSaved={async () => { await chargerTests(); }} onBack={() => setVueTest(null)} onCarrousel={() => setVueTest("carrousel")} />;
  if (vueTest === "mission") return <BilanMissionScreen user={user} cible={cible} tests={tests} liste={liste} onBack={() => setVueTest(null)} onSuivante={onMissionSuivante} />;
  if (vueTest === "ace") return <AceScreen user={user} isPro={isPro} onAbonnement={onAbonnement} sport={sport} cible={cible} matchs={matchs} programme={programme} onBack={() => setVueTest(null)} />;

  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, paddingBottom: 130 }}>

      {/* Badge programme loading */}
      {programmeLoading && (
        <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: DS.colors.surface, border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: DS.shadow.card, whiteSpace: "nowrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: theme.accent, animation: "pulse 1s infinite" }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>Génération du programme...</p>
        </div>
      )}

      {/* Header */}
      <div className={stagger ? "v-up" : undefined} style={{ padding: `${hautSur(56)} 24px 4px`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -140, right: -110, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${theme.accent}26, transparent 70%)`, pointerEvents: "none" }} />
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, marginBottom: 6, fontWeight: 600, position: "relative" }}>
          {today.charAt(0).toUpperCase() + today.slice(1)}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 34, color: DS.colors.textPrimary, margin: 0, letterSpacing: "-0.03em", lineHeight: 1, textTransform: "uppercase" }}>
            {greeting},<br /><span style={{ color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark }}>{userName}</span>
          </h1>
          <div style={{ width: 52, height: 52, borderRadius: 18, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `0 8px 24px ${theme.accent}55` }}>
            {SPORT_EMOJIS[sport] || "⚡"}
          </div>
        </div>
      </div>

      <div className={stagger} style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>

        {/* Bannière reprise séance en pause */}
        {pausedSession && (
          <div onClick={() => onResumeSession && onResumeSession(pausedSession)} style={{ background: `linear-gradient(135deg, ${theme.accent}18, ${theme.accent}06)`, border: `1.5px solid ${theme.accent}50`, borderRadius: DS.radius.xl, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: `0 4px 20px ${theme.accent}20` }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, animation: "pulse 2s infinite" }}>⏸</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 15, color: DS.colors.textPrimary, marginBottom: 2 }}>Séance en pause</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec }}>
                Tu en étais à l'exercice {(pausedSession.exIdx || 0) + 1}, série {(pausedSession.setIdx || 0) + 1} · {Object.keys(pausedSession.completedSets || {}).length} séries validées
              </p>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 800, color: accentLisible(theme.accent), whiteSpace: "nowrap" }}>Reprendre →</p>
          </div>
        )}

        <MissionCard cible={cible} onEdit={onEditCible} onBilan={isPro ? () => setVueTest("mission") : null} />
        <BilanSemaineCard user={user} isPro={isPro} />
        <ApresCompetCard rythme={progData?.rythme} cible={cible} sport={sport} />
        <SemaineCard jours={progData?.jours || DEFAULT_JOURS[Math.min(programme?.frequence || 3, 5)]} matchs={matchs} cible={cible} onAjouterMatch={onOpenMatchs} rythme={progData?.rythme} seances={seancesSemaine} onDepannage={ouvrirDepannage} />
        {programme && <button onClick={ouvrirDepannage} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 16, padding: 14, borderRadius: 20, background: DS.colors.surface, boxShadow: DS.shadow.card, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif", color: DS.colors.textPrimary }}>
          <span style={{ fontSize: 22 }}>🧰</span>
          <span style={{ flex: 1 }}>
            <b style={{ display: "block", fontSize: 14 }}>Séance de dépannage</b>
            <span style={{ fontSize: 12, color: DS.colors.textSec }}>Club annulé ou peu de matériel</span>
          </span>
          <span style={{ color: DS.colors.textSec }}>›</span>
        </button>}
        {depannage && <DepannageSheet sport={sport} progData={progData} user={user} onClose={() => setDepannage(false)} onSeance={(se) => { setDepannage(false); onStartSession(se); }} />}
        {!pausedSession && !programmeLoading && <InstallPrompt variante="tableau" ds={DS} />}

        {/* Séance du jour — card sombre */}
        {!seance ? (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.shadow.card, borderRadius: 26, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, fontSize: 120, opacity: 0.06 }}>{SPORT_EMOJIS[sport] || "⚡"}</div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentLisible(theme.accent), fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>PROGRAMME EN PRÉPARATION</p>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Ton programme arrive...</h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, margin: 0 }}>L'IA construit ton programme personnalisé. Reviens dans quelques instants.</p>
          </div>
        ) : (
          <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, boxShadow: DS.colors.isDark ? `0 0 0 1px ${theme.accent}22, 0 12px 40px ${theme.accent}14` : "0 12px 32px rgba(0,0,0,0.08)", borderRadius: 26, overflow: "hidden", marginBottom: 16, position: "relative" }}>
            <div style={{ position: "absolute", right: -20, top: -20, fontSize: 140, opacity: 0.06 }}>{SPORT_EMOJIS[sport] || "⚡"}</div>
            <div style={{ padding: "20px 20px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: accentLisible(theme.accent), fontWeight: 700, marginBottom: 6, letterSpacing: "0.04em" }}>
                    {typeSeance(seance) ? `${typeSeance(seance).ic} ${typeSeance(seance).l.toUpperCase()}` : seance.type?.replace(/_/g, " ").toUpperCase() || "SÉANCE DU JOUR"}
                  </p>
                  <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 24, color: DS.colors.textPrimary, margin: 0, letterSpacing: "-0.01em" }}>
                    {seance.titre || "Séance"}
                  </h2>
                  {seance.objectif && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, margin: "6px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{seance.objectif}</p>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, fontWeight: 800, color: DS.colors.textPrimary, margin: 0, lineHeight: 1 }}>{seance.dureeMin || 45}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>min</p>
                </div>
              </div>

              {/* Progress dots */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {exercices.slice(0, 6).map((_, i) => (
                  <div key={i} style={{ height: 3, flex: 1, background: DS.colors.surfaceHigh, borderRadius: 2 }} />
                ))}
              </div>

              {/* Exercices preview */}
              {seance.echauffement?.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: `1px solid ${DS.colors.border}`, fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec }}>
                  <span>🔥 Échauffement</span><span>{seance.echauffement.length} exercices</span>
                </div>
              )}
              {exercices.slice(0, 3).map((ex, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: `1px solid ${DS.colors.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, opacity: 0.7 }} />
                    <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textPrimary, fontWeight: 500 }}>{ficheExercice(ex)?.fr || ex.nom}</span>
                  </div>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec }}>{dosage(ex)}</span>
                </div>
              ))}
              {exercices.length > 3 && (
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, marginTop: 8, marginBottom: 0 }}>+{exercices.length - 3} exercices</p>
              )}
              {seance.retourCalme?.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", marginTop: 4, borderTop: `1px solid ${DS.colors.border}`, fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec }}>
                  <span>🧘 Retour au calme</span><span>{seance.retourCalme.length} exercices</span>
                </div>
              )}
            </div>

            <div style={{ padding: "0 16px 16px" }}>
              <PrimaryButton onClick={() => onStartSession(seance)} style={{ height: 54 }}>
                
                Démarrer la séance
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4.5V19.5L19 12L7 4.5Z" fill="currentColor" /></svg>
              </PrimaryButton>
            </div>
          </div>
        )}

        <button onClick={() => isPro ? setVueTest("ace") : onAbonnement()} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 16, padding: 14, borderRadius: 20, background: DS.colors.surface, boxShadow: DS.shadow.card, border: "none", textAlign: "left", cursor: "pointer", color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
          <AceAvatar size={32} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 14 }}>Parle à Ace</b>
            <span style={{ fontSize: 12, color: DS.colors.textSec }}>Pose-lui une question</span>
          </span>
          <span style={{ color: DS.colors.textSec }}>›</span>
        </button>

        <TestCard tests={tests} onOpen={() => setVueTest("test")} />

        {/* Sans objectif daté : progression par cycle. Avec objectif : la carte du haut suffit */}
        {!cible?.date && <>
        {/* Progression cycle */}
        <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 16, boxShadow: DS.shadow.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, margin: "0 0 2px" }}>
                {currentCycle === 1 ? "🌱 Fondations" : currentCycle === 2 ? "⚡ Intensification" : currentCycle === 3 ? "🔥 Puissance" : currentCycle === 4 ? "💎 Elite" : `🚀 Elite+${currentCycle - 4}`}
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>
                Cycle {currentCycle} · Semaine {prog.semaineCourante} sur {prog.totalSemaines}
              </p>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, color: accentLisible(theme.accent), margin: 0 }}>{prog.progression}%</p>
          </div>
          <div style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.full, height: 6, overflow: "hidden" }}>
            <div style={{ width: "100%", transform: `translateX(${prog.progression - 100}%)`, height: "100%", background: theme.accent, borderRadius: DS.radius.full, transition: "transform 500ms var(--ease-out)" }} />
          </div>
        </div>

        {/* Parcours cycles */}
        <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "18px 16px", marginBottom: 16, boxShadow: DS.shadow.card }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, marginBottom: 14 }}>Ton parcours</p>
          <div style={{ display: "flex", gap: 0, position: "relative" }}>
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, background: DS.colors.surfaceHigh, zIndex: 0 }} />
            <div style={{ position: "absolute", top: 20, left: 20, height: 2, width: `${Math.min(100, (1/4)*100)}%`, background: theme.accent, zIndex: 0 }} />
            {(() => {
              const getLabel = (n) => n === 1 ? "BASES" : n === 2 ? "INTENSITÉ" : n === 3 ? "PUISSANCE" : n === 4 ? "ELITE" : `E+${n-4}`;
              const start = Math.max(1, currentCycle - 1);
              return Array.from({ length: 4 }, (_, i) => ({ num: start + i, label: getLabel(start + i) })).map((c, i) => {
                const isDone = currentCycle > c.num && c.num >= startCycle;
                const isSkipped = c.num < startCycle;
                const isCurrent = currentCycle === c.num;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: DS.radius.full, background: isDone ? theme.accent : isCurrent ? theme.accent + "20" : DS.colors.surfaceHigh, border: `2px solid ${isDone || isCurrent ? theme.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isCurrent ? `0 0 12px ${theme.accent}50` : "none" }}>
                      {isDone ? <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>✓</span>
                        : isSkipped ? <span style={{ color: DS.colors.textDim, fontSize: 12 }}>—</span>
                        : <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: isCurrent ? theme.accent : DS.colors.textSec, fontWeight: 700 }}>{c.num}</span>}
                    </div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isCurrent ? theme.accent : DS.colors.textSec, fontWeight: isCurrent ? 700 : 400, letterSpacing: "0.05em", textAlign: "center" }}>{c.label}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        </>}

        {/* Dernière séance */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, marginBottom: 12 }}>Dernière séance</p>
          {derniereSeance ? (
            <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: DS.shadow.card }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {derniereSeance.feedback === "good" ? "💪" : derniereSeance.feedback === "easy" ? "😤" : "🔥"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: DS.colors.textPrimary, marginBottom: 3 }}>{derniereSeance.titre}</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, margin: 0 }}>
                  {new Date(derniereSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {derniereSeance.duree_min || 0} min
                </p>
              </div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: accentLisible(theme.accent), fontWeight: 700 }}>
                {derniereSeance.exercices?.length || 0} exo
              </p>
            </div>
          ) : (
            <div style={{ background: DS.colors.surface, borderRadius: DS.radius.xl, padding: "20px", textAlign: "center", boxShadow: DS.shadow.card }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec }}>Aucune séance encore. C'est l'heure de commencer ! 💪</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
// ── Progression : avant / maintenant, à partir des tests mensuels ──
const ecartTest = (t, a, b) => {
  const d = Number(b[t.k]) - Number(a[t.k]);
  const arrondi = Number(d.toFixed(t.dec));
  return { d: arrondi, mieux: arrondi * t.mieux > 0, egal: arrondi === 0, texte: `${arrondi > 0 ? "+" : arrondi < 0 ? "−" : ""}${virgule(Math.abs(arrondi), t.dec)}${t.u ? ` ${t.u}` : ""}` };
};
const minSec = (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
const valeurTest = (t, v) => t.chrono && v >= 60 ? minSec(v) : `${virgule(v, t.dec)}${t.u ? ` ${t.u}` : ""}`;
const semainesEntre = (a, b) => Math.max(1, Math.round((new Date(b.date_test) - new Date(a.date_test)) / (7 * JOUR_MS)));

function AvantMaintenant({ tests, liste, onTest, onPartager }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const [message, setMessage] = useState("");
  const carte = { background: DS.colors.surface, borderRadius: 22, boxShadow: DS.shadow.card, padding: "18px 16px", marginBottom: 16 };
  const sur = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: ac, margin: 0 };
  if (!tests) return null;
  if (tests.length === 0) return (
    <button onClick={onTest} style={{ ...carte, width: "100%", textAlign: "left", border: `2px solid ${DS.colors.primary}`, cursor: "pointer", display: "block", fontFamily: "'Inter',sans-serif", color: DS.colors.textPrimary }}>
      <p style={sur}>AVANT → MAINTENANT</p>
      <b style={{ display: "block", fontSize: 20, fontWeight: 900, margin: "6px 0 4px" }}>Fais ton test de départ</b>
      <span style={{ fontSize: 14, color: DS.colors.textSec, lineHeight: 1.45 }}>{liste.map(t => t.t).join(", ")}. Refais-le chaque mois : tes vrais progrès s'afficheront ici. ›</span>
    </button>
  );
  const a = tests[0], b = tests[tests.length - 1];
  const prochain = new Date(new Date(`${b.date_test}T12:00:00`).getTime() + INTERVALLE_TEST * JOUR_MS);
  const lignes = comparables(liste, tests);
  const paires = lignes.filter(c => c.n >= 2);
  if (tests.length === 1 || paires.length === 0) return (
    <div style={carte}>
      <p style={sur}>AVANT → MAINTENANT</p>
      <b style={{ display: "block", fontSize: 20, fontWeight: 900, margin: "6px 0 12px" }}>Ton point de départ</b>
      {lignes.map(({ t, b: dernier }) => (
        <div key={t.k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: `1px solid ${DS.colors.border}`, fontSize: 14 }}>
          <span style={{ color: DS.colors.textSec, fontWeight: 600 }}>{t.t}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{valeurTest(t, dernier[t.k])}</b>
        </div>
      ))}
      <p style={{ fontSize: 13, color: DS.colors.textSec, marginTop: 10, lineHeight: 1.45 }}>Refais le test {prochain <= new Date() ? "dès maintenant" : `le ${prochain.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`} pour voir ta progression.</p>
      {prochain <= new Date() && <PrimaryButton onClick={onTest} style={{ height: 52, marginTop: 12 }}>Faire mon test du mois</PrimaryButton>}
    </div>
  );
  const sem = semainesEntre(a, b);
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ ...sur, marginBottom: 10 }}>AVANT → MAINTENANT · {sem} SEMAINE{sem > 1 ? "S" : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {paires.map(({ t, a, b }, i) => {
          const e = ecartTest(t, a, b);
          return (
            <div key={t.k} className="v-in" style={{ "--i": i + 1, background: DS.colors.surface, borderRadius: 18, padding: "14px 10px", boxShadow: DS.shadow.card }}>
              <b style={{ display: "block", fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: e.mieux ? ac : DS.colors.textSec }}>{e.egal ? "=" : e.texte}</b>
              <span style={{ display: "block", fontSize: 11, color: DS.colors.textSec, fontWeight: 600, marginTop: 2 }}>{t.t.replace(" en 1 minute", "").replace(" sans élan", "")}</span>
              <span style={{ display: "block", fontSize: 11, color: DS.colors.textDim, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{valeurTest(t, a[t.k])} → {valeurTest(t, b[t.k])}</span>
            </div>
          );
        })}
      </div>
      <PrimaryButton onClick={onPartager} style={{ height: 52, marginTop: 14 }}>Partager ma progression</PrimaryButton>
      {message && <p style={{ fontSize: 13, color: DS.colors.textSec, textAlign: "center", marginTop: 8 }}>{message}</p>}
      <p onClick={onTest} style={{ fontSize: 13, color: DS.colors.textSec, textAlign: "center", marginTop: 12, textDecoration: "underline", cursor: "pointer" }}>{prochain <= new Date() ? "C'est l'heure de ton test du mois" : `Prochain test le ${prochain.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}</p>
    </div>
  );
}

// ── Carte du corps : les muscles travaillés sur 30 jours, d'après les séances faites ──
const ZONES_CORPS = [
  { id: "epaules", n: "épaules", mots: ["deltoid", "epaule", "coiffe", "rotat"] },
  { id: "pectoraux", n: "pectoraux", mots: ["pector", "pec "] },
  { id: "bras", n: "bras", mots: ["biceps", "triceps", "avant-bras", "prehension", "prise", "grip"] },
  { id: "abdos", n: "abdos", mots: ["abdo", "core", "gainage", "oblique", "transverse", "psoas", "hip flexor", "flechisseur"] },
  { id: "dos", n: "dos", mots: ["dorsa", "rhombo", "trapez", "dentel"] },
  { id: "lombaires", n: "lombaires", mots: ["lombaire", "erecteur", "bas du dos"] },
  { id: "fessiers", n: "fessiers", mots: ["fessier", "glute", "hanche"] },
  { id: "quadriceps", n: "quadriceps", mots: ["quadri"] },
  { id: "ischios", n: "ischios", mots: ["ischio"] },
  { id: "mollets", n: "mollets", mots: ["mollet", "gastrocn", "soleaire", "tibial", "cheville"] },
];
const sansAccents = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Le premier muscle cité compte en entier, les suivants à moitié
function zonesDepuisMuscles(muscles) {
  const texte = sansAccents(muscles);
  if (texte.includes("corps entier")) return Object.fromEntries(ZONES_CORPS.map(z => [z.id, 0.5]));
  // Les zones sont classées dans l'ordre où le texte les cite, avec ou sans virgules (« Quadriceps Fessiers »)
  const trouvees = ZONES_CORPS
    .map(z => ({ id: z.id, i: Math.min(...z.mots.map(k => { const p = `${texte} `.indexOf(k); return p < 0 ? Infinity : p; })) }))
    .filter(z => z.i < Infinity)
    .sort((a, b) => a.i - b.i);
  return Object.fromEntries(trouvees.map((z, n) => [z.id, n === 0 ? 1 : 0.5]));
}

// Du plus clair (peu travaillé) au plus foncé (le plus travaillé)
// Une couleur bien distincte par niveau, de Débutant à Élite
const COULEURS_NIVEAU = ["#F1ECE4", "#FFE27A", "#FFB23F", "#FF7433", "#E8364A", "#B3207A", "#5A2BA0"];
function rgbNiveau(t) {
  const x = Math.min(1, Math.max(0, t)) * (COULEURS_NIVEAU.length - 1);
  const i = Math.min(COULEURS_NIVEAU.length - 2, Math.floor(x)), f = x - i;
  const rgb = (h) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const a = rgb(COULEURS_NIVEAU[i]), b = rgb(COULEURS_NIVEAU[i + 1]);
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

// Couleurs unies de la carte des muscles /corps-zones.jpg, alignée sur /corps-anatomie.jpg
const ZONES_CARTE = {
  epaules: [255, 0, 0], pectoraux: [0, 255, 0], bras: [0, 0, 255], abdos: [255, 255, 0], dos: [255, 0, 255],
  lombaires: [0, 255, 255], fessiers: [255, 128, 0], quadriceps: [128, 0, 255], ischios: [0, 255, 128], mollets: [255, 0, 128],
};

const chargerImage = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

// L'illustration est détourée (le blanc qui touche les bords devient transparent),
// puis chaque pixel de la carte est rangé dans la zone dont la couleur est la plus proche et teinté à son niveau
// Corps détouré et teinté selon les niveaux, dans un canvas hors écran
let imagesCorps = null;
async function peindreCorps(niveaux) {
  imagesCorps = imagesCorps || Promise.all([chargerImage("/corps-anatomie.jpg"), chargerImage("/corps-zones.jpg")]);
  const [corps, carte] = await imagesCorps;
  const c = document.createElement("canvas");
  const w = corps.width, h = corps.height;
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(carte, 0, 0, w, h);
  const z = x.getImageData(0, 0, w, h).data;
  x.clearRect(0, 0, w, h);
  x.drawImage(corps, 0, 0);
  const donnees = x.getImageData(0, 0, w, h), p = donnees.data;
  // Détourage : on part des bords et on avance tant que le pixel est presque blanc
  const fond = new Uint8Array(w * h), pile = [];
  const clair = (k) => Math.min(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) > 236;
  for (let i = 0; i < w; i++) pile.push(i, (h - 1) * w + i);
  for (let j = 0; j < h; j++) pile.push(j * w, j * w + w - 1);
  while (pile.length) {
    const k = pile.pop();
    if (fond[k] || !clair(k)) continue;
    fond[k] = 1;
    const i = k % w;
    if (i > 0) pile.push(k - 1);
    if (i < w - 1) pile.push(k + 1);
    if (k >= w) pile.push(k - w);
    if (k < w * (h - 1)) pile.push(k + w);
  }
  const zones = Object.entries(ZONES_CARTE).map(([nom, rgb]) => ({ nom, rgb }));
  const peinture = Object.fromEntries(Object.keys(ZONES_CARTE).map(n => [n, niveaux[n] ? rgbNiveau(niveaux[n]) : null]));
  for (let k = 0; k < w * h; k++) {
    const i = k * 4;
    const col = k % w, lig = (k - col) / w;
    if (fond[k] || col < 4 || col > w - 5 || lig < 4 || lig > h - 5) { p[i + 3] = 0; continue; }
    // Bord du corps : fondu doux pour éviter un liseré blanc
    const voisinFond = fond[k - 1] || fond[k + 1] || fond[k - w] || fond[k + w];
    if (voisinFond) p[i + 3] = Math.min(255, Math.max(0, (255 - Math.min(p[i], p[i + 1], p[i + 2])) * 6));
    const r = z[i], g = z[i + 1], b = z[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 90) continue;
    let meilleure = null, distance = Infinity;
    for (const zo of zones) {
      const d = (r - zo.rgb[0]) ** 2 + (g - zo.rgb[1]) ** 2 + (b - zo.rgb[2]) ** 2;
      if (d < distance) { distance = d; meilleure = zo; }
    }
    if (distance > 22000) continue;
    // Erreurs de la carte générée, vue de face (moitié gauche) : intérieur des cuisses et haut des trapèzes
    const face = k % w < w / 2, y = Math.floor(k / w) / h;
    let zone = meilleure.nom;
    if (face && zone === "ischios") zone = "quadriceps";
    if (face && zone === "epaules" && y < 0.162) zone = "dos";
    const couleur = peinture[zone];
    if (!couleur) continue;
    // Effet « multiplier » : la couleur garde les fibres de l'illustration
    for (let n = 0; n < 3; n++) p[i + n] = Math.round(p[i + n] * (0.12 + 0.88 * couleur[n] / 255));
  }
  x.putImageData(donnees, 0, 0);
  return c;
}

function CorpsIllustre({ niveaux, vue = "deux" }) {
  const ref = useRef(null);
  const cle = JSON.stringify(niveaux);
  useEffect(() => {
    let annule = false;
    peindreCorps(niveaux).then(peint => {
      const c = ref.current;
      if (annule || !c) return;
      c.width = peint.width; c.height = peint.height;
      c.getContext("2d").drawImage(peint, 0, 0);
    });
    return () => { annule = true; };
  }, [cle]);
  const seule = vue !== "deux";
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <canvas ref={ref} role="img" aria-label="Muscles travaillés" className="v-pop" style={{ display: "block", width: seule ? "200%" : "100%", marginLeft: vue === "dos" ? "-100%" : 0, filter: DS.colors.isDark ? "none" : "drop-shadow(0 6px 14px rgba(0,0,0,0.12))" }} />
    </div>
  );
}

// Où poser l'étiquette d'une zone sur l'illustration (en % de largeur et de hauteur, face à gauche, dos à droite)
const ANCRES_ZONES = {
  quadriceps: [18, 58], pectoraux: [25, 22], epaules: [9, 20], bras: [8, 36], abdos: [25, 36],
  dos: [75, 24], lombaires: [75, 40], fessiers: [75, 50], ischios: [75, 63], mollets: [75, 80],
};

// ── Niveau de chaque muscle, de Débutant à Élite ──
// Mélange la force réelle (meilleure charge estimée sur 1 répétition / poids de corps) et le travail fourni (séries par semaine)
const NIVEAUX_CORPS = ["Débutant", "Novice", "Intermédiaire", "Confirmé", "Avancé", "Expert", "Élite"];
// Rapport charge / poids de corps à atteindre pour Intermédiaire, Confirmé, Avancé, Élite
const SEUILS_FORCE = {
  quadriceps: [0.5, 0.8, 1.1, 1.4, 1.75, 2.2], fessiers: [0.5, 0.8, 1.1, 1.4, 1.75, 2.2], ischios: [0.5, 0.8, 1.1, 1.4, 1.75, 2.2], mollets: [0.5, 0.8, 1.1, 1.4, 1.75, 2.2],
  pectoraux: [0.35, 0.55, 0.75, 1, 1.25, 1.5], epaules: [0.25, 0.35, 0.5, 0.65, 0.8, 1], dos: [0.35, 0.55, 0.75, 1, 1.25, 1.5], lombaires: [0.5, 0.8, 1.1, 1.4, 1.75, 2.2],
  bras: [0.15, 0.22, 0.3, 0.4, 0.5, 0.6], abdos: [0.2, 0.35, 0.5, 0.7, 0.9, 1.1],
};
// Séries par semaine sur la zone pour Intermédiaire, Confirmé, Avancé, Élite
const SEUILS_VOLUME = [2, 4, 7, 10, 14, 20];
const palier = (v, seuils) => seuils.filter(s => v >= s).length;
const PERIODES_CORPS = [{ id: 30, n: "1 mois" }, { id: 91, n: "3 mois" }, { id: 182, n: "6 mois" }, { id: 0, n: "Depuis le début" }];

function useSeriesCorps(user) {
  const [donnees, setDonnees] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("logs_performance").select("reps_par_set, charge_kg, logged_at, exercices(muscles)").eq("user_id", user.id).order("logged_at", { ascending: true }).limit(5000),
      supabase.from("profiles").select("poids").eq("id", user.id).maybeSingle(),
    ]).then(([{ data }, { data: profil }]) => {
      // Un même exercice enregistré plusieurs fois en moins d'une minute ne compte qu'une fois
      const vus = {};
      const logs = (data || []).filter(l => {
        const t = new Date(l.logged_at).getTime(), cle = `${l.exercices?.muscles}|${l.charge_kg}|${l.reps_par_set}`;
        const doublon = vus[cle] && t - vus[cle] < 60000;
        vus[cle] = t;
        return !doublon;
      }).map(l => ({ t: new Date(l.logged_at).getTime(), reps: Array.isArray(l.reps_par_set) ? l.reps_par_set : [], charge: Number(l.charge_kg) || 0, zones: zonesDepuisMuscles(l.exercices?.muscles) }));
      setDonnees({ logs, poids: Number(profil?.poids) || Number(user?.user_metadata?.onboarding?.poids) || 70 });
    });
  }, [user?.id]);
  return donnees;
}

// Niveau (0 à 4) de chaque zone d'après les logs entre debut et fin ; une zone sans log n'apparaît pas
function niveauxEntre(logs, poids, debut, fin, semaines) {
  const series = {}, force = {};
  logs.forEach(l => {
    if (l.t < debut || l.t > fin) return;
    Object.entries(l.zones).forEach(([z, p]) => {
      series[z] = (series[z] || 0) + Math.max(1, l.reps.length) * p;
      // La charge ne compte que pour le muscle principal de l'exercice
      if (p === 1 && l.charge > 0) {
        const reps = Math.min(12, Math.max(1, ...l.reps.map(Number).filter(Boolean)));
        force[z] = Math.max(force[z] || 0, l.charge * (1 + reps / 30) / poids);
      }
    });
  });
  return Object.fromEntries(Object.keys(series).map(z => {
    const vol = palier(series[z] / semaines, SEUILS_VOLUME);
    return [z, force[z] ? Math.round(0.6 * palier(force[z], SEUILS_FORCE[z]) + 0.4 * vol) : vol];
  }));
}

// Niveaux de départ (première semaine, corrigée par les points forts et faibles choisis), d'avant (début de la période) et de maintenant
function lireSeries(donnees, choix = {}, periode = 0) {
  if (!donnees?.logs.length) return { depart: {}, avant: {}, maintenant: {}, niveaux: {}, plus: null, gains: [] };
  const { logs, poids } = donnees, premier = logs[0].t, maintenantT = Date.now();
  const depart = Object.fromEntries(ZONES_CORPS.map(z => [z.id, 0]));
  Object.assign(depart, niveauxEntre(logs, poids, premier, premier + 7 * JOUR_MS, 1));
  (choix.forts || []).forEach(z => { depart[z] = Math.max(depart[z], 3); });
  (choix.faibles || []).forEach(z => { depart[z] = 0; });
  // Niveau atteint à une date : le meilleur bloc de 4 semaines jusque-là, pour qu'une pause ou une semaine légère ne fasse pas reculer
  const a = (fin) => {
    const atteint = { ...depart };
    for (let f = premier + 14 * JOUR_MS; f - 7 * JOUR_MS < fin; f += 7 * JOUR_MS) {
      const bout = Math.min(f, fin), deb = Math.max(premier, bout - 28 * JOUR_MS);
      const n = niveauxEntre(logs, poids, deb, bout, Math.max(1, (bout - deb) / (7 * JOUR_MS)));
      ZONES_CORPS.forEach(z => { if (n[z.id] > atteint[z.id]) atteint[z.id] = n[z.id]; });
    }
    return atteint;
  };
  const avant = periode ? a(maintenantT - periode * JOUR_MS) : depart;
  const maintenant = a(maintenantT);
  const gains = ZONES_CORPS.map(z => ({ ...z, de: avant[z.id], a: maintenant[z.id] })).filter(g => g.a > g.de).sort((p, q) => (q.a - q.de) - (p.a - p.de));
  const tries = ZONES_CORPS.map(z => ({ ...z, v: maintenant[z.id] })).sort((p, q) => q.v - p.v);
  return { depart, avant, maintenant, niveaux: tNiveau(maintenant), plus: tries[0], gains };
}

// Ce que montre la vidéo à partager : le corps au début de la période, celui d'aujourd'hui et les passages de niveau
function corpsPartage(donnees, choix = {}, periode = 0) {
  const l = lireSeries(donnees, choix, periode);
  const jours = donnees?.logs.length ? Math.max(1, Math.round((Date.now() - donnees.logs[0].t) / JOUR_MS)) : 0;
  const duree = periode ? `en ${PERIODES_CORPS.find(p => p.id === periode).n}` : jours >= 45 ? `en ${Math.round(jours / 30.4)} mois` : jours >= 14 ? `en ${Math.round(jours / 7)} semaines` : jours ? `en ${jours} jour${jours > 1 ? "s" : ""}` : "";
  return { avant: tNiveau(l.avant), niveaux: l.niveaux, gains: l.gains, plus: l.plus, total: l.gains.reduce((s, g) => s + g.a - g.de, 0), duree };
}

// Couleur du niveau (0 à 4) sur l'illustration : jamais 0, pour qu'un muscle débutant reste visible
const tNiveau = (niveaux) => Object.fromEntries(Object.entries(niveaux).map(([z, v]) => [z, Math.max(0.001, v / (NIVEAUX_CORPS.length - 1))]));

function CarteDuCorps({ donnees, user, onPartager }) {
  const [choix, setChoix] = useState(user?.user_metadata?.points_corps || {});
  const [periode, setPeriode] = useState(0);
  const [vue, setVue] = useState("maintenant");
  const [edition, setEdition] = useState(false);
  if (!donnees) return null;
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const l = lireSeries(donnees, choix, periode);
  const vide = !donnees.logs.length;
  const total = l.gains.reduce((s, g) => s + g.a - g.de, 0);
  const nomPeriode = periode ? `en ${PERIODES_CORPS.find(p => p.id === periode).n}` : "depuis ton début";
  const basculer = (z) => {
    const forts = choix.forts || [], faibles = choix.faibles || [];
    const suivant = forts.includes(z) ? { forts: forts.filter(x => x !== z), faibles: [...faibles, z] }
      : faibles.includes(z) ? { forts, faibles: faibles.filter(x => x !== z) }
      : { forts: [...forts, z], faibles };
    setChoix(suivant);
    supabase.auth.updateUser({ data: { points_corps: suivant } });
  };
  const puce = (actif, texte, onClick) => (
    <button key={texte} onClick={onClick} style={{ border: `1px solid ${actif ? ac : DS.colors.border}`, background: actif ? ac : "transparent", color: actif ? (DS.colors.isDark ? "#000" : "#fff") : DS.colors.textPrimary, borderRadius: 99, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{texte}</button>
  );
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ color: DS.colors.textSec, fontSize: 14, margin: "0 0 10px" }}>{vide ? "Fais ta première séance : ton niveau s'affichera muscle par muscle." : "Ton niveau, muscle par muscle"}</p>
      {!vide && <>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, scrollbarWidth: "none" }}>
          {PERIODES_CORPS.map(p => puce(periode === p.id, p.n, () => setPeriode(p.id)))}
        </div>
        <div style={{ display: "flex", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 99, padding: 3, marginBottom: 6 }}>
          {[["avant", periode ? `Il y a ${PERIODES_CORPS.find(p => p.id === periode).n}` : "Au départ"], ["maintenant", "Maintenant"]].map(([id, n]) => (
            <button key={id} onClick={() => setVue(id)} style={{ flex: 1, border: "none", borderRadius: 99, padding: "8px 0", fontSize: 13, fontWeight: 800, cursor: "pointer", background: vue === id ? DS.colors.surface : "transparent", color: vue === id ? DS.colors.textPrimary : DS.colors.textSec, boxShadow: vue === id ? DS.shadow.card : "none" }}>{n}</button>
          ))}
        </div>
      </>}
      <div style={{ margin: "0 -6px" }}>
        <CorpsIllustre niveaux={vide ? {} : tNiveau(vue === "avant" ? l.avant : l.maintenant)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${NIVEAUX_CORPS.length}, 1fr)`, gap: 3, marginTop: 10 }}>
        {NIVEAUX_CORPS.map((n, i) => (
          <div key={n} style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ height: 8, borderRadius: 4, background: COULEURS_NIVEAU[i], boxShadow: `inset 0 0 0 1px ${DS.colors.border}` }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: DS.colors.textSec, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n === "Intermédiaire" ? "Interm." : n}</div>
          </div>
        ))}
      </div>
      {!vide && (
        <div style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "14px 16px", marginTop: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: DS.colors.textPrimary }}>{total ? `+${total} niveau${total > 1 ? "x" : ""}` : "Même niveau"} <span style={{ fontSize: 13, fontWeight: 600, color: DS.colors.textSec }}>{nomPeriode}</span></div>
          {l.gains.slice(0, 3).map(g => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, color: DS.colors.textPrimary }}>
              <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{g.n}</span>
              <span style={{ color: DS.colors.textSec }}>{NIVEAUX_CORPS[g.de]} → <b style={{ color: ac }}>{NIVEAUX_CORPS[g.a]}</b></span>
            </div>
          ))}
          {!total && <p style={{ fontSize: 13, color: DS.colors.textSec, margin: "6px 0 0" }}>Continue tes séances : chaque muscle monte de niveau avec la force et la régularité.</p>}
        </div>
      )}
      {!vide && (
        <div style={{ marginTop: 12 }}>
          <p onClick={() => setEdition(!edition)} style={{ fontSize: 13, fontWeight: 800, color: ac, cursor: "pointer", margin: 0 }}>{edition ? "Terminé" : "Mes points forts et faibles au départ"}</p>
          {edition && <>
            <p style={{ fontSize: 12, color: DS.colors.textSec, margin: "6px 0 8px" }}>Touche un muscle : une fois pour un point fort 💪, deux fois pour un point faible 🎯, trois fois pour annuler.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ZONES_CORPS.map(z => {
                const fort = (choix.forts || []).includes(z.id), faible = (choix.faibles || []).includes(z.id);
                return puce(fort || faible, `${fort ? "💪 " : faible ? "🎯 " : ""}${z.n}`, () => basculer(z.id));
              })}
            </div>
          </>}
        </div>
      )}
      {!vide && onPartager && <p onClick={() => onPartager({ choix, periode })} style={{ fontSize: 13, fontWeight: 800, color: ac, textAlign: "right", marginTop: 10, cursor: "pointer" }}>Partager en vidéo ↗</p>}
    </div>
  );
}

// ── Carte animée à partager (story 1080 × 1920, vidéo ou image) ──
const PARTAGE_DUREE = 10;
const lisse = (t) => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
const entre = (t, a, b) => lisse((t - a) / (b - a));

function dessinerCartePartage(x, t, { neutre, colore, paires, plus, gains = [], total = 0, duree = "" }) {
  x.save();
  x.clearRect(0, 0, 1080, 1920);
  const fondu = x.createRadialGradient(540, 360, 60, 540, 360, 1300);
  fondu.addColorStop(0, "#22341A"); fondu.addColorStop(0.55, "#0E100C"); fondu.addColorStop(1, "#0B0B0C");
  x.fillStyle = fondu; x.fillRect(0, 0, 1080, 1920);
  x.fillStyle = "#fff"; x.textAlign = "right"; x.font = "900 38px Inter, sans-serif"; x.fillText("VOLTRA", 1020, 100);
  // Titre : le nombre de niveaux gagnés défile pendant que le corps se colore
  const a = entre(t, 0, 0.6), scan = entre(t, 0.9, 2.7);
  x.globalAlpha = a; x.textAlign = "left";
  x.fillStyle = "#9BE84F"; x.font = "800 40px Inter, sans-serif"; x.fillText(`MA PROGRESSION${duree ? ` · ${duree.toUpperCase()}` : ""}`, 60, 200 - (1 - a) * 30);
  const n = Math.round(total * scan);
  x.fillStyle = "#fff"; x.font = "900 84px Inter, sans-serif";
  x.fillText(total > 0 ? `+${n} NIVEAU${n > 1 ? "X" : ""}` : "MON NIVEAU ACTUEL", 60, 288 - (1 - a) * 30);
  x.globalAlpha = 1;
  // Corps : d'abord au départ, puis une ligne de scan remonte et révèle le niveau d'aujourd'hui
  const L = 760, H = Math.round(L * neutre.height / neutre.width), X = 160, Y = 330;
  x.globalAlpha = entre(t, 0.2, 0.9);
  x.drawImage(neutre, X, Y, L, H);
  const etat = scan < 0.5 ? "AU DÉPART" : "MAINTENANT";
  x.font = "800 28px Inter, sans-serif";
  const ew = x.measureText(etat).width + 40;
  x.fillStyle = scan < 0.5 ? "rgba(255,255,255,0.12)" : "#9BE84F"; x.beginPath(); x.roundRect(60, Y + 6, ew, 52, 26); x.fill();
  x.fillStyle = scan < 0.5 ? "#fff" : "#0B0B0C"; x.fillText(etat, 80, Y + 42);
  x.globalAlpha = 1;
  const ligne = Y + H - scan * H;
  if (scan > 0) {
    x.save(); x.beginPath(); x.rect(0, ligne, 1080, Y + H - ligne); x.clip();
    x.drawImage(colore, X, Y, L, H); x.restore();
    if (scan < 1) {
      const g = x.createLinearGradient(0, ligne - 40, 0, ligne + 40);
      g.addColorStop(0, "rgba(155,232,79,0)"); g.addColorStop(0.5, "rgba(155,232,79,0.9)"); g.addColorStop(1, "rgba(155,232,79,0)");
      x.fillStyle = g; x.fillRect(X - 20, ligne - 40, L + 40, 80);
    }
  }
  // Passage de niveau des muscles qui ont le plus progressé (ou niveau du plus fort s'il n'y a pas encore de progrès)
  const bulles = gains.length ? gains.slice(0, 2) : plus ? [{ ...plus, a: plus.v }] : [];
  bulles.forEach((b, i) => {
    const p = entre(t, 2.8 + i * 0.3, 3.2 + i * 0.3), [ax, ay] = ANCRES_ZONES[b.id];
    if (p <= 0) return;
    if (i === 1) { const [bx, by] = ANCRES_ZONES[bulles[0].id]; if ((bx < 50) === (ax < 50) && Math.abs(by - ay) < 16) return; }
    const nom = b.n.charAt(0).toUpperCase() + b.n.slice(1), de = b.de !== undefined ? `${NIVEAUX_CORPS[b.de]} → ` : "", vers = NIVEAUX_CORPS[b.a];
    x.font = "800 36px Inter, sans-serif"; const w1 = x.measureText(nom).width;
    x.font = "700 30px Inter, sans-serif"; const wde = x.measureText(de).width, w2 = wde + x.measureText(vers).width;
    const lw = Math.max(w1, w2) + 56, cx = Math.min(1040 - lw / 2, Math.max(40 + lw / 2, X + (ax / 100) * L)), cy = Y + (ay / 100) * H, k = 0.6 + 0.4 * p;
    x.save(); x.globalAlpha = p; x.translate(cx, cy); x.scale(k, k);
    x.fillStyle = "#1C1C1E"; x.beginPath(); x.roundRect(-lw / 2, -56, lw, 112, 30); x.fill();
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 36px Inter, sans-serif"; x.fillText(nom, -lw / 2 + 28, -10);
    x.font = "700 30px Inter, sans-serif"; x.fillStyle = "#A1A1AA"; x.fillText(de, -lw / 2 + 28, 34);
    x.fillStyle = "#9BE84F"; x.fillText(vers, -lw / 2 + 28 + wde, 34); x.restore();
  });
  // Progrès des tests, qui défilent jusqu'à leur valeur
  const bas = Y + H + 40;
  if (!paires?.length && gains.length) {
    gains.slice(0, 3).forEach((g, i) => {
      const p = entre(t, 3.4 + i * 0.25, 4.4 + i * 0.25);
      if (p <= 0) return;
      const cy = bas + i * 96 + (1 - p) * 40;
      x.globalAlpha = p;
      x.fillStyle = "rgba(255,255,255,0.08)"; x.beginPath(); x.roundRect(60, cy, 960, 80, 24); x.fill();
      x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 32px Inter, sans-serif"; x.fillText(g.n.charAt(0).toUpperCase() + g.n.slice(1), 92, cy + 51);
      x.textAlign = "right"; x.fillStyle = "#9BE84F"; x.fillText(NIVEAUX_CORPS[g.a], 988, cy + 51);
      const wv = x.measureText(NIVEAUX_CORPS[g.a]).width;
      x.fillStyle = "#A1A1AA"; x.font = "700 30px Inter, sans-serif"; x.fillText(`${NIVEAUX_CORPS[g.de]} → `, 988 - wv, cy + 51);
      x.globalAlpha = 1;
    });
  }
  if (paires?.length) {
    paires.slice(0, 3).forEach(({ t: te, a: ta, b: tb }, i) => {
      const p = entre(t, 3.4 + i * 0.25, 4.6 + i * 0.25);
      if (p <= 0) return;
      const e = ecartTest(te, ta, tb), cx = 60 + i * 330, cy = bas + (1 - p) * 40;
      x.globalAlpha = p;
      x.fillStyle = "rgba(255,255,255,0.08)"; x.beginPath(); x.roundRect(cx, cy, 300, 200, 32); x.fill();
      const v = Math.abs(e.d) * p, signe = e.d > 0 ? "+" : e.d < 0 ? "−" : "";
      x.textAlign = "left"; x.fillStyle = e.mieux ? "#9BE84F" : "#A1A1AA"; x.font = "900 66px Inter, sans-serif";
      x.fillText(`${signe}${virgule(v, te.dec)}${te.u ? ` ${te.u}` : ""}`, cx + 28, cy + 92);
      x.fillStyle = "#A1A1AA"; x.font = "700 30px Inter, sans-serif";
      x.fillText(te.t.replace(" en 1 minute", "").replace(" verticale", "").replace(" sans élan", "").replace(" nage libre", " nage"), cx + 28, cy + 150);
      x.globalAlpha = 1;
    });
  }
  // Fin
  const f = entre(t, 4.8, 5.4);
  x.globalAlpha = f; x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "800 44px Inter, sans-serif";
  x.fillText("Ma prépa physique : Voltra", 540, 1800); x.fillStyle = "#9BE84F"; x.fillText("voltra-app.fr", 540, 1862);
  x.globalAlpha = 1;
  // Fin de la vidéo : le corps d'avant et celui d'après, côte à côte
  const v = entre(t, 6.2, 6.8);
  if (v > 0) {
    x.globalAlpha = v;
    x.fillStyle = fondu; x.fillRect(0, 0, 1080, 1920);
    x.fillStyle = "#fff"; x.textAlign = "right"; x.font = "900 38px Inter, sans-serif"; x.fillText("VOLTRA", 1020, 100);
    x.textAlign = "left"; x.fillStyle = "#9BE84F"; x.font = "800 40px Inter, sans-serif"; x.fillText(`MA PROGRESSION${duree ? ` · ${duree.toUpperCase()}` : ""}`, 60, 200);
    x.fillStyle = "#fff"; x.font = "900 84px Inter, sans-serif"; x.fillText(total > 0 ? `+${total} NIVEAU${total > 1 ? "X" : ""}` : "MON NIVEAU ACTUEL", 60, 288);
    const l2 = 500, h2 = Math.round(l2 * neutre.height / neutre.width), y2 = 420;
    [[neutre, 27, "AVANT", 6.4], [colore, 553, "APRÈS", 6.9]].forEach(([img, x2, nom, d]) => {
      const p = entre(t, d, d + 0.5);
      if (p <= 0) return;
      x.globalAlpha = v * p;
      x.drawImage(img, x2, y2 + (1 - p) * 40, l2, h2);
      x.font = "900 34px Inter, sans-serif"; const w = x.measureText(nom).width + 48, apres = nom === "APRÈS";
      x.fillStyle = apres ? "#9BE84F" : "rgba(255,255,255,0.12)"; x.beginPath(); x.roundRect(x2 + l2 / 2 - w / 2, y2 - 74, w, 58, 29); x.fill();
      x.fillStyle = apres ? "#0B0B0C" : "#fff"; x.textAlign = "center"; x.fillText(nom, x2 + l2 / 2, y2 - 33);
    });
    x.globalAlpha = v * entre(t, 6.9, 7.4); x.fillStyle = "#9BE84F"; x.textAlign = "center"; x.font = "900 60px Inter, sans-serif"; x.fillText("→", 540, y2 + h2 / 2);
    gains.slice(0, 3).forEach((g, i) => {
      const p = entre(t, 7.5 + i * 0.25, 8.1 + i * 0.25);
      if (p <= 0) return;
      const cy = y2 + h2 + 50 + i * 96 + (1 - p) * 30;
      x.globalAlpha = v * p;
      x.fillStyle = "rgba(255,255,255,0.08)"; x.beginPath(); x.roundRect(60, cy, 960, 80, 24); x.fill();
      x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 32px Inter, sans-serif"; x.fillText(g.n.charAt(0).toUpperCase() + g.n.slice(1), 92, cy + 51);
      x.textAlign = "right"; x.fillStyle = "#9BE84F"; x.fillText(NIVEAUX_CORPS[g.a], 988, cy + 51);
      const wv = x.measureText(NIVEAUX_CORPS[g.a]).width;
      x.fillStyle = "#A1A1AA"; x.font = "700 30px Inter, sans-serif"; x.fillText(`${NIVEAUX_CORPS[g.de]} → `, 988 - wv, cy + 51);
    });
    x.globalAlpha = v; x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "800 44px Inter, sans-serif";
    x.fillText("Ma prépa physique : Voltra", 540, 1800); x.fillStyle = "#9BE84F"; x.fillText("voltra-app.fr", 540, 1862);
  }
  x.restore();
}

function PartageProgression({ corps, tests, liste, onBack }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const ref = useRef(null);
  const images = useRef(null);
  const [pret, setPret] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let fin = false, id;
    Promise.all([peindreCorps(corps.avant), peindreCorps(corps.niveaux), document.fonts?.ready]).then(([neutre, colore]) => {
      if (fin) return;
      images.current = { ...corps, neutre, colore, paires: comparables(liste, tests).filter(c => c.n >= 2) };
      setPret(true);
      const debut = performance.now();
      const boucle = (m) => {
        const c = ref.current;
        if (c && !enregistrement.current) dessinerCartePartage(c.getContext("2d"), ((m - debut) / 1000) % (PARTAGE_DUREE + 1), images.current);
        id = requestAnimationFrame(boucle);
      };
      id = requestAnimationFrame(boucle);
    });
    return () => { fin = true; cancelAnimationFrame(id); };
  }, []);
  const enregistrement = useRef(false);
  const envoyer = async (blob, nom) => {
    const f = new File([blob], nom, { type: blob.type });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
    else { const l = document.createElement("a"); l.href = URL.createObjectURL(f); l.download = nom; l.click(); }
  };
  const image = async () => {
    setMessage("");
    try {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
      dessinerCartePartage(c.getContext("2d"), PARTAGE_DUREE, images.current);
      await envoyer(await new Promise(ok => c.toBlob(ok, "image/png")), "voltra-progression.png");
    } catch (e) { if (e?.name !== "AbortError") setMessage("Impossible de créer l'image. Réessaie."); }
  };
  const video = async () => {
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t));
    if (!type || !HTMLCanvasElement.prototype.captureStream) { setMessage("Ton navigateur ne sait pas créer de vidéo : enregistre l'image."); return; }
    setMessage("Création de la vidéo… (10 secondes)");
    enregistrement.current = true;
    try {
      const c = ref.current, x = c.getContext("2d");
      const flux = c.captureStream(30), morceaux = [];
      const rec = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 8000000 });
      rec.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const fini = new Promise(ok => { rec.onstop = ok; });
      rec.start();
      const debut = performance.now();
      // Une horloge simple (30 images par seconde) plutôt que l'affichage, qui peut se mettre en pause
      await new Promise(ok => {
        const pas = () => {
          const t = (performance.now() - debut) / 1000;
          dessinerCartePartage(x, Math.min(t, PARTAGE_DUREE), images.current);
          if (t < PARTAGE_DUREE + 0.5) setTimeout(pas, 1000 / 30); else ok();
        };
        pas();
      });
      rec.stop(); await fini;
      const blob = new Blob(morceaux, { type: type.split(";")[0] });
      setMessage("");
      await envoyer(blob, `voltra-progression.${type.includes("mp4") ? "mp4" : "webm"}`);
    } catch (e) { if (e?.name !== "AbortError") setMessage("Impossible de créer la vidéo. Enregistre l'image."); }
    enregistrement.current = false;
  };
  return (
    <div className="v-plein" style={{ background: DS.colors.bg, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ minHeight: "100dvh", maxWidth: 430, margin: "0 auto", padding: `${hautSur(20)} 22px calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10, padding: 0 }}>← Retour</button>
        <p style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: ac, margin: "0 0 10px" }}>PARTAGE TA PROGRESSION</p>
        <canvas ref={ref} width="1080" height="1920" style={{ width: "100%", maxHeight: "62dvh", objectFit: "contain", display: "block", borderRadius: 20, background: "#0B0B0C", boxShadow: DS.shadow.card }} />
        {!pret && <p style={{ fontSize: 13, color: DS.colors.textSec, textAlign: "center", marginTop: 10 }}>Préparation…</p>}
        <PrimaryButton onClick={video} disabled={!pret} style={{ height: 54, marginTop: 16 }}>Enregistrer la vidéo</PrimaryButton>
        <button onClick={image} disabled={!pret} style={{ width: "100%", height: 48, marginTop: 10, borderRadius: 99, border: `1px solid ${DS.colors.border}`, background: DS.colors.surface, color: DS.colors.textPrimary, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Enregistrer l'image</button>
        {message && <p style={{ fontSize: 13, color: DS.colors.textSec, textAlign: "center", marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  );
}

function HistoriqueScreen({ user, sport }) {
  const stagger = useStaggerUneFois("historique");
  const { tests, charger: chargerTests, liste } = useTests(user, sport);
  const [vueTest, setVueTest] = useState(null);
  const series = useSeriesCorps(user);
  const [partageCorps, setPartageCorps] = useState({});
  const [seancesReelles, setSeancesReelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSeances, setTotalSeances] = useState(0);
  const [selectedSeance, setSelectedSeance] = useState(null);
  const [selectedExo, setSelectedExo] = useState(null);
  const [logsPerf, setLogsPerf] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      const { data } = await supabase
        .from("seances")
        .select("*, exercices(*, logs_performance(charge_kg))")
        .eq("user_id", session.user.id)
        .eq("statut", "faite")
        .order("date_realisee", { ascending: false })
        .limit(30);
      if (data) { setSeancesReelles(data); setTotalSeances(data.length); }
      const { data: logs } = await supabase
        .from("logs_performance")
        .select("*, exercices(nom)")
        .eq("user_id", session.user.id)
        .order("charge_kg", { ascending: false })
        .limit(100);
      if (logs) setLogsPerf(logs);
      setLoading(false);
    });
  }, []);

  // Stats
  const streak = (() => {
    let count = 0;
    const today = new Date();
    const sorted = [...seancesReelles].sort((a, b) => new Date(b.date_realisee) - new Date(a.date_realisee));
    for (const sc of sorted) {
      const diff = Math.floor((today - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24));
      if (diff <= count + 2) count++;
      else break;
    }
    return count;
  })();

  // Records
  const records = {};
  logsPerf.forEach(log => {
    const nom = log.exercices?.nom;
    if (!nom || !log.charge_kg) return;
    if (!records[nom] || log.charge_kg > records[nom]) records[nom] = log.charge_kg;
  });
  const topRecords = Object.entries(records).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Progression charges
  const exosDispos = [...new Set(logsPerf.map(l => l.exercices?.nom).filter(Boolean))];
  const exoSelectionne = selectedExo || exosDispos[0];
  const progressionExo = logsPerf
    .filter(l => l.exercices?.nom === exoSelectionne)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-8);

  // Calendrier
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const seanceDates = new Set(seancesReelles.map(s => new Date(s.date_realisee).getDate()));

  // Séances par semaine (8 dernières)
  const seancesParSemaine = (() => {
    const buckets = Array(8).fill(0);
    seancesReelles.forEach(sc => {
      const diff = Math.floor((now - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24 * 7));
      if (diff < 8) buckets[7 - diff]++;
    });
    return buckets;
  })();
  const maxSemaine = Math.max(...seancesParSemaine, 1);

  const feedbackColor = (f) => f === "easy" ? DS.colors.primary : f === "good" ? DS.colors.success : DS.colors.warning;
  const feedbackLabel = (f) => f === "easy" ? "Facile" : f === "good" ? "Parfait" : "Dur";
  const feedbackEmoji = (f) => f === "easy" ? "😤" : f === "good" ? "💪" : "🔥";

  const accentColor = "#FF2D55";

  if (vueTest === "partage") return <PartageProgression corps={corpsPartage(series, partageCorps.choix || user?.user_metadata?.points_corps, partageCorps.periode)} tests={tests} liste={liste} onBack={() => setVueTest(null)} />;
  if (vueTest === "test") return <TestScreen user={user} tests={tests} liste={liste} onSaved={async () => { await chargerTests(); }} onBack={() => setVueTest(null)} onCarrousel={() => setVueTest("carrousel")} />;
  if (vueTest === "carrousel") return <CarrouselScreen tests={tests} liste={liste} onBack={() => setVueTest("test")} />;

  return (
    <div className={stagger} style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", paddingBottom: 130 }}>
      <Bloom echelle={0.8} />

      {/* Drawer detail seance */}
      {selectedSeance && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setSelectedSeance(null)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px 48px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", marginBottom: 4 }}>
                  {new Date(selectedSeance.date_realisee).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </p>
                <h3 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 22, color: DS.colors.textPrimary }}>{selectedSeance.titre}</h3>
              </div>
              <button onClick={() => setSelectedSeance(null)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { val: `${selectedSeance.duree_min || 0}m`, label: "DUREE", color: accentColor },
                { val: selectedSeance.exercices?.length || 0, label: "EXO", color: DS.colors.success },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, color: DS.colors.textPrimary, fontWeight: 700 }}>{stat.val}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, marginTop: 2, letterSpacing: "0.06em" }}>{stat.label}</div>
                </div>
              ))}
              {selectedSeance.feedback && (
                <div style={{ flex: 1, background: feedbackColor(selectedSeance.feedback) + "15", borderRadius: DS.radius.md, padding: "12px 8px", textAlign: "center", border: `1px solid ${feedbackColor(selectedSeance.feedback)}30` }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{feedbackEmoji(selectedSeance.feedback)}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: feedbackColor(selectedSeance.feedback), letterSpacing: "0.08em" }}>{feedbackLabel(selectedSeance.feedback).toUpperCase()}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(selectedSeance.exercices || []).map((ex, i) => (
                <div key={i} style={{ background: DS.colors.surfaceHigh, borderRadius: DS.radius.md, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{ex.nom}</p>
                    <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{ex.muscles?.split(" ")[0]}</p>
                  </div>
                  <p style={{ fontFamily: "'Inter',sans-serif", color: accentColor, fontSize: 12, fontWeight: 700 }}>{ex.sets}×{ex.reps}{ex.charge_kg > 0 ? ` @ ${ex.logs_performance?.[0]?.charge_kg || ex.charge_kg}kg` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: DS.colors.stickyBg, backdropFilter: "blur(10px)", borderBottom: `1px solid ${DS.colors.border}`, padding: `${hautSur(20)} 20px 16px`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 34, color: DS.colors.textPrimary, letterSpacing: "-0.03em" }}>PROGRESSION</h1>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 999, padding: "6px 12px", whiteSpace: "nowrap", fontWeight: 700 }}>CE MOIS</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: accentColor, animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: DS.colors.textSec }}>Chargement...</p>
        </div>
      ) : (
        <div style={{ padding: "20px 20px 0" }}>

          <CarteDuCorps donnees={series} user={user} onPartager={(o) => { setPartageCorps(o); setVueTest("partage"); }} />
          <AvantMaintenant tests={tests} liste={liste} onTest={() => setVueTest("test")} onPartager={() => { setPartageCorps({}); setVueTest("partage"); }} />

          {/* Graphique séances par semaine — cliquable */}
          <div style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 16px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>SEANCES SUR 8 SEMAINES · APPUIE POUR DETAIL</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
              {seancesParSemaine.map((count, i) => {
                const isLast = i === 7;
                const h = count > 0 ? Math.max(12, (count / maxSemaine) * 100) : 8;
                const isEmpty = count === 0;
                const seancesOfWeek = seancesReelles.filter(sc => {
                  const diff = Math.floor((now - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24 * 7));
                  return diff === 7 - i;
                });
                return (
                  <div key={i} onClick={() => seancesOfWeek.length > 0 && setSelectedSeance(seancesOfWeek[0])} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: seancesOfWeek.length > 0 ? "pointer" : "default" }}>
                    {count > 0 && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isLast ? accentColor : "rgba(255,255,255,0.3)" }}>{count}</div>}
                    <div style={{ width: "100%", height: h, background: isEmpty ? "rgba(255,255,255,0.04)" : isLast ? accentColor : `rgba(255,45,85,${0.2 + (count/maxSemaine)*0.6})`, borderRadius: "4px 4px 0 0", border: isEmpty ? "1px dashed rgba(255,255,255,0.08)" : "none", boxShadow: isLast && count > 0 ? `0 0 12px rgba(255,45,85,0.5)` : "none", transition: "opacity 0.2s" }} />
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isLast ? accentColor : "rgba(255,255,255,0.2)" }}>S{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendrier du mois */}
          <div style={{ background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, color: DS.colors.textPrimary, letterSpacing: "0.08em" }}>{now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}</div>
              {streak > 0 && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentColor, letterSpacing: "0.06em" }}>🔥 {streak} JOURS</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
              {["L","M","M","J","V","S","D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, paddingBottom: 4 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === now.getDate();
                const hasSeance = seanceDates.has(day);
                return (
                  <div key={day} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: hasSeance ? accentColor : isToday ? DS.colors.surfaceHigh : "transparent", border: isToday && !hasSeance ? `1px solid ${accentColor}` : "none", boxShadow: hasSeance ? `0 0 8px rgba(255,45,85,0.4)` : "none" }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: hasSeance || isToday ? 800 : 500, color: hasSeance ? "#0B0B0C" : isToday ? accentLisible(accentColor) : DS.colors.textSec }}>{day}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Records personnels */}
          {topRecords.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>RECORDS PERSONNELS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, overflow: "hidden" }}>
                {topRecords.map(([nom, charge], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < topRecords.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: i === 0 ? "rgba(255,229,0,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "rgba(255,229,0,0.3)" : "rgba(255,255,255,0.06)"}`, flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </div>
                    <div style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: DS.colors.textPrimary, fontWeight: 500 }}>{nom}</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: accentLisible("#9BE84F"), fontWeight: 700 }}>{charge} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique séances récentes */}
          {seancesReelles.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>DERNIERES SEANCES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seancesReelles.slice(0, 6).map((sc, i) => (
                  <div key={i} onClick={() => setSelectedSeance(sc)} style={{ display: "flex", alignItems: "center", gap: 12, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.feedback ? feedbackColor(sc.feedback) + "15" : "rgba(255,255,255,0.05)", border: `1px solid ${sc.feedback ? feedbackColor(sc.feedback) + "30" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {feedbackEmoji(sc.feedback) || "🏋️"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: DS.colors.textPrimary, fontSize: 14, ...s.heading, marginBottom: 2 }}>{sc.titre}</p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.08em" }}>
                        {new Date(sc.date_realisee).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()} · {sc.duree_min || 0}min
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: accentColor, fontWeight: 700 }}>{sc.exercices?.length || 0} EXO</p>
                      {sc.feedback && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: feedbackColor(sc.feedback), marginTop: 2 }}>{feedbackLabel(sc.feedback).toUpperCase()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seancesReelles.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🏋️</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, color: DS.colors.textPrimary, letterSpacing: "0.08em", marginBottom: 8 }}>AUCUNE SEANCE ENCORE</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em" }}>Complete ta premiere seance pour voir ta progression ici.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────
// PROFIL
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MON ABONNEMENT — infos, offre de retention, resiliation guidee
// ─────────────────────────────────────────────
async function callSubscription(action, extra = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée, reconnecte-toi.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, return_url: window.location.origin, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "Erreur"); e.code = data.error; throw e; }
  return data;
}

const AVANTAGES_PRO = [
  ["🧠", "Un programme fait pour ton sport", "Créé par l'IA selon ton niveau, ton matériel et ton objectif, jusqu'à ta date."],
  ["📈", "Des charges qui suivent tes progrès", "Tu notes ton ressenti et ton poids réel : la séance suivante s'ajuste toute seule."],
  ["🔋", "Une séance adaptée à ta forme du jour", "Fatigue, gêne ou peu de temps : tu le dis en 5 secondes et la séance s'ajuste."],
  ["🤖", "Ace, ton coach quand tu veux", "En séance ou depuis ton tableau de bord, il connaît ton objectif et te répond."],
  ["🏆", "Des séances adaptées à tes compétitions", "Ta charge s'allège avant une compétition pour que tu arrives frais."],
  ["📊", "Un bilan chaque semaine", "Tes séances, tes progrès et le conseil d'Ace pour la semaine qui suit."],
  ["🏁", "Un bilan à chaque objectif", "Ce que tu as gagné pendant ta mission, puis la suivante."],
  ["⏰", "Des rappels pour garder le rythme", "Un e-mail le matin de tes séances et une relance si tu décroches, si tu le souhaites."],
];

function SubscriptionScreen({ onBack, accent, totalSeances, streak, recordKg, semaine, totalSemaines }) {
  const [info, setInfo] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [flow, setFlow] = useState(0); // 0 normal, 1 avant de partir, 2 offre, 3 confirmation, 4 rétractation, 5 rétractation faite, 6 gérer mon offre
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [retraction, setRetraction] = useState(null);
  const [finOffert, setFinOffert] = useState(null);
  const ecranRef = useRef(null);
  useEffect(() => { ecranRef.current?.scrollTo(0, 0); }, [flow]);

  const load = async () => {
    try { setInfo(await callSubscription("info")); setLoadErr(""); }
    catch (e) {
      if (e.code === "no_subscription") {
        const { data } = await supabase.from("invitations_utilisees").select("fin_le").eq("terminee", false).maybeSingle();
        setFinOffert(data?.fin_le || null);
      }
      setLoadErr(e.code === "no_subscription" ? "none" : (e.message || "Erreur"));
    }
  };
  useEffect(() => { load(); }, []);

  const dateFr = (unix) => unix ? new Date(unix * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const isYear = info?.interval === "year";
  const planLabel = info ? `${isYear ? "Annuel" : "Mensuel"} · ${String(info.amount).replace(".", ",")} €/${isYear ? "an" : "mois"}` : "";
  const enEssai = info?.status === "trialing";
  const premierPaiement = info ? String(isYear && info.hasDiscount ? 56.24 : info.amount).replace(".", ",") : "";

  const goPortal = async (action) => {
    setBusy(true); setMsg("");
    try { const d = await callSubscription(action, { reason }); if (d.url) { window.location.href = d.url; return; } }
    catch (e) { setMsg(e.message || "Erreur, réessaie."); }
    setBusy(false);
  };
  const takeOffer = async (type) => {
    setBusy(true); setMsg("");
    try {
      await callSubscription("offer", { type, reason });
      setFlow(6); await load();
      setMsg(type === "free_month" ? "✓ Ton prochain mois est offert. Merci de rester avec nous !" : "✓ Ta réduction de 30 % est appliquée. Merci de rester avec nous !");
    } catch (e) { setMsg(e.code === "offer_used" ? "Tu as déjà profité d'une offre de fidélité." : (e.message || "Erreur, réessaie.")); }
    setBusy(false);
  };
  const resume = async () => {
    setBusy(true); setMsg("");
    try { await callSubscription("resume"); await load(); setMsg("✓ Ton abonnement est réactivé."); }
    catch (e) { setMsg(e.message || "Erreur, réessaie."); }
    setBusy(false);
  };

  const retract = async () => {
    setBusy(true); setMsg("");
    try { setRetraction(await callSubscription("retract")); setFlow(5); }
    catch (e) { setMsg(e.code === "retractation_expired" ? "Le délai de 14 jours est dépassé." : "La rétractation n'a pas abouti. Réessaie ou écris à contact.voltra1@gmail.com"); }
    setBusy(false);
  };

  const card = { background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 };
  const h = { fontFamily: "'Inter',sans-serif", fontWeight: 800, color: DS.colors.textPrimary, margin: 0 };
  const t = { fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.55, color: DS.colors.textSec, margin: 0 };
  const btnMain = { width: "100%", height: 52, borderRadius: DS.radius.md, background: accent, border: "none", color: "#000", fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 800, cursor: "pointer" };
  const btnGhost = { width: "100%", height: 46, borderRadius: DS.radius.md, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, color: DS.colors.textPrimary, fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 700, cursor: "pointer" };
  const link = { fontFamily: "'Inter',sans-serif", fontSize: 12, color: DS.colors.textSec, textDecoration: "underline", cursor: "pointer", textAlign: "center", margin: "14px 0 0" };
  const REASONS = ["Trop cher", "Je ne m'en sers pas assez", "Je n'ai pas trouvé ce que je cherchais", "Je fais une pause", "Autre"];

  return (
    <div ref={ecranRef} style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: `${hautSur(52)} 16px 12px`, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}`, position: "sticky", top: 0, background: DS.colors.bg, zIndex: 2 }}>
        <button onClick={flow === 5 ? () => window.location.reload() : flow === 6 ? () => setFlow(0) : flow ? () => setFlow(6) : onBack} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: 20, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 16, cursor: "pointer" }}>←</button>
        <p style={{ ...h, fontSize: 18 }}>{flow === 0 ? "Mon abonnement" : "Gérer mon offre"}</p>
      </div>

      <div style={{ padding: "20px 16px calc(80px + env(safe-area-inset-bottom, 0px))", maxWidth: 520, margin: "0 auto" }}>
        {msg && <div style={{ ...card, borderColor: `${accent}60`, background: `${accent}12` }}><p style={{ ...t, color: DS.colors.textPrimary, fontWeight: 600 }}>{msg}</p></div>}

        {!info && !loadErr && <p style={{ ...t, textAlign: "center", marginTop: 40 }}>Chargement...</p>}
        {loadErr === "none" && (
          <div style={card}>
            <p style={{ ...h, fontSize: 16, marginBottom: 8 }}>{finOffert ? "🎁 Accès offert" : "Aucun abonnement récurrent"}</p>
            <p style={t}>{finOffert ? `Ton accès Voltra Pro est offert jusqu'au ${new Date(finOffert).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}. Aucune carte enregistrée : rien ne te sera prélevé.` : "Ton accès Pro n'est lié à aucun abonnement en cours."} Une question ? contact.voltra1@gmail.com</p>
          </div>
        )}
        {loadErr && loadErr !== "none" && (
          <div style={card}><p style={t}>Impossible de charger ton abonnement ({loadErr}). Réessaie ou écris à contact.voltra1@gmail.com</p></div>
        )}

        {info && flow === 0 && (
          <>
            <div style={{ ...card, borderColor: `${accent}50`, background: `linear-gradient(160deg, ${accent}24, ${DS.colors.surface} 60%)` }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: DS.radius.full, background: `${accent}24`, color: accentLisible(accent), fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 800, marginBottom: 12 }}><span>⭐</span>Voltra Pro actif</span>
              <p style={{ ...h, fontSize: 24, lineHeight: 1.12, letterSpacing: "-0.02em", marginBottom: 6 }}>{totalSeances > 0 ? "Ta progression est lancée" : "Ta première séance t'attend"}</p>
              <p style={{ ...t, marginBottom: 16 }}>{totalSeances > 0 ? "Chaque séance rend la suivante plus juste. Ne casse pas ton élan." : "Ton programme est prêt et il s'ajustera à chaque séance."}</p>
              {semaine && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <p style={{ ...t, fontSize: 12, fontWeight: 700, color: DS.colors.textPrimary }}>Semaine {semaine} sur {totalSemaines}</p>
                    <p style={{ ...t, fontSize: 12 }}>{Math.min(100, Math.round((semaine / totalSemaines) * 100))} %</p>
                  </div>
                  <div style={{ height: 6, borderRadius: DS.radius.full, background: DS.colors.surfaceHigh, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (semaine / totalSemaines) * 100)}%`, borderRadius: DS.radius.full, background: accent }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                {[[totalSeances || 0, "séances"], [streak || 0, "série"], [recordKg > 0 ? recordKg : "—", "record kg"]].map(([val, label]) => (
                  <div key={label} style={{ flex: 1, minWidth: 0, background: DS.colors.surfaceHigh, borderRadius: 12, padding: "12px 6px", textAlign: "center" }}>
                    <p style={{ ...h, fontSize: 20, color: accentLisible(accent), fontVariantNumeric: "tabular-nums" }}>{val}</p>
                    <p style={{ ...t, fontSize: 11 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <p style={{ ...h, fontSize: 16, marginBottom: 14 }}>Ce que Pro fait pour toi</p>
              {AVANTAGES_PRO.map(([icone, titre, detail], i) => (
                <div key={titre} style={{ display: "flex", gap: 12, paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0, borderTop: i ? `1px solid ${DS.colors.border}` : "none" }}>
                  <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, background: DS.colors.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{icone}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...h, fontSize: 14, marginBottom: 3 }}>{titre}</p>
                    <p style={t}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => { setMsg(""); setFlow(6); }} style={btnGhost}>Gérer mon offre et mes paiements</button>
            {/* Le mot « résilier » reste écrit ici : la loi demande un accès direct et sans ambiguïté */}
            <p onClick={() => { setMsg(""); setFlow(6); }} style={{ ...link, textDecoration: "none" }}>Prix, factures, résilier ou renoncer au contrat</p>
          </>
        )}

        {info && flow === 6 && (
          <>
            <div style={{ ...card, borderColor: `${accent}50` }}>
              <p style={{ ...h, fontSize: 18, marginBottom: 6 }}>Mon offre</p>
              <p style={{ ...t, color: DS.colors.textPrimary, fontWeight: 600 }}>{planLabel}</p>
              <p style={{ ...t, marginTop: 6 }}>
                {enEssai && info.cancelAtPeriodEnd ? `Résiliation prévue : ton essai reste actif jusqu'au ${dateFr(info.periodEnd)}. Tu ne seras pas débité.`
                  : enEssai ? `Essai gratuit jusqu'au ${dateFr(info.periodEnd)}. Premier paiement ce jour-là : ${premierPaiement} €, sauf si tu résilies avant.`
                  : info.cancelAtPeriodEnd ? `Résiliation prévue : ton accès reste actif jusqu'au ${dateFr(info.periodEnd)}.`
                  : info.paused ? `Pause active : ton prochain mois est offert.`
                  : `Prochain renouvellement le ${dateFr(info.periodEnd)}.`}
                {info.offerUsed && info.hasDiscount && !info.cancelAtPeriodEnd ? " 🎁 Réduction de fidélité appliquée." : ""}
              </p>
              {info.cancelAtPeriodEnd && <button onClick={resume} disabled={busy} style={{ ...btnMain, marginTop: 14 }}>{busy ? "..." : "Réactiver mon abonnement"}</button>}
            </div>

            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 6 }}>Paiement et factures</p>
              <p style={{ ...t, marginBottom: 12 }}>Change ta carte bancaire, consulte et télécharge tes factures.</p>
              <button onClick={() => goPortal("portal")} disabled={busy} style={btnGhost}>{busy ? "Ouverture..." : "Moyen de paiement et factures"}</button>
            </div>

            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 6 }}>Ce que Voltra Pro te garde</p>
              <p style={{ ...t, marginBottom: 12 }}>Sans Pro, tu ne peux plus lancer de séance.{totalSeances > 0 ? ` Tes ${totalSeances} séance${totalSeances > 1 ? "s" : ""} et ton historique restent sur ton compte, mais ton programme s'arrête là.` : ""}</p>
              {AVANTAGES_PRO.map(([icone, titre]) => (
                <p key={titre} style={{ ...t, color: DS.colors.textPrimary, fontWeight: 600, marginTop: 6 }}>{icone} {titre}</p>
              ))}
            </div>

            {!info.cancelAtPeriodEnd && (
              <p onClick={() => { setMsg(""); setFlow(1); }} style={link}>Résilier mon abonnement</p>
            )}

            {/* Discret, mais la loi le veut identifiable et accessible tout le délai */}
            {info.canRetract && (
              <p style={{ ...link, textDecoration: "none", cursor: "default", lineHeight: 1.5 }}>
                Droit de rétractation jusqu'au {dateFr(info.retractUntil)} :{" "}
                <button onClick={() => { setMsg(""); setFlow(4); }} style={{ padding: 0, background: "none", border: "none", color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer" }}>Renoncer au contrat ici</button>
              </p>
            )}
          </>
        )}

        {info && flow === 1 && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Avant de partir…</p>
              <p style={t}>Tu as fait <b style={{ color: accent }}>{totalSeances || 0} séance{totalSeances > 1 ? "s" : ""}</b> avec Voltra. En résiliant, tu perdras à la fin de ta période d'accès :{"\n"}• ton programme IA qui évolue avec toi{"\n"}• le coach Ace pendant tes séances{"\n"}• les séances illimitées</p>
            </div>
            <div style={card}>
              <p style={{ ...h, fontSize: 14, marginBottom: 10 }}>Pourquoi veux-tu partir ? (facultatif)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {REASONS.map(r => (
                  <div key={r} onClick={() => setReason(r)} style={{ padding: "9px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, background: reason === r ? accent : DS.colors.surfaceHigh, color: reason === r ? "#000" : DS.colors.textSec, border: `1px solid ${reason === r ? accent : DS.colors.border}` }}>{r}</div>
                ))}
              </div>
            </div>
            <button onClick={onBack} style={btnMain}>Garder mon abonnement</button>
            <p onClick={() => setFlow(info.offerUsed || enEssai ? 3 : 2)} style={link}>Continuer la résiliation</p>
          </>
        )}

        {info && flow === 2 && (
          <>
            <div style={{ ...card, borderColor: `${accent}60` }}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>🎁 Une offre rien que pour toi</p>
              <p style={t}>On préfère te garder. Choisis ce qui te convient :</p>
            </div>
            <div style={card}>
              <p style={{ ...h, fontSize: 16, marginBottom: 4 }}>−30 % {isYear ? "sur ton prochain renouvellement" : "pendant 3 mois"}</p>
              <p style={{ ...t, marginBottom: 12 }}>{isYear ? "Une seule fois, au prochain paiement annuel." : "Appliqué automatiquement sur tes 3 prochaines factures."} Sans engagement, tu peux toujours résilier ensuite.</p>
              <button onClick={() => takeOffer("discount")} disabled={busy} style={btnMain}>{busy ? "..." : "Profiter de −30 %"}</button>
            </div>
            {!isYear && (
              <div style={card}>
                <p style={{ ...h, fontSize: 16, marginBottom: 4 }}>1 mois offert</p>
                <p style={{ ...t, marginBottom: 12 }}>On met ton abonnement en pause : ton prochain mois ne te coûte rien, et tu gardes ton accès Pro.</p>
                <button onClick={() => takeOffer("free_month")} disabled={busy} style={btnGhost}>{busy ? "..." : "Profiter d'un mois offert"}</button>
              </div>
            )}
            <p onClick={() => setFlow(3)} style={link}>Non merci, je veux résilier</p>
          </>
        )}

        {info && flow === 3 && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Dernière étape</p>
              <p style={t}>{enEssai ? "Ton essai" : "Ton accès Pro"} reste actif jusqu'au <b>{dateFr(info.periodEnd)}</b>, puis il s'arrêtera. Tu ne seras {enEssai ? "pas débité" : "plus facturé"}. Tu garderas ton compte et ton historique.</p>
            </div>
            <button onClick={onBack} style={btnMain}>Finalement, je reste</button>
            <button onClick={() => goPortal("cancel_flow")} disabled={busy} style={{ ...btnGhost, marginTop: 12, color: "#FF2D55", borderColor: "rgba(255,45,85,0.3)" }}>{busy ? "Ouverture..." : "Confirmer la résiliation"}</button>
          </>
        )}

        {info && flow === 4 && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Te rétracter</p>
              <p style={t}>{enEssai ? "Ton essai" : "Ton abonnement"} et ton accès Pro s'arrêtent tout de suite. {info.refundable > 0 ? <>Nous te remboursons <b>{info.refundable.toFixed(2).replace(".", ",")} €</b> sur ton moyen de paiement, sous 14 jours au plus tard.</> : "Aucun paiement n'a été prélevé, et tu ne seras pas débité."} Tu garderas ton compte et ton historique.</p>
            </div>
            <button onClick={onBack} style={btnMain}>Finalement, je reste</button>
            <button onClick={retract} disabled={busy} style={{ ...btnGhost, marginTop: 12, color: "#FF2D55", borderColor: "rgba(255,45,85,0.3)" }}>{busy ? "Envoi..." : "Confirmer la rétractation"}</button>
          </>
        )}

        {flow === 5 && retraction && (
          <>
            <div style={card}>
              <p style={{ ...h, fontSize: 20, marginBottom: 8 }}>Rétractation confirmée</p>
              <p style={t}>{retraction.refunded > 0 ? `Ton remboursement de ${retraction.refunded.toFixed(2).replace(".", ",")} € est lancé. Il arrive sous 14 jours au plus tard.` : "Tu n'as rien à payer."} {retraction.emailSent ? "Une confirmation vient de t'être envoyée par e-mail." : "Si tu veux une confirmation écrite, écris à contact.voltra1@gmail.com"}</p>
            </div>
            <button onClick={() => window.location.reload()} style={btnMain}>Retour à l'accueil</button>
          </>
        )}
      </div>
    </div>
  );
}

// « Ma salle » : tout est disponible par défaut, l'utilisateur décoche ce qui manque
function MaSalleScreen({ absentes, onChange, onBack }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const basculer = (id) => onChange(absentes.includes(id) ? absentes.filter(a => a !== id) : [...absentes, id]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, color: DS.colors.textPrimary, overflowY: "auto", WebkitOverflowScrolling: "touch", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "calc(20px + env(safe-area-inset-top, 0px)) 20px 60px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 0", marginBottom: 8 }}>← Retour</button>
        <h1 style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Ma <span style={{ color: ac }}>salle</span></h1>
        <p style={{ fontSize: 14, color: DS.colors.textSec, lineHeight: 1.45, margin: "8px 0 20px" }}>Décoche ce qu'il n'y a pas dans ta salle. Tes séances le remplaceront par un exercice qui travaille les mêmes muscles.</p>
        {machinesParCategorie().map(([categorie, machines]) => (
          <div key={categorie} style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: ac, textTransform: "uppercase", marginBottom: 8 }}>{categorie}</p>
            <div style={{ background: DS.colors.surface, borderRadius: 18, boxShadow: DS.shadow.card, overflow: "hidden" }}>
              {machines.map((m, i) => {
                const dispo = !absentes.includes(m.id);
                return (
                  <button key={m.id} onClick={() => basculer(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", background: "none", border: "none", borderTop: i ? `1px solid ${DS.colors.border}` : "none", color: DS.colors.textPrimary, textAlign: "left", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700, opacity: dispo ? 1 : 0.5 }}>{m.fr}</span>
                      <span style={{ display: "block", fontSize: 12, color: DS.colors.textSec, marginTop: 1 }}>{m.en}</span>
                    </span>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: `2px solid ${dispo ? DS.colors.primary : DS.colors.textDim}`, background: dispo ? DS.colors.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0B0B0C", fontSize: 13, fontWeight: 900 }}>{dispo ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilScreen({ isPro, user, programme, sportActif: sportActifProp, appTheme, onThemeChange, onLogout, onRegenerateProgram, absentes = [], onChangeAbsentes }) {
  const [showSalle, setShowSalle] = useState(false);
  const stagger = useStaggerUneFois("profil");
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editData, setEditData] = useState({ sport: null, objectif: null, frequence: 3, jours: [1, 3, 5] });
  const [showLegal, setShowLegal] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [paidPlan, setPaidPlan] = useState(null);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [recordKg, setRecordKg] = useState(0);
  const [seancesFaitesSemaine, setSeancesFaitesSemaine] = useState([]);
  const [totalSeancesAllTime, setTotalSeancesAllTime] = useState(0);
  const memberSinceDays = user?.created_at ? Math.floor((Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0;
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image trop lourde (max 5Mo)"); return; }
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await supabase.auth.updateUser({ data: { avatar_url: pub.publicUrl } });
      setAvatarUrl(pub.publicUrl);
    } catch (err) {
      console.error("Erreur upload avatar:", err.message);
      alert("Erreur lors de l'envoi de la photo");
    }
    setUploadingAvatar(false);
  };

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Toi";
  const progData = programme?.data_json;
  const semaineCourante = programme?.semaine_courante || 1;
  const totalSemaines = programme?.total_semaines || 8;
  const progression = Math.round((semaineCourante / totalSemaines) * 100);
  const sport = sportActifProp || progData?.sport || user?.user_metadata?.sport || "default";
  const objectif = progData?.objectif || "Non defini";
  const frequence = progData?.frequence || 3;
  const theme = getSportTheme(sport);
  const currentCycle = progData?.cycle || getNiveauCycle(progData?.niveau) || 1;
  const startCycle = progData?.startCycle || getNiveauCycle(progData?.niveau) || 1;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from("seances").select("date_realisee").eq("user_id", session.user.id).eq("statut", "faite").order("date_realisee", { ascending: false }).limit(30);
      if (data) {
        setSeancesCount(data.length);
        let s = 0, today = new Date();
        for (const sc of data) {
          const diff = Math.floor((today - new Date(sc.date_realisee)) / (1000 * 60 * 60 * 24));
          if (diff <= s + 2) s++;
          else break;
        }
        setStreak(s);
      }
      // Record de kg soulevés en une seule seance + total seances toutes periodes
      const { data: allSeances, count: totalCount } = await supabase
        .from("seances")
        .select("id, exercices(charge_kg, sets, reps, logs_performance(charge_kg))", { count: "exact" })
        .eq("user_id", session.user.id)
        .eq("statut", "faite");
      if (allSeances) {
        setTotalSeancesAllTime(totalCount || allSeances.length);
        let maxKg = 0;
        allSeances.forEach(sc => {
          const kgSeance = (sc.exercices || []).reduce((acc, ex) => {
            if (!(ex.charge_kg > 0)) return acc;
            return acc + (ex.logs_performance?.[0]?.charge_kg || ex.charge_kg) * (ex.sets || 1) * (parseInt(ex.reps) || 1);
          }, 0);
          if (kgSeance > maxKg) maxKg = kgSeance;
        });
        setRecordKg(Math.round(maxKg));
      }
      // Seances faites cette semaine (pour le calendrier)
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // lundi=0
      const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek); monday.setHours(0, 0, 0, 0);
      const { data: weekData } = await supabase
        .from("seances")
        .select("date_realisee")
        .eq("user_id", session.user.id)
        .eq("statut", "faite")
        .gte("date_realisee", monday.toISOString());
      if (weekData) {
        setSeancesFaitesSemaine(weekData.map(d => new Date(d.date_realisee).getDay()));
      }
    });
  }, []);

  const openEdit = () => {
    setEditData({ sport, objectif: objectif !== "Non defini" ? objectif : null, frequence, jours: progData?.jours?.length === frequence ? progData.jours : DEFAULT_JOURS[frequence], rythme: { ...RYTHME_DEFAUT, ...(progData?.rythme || user?.user_metadata?.onboarding?.rythme || {}) }, equipement: progData?.equipement || user?.user_metadata?.onboarding?.equipement || "salle_complete", materiel: progData?.materiel || [], chargeMaison: progData?.chargeMaison ?? null });
    setShowEditDrawer(true);
  };

  // Un nouveau programme si le sport, le club ou les jours changent : chaque séance dépend de son jour
  const memes = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const rythmeAvant = { ...RYTHME_DEFAUT, ...(progData?.rythme || {}) };
  const regenere = !!editData?.rythme && (editData.sport !== sport || !memes([...editData.rythme.club].sort(), [...rythmeAvant.club].sort()) || editData.rythme.match !== rythmeAvant.match || editData.rythme.saison !== rythmeAvant.saison || !memes([...editData.jours].sort(), [...(progData?.jours || [])].sort())) || (!!editData?.equipement && (editData.equipement !== (progData?.equipement || "salle_complete") || !memes([...(editData.materiel || [])].sort(), [...(progData?.materiel || [])].sort()) || (editData.chargeMaison ?? null) !== (progData?.chargeMaison ?? null)));

  const saveEdit = async () => {
    setSaving(true);
    const sportChanged = regenere;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("profiles").upsert({ id: session.user.id, sport: editData.sport }, { onConflict: "id" });
        if (sportChanged && programme?.id) {
          // Sport change → nouveau programme
          const dj = programme.data_json || {};
          if (onRegenerateProgram) await onRegenerateProgram({ niveau: dj.niveau || programme.niveau, equipement: dj.equipement, douleurs: dj.douleurs, poste: editData.sport === sport ? dj.poste : null, cycle: dj.cycle, ...user?.user_metadata?.onboarding && { poids: user.user_metadata.onboarding.poids, age: user.user_metadata.onboarding.age, taille: user.user_metadata.onboarding.taille }, ...editData }, true);
        } else if (programme?.id) {
          // Juste mettre a jour objectif + frequence sans regenerer ni remettre a zero
          const updatedJson = { ...(programme.data_json || {}), objectif: editData.objectif, frequence: editData.frequence, jours: editData.jours, rythme: editData.rythme };
          await supabase.from("programmes").update({ data_json: updatedJson }).eq("id", programme.id);
          if (onRegenerateProgram) await onRegenerateProgram(editData, false);
        }
      }
    } catch (err) { console.error(err); }
    setSaving(false);
    setShowEditDrawer(false);
  };

  if (showSalle) return <MaSalleScreen absentes={absentes} onChange={onChangeAbsentes} onBack={() => setShowSalle(false)} />;
  // Hors du bloc du profil : dedans, la barre du bas passerait par-dessus ces écrans
  if (showSub) return <SubscriptionScreen onBack={() => setShowSub(false)} accent={theme.accent} totalSeances={totalSeancesAllTime} streak={streak} recordKg={recordKg} semaine={programme ? semaineCourante : null} totalSemaines={totalSemaines} />;
  if (showLegal) return <LegalScreen initial={showLegal} onBack={() => setShowLegal(null)} />;

  return (
    <div className={stagger} style={{ minHeight: "100dvh", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", paddingBottom: 130, overflow: "hidden" }}>
      <Bloom echelle={0.8} />

      {/* Sport bg */}
      <div style={{ position: "absolute", inset: 0, background: theme.bg, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.04, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>
        {SPORT_EMOJIS[sport] || "⚡"}
      </div>

      {/* Drawer edition */}
      {showEditDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowEditDrawer(false)} style={{ position: "absolute", inset: 0, background: DS.colors.surfaceHigh, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: DS.colors.surface, borderRadius: `${DS.radius.xl}px ${DS.radius.xl}px 0 0`, padding: "24px 20px calc(96px + env(safe-area-inset-bottom, 0px))", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <p style={{ ...s.display, fontSize: 20, color: DS.colors.textPrimary }}>Modifier mon profil</p>
              <button onClick={() => setShowEditDrawer(false)} style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.full, width: 32, height: 32, color: DS.colors.textSec, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Sport</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
              {SPORTS.map(sp => (
                <div key={sp.id} onClick={() => setEditData(d => ({ ...d, sport: sp.id, objectif: null }))} style={{ background: editData.sport === sp.id ? theme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${editData.sport === sp.id ? theme.accent : DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 6px", textAlign: "center", cursor: "pointer", transition: "var(--t-choix)" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{sp.emoji}</div>
                  <div style={{ color: editData.sport === sp.id ? theme.accent : DS.colors.textSec, fontSize: 10, ...s.heading }}>{sp.label}</div>
                </div>
              ))}
            </div>
            {editData.sport && (
              <>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Objectif</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  {(OBJECTIFS_PAR_SPORT[editData.sport] || []).map(obj => (
                    <div key={obj.id} onClick={() => setEditData(d => ({ ...d, objectif: obj.id }))} style={{ background: editData.objectif === obj.id ? theme.accent + "15" : DS.colors.surfaceHigh, border: `1px solid ${editData.objectif === obj.id ? theme.accent : DS.colors.border}`, borderRadius: DS.radius.md, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <span style={{ fontSize: 20 }}>{obj.emoji}</span>
                      <div>
                        <p style={{ color: editData.objectif === obj.id ? theme.accent : DS.colors.textPrimary, fontSize: 14, ...s.heading }}>{obj.label}</p>
                        <p style={{ color: DS.colors.textSec, fontSize: 11 }}>{obj.desc}</p>
                      </div>
                      {editData.objectif === obj.id && <div style={{ marginLeft: "auto", width: 18, height: 18, background: theme.accent, borderRadius: DS.radius.full, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#000" strokeWidth="3" strokeLinecap="round" /></svg></div>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginBottom: 28 }}>
              <RythmeClub sport={editData.sport} rythme={editData.rythme} accent={theme.accent} onChange={(r) => setEditData(d => ({ ...d, rythme: r, jours: joursConseilles(d.frequence, r) }))} />
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Séances Voltra / semaine{editData.frequence > frequenceConseillee(editData.rythme) ? ` · ${frequenceConseillee(editData.rythme)} conseillées` : ""}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[2, 3, 4, 5].map(n => (
                <div key={n} onClick={() => setEditData(d => ({ ...d, frequence: n, jours: joursConseilles(n, d.rythme) }))} style={{ flex: 1, padding: "14px 0", textAlign: "center", background: editData.frequence === n ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.md, color: editData.frequence === n ? "#000" : DS.colors.textSec, fontSize: 18, cursor: "pointer", ...s.display }}>{n}</div>
              ))}
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Mes jours d'entraînement</p>
            <div style={{ marginBottom: 28 }}>
              <DayPicker sport={editData.sport} jours={editData.jours || []} max={editData.frequence} accent={theme.accent} rythme={editData.rythme} onChange={(j) => setEditData(d => ({ ...d, jours: j }))} />
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Où tu t'entraînes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: MATERIEL_LIEU[editData.equipement] ? 0 : 28 }}>
              {EQUIPEMENTS.map(eq => (
                <div key={eq.id} onClick={() => setEditData(d => ({ ...d, equipement: eq.id }))} style={{ padding: "12px 10px", borderRadius: DS.radius.md, cursor: "pointer", background: editData.equipement === eq.id ? theme.accent + "20" : DS.colors.surfaceHigh, border: `1px solid ${editData.equipement === eq.id ? theme.accent : DS.colors.border}`, transition: "var(--t-choix)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, margin: 0 }}>{eq.emoji} {eq.label}</p>
                </div>
              ))}
            </div>
            {MATERIEL_LIEU[editData.equipement] && <div style={{ marginBottom: 28 }}><MaterielLieu lieu={editData.equipement} sport={editData.sport} materiel={editData.materiel || []} chargeMaison={editData.chargeMaison} accent={theme.accent} onChange={(m) => setEditData(d => ({ ...d, ...m }))} /></div>}
            {regenere && (
              <div style={{ background: DS.colors.warningSoft, border: "1px solid rgba(255,140,0,0.2)", borderRadius: DS.radius.md, padding: "10px 14px", marginBottom: 16 }}>
                <p style={{ color: DS.colors.warning, fontSize: 12 }}>⚠️ Un nouveau programme sera créé avec ces réglages.</p>
              </div>
            )}
            <button onClick={saveEdit} disabled={saving || !editData.sport || !editData.objectif || (editData.jours || []).length !== editData.frequence} style={{ width: "100%", height: 52, background: editData.sport && editData.objectif ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)` : DS.colors.surfaceHigh, border: "none", borderRadius: DS.radius.md, color: editData.sport && editData.objectif ? "#000" : DS.colors.textSec, fontSize: 15, cursor: "pointer", ...s.heading, fontWeight: 700, letterSpacing: "0.05em" }}>
              {saving ? (regenere ? "Génération en cours..." : "Sauvegarde...") : (regenere ? "Sauvegarder et régénérer ⚡" : "Sauvegarder les changements")}
            </button>
          </div>
        </div>
      )}

      {/* Header hero */}
      <div style={{ padding: `${hautSur(60)} 24px 32px`, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
          <div onClick={() => fileInputRef.current?.click()} style={{ position: "relative", width: 72, height: 72, flexShrink: 0, cursor: "pointer" }}>
            <div style={{ width: 72, height: 72, background: avatarUrl ? "transparent" : theme.accent + "20", border: `2px solid ${theme.accent}50`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, ...s.display, color: accentLisible(theme.accent), overflow: "hidden", boxShadow: `0 0 30px ${theme.accent}20` }}>
              {uploadingAvatar ? (
                <div style={{ width: 20, height: 20, border: `2px solid ${theme.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            {/* Bouton camera */}
            <div style={{ position: "absolute", bottom: -4, right: -4, width: 26, height: 26, borderRadius: "50%", background: theme.accent, border: `2px solid ${DS.colors.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#000" strokeWidth="2"/></svg>
            </div>
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{SPORT_EMOJIS[sport] || "⚡"}</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", textTransform: "uppercase" }}>{sport !== "default" ? sport : "Sport"}</span>
            </div>
            <p style={{ ...s.display, fontSize: 24, color: DS.colors.textPrimary, letterSpacing: "0.05em", lineHeight: 1, marginBottom: 4 }}>{userName.toUpperCase()}</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>{user?.email}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px", position: "relative", zIndex: 1 }}>

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[
            { val: totalSeancesAllTime || seancesCount, label: "Seances", color: accentLisible(theme.accent) },
            { val: streak, label: "Streak", color: DS.colors.success },
            { val: `${progression}%`, label: "Progres", color: DS.colors.warning },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 4 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { val: recordKg > 0 ? `${recordKg}` : "—", label: "Record kg", color: "#FF8C00" },
            { val: memberSinceDays, label: "Jours actif", color: "#00C8FF" },
            { val: `${seancesCount}`, label: "Ce mois", color: DS.colors.textSec },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.lg, padding: "16px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: DS.colors.textPrimary, lineHeight: 1, marginBottom: 4 }}>{stat.val}</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Programme actif */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}25`, borderRadius: DS.radius.xl, padding: 20, marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent), letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Programme actif</p>
              <p style={{ color: DS.colors.textPrimary, fontSize: 16, ...s.heading }}>{programme?.titre || "Aucun programme"}</p>
            </div>
            <div style={{ background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.full, padding: "4px 10px" }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>CYCLE {currentCycle}</p>
            </div>
          </div>
          <ProgressBar value={progression} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec }}>{frequence}x / semaine</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>Semaine {semaineCourante}/{totalSemaines} · {progression}%</p>
          </div>
          {objectif && objectif !== "Non defini" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ton objectif</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, textTransform: "capitalize" }}>{objectif}</p>
              </div>
            </div>
          )}
        </div>

        {/* Calendrier de la semaine */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cette semaine</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>{seancesFaitesSemaine.length}/{frequence} séances</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(() => {
              const jours = ["L", "M", "M", "J", "V", "S", "D"];
              const joursIdx = [1, 2, 3, 4, 5, 6, 0]; // getDay() index: L=1..D=0
              const todayIdx = new Date().getDay();
              const planPositions = (progData?.jours?.length ? progData.jours : DEFAULT_JOURS[Math.min(frequence, 5)]) || [1, 3, 5];
              return jours.map((j, i) => {
                const dayNum = joursIdx[i];
                const isPlanned = planPositions.includes(dayNum);
                const isDone = seancesFaitesSemaine.includes(dayNum);
                const isToday = dayNum === todayIdx;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: isToday ? theme.accent : DS.colors.textDim, fontWeight: isToday ? 700 : 400 }}>{j}</p>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: isDone ? theme.accent : isPlanned ? theme.accent + "15" : DS.colors.surfaceHigh, border: `1.5px solid ${isDone ? theme.accent : isPlanned ? theme.accent + "40" : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isToday ? `0 0 0 2px ${theme.accent}30` : "none" }}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="#000" strokeWidth="3" strokeLinecap="round" /></svg>
                      ) : isPlanned ? (
                        <span style={{ fontSize: 12 }}>💪</span>
                      ) : (
                        <span style={{ fontSize: 10, color: DS.colors.textDim }}>·</span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Historique des cycles — badges */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: DS.colors.textSec, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Parcours de cycles</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {(() => {
              const cycleInfo = (n) => n === 1 ? { label: "Fondations", emoji: "🌱" } : n === 2 ? { label: "Intensification", emoji: "⚡" } : n === 3 ? { label: "Puissance", emoji: "🔥" } : n === 4 ? { label: "Elite", emoji: "💎" } : { label: `Elite+${n - 4}`, emoji: "🚀" };
              const maxDisplay = Math.max(currentCycle, 4);
              return Array.from({ length: maxDisplay }, (_, i) => i + 1).map(n => {
                const info = cycleInfo(n);
                const isDone = currentCycle > n && n >= startCycle;
                const isSkipped = n < startCycle;
                const isCurrent = currentCycle === n;
                return (
                  <div key={n} style={{ flexShrink: 0, width: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: isSkipped ? 0.35 : 1 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: isDone ? theme.accent : isCurrent ? theme.accent + "20" : DS.colors.surfaceHigh, border: `2px solid ${isDone || isCurrent ? theme.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: isCurrent ? `0 0 16px ${theme.accent}50` : "none" }}>
                      {isSkipped ? "—" : info.emoji}
                    </div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? theme.accent : DS.colors.textSec, textAlign: "center", lineHeight: 1.2 }}>{info.label}</p>
                    {isDone && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: accentLisible(theme.accent) }}>✓ FAIT</p>}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Modifier profil — 1 seul bouton clair */}
        <div onClick={openEdit} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✏️</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Modifier mon profil</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, fontFamily: "'Inter',sans-serif" }}>{sport !== "default" ? sport : "?"} · {objectif !== "Non defini" ? objectif : "?"} · {frequence}x/sem</p>
            </div>
          </div>
          <span style={{ color: accentLisible(theme.accent), fontSize: 18 }}>→</span>
        </div>

        {/* Ma salle */}
        <div onClick={() => setShowSalle(true)} style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏋️</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Ma salle</p>
              <p style={{ color: DS.colors.textSec, fontSize: 12, fontFamily: "'Inter',sans-serif" }}>{absentes.length ? `${absentes.length} machine${absentes.length > 1 ? "s" : ""} absente${absentes.length > 1 ? "s" : ""}` : "Choisis les machines disponibles"}</p>
            </div>
          </div>
          <span style={{ color: accentLisible(theme.accent), fontSize: 18 }}>→</span>
        </div>

        {/* Theme */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{DS.colors.isDark ? "🌙" : "☀️"}</div>
            <div>
              <p style={{ color: DS.colors.textPrimary, fontSize: 15, ...s.heading, marginBottom: 2 }}>Apparence</p>
              <p style={{ color: DS.colors.textSec, fontSize: 11, fontFamily: "'Inter',sans-serif" }}>{DS.colors.isDark ? "THÈME SOMBRE" : "THÈME LUMINEUX"}</p>
            </div>
          </div>
          <div onClick={() => { const next = DS.colors.isDark ? "light" : "dark"; DS.colors = THEMES[next]; DS.shadow = THEMES[next].shadow; localStorage.setItem("voltra_theme", next); onThemeChange && onThemeChange(next); }} style={{ width: 50, height: 28, background: DS.colors.isDark ? theme.accent : DS.colors.surfaceHigh, borderRadius: DS.radius.full, position: "relative", cursor: "pointer", transition: "background 0.25s", border: `1px solid ${DS.colors.border}` }}>
            <div style={{ position: "absolute", top: 3, left: 3, transform: `translateX(${DS.colors.isDark ? 22 : 0}px)`, width: 22, height: 22, background: "white", borderRadius: DS.radius.full, transition: "transform 200ms var(--ease-out)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              {DS.colors.isDark ? "🌙" : "☀️"}
            </div>
          </div>
        </div>

        {/* Abonnement */}
        {isPro && user?.id && <RappelsCard user={user} />}

        {isPro && (
          <div style={{ background: DS.colors.surface, border: `1px solid ${theme.accent}40`, borderRadius: DS.radius.xl, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 15, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 800 }}>Voltra Pro actif</p>
            </div>
            <p onClick={() => setShowSub(true)} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: DS.colors.textSec, textDecoration: "underline", cursor: "pointer", margin: 0 }}>Gérer mon abonnement</p>
          </div>
        )}

        {/* Informations legales */}
        <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, marginBottom: 14, overflow: "hidden" }}>
          {[["cgu", "📄", "Conditions d'utilisation"], ["privacy", "🔒", "Politique de confidentialité"], ["mentions", "ℹ️", "Mentions légales"]].map(([k, ic, label], i) => (
            <div key={k} onClick={() => setShowLegal(k)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", borderTop: i ? `1px solid ${DS.colors.border}` : "none" }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 14, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{label}</p>
              <span style={{ color: DS.colors.textSec }}>›</span>
            </div>
          ))}
          <a href="mailto:contact.voltra1@gmail.com?subject=Voltra%20-%20Support%20ou%20donn%C3%A9es" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderTop: `1px solid ${DS.colors.border}`, textDecoration: "none" }}>
            <span style={{ fontSize: 18 }}>✉️</span>
            <p style={{ flex: 1, color: DS.colors.textPrimary, fontSize: 14, margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>Support · supprimer mes données</p>
            <span style={{ color: DS.colors.textSec }}>›</span>
          </a>
        </div>

        {/* Deconnexion */}
        <div onClick={onLogout} style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: DS.radius.xl, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚪</div>
          <p style={{ color: "#FF2D55", fontSize: 15, ...s.heading }}>Se déconnecter</p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAMME PREVIEW — avant inscription
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PROJECTION SCREEN — la transformation concrète
// ─────────────────────────────────────────────
// Nombre qui « compte » jusqu'à sa valeur (ex. "+18%", "24", "0.5T")
// ─────────────────────────────────────────────
// OBJECTIF : le plan part de la date et remonte
// ─────────────────────────────────────────────
const JOUR_MS = 86400000;
const CIBLES = {
  match: { ic: "🏆", get t() { return `${motsSport().Un} important${motsSport().e}`; }, s: "Championnat, tournoi, finale", get fin() { return motsSport().ton; } },
  test: { ic: "🎯", t: "Une détection ou un test", s: "Sélection, centre de formation", fin: "ta détection" },
  saison: { ic: "📅", t: "La reprise de saison", s: "Arriver prêt dès le premier jour", fin: "ta reprise" },
  perso: { ic: "🚀", t: "Un cap personnel", s: "Sauter plus haut, courir plus vite", fin: "ton objectif" },
};
const dateLocale = (iso) => new Date(`${iso}T12:00:00`);
const isoDans = (jours) => { const d = new Date(Date.now() + jours * JOUR_MS); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const joursAvant = (iso) => { const a = new Date(); a.setHours(12, 0, 0, 0); return Math.round((dateLocale(iso) - a) / JOUR_MS); };
const dateLongue = (iso) => dateLocale(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// La dernière semaine est toujours l'affûtage
function phasesObjectif(semaines) {
  const w = Math.max(1, semaines);
  if (w <= 2) return [
    { n: "Activation", w: Math.max(w - 1, 1), d: "Réveiller la vitesse sans te fatiguer", c: "#C9F299" },
    { n: "Affûtage", w: 1, d: "Charges réduites, fraîcheur maximale", c: "#FFB25C" },
  ];
  const reste = w - 1;
  const f = Math.max(1, Math.round(reste * 0.34)), fo = Math.max(1, Math.round(reste * 0.33)), p = Math.max(reste - f - fo, 1);
  return [
    { n: "Fondations", w: f, d: "Technique, appuis et bases solides", c: "#C9F299" },
    { n: "Force", w: fo, d: "Charges plus lourdes, moins de répétitions", c: "#9BE84F" },
    { n: "Puissance", w: p, d: "Explosivité, sauts et vitesse", c: "#6FCF3D" },
    { n: "Affûtage", w: 1, d: "Volume réduit pour arriver frais", c: "#FFB25C" },
  ];
}

// Où en est l'athlète dans son plan
function etatPlan(cible) {
  const total = Math.max(1, Math.round((dateLocale(cible.date) - new Date(cible.debut)) / (7 * JOUR_MS)));
  const semaine = Math.min(total, Math.max(1, Math.floor((Date.now() - new Date(cible.debut)) / (7 * JOUR_MS)) + 1));
  const phases = phasesObjectif(total);
  let debut = 1, index = 0;
  for (let i = 0; i < phases.length; i++) {
    if (semaine < debut + phases[i].w) { index = i; break; }
    debut += phases[i].w;
    index = i;
  }
  return { total, semaine, phases, index, dansPhase: (semaine - debut + 1) / phases[index].w };
}

// Dates où l'athlète joue : ses matchs, et son objectif si c'est un match
function datesDeMatch(matchs, cible) {
  const dates = (matchs || []).map(m => m.date_match).filter(Boolean).map(d => String(d).slice(0, 10));
  if (cible?.type === "match" && cible.date) dates.push(cible.date);
  return [...new Set(dates)];
}

// Comment la séance change selon le prochain match (0 = rien à changer)
function adaptationDuJour(matchs, cible, decalage = 0) {
  const ecarts = datesDeMatch(matchs, cible).map(d => joursAvant(d) - decalage);
  const avant = ecarts.filter(e => e >= 0).sort((a, b) => a - b)[0];
  if (avant === 0) return { charge: 0.5, sets: 2, label: "Activation", ic: "⚡", note: `Jour de ${motsSport().nom} : activation légère seulement, garde tes forces.` };
  if (avant === 1) return { charge: 0.5, sets: 2, label: "Repos", ic: "😴", note: `${motsSport().Nom} demain : idéalement repos. Si tu t'entraînes, séance très légère.` };
  if (ecarts.includes(-1)) return { charge: 0.6, setsMoins: 1, label: "Récup", ic: "🧘", note: `Lendemain ${motsSport().du} : séance allégée pour bien récupérer.` };
  if (avant === 2 || avant === 3) return { charge: 0.7, setsMoins: 1, label: "−30 %", ic: "💪", note: `${motsSport().Nom} dans ${avant} jours : charges réduites de 30 % pour arriver frais.` };
  if (cible?.date && !cible.open && joursAvant(cible.date) - decalage >= 0 && joursAvant(cible.date) - decalage <= 7) return { charge: 0.8, setsMoins: 1, label: "Affûtage", ic: "💪", note: "Dernière ligne droite : volume réduit pour arriver frais." };
  return null;
}

// Prochaine charge d'un exercice, sur le programme en cours :
// - ecart : ce que l'utilisateur a vraiment soulevé par rapport au prévu
// - ajust : son ressenti, Facile +5 %, Dur -5 %, sans dépasser ±15 %
const cleExercice = (nom) => ficheExercice({ nom })?.id || String(nom || "").toLowerCase().trim();

function ressentisParExercice(logs) {
  const ressentis = {};
  for (const log of logs || []) {
    const nom = log.exercices?.nom;
    if (!nom) continue;
    const cle = cleExercice(nom);
    const e = ressentis[cle] || (ressentis[cle] = { ecart: 1, ajust: 1, reel: 0 });
    const prevu = Number(log.exercices?.charge_kg) || 0;
    const reel = Number(log.charge_kg) || 0;
    if (prevu > 0 && reel > 0) {
      e.ecart *= reel / prevu;
      e.reel = reel;
    }
    if (log.feedback === "easy") e.ajust = Math.min(1.15, e.ajust * 1.05);
    if (log.feedback === "hard") e.ajust = Math.max(0.85, e.ajust * 0.95);
  }
  return ressentis;
}

// Le poids réel le plus proche : une petite hausse attend d'atteindre le disque ou l'haltère suivant
function poidsLePlusProche(kg, materiel) {
  const proche = (liste) => liste.reduce((a, b) => Math.abs(b - kg) < Math.abs(a - kg) ? b : a);
  if (materiel === "kettlebell") return proche(KETTLEBELLS);
  if (materiel === "medball") return proche(MEDBALLS);
  const pas = materiel === "halteres" || materiel === "haltere_unique" ? 2 : 2.5;
  return Math.max(pas, Math.round(kg / pas) * pas);
}

function appliquerRessenti(ex, ressentis, profil) {
  const e = ressentis?.[cleExercice(ex.nom)];
  if (!e || !(ex.chargeKg > 0)) return ex;
  const m = e.ecart * e.ajust;
  if (Math.abs(m - 1) < 0.001) return ex;
  const saisi = Math.abs(e.ecart - 1) >= 0.001;
  const cible = poidsLePlusProche(ex.chargeKg * m, ex.materiel);
  // Un poids déjà soulevé reste possible : il passe outre le plafond de sécurité
  const securise = securiserExercice({ ...ex, chargeKg: cible }, profil);
  const ajuste = saisi && cible <= e.reel * 1.1 ? { ...securise, chargeKg: cible } : securise;
  if (ajuste.chargeKg === ex.chargeKg) return ex;
  const raison = saisi ? "d'après ce que tu as soulevé la dernière fois" : `tes dernières séances étaient ${m > 1 ? "faciles" : "dures"}`;
  return { ...ajuste, ajustement: `${ajuste.chargeKg > ex.chargeKg ? "↗" : "↘"} ${ajuste.chargeKg} kg au lieu de ${ex.chargeKg} kg : ${raison}` };
}

// Prend les infos de la fiche du catalogue, en gardant séries et répétitions
function exerciceDepuisFiche(ex, f, remplace) {
  return {
    ...ex,
    nom: f.fr,
    nomEn: f.en,
    materiel: f.materiel,
    muscles: remplace || !ex.muscles ? [f.muscle, ...f.secondaires].join(" ") : ex.muscles,
    conseil: remplace || !ex.conseil ? f.conseil : ex.conseil,
    chargeKg: remplace ? 0 : ex.chargeKg,
    chargeUnite: "",
    ajustement: undefined,
    remplace: remplace ? ex.nom : ex.remplace,
  };
}

function adapterSeance(seance, adaptation) {
  if (!adaptation || !seance) return seance;
  return {
    ...seance,
    adaptation: adaptation.note,
    allegee: !!adaptation.allegee,
    exercices: (seance.exercices || []).map(ex => ({
      ...ex,
      chargeKg: ex.chargeKg > 0 ? ex.chargeKg * adaptation.charge : ex.chargeKg,
      sets: adaptation.sets ? Math.min(adaptation.sets, ex.sets || 3) : Math.max(1, (ex.sets || 3) - (adaptation.setsMoins || 0)),
    })),
  };
}

// Forme du jour : la réponse sert à cette séance seulement, elle n'est pas enregistrée
const FORMES = [
  { id: "forme", ic: "💪", t: "En forme", s: "Programme complet", charge: 1, note: "Tu es en forme : programme complet. Si c'est facile, dis-le à la fin pour monter la prochaine fois." },
  { id: "normal", ic: "🙂", t: "Normal", s: "Programme complet", charge: 1 },
  { id: "fatigue", ic: "😴", t: "Fatigue", s: "Charges -15 %, 1 série de moins", charge: 0.85, setsMoins: 1, allegee: true, note: "Séance allégée pour ta fatigue : charges -15 % et 1 série de moins. Tes prochaines séances ne baissent pas." },
  { id: "gene", ic: "🩹", t: "Une gêne", s: "Charges -30 %, 1 série de moins", charge: 0.7, setsMoins: 1, allegee: true, note: "Séance allégée pour ta gêne : charges -30 % et 1 série de moins. Si ça fait mal, arrête. Si ça persiste, consulte." },
];

// Le match et la forme du jour ne s'additionnent pas : le plus léger des deux s'applique
function adaptationAvecForme(match, forme) {
  if (!forme) return match;
  if (!match || match.charge > forme.charge) return forme;
  return { ...match, allegee: forme.allegee, note: forme.id === "gene" ? `${match.note} Si ta gêne fait mal, arrête. Si elle persiste, consulte.` : match.note };
}

// Peu de temps : on garde les premiers exercices, les plus importants de la séance
function seanceCourte(seance) {
  const exercices = seance.exercices || [];
  const garde = Math.max(2, Math.ceil(exercices.length * 0.6));
  if (exercices.length <= garde) return seance;
  const note = `Version courte : ${garde} exercices sur ${exercices.length}.`;
  return { ...seance, exercices: exercices.slice(0, garde), adaptation: [seance.adaptation, note].filter(Boolean).join(" ") };
}

const Bloom = ({ echelle = 1 }) => <div className="v-bloom" style={{ transform: `scale(${echelle})` }} />;

// ── Les 4 temps : objectif, date, construction, plan ──
// Durées de la construction du plan, en ms
const PLAN_DEBUT = 250, PLAN_REMPLISSAGE = 2300, PLAN_JOUR_J = PLAN_DEBUT + PLAN_REMPLISSAGE + 200, PLAN_FIN = PLAN_JOUR_J + 1500;

// Une case par semaine se remplit pendant que le compte à rebours descend, jusqu'au jour J
function ConstructionPlan({ phases, jours, date, ouvert, ic, onClick }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const total = phases.reduce((n, p) => n + p.w, 0);
  const colonnes = total <= 7 ? 4 : total <= 23 ? 6 : 8;
  const couleurs = phases.flatMap(p => Array(p.w).fill(p.c));
  // Lent au départ, rapide à l'arrivée
  const delai = (i) => PLAN_DEBUT + PLAN_REMPLISSAGE * (1 - Math.pow(1 - i / total, 1.6));
  const [avance, setAvance] = useState(0);
  const [arrive, setArrive] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setAvance(1); setArrive(true); return; }
    const debut = performance.now();
    let id;
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - debut - PLAN_DEBUT) / PLAN_REMPLISSAGE));
      setAvance(1 - Math.pow(1 - p, 1 / 1.6));
      if (t - debut < PLAN_JOUR_J) id = requestAnimationFrame(tick);
      else setArrive(true);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const semaineEnCours = Math.min(total, Math.floor(avance * total) + 1);
  let semaine = 0;
  return (
    <div onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer" }}>
      <div className="v-plan-flash" />
      <p className="v-in" style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: ac, textAlign: "center" }}>On construit ton plan</p>
      <div style={{ textAlign: "center", margin: "10px 0 18px", height: 112 }}>
        {arrive
          ? <div key="arrive" className="v-plan-arrive" style={{ height: 84, fontSize: ouvert ? 54 : 76, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: "84px", color: DS.colors.warning }}>{ouvert ? "TU ES PRÊT" : "JOUR J"}</div>
          : ouvert
            ? <div style={{ height: 84, fontSize: 76, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: "84px", fontVariantNumeric: "tabular-nums" }}><span style={{ fontSize: 34, color: ac, marginRight: 6, letterSpacing: "-0.02em" }}>SEM.</span>{semaineEnCours}</div>
            : <div style={{ height: 84, fontSize: 76, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: "84px", fontVariantNumeric: "tabular-nums" }}><span style={{ fontSize: 34, color: ac, marginRight: 2, letterSpacing: "-0.02em" }}>J-</span>{Math.max(1, Math.round(jours * (1 - avance)))}</div>}
        <p className="v-premiere" style={{ fontSize: 15, fontWeight: 700, color: DS.colors.textSec, marginTop: 2 }}>{ouvert ? `${total} semaines de préparation` : dateLocale(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="v-plan-grille" style={{ gridTemplateColumns: `repeat(${colonnes}, 1fr)`, "--impact": `${PLAN_JOUR_J}ms` }}>
        {couleurs.map((c, i) => (
          <div key={i} className="v-plan-case" style={{ background: DS.colors.surfaceHigh }}>
            <i style={{ background: c, animationDelay: `${delai(i)}ms` }} />
          </div>
        ))}
        <div className="v-plan-case jour-j" style={{ "--orange": DS.colors.warning, "--impact": `${PLAN_JOUR_J}ms` }}><b /><span>{ic}</span><span>{ouvert ? "Cap atteint" : dateLongue(date)}</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
        {phases.map(p => {
          const depart = semaine;
          semaine += p.w;
          return (
            <div key={p.n} className="v-plan-phase" style={{ animationDelay: `${delai(depart)}ms` }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: p.c, flexShrink: 0 }} />
              <b style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{p.n}</b>
              <span style={{ fontSize: 13, color: DS.colors.textSec, fontVariantNumeric: "tabular-nums" }}>{p.w} sem.</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObjectifScreen({ initial, onboardingData, edition, onDone, onBack }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const [etape, setEtape] = useState(0);
  const [type, setType] = useState(initial?.type || "match");
  const [jours, setJours] = useState(() => { const j = initial?.date && joursAvant(initial.date); return j >= 7 && j <= 300 ? j : 84; });
  const [ouvert, setOuvert] = useState(false);
  const semaines = Math.max(1, Math.round(jours / 7));
  const phases = phasesObjectif(semaines);
  const date = isoDans(jours);
  const c = CIBLES[type];
  const freq = onboardingData?.frequence || 3;
  const titre = { fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1.02, letterSpacing: "-0.03em", textTransform: "uppercase", color: DS.colors.textPrimary, margin: "8px 0" };
  const sur = { fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: ac };

  useEffect(() => {
    if (etape !== 2) return;
    const t = setTimeout(() => setEtape(3), PLAN_FIN);
    return () => clearTimeout(t);
  }, [etape]);

  const cadre = { minHeight: "100dvh", maxWidth: 430, margin: "0 auto", background: DS.colors.bg, position: "relative", isolation: "isolate", overflowX: "clip", display: "flex", flexDirection: "column", padding: `${hautSur(48)} 22px calc(24px + env(safe-area-inset-bottom, 0px))`, fontFamily: "'Inter',sans-serif", color: DS.colors.textPrimary };

  if (etape === 0) return (
    <div key="objectif" style={cadre}>
      <Bloom echelle={0.9} />
      {edition && <button onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>}
      <p className="v-in" style={sur}>Ton objectif</p>
      <h1 className="v-in" style={{ ...titre, "--i": 1 }}>Qu'est-ce que<br />tu <span style={{ color: ac }}>prépares ?</span></h1>
      <p className="v-in" style={{ "--i": 2, color: DS.colors.textSec, fontSize: 15, lineHeight: 1.45 }}>Tout ton plan sera construit pour ce moment-là.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {Object.entries(CIBLES).map(([k, g], i) => {
          const on = type === k;
          return (
            <button key={k} className={`v-in v-cible ${on ? "on" : ""}`} onClick={() => setType(k)} style={{ "--i": i + 3, background: DS.colors.surface, border: `2px solid ${on ? DS.colors.primary : "transparent"}`, boxShadow: DS.shadow.card, color: DS.colors.textPrimary }}>
              <span className="v-cible-ic" style={{ background: on ? DS.colors.primary : DS.colors.surfaceHigh }}>{g.ic}</span>
              <span style={{ position: "relative", textAlign: "left" }}>
                <b style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{g.t}</b>
                <span style={{ fontSize: 13, color: DS.colors.textSec }}>{g.s}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 18 }} />
      <PrimaryButton onClick={() => setEtape(1)} style={{ height: 58 }}>Continuer →</PrimaryButton>
    </div>
  );

  if (etape === 1) {
    const pct = ((jours - 7) / 293) * 100;
    return (
      <div key="date" style={cadre}>
        <Bloom />
        <button onClick={() => setEtape(0)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>
        <p className="v-in" style={sur}>{c.ic} {c.t}</p>
        <h1 className="v-in" style={{ ...titre, "--i": 1 }}>C'est pour <span style={{ color: ac }}>quand ?</span></h1>
        <div className="v-in" style={{ "--i": 2, textAlign: "center", marginTop: 18 }}>
          <div style={{ fontSize: 104, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.95, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 44, color: ac, marginRight: 2, letterSpacing: "-0.03em" }}>J-</span>{jours}
          </div>
          <p className="v-premiere" style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{dateLocale(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p style={{ fontSize: 14, color: DS.colors.textSec, marginTop: 2 }}>{semaines} semaine{semaines > 1 ? "s" : ""} pour te préparer</p>
        </div>
        <input className="v-range v-in" type="range" min="7" max="300" step="1" value={jours} aria-label="Date de ton objectif"
          onChange={e => setJours(+e.target.value)}
          style={{ "--i": 3, "--p": `${pct}%`, "--fond": DS.colors.surfaceHigh, "--bord": DS.colors.surface }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DS.colors.textDim, fontWeight: 600, marginTop: -4 }}><span>1 sem.</span><span>10 mois</span></div>
        <div className="v-in" style={{ "--i": 4, display: "flex", gap: 4, marginTop: 22, height: 54 }}>
          {phases.map(p => (
            <div key={p.n} style={{ flex: `${p.w} 1 0`, background: p.c, borderRadius: 12, padding: "7px 8px", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", color: "#0B0B0C", fontSize: 11, fontWeight: 800, transition: "flex-grow 260ms var(--ease-out)" }}>
              {p.w >= 2 && p.n}
              {p.w >= 2 && <span style={{ display: "block", fontWeight: 600, opacity: 0.65, marginTop: 2, fontSize: 10 }}>{p.w} sem.</span>}
            </div>
          ))}
        </div>
        <button onClick={() => { setJours(84); setOuvert(true); setEtape(2); }} style={{ marginTop: 12, padding: 10, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Je n'ai pas encore de date</button>
        <div style={{ flex: 1, minHeight: 18 }} />
        <PrimaryButton onClick={() => { setOuvert(false); setEtape(2); }} style={{ height: 58 }}>Construire mon plan →</PrimaryButton>
      </div>
    );
  }

  if (etape === 2) return (
    <div key="construction" style={cadre}>
      <Bloom echelle={0.8} />
      <ConstructionPlan phases={phases} jours={jours} date={date} ouvert={ouvert} ic={ouvert ? "🏁" : c.ic} onClick={() => setEtape(3)} />
    </div>
  );

  let debut = 1;
  return (
    <div key="plan" style={cadre}>
      <Bloom echelle={1.1} />
      <p className="v-in" style={sur}>Ton plan est prêt</p>
      <h1 className="v-in" style={{ ...titre, "--i": 1 }}>{ouvert ? "Prêt dans" : "Prêt pour le"}<br /><span style={{ color: ac }}>{ouvert ? "12 semaines" : dateLongue(date)}</span></h1>
      <p className="v-in" style={{ "--i": 2, color: DS.colors.textSec, fontSize: 15, lineHeight: 1.45 }}>{ouvert ? "Tu pourras ajouter ta date à tout moment : le plan se recalcule." : `Chaque semaine d'ici ${c.fin} a un rôle précis.`}</p>
      <div className="v-in" style={{ "--i": 3, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 }}>
        {[[semaines, "semaines"], [semaines * freq, "séances"], [phases.length, "phases"]].map(([v, l]) => (
          <div key={l} style={{ background: DS.colors.surface, borderRadius: 18, padding: "12px 6px", textAlign: "center", boxShadow: DS.shadow.card }}>
            <b style={{ display: "block", fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{v}</b>
            <span style={{ fontSize: 11, color: DS.colors.textSec }}>{l}</span>
          </div>
        ))}
      </div>
      <div className="v-timeline" style={{ "--fond": DS.colors.surfaceHigh, marginTop: 20 }}>
        {phases.map((p, i) => {
          const a = debut, b = debut + p.w - 1; debut = b + 1;
          return (
            <div key={p.n} className={`v-phase v-in ${i === 0 ? "now" : ""}`} style={{ "--i": i + 5, "--point": DS.colors.surface, "--bord": DS.colors.textDim, "--halo": DS.colors.primarySoft }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: ac, letterSpacing: "0.03em" }}>SEMAINE{p.w > 1 ? "S" : ""} {a === b ? a : `${a} À ${b}`}</span>
              <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>{p.n}</h3>
              <p style={{ fontSize: 13, color: DS.colors.textSec, marginTop: 2 }}>{p.d}</p>
            </div>
          );
        })}
        <div className="v-phase fin v-in" style={{ "--i": phases.length + 5 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, paddingLeft: 2 }}>{ouvert ? "Cap atteint" : dateLongue(date)}</h3>
          <p style={{ fontSize: 13, color: DS.colors.textSec, marginTop: 2, paddingLeft: 2 }}>{ouvert ? "Nouveau test et nouveau plan" : "Jour J : tu arrives prêt"}</p>
        </div>
      </div>
      <p style={{ fontSize: 12, color: DS.colors.textSec, marginBottom: 14, lineHeight: 1.45 }}>Tes premières séances se créent juste après. Les suivantes se génèrent au fur et à mesure, selon tes résultats.</p>
      <PrimaryButton onClick={() => onDone({ type, date, open: ouvert, debut: new Date().toISOString() })} style={{ height: 58 }}>{edition ? "Enregistrer mon plan" : lireInvitation() ? "Continuer →" : "Commencer mes 7 jours gratuits →"}</PrimaryButton>
    </div>
  );
}

// ── Carte du tableau de bord ──
function MissionCard({ cible, onEdit, onBilan }) {
  if (!cible?.date) return (
    <button onClick={onEdit} className="v-mission" style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer" }}>
      <span className="v-mission-lab">🎯 TON OBJECTIF</span>
      <span style={{ display: "block", fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 8, color: "#fff" }}>Fixe ta date</span>
      <span style={{ display: "block", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Ton plan se construit à partir de {motsSport().prochain} ou de ton objectif →</span>
    </button>
  );
  const j = joursAvant(cible.date);
  const c = CIBLES[cible.type] || CIBLES.perso;
  if (j < 0) return (
    <button onClick={onBilan || onEdit} className="v-mission" style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer" }}>
      <span className="v-mission-lab">{c.ic} JOUR J PASSÉ</span>
      <span style={{ display: "block", fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 8, color: "#fff" }}>{onBilan ? "Découvre ton bilan" : "Quel est ton prochain objectif ?"}</span>
      <span style={{ display: "block", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{onBilan ? "Ce que tu as gagné, puis ta prochaine mission →" : "Choisis une nouvelle date pour relancer ton plan →"}</span>
    </button>
  );
  const etat = etatPlan(cible);
  const suivante = etat.phases[etat.index + 1];
  return (
    <div className="v-mission" onClick={onEdit} style={{ cursor: "pointer" }}>
      <div className="v-mission-lab">{c.ic} {cible.open ? "TON CAP" : "TON OBJECTIF"}</div>
      <div style={{ fontSize: 66, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums", color: "#fff" }}>
        <span style={{ fontSize: 28, color: "#9BE84F", marginRight: 2 }}>J-</span>{j}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: "#fff" }}>{cible.open ? `${etat.total} semaines de préparation` : `${c.t} · ${dateLongue(cible.date)}`}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
        {etat.phases.map((p, i) => (
          <div key={p.n} style={{ flex: `${p.w} 1 0`, height: 8, borderRadius: 99, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div className="v-barre" style={{ height: "100%", width: "100%", background: "#9BE84F", borderRadius: 99, transform: `translateX(${i < etat.index ? 0 : i === etat.index ? (etat.dansPhase * 100 - 100) : -100}%)` }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8, color: "rgba(255,255,255,0.65)" }}>
        <span><b style={{ color: "#fff" }}>{etat.phases[etat.index].n}</b> · semaine {etat.semaine} sur {etat.total}</span>
        {suivante && <span>{suivante.n} →</span>}
      </div>
    </div>
  );
}

// ── Après la compétition et semaine différente : réponses gardées sur ce téléphone ──
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lireLocal = (cle) => { try { return JSON.parse(localStorage.getItem(cle) || "null"); } catch { return null; } };
const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch {} };
const cleSemaine = (d = new Date()) => { const l = new Date(d); l.setHours(12, 0, 0, 0); l.setDate(l.getDate() - ((l.getDay() + 6) % 7)); return `voltra_semaine_${isoDe(l)}`; };
const cleApresCompet = (iso) => `voltra_apres_${iso}`;

// La dernière compétition date d'hier ou d'avant-hier (jour habituel ou objectif daté)
function derniereCompet(rythme, cible) {
  for (let i = 1; i <= 2; i++) {
    const d = new Date(Date.now() - i * JOUR_MS);
    const iso = isoDe(d);
    const habituel = rythme?.match === d.getDay() && !lireLocal(cleSemaine(d))?.sansCompet;
    if (habituel || (cible?.type === "match" && cible.date === iso)) return { iso, jours: i };
  }
  return null;
}

function choixApresCompet(m) {
  if (m.nom === "combat") return [{ id: "plein", ic: "🔥", t: "Combat complet" }, { id: "peu", ic: "⏱️", t: "Combat court" }, { id: "rien", ic: "🪑", t: "Pas combattu" }];
  if (m.nom === "course") return [{ id: "plein", ic: "🔥", t: "Oui, à fond" }, { id: "peu", ic: "⏱️", t: "Course courte ou abandon" }, { id: "rien", ic: "🪑", t: "Pas couru" }];
  return [{ id: "plein", ic: "🔥", t: "Presque tout le match" }, { id: "peu", ic: "⏱️", t: "Un peu" }, { id: "rien", ic: "🪑", t: "Je n'ai pas joué" }];
}

// Le remplaçant qui n'a pas joué fait l'effort du match à la fin de sa séance
function blocCompensation(sport) {
  const base = { id: "compensation", materiel: "cardio", muscles: "", chargeKg: 0 };
  if (sport === "combat") return { ...base, nom: "Rounds de compensation (shadow ou sac)", sets: 4, travailSec: 180, reposSec: 60, reps: "3 min", intensite: "Rythme de combat", conseil: "Tu n'as pas combattu : ces rounds remplacent l'effort du combat." };
  if (sport === "natation") return { ...base, nom: "Fractionné de compensation 30/30 (corde ou rameur)", sets: 10, travailSec: 30, reposSec: 30, reps: "30 s", intensite: "Rythme de course", conseil: "Tu n'as pas nagé : ce bloc garde ton cardio." };
  if (sport === "sprint") return { ...base, nom: "Accélérations de compensation", sets: 6, travailSec: 10, reposSec: 60, reps: "10 s", intensite: "Vite, presque à fond", conseil: "Tu n'as pas couru : ces efforts courts gardent ta vitesse." };
  return { ...base, nom: "Fractionné de compensation 15/15", sets: 16, travailSec: 15, reposSec: 15, reps: "15 s", intensite: "Vite, comme pendant un match", conseil: "Tu n'as pas joué : ce bloc remplace l'effort du match." };
}

// Ce que la réponse change à la séance : allégée après un gros effort, bloc en plus sans temps de jeu
function adaptationApresCompet(rythme, cible) {
  const der = derniereCompet(rythme, cible);
  const rep = der && lireLocal(cleApresCompet(der.iso));
  const m = motsSport();
  if (rep === "plein") return { iso: der.iso, charge: 0.75, setsMoins: 1, allegee: true, note: `${m.Nom} à fond ${der.jours === 1 ? "hier" : "avant-hier"} : séance allégée pour bien récupérer.` };
  if (rep === "rien") return { iso: der.iso, compensation: true, note: `Pas de temps de ${m.nom === "match" ? "jeu" : m.nom} pour toi : séance complète, avec un bloc de compensation à la fin.` };
  return null;
}

const SEMAINE_CHARGEE = { charge: 0.85, setsMoins: 1, allegee: true, note: "Semaine chargée : charges -15 % et 1 série de moins. Tes prochaines séances ne baissent pas." };
const plusLeger = (a, b) => !a ? b : !b ? a : b.charge < a.charge ? b : a;

function ApresCompetCard({ rythme, cible, sport }) {
  const der = derniereCompet(rythme, cible);
  const [rep, setRep] = useState(() => der && lireLocal(cleApresCompet(der.iso)));
  const [juste, setJuste] = useState(false);
  if (!der || (rep && !juste)) return null;
  const m = motsSport(sport);
  const quand = der.jours === 1 ? "d'hier" : "d'avant-hier";
  const question = m.nom === "combat" ? `Ton combat ${quand} : tu as combattu ?` : m.nom === "course" ? `Ta course ${quand} : tu as couru ?` : `Ton match ${quand} : tu as joué combien ?`;
  const choisir = (id) => { ecrireLocal(cleApresCompet(der.iso), id); setRep(id); setJuste(true); };
  const reponses = { plein: "Ta prochaine séance sera allégée pour bien récupérer.", peu: "Ta prochaine séance reste normale.", rien: "Ta prochaine séance sera complète, avec un bloc de compensation à la fin." };
  return (
    <div style={{ marginBottom: 16, padding: 16, borderRadius: 20, background: DS.colors.surface, boxShadow: DS.shadow.card, fontFamily: "'Inter',sans-serif" }}>
      <p style={{ fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary, margin: 0 }}>🏆 {question}</p>
      {rep ? (
        <p style={{ fontSize: 13, color: DS.colors.textSec, margin: "8px 0 0", lineHeight: 1.45 }}>✓ Noté. {reponses[rep]}</p>
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {choixApresCompet(m).map(c => (
            <button key={c.id} onClick={() => choisir(c.id)} style={{ flex: 1, padding: "10px 4px", borderRadius: 14, border: `1px solid ${DS.colors.border}`, background: DS.colors.surfaceHigh, color: DS.colors.textPrimary, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
              <span style={{ display: "block", fontSize: 18, marginBottom: 4 }}>{c.ic}</span>{c.t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Séance de dépannage : générée tout de suite avec le matériel dispo maintenant ──
const MATERIEL_DEPANNAGE = [
  { id: "rien", l: "Rien", ic: "🙌" },
  { id: "elastique", l: "Élastique", ic: "🪢" },
  { id: "halteres", l: "Haltères", ic: "🏋️" },
  { id: "kettlebell", l: "Kettlebell", ic: "🔔" },
  { id: "corde a sauter", l: "Corde à sauter", ic: "➰" },
  { id: "barre de traction", l: "Barre de traction", ic: "🪜" },
  { id: "banc ou chaise", l: "Banc ou chaise", ic: "🪑" },
  { id: "espace pour courir", l: "De la place pour courir", ic: "🏃" },
  { id: "salle", l: "Salle complète", ic: "🏟️" },
];
const MATERIEL_DEPANNAGE_SPORT = {
  combat: [{ id: "sac de frappe", l: "Sac de frappe", ic: "🥊" }],
  football: [{ id: "ballon", l: "Ballon", ic: "⚽" }, { id: "plots", l: "Plots", ic: "🔺" }],
  basketball: [{ id: "ballon et panier", l: "Ballon et panier", ic: "🏀" }],
  rugby: [{ id: "ballon", l: "Ballon", ic: "🏉" }],
  tennis: [{ id: "raquette et balles", l: "Raquette et balles", ic: "🎾" }],
  sprint: [{ id: "piste", l: "Piste", ic: "🏟️" }],
};

async function genererDepannage(corps) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Pas de session");
  const res = await appelerFonction("generate-program", session.access_token, { mode: "depannage", ...corps });
  const data = await res.json();
  if (!res.ok || !data.seance) throw new Error(data.error || "Erreur");
  return data.seance;
}

// Écran plein pendant que l'IA écrit la séance de dépannage (≈ 20 s)
function DepannageChargement({ sport, materiel, duree, type }) {
  const theme = getSportTheme(sport);
  const ac = accentLisible(theme.accent);
  const [t, setT] = useState(0);
  useEffect(() => { const d = Date.now(); const i = setInterval(() => setT((Date.now() - d) / 1000), 200); return () => clearInterval(i); }, []);
  // Avance vite au début puis ralentit : ne touche jamais 100 % avant la vraie réponse
  const pct = Math.round(96 * (1 - Math.exp(-t / 8)));
  const nomType = type && TYPES_SEANCE[type] ? TYPES_SEANCE[type].l.toLowerCase() : null;
  const etapes = [
    { ic: "🧰", txt: materiel.length ? `Matériel pris en compte : ${materiel.map(m => m.l.toLowerCase()).join(", ")}` : "Séance sans matériel", a: 0 },
    { ic: "🎯", txt: nomType ? `Séance ${nomType} de ${duree} min` : `Ace choisit le meilleur type de séance pour ${duree} min`, a: 2.5 },
    { ic: "🔥", txt: "Échauffement spécifique à ton sport", a: 6 },
    { ic: "💪", txt: "Choix des exercices et des charges", a: 10 },
    { ic: "🧘", txt: "Retour au calme", a: 15 },
  ];
  const actif = etapes.reduce((n, e, i) => (t >= e.a ? i : n), 0);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: DS.colors.bg, isolation: "isolate", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", fontFamily: "'Inter',sans-serif", animation: "vScaleIn 260ms var(--ease-out)" }}>
      <Bloom echelle={0.8} />
      <div style={{ position: "absolute", top: -20, right: -30, fontSize: 200, opacity: 0.05, pointerEvents: "none", lineHeight: 1, transform: "rotate(-15deg)" }}>{SPORT_EMOJIS[sport] || "⚡"}</div>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 390 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 18px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${theme.accent}30`, borderTopColor: theme.accent, animation: "spin 1.1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, animation: "vGlow 1.6s ease-out infinite" }}>🧰</div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: ac, letterSpacing: "0.08em", margin: "0 0 8px" }}>SÉANCE DE DÉPANNAGE</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: DS.colors.textPrimary, lineHeight: 1.1, margin: 0 }}>Ace prépare<br />ta séance</h1>
          <p style={{ fontSize: 13, color: DS.colors.textSec, margin: "10px 0 0" }}>Environ 20 secondes, reste sur cet écran.</p>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: DS.colors.textSec, margin: 0 }}>Création en cours</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: ac, margin: 0, fontVariantNumeric: "tabular-nums" }}>{pct} %</p>
          </div>
          <div style={{ background: DS.colors.surface, borderRadius: 9999, height: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", transform: `translateX(${pct - 100}%)`, background: theme.accent, borderRadius: 9999, transition: "transform 400ms linear", boxShadow: `0 0 12px ${theme.accent}80` }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {etapes.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14, background: i === actif ? `color-mix(in srgb, ${theme.accent} 14%, ${DS.colors.surface})` : DS.colors.surface, border: `1px solid ${i <= actif ? theme.accent + "40" : DS.colors.border}`, opacity: i > actif ? 0.4 : 1, transition: "background 300ms ease, opacity 300ms ease, border-color 300ms ease" }}>
              <span style={{ fontSize: 16, filter: i > actif ? "grayscale(1)" : "none" }}>{e.ic}</span>
              <p style={{ fontSize: 13, color: DS.colors.textPrimary, fontWeight: i === actif ? 700 : 500, flex: 1, margin: 0, lineHeight: 1.35 }}>{e.txt}</p>
              {i < actif && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: "pop 0.35s var(--ease-spring)" }}><circle cx="12" cy="12" r="11" fill={theme.accent} /><path d="M7 12.5L10.5 16L17 8" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {i === actif && <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${theme.accent}`, borderTopColor: "transparent", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DepannageSheet({ sport, progData, user, onClose, onSeance }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const options = [...MATERIEL_DEPANNAGE, ...(MATERIEL_DEPANNAGE_SPORT[sport] || [])];
  // Part du matériel déjà déclaré à la maison ou dehors
  const [materiel, setMateriel] = useState(() => { const deja = (progData?.materiel || []).filter(m => options.some(o => o.id === m)); return deja.length ? deja : ["rien"]; });
  const [duree, setDuree] = useState(30);
  const [type, setType] = useState("auto");
  const [etat, setEtat] = useState("");
  const basculer = (id) => setMateriel(l => id === "rien" ? ["rien"] : l.includes(id) ? (l.filter(x => x !== id).length ? l.filter(x => x !== id) : ["rien"]) : [...l.filter(x => x !== "rien"), id]);
  const puce = (on) => ({ padding: "9px 12px", borderRadius: 999, border: `1px solid ${on ? ac : DS.colors.border}`, background: on ? DS.colors.primarySoft : DS.colors.surface, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" });
  const titre = { fontSize: 13, fontWeight: 700, color: DS.colors.textSec, textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 10px" };
  const generer = async () => {
    setEtat("charge");
    try {
      const meta = user?.user_metadata?.onboarding || {};
      const seance = await genererDepannage({
        sport, poste: progData?.poste, niveau: progData?.niveau || meta.niveau, objectif: progData?.objectif || meta.objectif, douleurs: progData?.douleurs,
        poids: meta.poids, age: meta.age, taille: meta.taille,
        materiel: materiel.filter(x => x !== "rien"), chargeMaison: progData?.chargeMaison, duree, type: type === "auto" ? null : type,
      });
      onSeance(seance);
    } catch (e) {
      setEtat(String(e?.message || "").includes("abonnés") ? "pro" : "erreur");
    }
  };
  if (etat === "charge") return <DepannageChargement sport={sport} materiel={options.filter(o => o.id !== "rien" && materiel.includes(o.id))} duree={duree} type={type === "auto" ? null : type} />;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", background: DS.colors.bg, borderRadius: "24px 24px 0 0", padding: "22px 18px calc(18px + env(safe-area-inset-bottom, 0px))", fontFamily: "'Inter',sans-serif", color: DS.colors.textPrimary }}>
        <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>🧰 Séance de dépannage</p>
        <p style={{ fontSize: 14, color: DS.colors.textSec, margin: "6px 0 0", lineHeight: 1.45 }}>Une séance de ton sport, tout de suite, avec ce que tu as sous la main.</p>
        <p style={titre}>Ton matériel maintenant</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options.map(o => <button key={o.id} onClick={() => basculer(o.id)} style={puce(materiel.includes(o.id))}>{o.ic} {o.l}</button>)}
        </div>
        <p style={titre}>Ton temps</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[20, 30, 45].map(d => <button key={d} onClick={() => setDuree(d)} style={{ ...puce(duree === d), flex: 1 }}>{d} min</button>)}
        </div>
        <p style={titre}>Type de séance</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setType("auto")} style={puce(type === "auto")}>✨ Au choix d'Ace</button>
          {Object.entries(TYPES_SEANCE).map(([id, t]) => <button key={id} onClick={() => setType(id)} style={puce(type === id)}>{t.ic} {t.l}</button>)}
        </div>
        {etat === "erreur" && <p style={{ fontSize: 13, color: DS.colors.warning, marginTop: 14 }}>La séance n'a pas pu être créée. Réessaie.</p>}
        {etat === "pro" && <p style={{ fontSize: 13, color: DS.colors.textSec, marginTop: 14 }}>La séance de dépannage est réservée à l'offre payante.</p>}
        <PrimaryButton onClick={generer} disabled={etat === "charge"} style={{ height: 56, marginTop: 22 }}>Créer ma séance →</PrimaryButton>
        <button onClick={onClose} disabled={etat === "charge"} style={{ width: "100%", marginTop: 8, padding: 12, background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Annuler</button>
      </div>
    </div>
  );
}

// ── Semaine réelle, réorganisée autour des matchs ──
function SemaineCard({ jours, matchs, cible, onAjouterMatch, rythme: rythmeProgramme, seances, onDepannage }) {
  // « Cette semaine est différente » : pas de compétition, pas de club, ou semaine chargée
  const [semaine, setSemaine] = useState(() => lireLocal(cleSemaine()) || {});
  const [modifier, setModifier] = useState(false);
  const basculer = (k) => { const n = { ...semaine, [k]: !semaine[k] }; setSemaine(n); ecrireLocal(cleSemaine(), n); };
  const rythme = { ...rythmeProgramme, match: semaine.sansCompet ? null : rythmeProgramme?.match, club: semaine.clubAnnule ? [] : rythmeProgramme?.club };
  const m = motsSport();
  const lundi = new Date(); lundi.setHours(12, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const matchsDates = datesDeMatch(matchs, cible);
  const auj = (new Date().getDay() + 6) % 7;
  // La séance i tombe sur le i-ème jour Voltra de la semaine (lundi d'abord)
  const joursTries = [...(jours || [])].sort((a, b) => (a + 6) % 7 - (b + 6) % 7);
  const seanceDuJour = (d) => (seances || []).find(se => se.jourSemaine === d) || (seances?.some(se => se.jourSemaine != null) ? null : seances?.[joursTries.indexOf(d)]);
  const cases = ["L", "M", "M", "J", "V", "S", "D"].map((l, i) => {
    const d = new Date(lundi.getTime() + i * JOUR_MS);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const club = rythme?.club?.includes(d.getDay());
    if (matchsDates.includes(iso) || rythme?.match === d.getDay()) return { l, ic: "🏆", t: motsSport().Nom.toUpperCase(), match: true };
    const prevu = (jours || []).includes(d.getDay());
    const ad = adaptationDuJour(matchs, cible, i - auj);
    if (ad?.label === "Récup") return { l, ic: ad.ic, t: ad.label, club };
    if (ad?.label === "Repos") return { l, ic: ad.ic, t: ad.label, club };
    const type = prevu ? typeSeance(seanceDuJour(d.getDay())) : null;
    if (prevu) return { l, ic: type?.ic || ad?.ic || "💪", t: ad?.label || type?.l || "Séance", c: type?.c, club };
    if (club) return { l, ic: "🏟️", t: "Club" };
    return { l, ic: "·", t: "" };
  });
  const note = adaptationDuJour(matchs, cible, 0)?.note;
  return (
    <div style={{ marginBottom: 16, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary }}>Ta semaine</p>
        <button onClick={onAjouterMatch} style={{ background: "none", border: "none", color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Ajouter {motsSport().un}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
        {cases.map((c, i) => (
          <div key={i} style={{ borderRadius: 14, padding: "8px 2px", minHeight: 74, textAlign: "center", background: c.match ? "#FF8C00" : c.c ? `color-mix(in srgb, ${c.c} 22%, ${DS.colors.surface})` : DS.colors.surface, boxShadow: DS.shadow.card, outline: i === auj ? `2px solid ${DS.colors.primary}` : "none" }}>
            <b style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.match ? "#1A0E00" : DS.colors.textSec }}>{c.l}</b>
            <span style={{ display: "block", fontSize: 18, margin: "4px 0 2px", color: DS.colors.textDim }}>{c.ic}</span>
            <span style={{ display: "block", fontSize: 9.5, fontWeight: 700, lineHeight: 1.15, color: c.match ? "#1A0E00" : c.c ? DS.colors.textPrimary : DS.colors.textSec }}>{c.t}</span>
            {c.club && <span style={{ display: "block", fontSize: 8.5, fontWeight: 700, marginTop: 2, color: DS.colors.textSec }}>+ club</span>}
          </div>
        ))}
      </div>
      {semaine.chargee && <p style={{ fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary, marginTop: 10 }}>🔋 Semaine chargée : séances allégées</p>}
      {note && <p style={{ fontSize: 13, color: DS.colors.textSec, marginTop: 10, lineHeight: 1.45 }}>{note}</p>}
      <button onClick={() => setModifier(o => !o)} style={{ marginTop: 12, padding: 0, background: "none", border: "none", color: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>{modifier ? "Fermer" : "Cette semaine est différente ?"}</button>
      {modifier && (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 18, background: DS.colors.surface, boxShadow: DS.shadow.card }}>
          {[
            rythmeProgramme?.match != null && ["sansCompet", `Pas de ${m.nom} cette semaine`],
            rythmeProgramme?.club?.length > 0 && ["clubAnnule", "Pas d'entraînement au club"],
            ["chargee", "Semaine chargée"],
          ].filter(Boolean).map(([k, l]) => (
            <button key={k} onClick={() => basculer(k)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600 }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: semaine[k] ? (DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark) : DS.colors.surfaceHigh, color: "#000", fontSize: 13, fontWeight: 900 }}>{semaine[k] ? "✓" : ""}</span>{l}
            </button>
          ))}
          <p style={{ fontSize: 12, color: DS.colors.textSec, margin: "6px 0 0", lineHeight: 1.45 }}>Valable jusqu'à dimanche.</p>
          {(semaine.sansCompet || semaine.clubAnnule) && onDepannage && <button onClick={onDepannage} style={{ marginTop: 10, padding: "10px 16px", borderRadius: 999, border: "none", background: DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark, color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>🧰 Séance de dépannage</button>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TEST DU MOIS
// ─────────────────────────────────────────────
// Tests physiques : chaque sport a les siens. chrono = affiché en minutes:secondes.
// detente_cm, sprint_20m et pompes ont aussi leur colonne (anciens tests), les autres vivent dans « mesures ».
const TESTS_CATALOGUE = {
  detente_cm: { t: "Détente verticale", d: "Touche le mur au plus haut, 3 essais", u: "cm", pas: 1, depart: 40, mieux: 1, dec: 0 },
  sprint_20m: { t: "Sprint 20 m", d: "Départ arrêté, meilleur temps", u: "s", pas: 0.01, depart: 3.5, mieux: -1, dec: 2 },
  sprint_30m: { t: "Sprint 30 m", d: "Départ arrêté, meilleur de 2 essais", u: "s", pas: 0.01, depart: 4.6, mieux: -1, dec: 2 },
  pompes: { t: "Pompes en 1 minute", d: "Corps gainé, poitrine près du sol", u: "", pas: 1, depart: 20, mieux: 1, dec: 0 },
  vma_kmh: { t: "VMA", d: "Test navette Luc Léger : vitesse du dernier palier tenu", u: "km/h", pas: 0.5, depart: 13, mieux: 1, dec: 1 },
  t_test: { t: "Test T (agilité)", d: "En avant, à gauche, à droite, retour : chrono", u: "s", pas: 0.1, depart: 11, mieux: -1, dec: 1 },
  navette_5105: { t: "Navette 5-10-5", d: "5 m d'un côté, 10 m de l'autre, 5 m retour", u: "s", pas: 0.01, depart: 5.3, mieux: -1, dec: 2 },
  saut_longueur_cm: { t: "Saut en longueur sans élan", d: "Pieds joints, meilleur de 3 essais", u: "cm", pas: 1, depart: 210, mieux: 1, dec: 0 },
  nage_50m: { t: "50 m nage libre", d: "Chronométré, départ plongé ou dans l'eau", u: "s", pas: 0.5, depart: 40, mieux: -1, dec: 1 },
  nage_400m: { t: "400 m nage libre", d: "Chronométré, allure régulière", u: "s", pas: 1, depart: 420, mieux: -1, dec: 0, chrono: true },
  gainage_s: { t: "Gainage planche", d: "Sur les avant-bras, le plus longtemps possible", u: "s", pas: 5, depart: 60, mieux: 1, dec: 0, chrono: true },
  burpees: { t: "Burpees en 1 minute", d: "Poitrine au sol, saut bras en l'air", u: "", pas: 1, depart: 15, mieux: 1, dec: 0 },
  corde_temps: { t: "Corde à sauter non-stop", d: "Rythme de boxeur, chrono arrêté à la première faute", u: "s", pas: 5, depart: 120, mieux: 1, dec: 0, chrono: true },
  sac_coups_30s: { t: "Coups au sac en 30 s", d: "Jab-direct à fond, compte avec une vidéo", u: "", pas: 1, depart: 60, mieux: 1, dec: 0 },
  sac_rounds: { t: "Rounds de sac à fond", d: "Rounds de 3 min, 1 min de repos : combien tu en tiens à bonne intensité", u: "", pas: 1, depart: 3, mieux: 1, dec: 0 },
  sprawls_1min: { t: "Sprawls en 1 minute", d: "Hanches au sol, retour en garde", u: "", pas: 1, depart: 20, mieux: 1, dec: 0 },
  uchikomi_30s: { t: "Uchi-komi en 30 s", d: "À l'élastique ou avec un partenaire, entrée complète", u: "", pas: 1, depart: 20, mieux: 1, dec: 0 },
  suspension_serviette: { t: "Suspension à la serviette", d: "Deux serviettes sur la barre, bras tendus", u: "s", pas: 5, depart: 30, mieux: 1, dec: 0, chrono: true },
  bronco: { t: "Bronco test", d: "5 allers-retours 20, 40 et 60 m d'affilée (1 200 m)", u: "s", pas: 1, depart: 330, mieux: -1, dec: 0, chrono: true },
};
const TESTS_PAR_SPORT = {
  basketball: ["detente_cm", "sprint_20m", "t_test"],
  football: ["sprint_20m", "vma_kmh", "detente_cm"],
  tennis: ["navette_5105", "detente_cm", "vma_kmh"],
  rugby: ["sprint_20m", "bronco", "pompes"],
  natation: ["nage_50m", "nage_400m", "gainage_s"],
  sprint: ["sprint_30m", "saut_longueur_cm", "detente_cm"],
  combat: ["burpees", "pompes", "gainage_s"],
};
const COLONNES_TEST = ["detente_cm", "sprint_20m", "pompes"];
// Sports de combat : chaque discipline a ses propres tests
const TESTS_PAR_DISCIPLINE = {
  boxe_anglaise: ["corde_temps", "sac_coups_30s", "sac_rounds"],
  boxe_francaise: ["corde_temps", "sac_coups_30s", "sac_rounds"],
  boxe_thai: ["corde_temps", "sac_rounds", "sac_coups_30s"],
  mma: ["sac_rounds", "sprawls_1min", "corde_temps"],
  judo: ["uchikomi_30s", "suspension_serviette", "burpees"],
  jiu_jitsu: ["suspension_serviette", "sprawls_1min", "gainage_s"],
};
let POSTE_COURANT = null;
const testsDuSport = (sport, poste = POSTE_COURANT) => ((sport === "combat" && TESTS_PAR_DISCIPLINE[poste]) || TESTS_PAR_SPORT[sport] || ["detente_cm", "sprint_20m", "pompes"]).map(k => ({ k, ...TESTS_CATALOGUE[k] }));
const virgule = (n, dec = 0) => Number(n).toFixed(dec).replace(".", ",");
const INTERVALLE_TEST = 28;

// Pour chaque test : le premier et le dernier résultat (les tests passés d'un autre sport restent visibles)
function comparables(liste, tests) {
  const avec = (k) => (tests || []).filter(r => r[k] != null && !Number.isNaN(Number(r[k])));
  const autres = Object.keys(TESTS_CATALOGUE).filter(k => !liste.some(t => t.k === k) && avec(k).length > 0).map(k => ({ k, ...TESTS_CATALOGUE[k] }));
  return [...liste, ...autres].map(t => { const l = avec(t.k); return { t, a: l[0], b: l[l.length - 1], n: l.length }; }).filter(c => c.n > 0);
}

function useTests(user, sport) {
  const [tests, setTests] = useState(null);
  const charger = async () => {
    if (!user?.id) return setTests([]);
    const { data } = await supabase.from("tests_performance").select("*").eq("user_id", user.id).order("date_test", { ascending: true });
    // Les mesures rangées dans « mesures » se lisent comme les anciennes colonnes
    setTests((data || []).map(r => ({ ...r, ...(r.mesures || {}) })));
  };
  useEffect(() => { charger(); }, [user?.id]);
  return { tests, charger, liste: testsDuSport(sport) };
}

function TestCard({ tests, onOpen }) {
  const dernier = tests?.[tests.length - 1];
  const prochain = dernier ? new Date(new Date(`${dernier.date_test}T12:00:00`).getTime() + INTERVALLE_TEST * JOUR_MS) : null;
  const pret = !dernier || prochain <= new Date();
  return (
    <button onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 16, padding: 14, borderRadius: 20, background: DS.colors.surface, boxShadow: DS.shadow.card, border: pret ? `2px solid ${DS.colors.primary}` : "2px solid transparent", textAlign: "left", cursor: "pointer", color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
      <span style={{ fontSize: 22 }}>📊</span>
      <span style={{ flex: 1 }}>
        <b style={{ display: "block", fontSize: 14 }}>{!dernier ? "Fais ton test de départ" : pret ? "C'est l'heure de ton test du mois" : "Tes tests de performance"}</b>
        <span style={{ fontSize: 12, color: DS.colors.textSec }}>{!dernier ? "Pour mesurer tes progrès dès le début" : pret ? "Regarde combien tu as progressé" : `Prochain test le ${prochain.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}</span>
      </span>
      <span style={{ color: DS.colors.textSec }}>›</span>
    </button>
  );
}

function TestScreen({ user, tests, liste, onSaved, onBack, onCarrousel }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const dernier = tests?.[tests.length - 1];
  const prochain = dernier ? new Date(new Date(`${dernier.date_test}T12:00:00`).getTime() + INTERVALLE_TEST * JOUR_MS) : null;
  const trop_tot = prochain && prochain > new Date();
  const [valeurs, setValeurs] = useState(() => Object.fromEntries(liste.map(t => [t.k, dernier?.[t.k] != null ? Number(dernier[t.k]) : t.depart])));
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async () => {
    setSaving(true); setErreur("");
    // Tout va dans « mesures » ; détente, sprint 20 m et pompes gardent aussi leur colonne
    const colonnes = Object.fromEntries(COLONNES_TEST.filter(k => valeurs[k] != null).map(k => [k, valeurs[k]]));
    const { error } = await supabase.from("tests_performance").insert({ user_id: user.id, date_test: isoDans(0), mesures: valeurs, ...colonnes });
    setSaving(false);
    if (error) { setErreur("Enregistrement impossible. Réessaie."); return; }
    onSaved();
  };

  // Courbe du test principal du sport
  const t0 = liste[0];
  const serie = (tests || []).filter(t => t[t0.k] != null).map(t => Number(t[t0.k])).filter(v => !Number.isNaN(v));
  const min = Math.min(...serie), max = Math.max(...serie);
  const points = serie.map((v, i) => `${serie.length === 1 ? 160 : 6 + i * (308 / (serie.length - 1))} ${max === min ? 35 : t0.mieux > 0 ? 62 - ((v - min) / (max - min)) * 54 : 8 + ((v - min) / (max - min)) * 54}`);

  return (
    <div className="v-plein" style={{ background: DS.colors.bg, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ minHeight: "100dvh", maxWidth: 430, margin: "0 auto", position: "relative", isolation: "isolate", overflowX: "clip", padding: `${hautSur(48)} 22px calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        <Bloom echelle={0.8} />
        <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>
        <p className="v-in" style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: ac }}>{dernier ? "TEST DU MOIS" : "TEST DE DÉPART"}</p>
        <h1 className="v-in" style={{ "--i": 1, fontWeight: 900, fontSize: 32, lineHeight: 1.02, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "8px 0 4px" }}>
          {trop_tot ? <>Tes <span style={{ color: ac }}>progrès</span></> : dernier ? <>Combien tu as<br /><span style={{ color: ac }}>progressé ?</span></> : <>Ton point<br /><span style={{ color: ac }}>de départ</span></>}
        </h1>
        {trop_tot && <p style={{ fontSize: 14, color: DS.colors.textSec, marginBottom: 4 }}>Prochain test le {prochain.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</p>}

        {!trop_tot && liste.map((t, i) => {
          const avant = dernier?.[t.k] != null ? Number(dernier[t.k]) : null;
          const ecart = avant == null ? 0 : +(valeurs[t.k] - avant).toFixed(t.dec);
          const bien = ecart * t.mieux > 0;
          return (
            <div key={t.k} className="v-in" style={{ "--i": i + 2, background: DS.colors.surface, borderRadius: 22, padding: "15px 16px", marginTop: 12, boxShadow: DS.shadow.card }}>
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>{t.t}</h3>
              <p style={{ fontSize: 12, color: DS.colors.textSec, marginTop: 1 }}>{t.d}{avant != null ? ` · le mois dernier : ${valeurTest(t, avant)}` : ""}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <button aria-label="Moins" onClick={() => setValeurs(v => ({ ...v, [t.k]: Math.max(0, +(v[t.k] - t.pas).toFixed(t.dec)) }))} style={{ width: 44, height: 44, borderRadius: "50%", background: DS.colors.surfaceHigh, border: "none", color: DS.colors.textPrimary, fontSize: 22, fontWeight: 700, cursor: "pointer" }}>−</button>
                <b style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{t.chrono && valeurs[t.k] >= 60 ? minSec(valeurs[t.k]) : virgule(valeurs[t.k], t.dec)}<small style={{ fontSize: 15, color: DS.colors.textSec, fontWeight: 600, marginLeft: 3 }}>{t.chrono && valeurs[t.k] >= 60 ? "" : t.u}</small></b>
                <button aria-label="Plus" onClick={() => setValeurs(v => ({ ...v, [t.k]: +(v[t.k] + t.pas).toFixed(t.dec) }))} style={{ width: 44, height: 44, borderRadius: "50%", background: DS.colors.surfaceHigh, border: "none", color: DS.colors.textPrimary, fontSize: 22, fontWeight: 700, cursor: "pointer" }}>+</button>
              </div>
              <p style={{ fontSize: 13, fontWeight: 800, textAlign: "center", marginTop: 4, minHeight: 18, color: bien ? ac : DS.colors.textSec }}>{ecart ? `${ecart > 0 ? "+" : ""}${virgule(ecart, t.dec)} ${t.u} depuis le mois dernier` : ""}</p>
            </div>
          );
        })}

        {serie.length >= 2 && (
          <div className="v-in" style={{ "--i": 5, background: DS.colors.surface, borderRadius: 22, padding: "15px 16px", marginTop: 12, boxShadow: DS.shadow.card }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>{t0.t} depuis le début</h3>
            <svg viewBox="0 0 320 70" width="100%" style={{ display: "block", marginTop: 8 }}>
              <path className="v-route" pathLength="1" d={`M ${points.join(" L ")}`} fill="none" stroke="#9BE84F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: DS.colors.textSec, marginTop: 4 }}><span>{valeurTest(t0, serie[0])}</span><span>{valeurTest(t0, serie[serie.length - 1])}</span></div>
          </div>
        )}

        {erreur && <p style={{ color: "#FF2D55", fontSize: 13, textAlign: "center", marginTop: 12 }}>{erreur}</p>}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {!trop_tot && <PrimaryButton onClick={enregistrer} disabled={saving} style={{ height: 58 }}>{saving ? "Enregistrement..." : "Enregistrer mes résultats"}</PrimaryButton>}
          {tests?.length >= 2 && new URLSearchParams(window.location.search).has("carrousel") && <PrimaryButton onClick={onCarrousel} style={{ height: 58 }}>Créer mon carrousel avant / après →</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CARROUSEL AVANT / APRÈS (images 1080 × 1920)
// ─────────────────────────────────────────────
async function dessinerSlide({ surTitre, valeur, ligne, photo, fond, resultat, lignes }) {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1920;
  const x = c.getContext("2d");
  x.fillStyle = fond; x.fillRect(0, 0, 1080, 1920);
  if (photo) {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = photo; });
    const r = Math.max(1080 / img.width, 1920 / img.height);
    x.drawImage(img, (1080 - img.width * r) / 2, (1920 - img.height * r) / 2, img.width * r, img.height * r);
  }
  if (!resultat) {
    const g = x.createLinearGradient(0, 860, 0, 1920);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.88)");
    x.fillStyle = g; x.fillRect(0, 860, 1080, 1060);
  }
  x.fillStyle = "#fff"; x.textAlign = "right"; x.font = "900 40px Inter, sans-serif"; x.fillText("VOLTRA", 1020, 96);
  x.textAlign = resultat ? "center" : "left";
  const px = resultat ? 540 : 60;
  if (resultat) {
    x.fillStyle = "#9BE84F"; x.font = "800 44px Inter, sans-serif"; x.fillText(surTitre, px, 700);
    x.font = "900 210px Inter, sans-serif"; x.fillText(valeur, px, 910);
    x.fillStyle = "#fff"; x.font = "600 50px Inter, sans-serif";
    lignes.forEach((l, i) => x.fillText(l, px, 1030 + i * 70));
    x.font = "800 50px Inter, sans-serif"; x.fillText("Ma prépa physique : Voltra", px, 1350); x.fillText("voltra-app.fr", px, 1420);
  } else {
    x.fillStyle = "#9BE84F"; x.font = "800 44px Inter, sans-serif"; x.fillText(surTitre, px, 1560);
    x.fillStyle = "#fff"; x.font = "900 150px Inter, sans-serif"; x.fillText(valeur, px, 1710);
    x.font = "600 50px Inter, sans-serif"; x.fillText(ligne, px, 1790);
  }
  return new Promise(ok => c.toBlob(ok, "image/png"));
}

function CarrouselScreen({ tests, liste, onBack }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const [photos, setPhotos] = useState([null, null]);
  const [message, setMessage] = useState("");
  // Le test vedette est le premier test du sport mesuré deux fois ; les autres vont sur la dernière image
  const paires = comparables(liste, tests);
  const vedette = paires.find(p => p.n >= 2) || paires[0];
  const { t, a, b } = vedette;
  const sem = semainesEntre(a, b);
  const ecart = (Number(b[t.k]) - Number(a[t.k])) * t.mieux;
  const gainTxt = `${ecart >= 0 ? "+" : "−"}${valeurTest(t, Math.abs(Number(b[t.k]) - Number(a[t.k])))}`;
  const lignes = paires.filter(p => p !== vedette).slice(0, 2).map(p => `${p.t.t} : ${valeurTest(p.t, Number(p.b[p.t.k]))}`);
  const slides = [
    { surTitre: "AVANT", valeur: valeurTest(t, Number(a[t.k])), ligne: `${t.t} au départ`, photo: photos[0], fond: "#262A30" },
    { surTitre: `${sem} SEMAINE${sem > 1 ? "S" : ""} APRÈS`, valeur: valeurTest(t, Number(b[t.k])), ligne: `${t.t} : ${ecart >= 0 ? "mieux" : "à retravailler"}, mesuré`, photo: photos[1], fond: "#27351B" },
    { surTitre: "MA PROGRESSION", valeur: gainTxt, resultat: true, lignes, fond: "#0E1209" },
  ];
  const choisir = (i, e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotos(p => p.map((x, k) => k === i ? URL.createObjectURL(f) : x));
  };
  const enregistrer = async () => {
    setMessage("Préparation des images...");
    try {
      await document.fonts?.ready;
      const fichiers = await Promise.all(slides.map(async (s, i) => new File([await dessinerSlide(s)], `voltra-${i + 1}.png`, { type: "image/png" })));
      if (navigator.canShare?.({ files: fichiers })) {
        await navigator.share({ files: fichiers });
      } else {
        fichiers.forEach(f => { const l = document.createElement("a"); l.href = URL.createObjectURL(f); l.download = f.name; l.click(); });
      }
      setMessage("Tes 3 images sont prêtes.");
    } catch (e) {
      setMessage(e?.name === "AbortError" ? "" : "Impossible de créer les images. Réessaie.");
    }
  };
  return (
    <div className="v-plein" style={{ background: DS.colors.bg, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ minHeight: "100dvh", maxWidth: 430, margin: "0 auto", overflowX: "clip", padding: `${hautSur(48)} 22px calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>
        <p className="v-in" style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: ac }}>PARTAGE TA PROGRESSION</p>
        <h1 className="v-in" style={{ "--i": 1, fontWeight: 900, fontSize: 30, lineHeight: 1.02, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "8px 0" }}>Ton carrousel<br /><span style={{ color: ac }}>TikTok</span></h1>
        <p className="v-in" style={{ "--i": 2, color: DS.colors.textSec, fontSize: 15, lineHeight: 1.45 }}>Ajoute tes photos, les chiffres sont ceux de tes tests. Glisse pour voir les 3 images.</p>
        <div className="v-slides">
          {slides.map((s, i) => (
            <div key={i} className="v-slide" style={{ background: s.fond, justifyContent: s.resultat ? "center" : "flex-end", textAlign: s.resultat ? "center" : "left" }}>
              {!s.resultat && (
                <label className="v-slide-photo" style={{ backgroundImage: photos[i] ? `url(${photos[i]})` : "none" }}>
                  {!photos[i] && "Touche pour ajouter ta photo"}
                  <input type="file" accept="image/*" onChange={e => choisir(i, e)} style={{ display: "none" }} />
                </label>
              )}
              {!s.resultat && <span className="v-slide-degrade" />}
              <span style={{ position: "absolute", top: 16, right: 16, fontSize: 12, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>VOLTRA</span>
              <div style={{ position: "relative", pointerEvents: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", color: "#9BE84F" }}>{s.surTitre}</div>
                <div style={{ fontSize: s.resultat ? 66 : 50, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.02, marginTop: 2, color: s.resultat ? "#9BE84F" : "#fff" }}>{s.valeur}</div>
                {s.ligne && <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: "#fff" }}>{s.ligne}</div>}
                {s.lignes?.map(l => <div key={l} style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: "#fff" }}>{l}</div>)}
                {s.resultat && <div style={{ fontSize: 14, fontWeight: 800, marginTop: 20, color: "#fff" }}>Ma prépa physique : Voltra<br />voltra-app.fr</div>}
              </div>
            </div>
          ))}
        </div>
        <PrimaryButton onClick={enregistrer} style={{ height: 58 }}>Enregistrer les 3 images</PrimaryButton>
        {message && <p style={{ fontSize: 13, color: DS.colors.textSec, textAlign: "center", marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  );
}

function BottomNav({ activeTab, setTab }) {
  const tabs = [
    { id: "dashboard", label: "Aujourd'hui", icon: Icons.home },
    { id: "historique", label: "Progression", icon: Icons.chart },
    { id: "profil", label: "Profil", icon: Icons.user },
  ];
  const idx = Math.max(0, tabs.findIndex(t => t.id === activeTab));
  // Barre flottante façon « pilule », avec un repère qui glisse vers l'onglet choisi
  return (
    <div style={{ position: "fixed", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 100, width: "calc(100% - 32px)", maxWidth: 398, background: DS.colors.navBg, backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, padding: 6, display: "flex", boxShadow: DS.colors.isDark ? "0 12px 40px rgba(0,0,0,0.6)" : "0 12px 36px rgba(0,0,0,0.12)" }}>
      <div style={{ position: "absolute", top: 6, bottom: 6, left: 6, width: `calc((100% - 12px) / ${tabs.length})`, borderRadius: DS.radius.full, background: DS.colors.primarySoft, border: `1px solid ${DS.colors.borderAccent}`, transform: `translateX(${idx * 100}%)`, transition: "transform 240ms var(--ease-out)" }} />
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setTab(tab.id)} style={{ position: "relative", zIndex: 1, flex: 1, height: 52, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <span style={{ display: "flex", transform: isActive ? "translateY(-1px) scale(1.08)" : "none", transition: "transform 200ms var(--ease-out)" }}>{tab.icon(isActive)}</span>
            <span style={{ color: isActive ? DS.colors.textPrimary : DS.colors.textSec, fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: isActive ? 800 : 600, transition: "color 0.2s ease" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// FORME DU JOUR
// ─────────────────────────────────────────────
function FormeDuJour({ onChoix, onFermer }) {
  const [peuDeTemps, setPeuDeTemps] = useState(false);
  const police = { fontFamily: "'Inter',sans-serif", margin: 0 };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, background: DS.colors.surface, borderRadius: "24px 24px 0 0", padding: "22px 16px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <AceAvatar size={36} />
          <p style={{ ...police, flex: 1, fontSize: 19, fontWeight: 800, color: DS.colors.textPrimary }}>Comment tu te sens ?</p>
          <button onClick={onFermer} aria-label="Fermer" style={{ width: 36, height: 36, borderRadius: 18, background: DS.colors.surfaceHigh, border: "none", color: DS.colors.textPrimary, fontSize: 15, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {FORMES.map(f => (
            <button key={f.id} onClick={() => onChoix(f, peuDeTemps)} style={{ minHeight: 104, padding: 12, textAlign: "left", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: 16, cursor: "pointer" }}>
              <span style={{ display: "block", fontSize: 22, marginBottom: 6 }}>{f.ic}</span>
              <span style={{ ...police, display: "block", fontSize: 14, fontWeight: 800, color: DS.colors.textPrimary, marginBottom: 2 }}>{f.t}</span>
              <span style={{ ...police, display: "block", fontSize: 12, lineHeight: 1.3, color: DS.colors.textSec }}>{f.s}</span>
            </button>
          ))}
        </div>
        <button role="switch" aria-checked={peuDeTemps} onClick={() => setPeuDeTemps(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "8px 12px", textAlign: "left", background: "none", border: `1px solid ${peuDeTemps ? DS.colors.primary : DS.colors.border}`, borderRadius: 14, cursor: "pointer" }}>
          <span style={{ fontSize: 18 }}>⏱</span>
          <span style={{ ...police, flex: 1, fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary }}>J'ai peu de temps : moins d'exercices</span>
          <Interrupteur actif={peuDeTemps} />
        </button>
      </div>
    </div>
  );
}

function Interrupteur({ actif }) {
  return (
    <span style={{ width: 42, height: 24, flexShrink: 0, borderRadius: 12, padding: 2, background: actif ? DS.colors.primary : DS.colors.border, transition: "background 160ms var(--ease-out)" }}>
      <span style={{ display: "block", width: 20, height: 20, borderRadius: 10, background: "#fff", transform: `translateX(${actif ? 18 : 0}px)`, transition: "transform 160ms var(--ease-out)" }} />
    </span>
  );
}

// ─────────────────────────────────────────────
// BILANS : ce que l'athlète a vraiment gagné
// ─────────────────────────────────────────────
// Premier poids et meilleur poids de chaque exercice (logs du plus ancien au plus récent)
function progresExercices(logs) {
  const parNom = {};
  for (const log of logs || []) {
    const nom = log.exercices?.nom;
    const kg = Number(log.charge_kg) || 0;
    if (!nom || kg <= 0) continue;
    const e = parNom[nom] || (parNom[nom] = { nom, de: kg, a: kg });
    e.a = Math.max(e.a, kg);
  }
  return Object.values(parNom).filter(e => e.a > e.de).sort((x, y) => (y.a - y.de) - (x.a - x.de));
}

const virguleKg = (n) => String(n).replace(".", ",");
const RESULTATS_MISSION = [
  { id: "atteint", ic: "🏆", t: "Objectif atteint", r: "Bravo, tu l'as fait. Garde cet élan pour la suite." },
  { id: "presque", ic: "🎯", t: "Presque", r: "Tu y étais presque. Tu repars de ce niveau, pas de zéro." },
  { id: "pas_encore", ic: "💪", t: "Pas cette fois", r: "Ça arrive. Tout ce que tu as gagné reste." },
];

function BilanMissionScreen({ user, cible, tests, liste, onBack, onSuivante }) {
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  const c = CIBLES[cible.type] || CIBLES.perso;
  const debut = cible.debut || user.created_at;
  const [donnees, setDonnees] = useState(null);
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    const fin = `${cible.date}T23:59:59`;
    Promise.all([
      supabase.from("seances").select("duree_min").eq("user_id", user.id).eq("statut", "faite").gte("date_realisee", debut).lte("date_realisee", fin),
      supabase.from("logs_performance").select("charge_kg, exercices(nom)").eq("user_id", user.id).gte("logged_at", debut).lte("logged_at", fin).order("logged_at", { ascending: true }).limit(1000),
    ]).then(([seances, logs]) => setDonnees({ seances: seances.data || [], progres: progresExercices(logs.data) }))
      .catch(() => setDonnees({ seances: [], progres: [] }));
  }, []);

  const testsMission = (tests || []).filter(t => t.date_test >= String(debut).slice(0, 10) && t.date_test <= cible.date);
  const premier = testsMission[0];
  const dernier = testsMission.length > 1 ? testsMission[testsMission.length - 1] : null;
  const heures = Math.round((donnees?.seances || []).reduce((total, s) => total + (s.duree_min || 0), 0) / 60);
  const carte = { background: DS.colors.surface, borderRadius: 20, boxShadow: DS.shadow.card, padding: 16, marginBottom: 12 };
  const titreCarte = { fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary, margin: "0 0 10px" };
  const ligne = (cle, nom, valeur, i) => (
    <div key={cle} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: i ? `1px solid ${DS.colors.border}` : "none", fontSize: 13 }}>
      <span style={{ minWidth: 0, color: DS.colors.textPrimary, fontWeight: 600 }}>{nom}</span>
      <span style={{ flexShrink: 0, color: DS.colors.isDark ? ac : DS.colors.textPrimary, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
    </div>
  );

  return (
    <div className="v-plein" style={{ background: DS.colors.bg, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ minHeight: "100dvh", maxWidth: 430, margin: "0 auto", position: "relative", isolation: "isolate", overflowX: "clip", padding: `${hautSur(48)} 16px calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        <Bloom echelle={0.8} />
        <button onClick={onBack} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Retour</button>
        <p style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: ac, margin: 0 }}>{c.ic} BILAN DE MISSION</p>
        <h1 style={{ fontWeight: 900, fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>Mission terminée</h1>
        <p style={{ fontSize: 14, color: DS.colors.textSec, margin: "0 0 18px" }}>{c.t} · {dateLongue(cible.date)}</p>

        {!donnees && <p style={{ fontSize: 13, color: DS.colors.textSec }}>Calcul de ton bilan...</p>}
        {donnees && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[[donnees.seances.length, donnees.seances.length > 1 ? "séances" : "séance"], [heures, heures > 1 ? "heures" : "heure"], [donnees.progres.length, donnees.progres.length > 1 ? "exercices en progrès" : "exercice en progrès"]].map(([val, label]) => (
                <div key={label} style={{ flex: 1, minWidth: 0, background: DS.colors.surface, boxShadow: DS.shadow.card, borderRadius: 16, padding: "14px 6px", textAlign: "center" }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: ac, margin: 0, fontVariantNumeric: "tabular-nums" }}>{val}</p>
                  <p style={{ fontSize: 11, lineHeight: 1.25, color: DS.colors.textSec, margin: "2px 0 0" }}>{label}</p>
                </div>
              ))}
            </div>

            {donnees.progres.length > 0 && (
              <div style={carte}>
                <p style={titreCarte}>Tes charges</p>
                {donnees.progres.slice(0, 5).map((e, i) => ligne(e.nom, e.nom, `${virguleKg(e.de)} → ${virguleKg(e.a)} kg`, i))}
              </div>
            )}

            {dernier && (
              <div style={carte}>
                <p style={titreCarte}>Tes tests</p>
                {comparables(liste, testsMission).filter(c => c.n >= 2).map(({ t, a, b }, i) => ligne(t.k, t.t, `${valeurTest(t, a[t.k])} → ${valeurTest(t, b[t.k])}`, i))}
              </div>
            )}

            {donnees.seances.length === 0 && <p style={{ fontSize: 13, color: DS.colors.textSec, margin: "0 0 12px" }}>Aucune séance enregistrée pendant cette mission. La prochaine peut commencer aujourd'hui.</p>}

            <div style={carte}>
              <p style={titreCarte}>Comment ça s'est passé ?</p>
              <div style={{ display: "flex", gap: 8 }}>
                {RESULTATS_MISSION.map(r => (
                  <button key={r.id} onClick={() => setResultat(r)} aria-pressed={resultat?.id === r.id} style={{ flex: 1, minWidth: 0, minHeight: 76, padding: "10px 4px", background: DS.colors.surfaceHigh, border: `2px solid ${resultat?.id === r.id ? ac : "transparent"}`, borderRadius: 14, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <span style={{ display: "block", fontSize: 20, marginBottom: 4 }}>{r.ic}</span>{r.t}
                  </button>
                ))}
              </div>
              {resultat && <p style={{ fontSize: 13, lineHeight: 1.45, color: DS.colors.textSec, margin: "12px 0 0" }}>{resultat.r}</p>}
            </div>

            <PrimaryButton onClick={() => onSuivante(resultat?.id || null)} style={{ height: 56 }}>Choisir ma prochaine mission →</PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}

function appelerFonction(nom, jeton, corps = {}) {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${nom}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jeton}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify(corps),
  });
}

// Si le serveur ne répond pas, le code reste gardé : on réessaiera à la prochaine ouverture
async function activerInvitation() {
  const code = lireInvitation();
  if (!code) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await appelerFonction("invitation", session.access_token, { code });
    if (!res.ok) return { erreur: "indisponible" };
    const data = await res.json();
    oublierInvitation();
    return data;
  } catch {
    return { erreur: "indisponible" };
  }
}

function lundiCourant() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BilanSemaineCard({ user, isPro }) {
  const cleFerme = `voltra_bilan_ferme_${user?.id}`;
  const [bilan, setBilan] = useState(null);

  useEffect(() => {
    if (!isPro || !user?.id) return;
    try { if (localStorage.getItem(cleFerme) === lundiCourant()) return; } catch {}
    supabase.auth.getSession()
      .then(({ data: { session } }) => session ? appelerFonction("bilan-semaine", session.access_token) : null)
      .then(res => res?.ok ? res.json() : null)
      .then(d => setBilan(d?.bilan || null))
      .catch(() => {});
  }, [isPro, user?.id]);

  const [ouvert, setOuvert] = useState(false);
  if (!bilan) return null;
  const fermer = () => {
    try { localStorage.setItem(cleFerme, lundiCourant()); } catch {}
    setBilan(null);
  };
  const ac = DS.colors.isDark ? DS.colors.primary : DS.colors.primaryDark;
  return (
    <div style={{ background: DS.colors.surface, boxShadow: DS.shadow.card, borderRadius: 20, padding: 16, marginBottom: 16, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <AceAvatar size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary, margin: 0 }}>Ta semaine, par Ace</p>
          <p style={{ fontSize: 12, color: DS.colors.textSec, margin: 0 }}>{bilan.seances} séance{bilan.seances > 1 ? "s" : ""}{bilan.prevues ? ` sur ${bilan.prevues}` : ""}</p>
        </div>
        <button onClick={fermer} aria-label="Fermer le bilan" style={{ width: 32, height: 32, borderRadius: 16, background: DS.colors.surfaceHigh, border: "none", color: DS.colors.textSec, fontSize: 13, cursor: "pointer" }}>✕</button>
      </div>
      {(bilan.gains || []).map(g => (
        <div key={g.nom} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13 }}>
          <span style={{ minWidth: 0, color: DS.colors.textPrimary, fontWeight: 600 }}>{g.nom}</span>
          <span style={{ flexShrink: 0, color: DS.colors.isDark ? ac : DS.colors.textPrimary, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{virguleKg(g.de)} → {virguleKg(g.a)} kg</span>
        </div>
      ))}
      <p onClick={() => setOuvert(o => !o)} style={{ fontSize: 13, lineHeight: 1.5, color: DS.colors.textSec, margin: "8px 0 0", cursor: "pointer", ...(ouvert ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{bilan.texte}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACE EN DEHORS DES SÉANCES
// ─────────────────────────────────────────────
const questionsAce = () => [`Comment préparer ${motsSport().prochain.replace(/^ta /, "ma ").replace(/^ton /, "mon ")} ?`, "Je peux m'entraîner si je suis courbaturé ?", "Sur quoi je dois me concentrer cette semaine ?"];
const ACCUEIL_ACE = { role: "assistant", text: "Salut, je connais ton objectif et tes charges. Pose-moi ta question." };

function AceScreen({ user, isPro, onAbonnement, sport, cible, matchs, programme, onBack }) {
  const theme = getSportTheme(sport);
  const cle = `voltra_ace_${user.id}`;
  // Sans abonnement : 2 messages par jour, puis Ace propose l'offre payante
  const cleGratuit = `voltra_ace_gratuit_${user.id}_${new Date().toISOString().slice(0, 10)}`;
  const [gratuits, setGratuits] = useState(() => { try { return Number(localStorage.getItem(cleGratuit)) || 0; } catch { return 0; } });
  const bloque = !isPro && gratuits >= 2;
  const [messages, setMessages] = useState(() => {
    try { const sauves = JSON.parse(localStorage.getItem(cle) || "[]"); return Array.isArray(sauves) && sauves.length ? sauves : [ACCUEIL_ACE]; }
    catch { return [ACCUEIL_ACE]; }
  });
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [records, setRecords] = useState([]);
  const finRef = useRef(null);

  useEffect(() => {
    supabase.from("logs_performance").select("charge_kg, exercices(nom)").eq("user_id", user.id).order("charge_kg", { ascending: false }).limit(100)
      .then(({ data }) => {
        const vus = {};
        for (const l of data || []) if (l.exercices?.nom && l.charge_kg > 0 && !vus[l.exercices.nom]) vus[l.exercices.nom] = l.charge_kg;
        setRecords(Object.entries(vus).slice(0, 5).map(([nom, kg]) => `${nom} ${kg} kg`));
      });
  }, []);
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
    try { localStorage.setItem(cle, JSON.stringify(messages.slice(-30))); } catch {}
  }, [messages, enCours]);

  const envoyer = async (question) => {
    const message = String(question || "").trim();
    if (!message || enCours || bloque) return;
    if (!isPro) { const n = gratuits + 1; setGratuits(n); try { localStorage.setItem(cleGratuit, String(n)); } catch {} }
    const historique = messages.slice(-8);
    setTexte("");
    setMessages(prev => [...prev, { role: "user", text: message }]);
    setEnCours(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");
      const dj = programme?.data_json || {};
      const res = await appelerFonction("coach-chat", session.access_token, {
        mode: "libre",
        message,
        history: historique,
        context: {
          sport,
          niveau: dj.niveau || programme?.niveau,
          objectif: cible?.date ? `${(CIBLES[cible.type] || CIBLES.perso).t}, le ${dateLongue(cible.date)}` : "",
          jours_avant: cible?.date ? joursAvant(cible.date) : null,
          matchs: (matchs || []).map(m => m.date_match),
          semaine: programme?.semaine_courante,
          total_semaines: programme?.total_semaines,
          douleurs: dj.douleurs,
          records,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: d.reply || "Réessaie dans un instant." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion. Réessaie." }]);
    }
    setEnCours(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: DS.colors.bg, display: "flex", flexDirection: "column", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ padding: `${hautSur(52)} 16px 12px`, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
        <button onClick={onBack} aria-label="Retour" style={{ background: DS.colors.surfaceHigh, border: "none", borderRadius: 20, width: 36, height: 36, color: DS.colors.textPrimary, fontSize: 16, cursor: "pointer" }}>←</button>
        <AceAvatar size={32} />
        <p style={{ flex: 1, fontSize: 18, fontWeight: 800, color: DS.colors.textPrimary, margin: 0 }}>Ace</p>
        {messages.length > 1 && <button onClick={() => setMessages([ACCUEIL_ACE])} style={{ background: "none", border: "none", color: DS.colors.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 8 }}>Effacer</button>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? theme.accent : DS.colors.surfaceHigh, color: m.role === "user" ? "#000" : DS.colors.textPrimary, fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere" }}>
            {m.text.split("**").map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </div>
        ))}
        {enCours && <p style={{ fontSize: 13, color: DS.colors.textSec, margin: 0 }}>Ace écrit...</p>}
        {bloque && !enCours && (
          <div style={{ alignSelf: "stretch", padding: 16, borderRadius: 18, background: DS.colors.surface, border: `1px solid ${theme.accent}`, textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary, margin: 0 }}>Tu veux continuer à parler avec Ace ?</p>
            <p style={{ fontSize: 13, color: DS.colors.textSec, margin: "6px 0 12px", lineHeight: 1.45 }}>Avec la version gratuite, tu as 2 messages par jour. Passe à l'offre payante pour parler à Ace autant que tu veux.</p>
            {onAbonnement && <button onClick={onAbonnement} style={{ padding: "10px 18px", borderRadius: DS.radius.full, border: "none", background: theme.accent, color: "#000", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Voir les offres →</button>}
          </div>
        )}
        {messages.length === 1 && !enCours && questionsAce().map(q => (
          <button key={q} onClick={() => envoyer(q)} style={{ alignSelf: "flex-start", minHeight: 40, padding: "8px 14px", background: "none", border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>{q}</button>
        ))}
        <div ref={finRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${DS.colors.border}` }}>
        <input enterKeyHint="send" value={texte} onChange={e => setTexte(e.target.value)} onKeyDown={e => e.key === "Enter" && envoyer(texte)} disabled={bloque} placeholder={bloque ? "Passe à l'offre payante pour continuer" : "Parle à Ace..."} aria-label="Ton message à Ace" style={{ flex: 1, minWidth: 0, height: 46, padding: "0 16px", background: DS.colors.surfaceHigh, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.full, color: DS.colors.textPrimary, fontSize: 16, outline: "none", fontFamily: "'Inter',sans-serif" }} />
        <button onClick={() => envoyer(texte)} disabled={!texte.trim() || enCours} aria-label="Envoyer" style={{ width: 46, height: 46, flexShrink: 0, borderRadius: DS.radius.full, background: texte.trim() ? theme.accent : DS.colors.surfaceHigh, border: "none", color: texte.trim() ? "#000" : DS.colors.textSec, fontSize: 18, fontWeight: 700, cursor: "pointer" }}>→</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RAPPELS PAR E-MAIL
// ─────────────────────────────────────────────
function RappelsCard({ user }) {
  const [etat, setEtat] = useState(null);
  useEffect(() => {
    supabase.from("rappels").select("seance_matin, relance").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => { if (!error) setEtat(data || { seance_matin: false, relance: true }); });
  }, [user.id]);
  if (!etat) return null;

  const changer = async (cle) => {
    const suivant = { ...etat, [cle]: !etat[cle] };
    setEtat(suivant);
    const { error } = await supabase.from("rappels").upsert({ user_id: user.id, ...suivant }, { onConflict: "user_id" });
    if (error) setEtat(etat);
  };
  const options = [
    ["seance_matin", "Le matin de mes séances", "Un e-mail pour te rappeler ta séance du jour."],
    ["relance", "Si je décroche", "Un e-mail après 5 jours sans séance, 3 fois au maximum."],
  ];
  return (
    <div style={{ background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.xl, padding: "16px 20px", marginBottom: 14, fontFamily: "'Inter',sans-serif" }}>
      <p style={{ fontSize: 15, fontWeight: 800, color: DS.colors.textPrimary, margin: "0 0 6px" }}>⏰ Rappels</p>
      {options.map(([cle, titre, detail], i) => (
        <button key={cle} role="switch" aria-checked={etat[cle]} onClick={() => changer(cle)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "8px 0", background: "none", border: "none", borderTop: i ? `1px solid ${DS.colors.border}` : "none", textAlign: "left", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: DS.colors.textPrimary }}>{titre}</span>
            <span style={{ display: "block", fontSize: 12, lineHeight: 1.35, color: DS.colors.textSec }}>{detail}</span>
          </span>
          <Interrupteur actif={etat[cle]} />
        </button>
      ))}
    </div>
  );
}

// Page ouverte par le lien de désinscription des e-mails : aucune connexion demandée
const JETON_STOP_RAPPELS = /[?&]rappels=stop/.test(URL_AU_CHARGEMENT) ? new URLSearchParams(window.location.search).get("t") : null;

function RappelsStopScreen({ jeton }) {
  const [etat, setEtat] = useState("attente");
  useEffect(() => {
    appelerFonction("rappels", import.meta.env.VITE_SUPABASE_ANON_KEY, { action: "desactiver", jeton })
      .then(res => setEtat(res.ok ? "ok" : "erreur"))
      .catch(() => setEtat("erreur"));
  }, []);
  const texte = {
    attente: ["Un instant...", ""],
    ok: ["Rappels désactivés", "Tu ne recevras plus d'e-mails de rappel. Tu peux les réactiver dans ton profil."],
    erreur: ["Ça n'a pas marché", `Réessaie plus tard, ou écris à ${LEGAL_EMAIL}.`],
  }[etat];
  return (
    <div style={{ minHeight: "100dvh", background: DS.colors.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "'Inter',sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: DS.colors.textPrimary, margin: "0 0 8px" }}>{texte[0]}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: DS.colors.textSec, margin: 0 }}>{texte[1]}</p>
    </div>
  );
}

export default function VoltraApp() {
  if (JETON_STOP_RAPPELS) return <RappelsStopScreen jeton={JETON_STOP_RAPPELS} />;
  const [screen, setScreen] = useState("splash");
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem("voltra_theme") || "light");
  const [themeChosen, setThemeChosen] = useState(() => !!localStorage.getItem("voltra_theme"));
  const [sessionChecked, setSessionChecked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const userRef = useRef(null);
  const sessionCheckedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [cibleEtat, setCibleEtat] = useState(null);
  const [pricingRetour, setPricingRetour] = useState(false);
  const [seanceActive, setSeanceActive] = useState(null);
  const [resumeState, setResumeState] = useState(null);
  const [programmeActif, setProgrammeActif] = useState(null);
  POSTE_COURANT = programmeActif?.data_json?.poste || null;
  const [sportActif, setSportActif] = useState(null);
  definirSport(sportActif);
  const [ouvrirTests, setOuvrirTests] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null);
  const [matchs, setMatchs] = useState([]);
  const [showMatchs, setShowMatchs] = useState(false);
  const [derniereSeance, setDerniereSeance] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [showDoubleSessionWarning, setShowDoubleSessionWarning] = useState(false);
  const [pendingSeance, setPendingSeance] = useState(null);
  const [seanceAPreparer, setSeanceAPreparer] = useState(null);
  const [authConfirmation, setAuthConfirmation] = useState(null);
  const [profilPhysique, setProfilPhysique] = useState(null);
  const [ressentis, setRessentis] = useState({});
  const [absentesEtat, setAbsentesEtat] = useState(null);

  // Objectif de l'athlète : gardé avec son compte, retrouvé sur tous ses appareils
  const cible = cibleEtat || user?.user_metadata?.cible || user?.user_metadata?.onboarding?.cible || onboardingData?.cible || null;

  // Machines absentes de la salle : gardées avec le compte
  const machinesAbsentes = absentesEtat || user?.user_metadata?.machines_absentes || [];
  const changerAbsentes = (liste) => {
    setAbsentesEtat(liste);
    supabase.auth.updateUser({ data: { machines_absentes: liste } });
  };

  const chargerRessentis = async (programmeId) => {
    if (!programmeId) return setRessentis({});
    const { data } = await supabase
      .from("logs_performance")
      .select("feedback, charge_kg, logged_at, exercices(nom, charge_kg), seances!inner(programme_id)")
      .eq("seances.programme_id", programmeId)
      .order("logged_at", { ascending: true })
      .limit(1000);
    setRessentis(ressentisParExercice(data));
  };
  useEffect(() => { if (user?.id) chargerRessentis(programmeActif?.id); }, [user?.id, programmeActif?.id]);

  const profilDeCharges = () => {
    const dj = programmeActif?.data_json || {};
    return {
      poids: profilPhysique?.poids ?? onboardingData?.poids ?? null,
      age: profilPhysique?.age ?? onboardingData?.age ?? null,
      niveau: dj.niveau || programmeActif?.niveau || onboardingData?.niveau || "debutant",
      cycle: dj.cycle || 1,
      avecCharges: !["maison", "terrain"].includes(dj.equipement || onboardingData?.equipement) || (dj.materiel || []).some(m => m === "halteres" || m === "kettlebell"),
      plafond: ["maison", "terrain"].includes(dj.equipement) ? dj.chargeMaison || null : null,
    };
  };

  // Machine prise ou absente : l'alternative choisie est chargée comme un exercice de la séance
  const remplacerExercice = (ex, alt, absenteId) => {
    if (absenteId && !machinesAbsentes.includes(absenteId)) changerAbsentes([...machinesAbsentes, absenteId]);
    const profil = profilDeCharges();
    return appliquerRessenti(securiserExercice(exerciceDepuisFiche(ex, alt, true), profil), ressentis, profil);
  };

  const launchSeance = (seanceBrute, forme, peuDeTemps) => {
    // Le plus léger l'emporte : compétition proche, forme du jour, semaine chargée, gros effort la veille
    const rythme = programmeActif?.data_json?.rythme;
    const apres = adaptationApresCompet(rythme, cible);
    let adaptation = adaptationAvecForme(adaptationDuJour(matchs, cible), forme);
    if (lireLocal(cleSemaine())?.chargee) adaptation = plusLeger(adaptation, SEMAINE_CHARGEE);
    if (apres?.charge) adaptation = plusLeger(adaptation, apres);
    let adaptee = adapterSeance(seanceBrute, adaptation);
    // Le bloc de compensation ne sert qu'une fois
    if (apres?.compensation && !seanceBrute.depannage) ecrireLocal(cleApresCompet(apres.iso), "fait");
    if (apres?.compensation && !seanceBrute.depannage) adaptee = { ...adaptee, exercices: [...(adaptee.exercices || []), blocCompensation(sportActif)], adaptation: [adaptee.adaptation, apres.note].filter(Boolean).join(" ") };
    const rawSeance = peuDeTemps ? seanceCourte(adaptee) : adaptee;
    const profilCharges = profilDeCharges();
    const seance = {
      ...rawSeance,
      exercices: (rawSeance.exercices || []).map((ex, i) => {
        const preparer = (e) => appliquerRessenti(securiserExercice(e, profilCharges), ressentis, profilCharges);
        const base = {
        materiel: ex.materiel || "",
        chargeUnite: ex.chargeUnite || "",
        id: ex.id || `ex_${i}`,
        nom: ex.nom || "Exercice",
        nomEn: ex.nomEn || ex.nom_en || "",
        muscles: ex.muscles || "",
        sets: ex.sets || 3,
        reps: ex.reps || "8",
        chargeKg: ex.chargeKg || ex.charge_kg || 0,
        reposSec: ex.reposSec || ex.repos_sec || 90,
        conseil: ex.conseil || "",
        ordre: ex.ordre || i + 1,
        phase: "principal",
        ...(Number(ex.travailSec) > 0 ? { travailSec: Number(ex.travailSec), reposSec: Number(ex.reposSec) || 0 } : {}),
        ...(ex.intensite ? { intensite: ex.intensite } : {}),
        };
        // Cardio et mobilité : pas de fiche machine ni de charge à ajuster
        if (base.travailSec || ["cardio", "mobilite"].includes(base.materiel)) return { ...base, chargeKg: 0 };
        const f = ficheExercice(base);
        if (!f) return preparer(base);
        if (machinesAbsentes.includes(f.id)) {
          const alt = alternativesDisponibles(f, machinesAbsentes)[0];
          if (alt) return preparer(exerciceDepuisFiche({ ...base, nom: f.fr }, alt, true));
        }
        return preparer(exerciceDepuisFiche(base, f, false));
      })
    };
    // Échauffement et retour au calme encadrent la séance, sans charge ni repos
    const etape = (phase) => (e, i) => ({ id: `${phase}_${i}`, nom: e.nom || "Exercice", phase, materiel: phase === "retour" ? "mobilite" : "echauffement", muscles: "", sets: 1, reps: String(e.reps || ""), chargeKg: 0, reposSec: 0, conseil: e.conseil || "", ...(Number(e.travailSec) > 0 ? { travailSec: Number(e.travailSec) } : {}) });
    seance.exercices = [...(rawSeance.echauffement || []).map(etape("echauffement")), ...seance.exercices, ...(rawSeance.retourCalme || []).map(etape("retour"))];
    setResumeState(null);
    localStorage.removeItem("voltra_paused_session");
    setSeanceActive(seance);
  };
  const [showUpsell, setShowUpsell] = useState(false);
  const [seancesCount, setSeancesCount] = useState(0);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const genPromiseRef = useRef(null);
  // Lance la génération UNE seule fois (réutilise la requête en cours)
  const startGeneration = (data) => {
    if (genPromiseRef.current) return genPromiseRef.current;
    setProgrammeLoading(true);
    genPromiseRef.current = generateProgramIA(data)
      .then(async prog => { const p = await attachJours(prog, data.jours); if (p) setProgrammeActif(p); return p; })
      .catch(err => { console.error(err); return null; })
      .finally(() => { setProgrammeLoading(false); genPromiseRef.current = null; });
    return genPromiseRef.current;
  };
  const [invitationErreur, setInvitationErreur] = useState(null);
  const essayerInvitation = async () => {
    const resultat = await activerInvitation();
    if (resultat?.ok) { setIsPro(true); setInvitationErreur(null); return true; }
    if (resultat?.erreur) setInvitationErreur(resultat.erreur);
    return false;
  };
  const [paidPlan, setPaidPlan] = useState(null);
  const [paidEssai, setPaidEssai] = useState(true);
  const [cycleComplete, setCycleComplete] = useState(false);

  useEffect(() => {
    applyTheme(appTheme);
    document.body.style.background = DS.colors.bg;
    document.body.style.color = DS.colors.textPrimary;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", DS.colors.bg);
  }, [appTheme]);

  // Une mise à jour recharge la page : jamais pendant une séance, un paiement ou une génération
  useEffect(() => {
    signalerEcran({ theme: appTheme, calme: (screen === "welcome" || screen === "app") && !seanceActive && !programmeLoading });
  }, [appTheme, screen, !!seanceActive, programmeLoading]);

  const ecranPrecedent = useRef(screen);
  // Transition douce à chaque changement d'écran ou d'onglet (opacité seulement, pour ne pas décaler les éléments fixés)
  useEffect(() => {
    const el = document.getElementById("root")?.firstElementChild;
    if (!el || !el.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Changer d'onglet arrive sans cesse : fondu très court. Changer d'écran : un peu plus présent.
    const memeEcran = ecranPrecedent.current === screen;
    ecranPrecedent.current = screen;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: memeEcran ? 120 : 220, easing: "ease-out" });
  }, [screen, activeTab, !!seanceActive]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
        --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
        --t-choix: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, opacity 160ms ease, scale 120ms var(--ease-out);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
      body { background: ${DS.colors.bg}; color: ${DS.colors.textPrimary}; font-family: 'Inter',sans-serif; overscroll-behavior: none; -webkit-font-smoothing: antialiased; }
      h1, h2 { letter-spacing: -0.02em; text-wrap: balance; }
      p { text-wrap: pretty; }
      button, a, [style*="cursor: pointer"] { touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
      :focus-visible { outline: 2px solid #9BE84F; outline-offset: 2px; }
      @media (pointer: coarse) { input, textarea, select { font-size: 16px !important; } }
      /* Ambiance commune : lueur, apparitions, tracé */
      .v-bloom { position: absolute; z-index: -1; width: 520px; height: 520px; border-radius: 50%; left: 50%; top: -220px; margin-left: -260px; background: radial-gradient(circle, rgba(155,232,79,0.3), transparent 65%); pointer-events: none; transition: transform 700ms var(--ease-out); }
      .v-in { animation: vFadeUp 420ms var(--ease-out) backwards; animation-delay: calc(var(--i, 0) * 55ms); }
      .v-premiere::first-letter { text-transform: uppercase; }
      .v-cible { display: flex; align-items: center; gap: 14px; padding: 15px 16px; border-radius: 22px; position: relative; overflow: hidden; cursor: pointer; font-family: 'Inter', sans-serif; width: 100%; }
      .v-cible::after { content: ""; position: absolute; inset: 0; background: #9BE84F; opacity: 0.16; transform: scaleX(0); transform-origin: left; transition: transform 380ms var(--ease-out); pointer-events: none; }
      .v-cible.on::after { transform: scaleX(1); }
      .v-cible-ic { width: 50px; height: 50px; flex-shrink: 0; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 25px; transition: transform 300ms var(--ease-spring), background-color 200ms ease; position: relative; }
      .v-cible.on .v-cible-ic { transform: scale(1.1) rotate(-6deg); }
      .v-range { width: 100%; margin-top: 26px; height: 44px; appearance: none; -webkit-appearance: none; background: transparent; touch-action: pan-y; cursor: grab; }
      .v-range::-webkit-slider-runnable-track { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #9BE84F var(--p), var(--fond) var(--p)); }
      .v-range::-moz-range-track { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #9BE84F var(--p), var(--fond) var(--p)); }
      .v-range::-webkit-slider-thumb { -webkit-appearance: none; width: 34px; height: 34px; margin-top: -13px; border-radius: 50%; background: #9BE84F; border: 4px solid var(--bord); box-shadow: 0 4px 14px rgba(0,0,0,0.25); }
      .v-range::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #9BE84F; border: 4px solid var(--bord); }
      .v-route { stroke-dasharray: 1; stroke-dashoffset: 1; animation: vTrace 2100ms var(--ease-out) 150ms forwards; }
      @keyframes vTrace { to { stroke-dashoffset: 0; } }
            .v-plan-grille { display: grid; gap: 6px; width: 100%; animation: vPlanImpact 500ms var(--ease-out) var(--impact) both; }
      @keyframes vPlanImpact { 0%, 100% { transform: scale(1); } 35% { transform: scale(1.035); } }
      .v-plan-case { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; }
      .v-plan-case i { position: absolute; inset: 0; border-radius: inherit; opacity: 0; animation: vPlanCase 340ms var(--ease-spring) forwards; }
      @keyframes vPlanCase { from { opacity: 0; transform: scale(0.35); } to { opacity: 1; transform: scale(1); } }
      .v-plan-case.jour-j { grid-column: 1 / -1; aspect-ratio: auto; height: 54px; border-radius: 16px; overflow: visible; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 18px; font-weight: 900; color: #0B0B0C; background: var(--orange); box-shadow: 0 0 24px var(--orange); animation: vPlanJ 620ms var(--ease-spring) var(--impact) backwards; }
      .v-plan-case.jour-j b { position: absolute; inset: 0; border-radius: inherit; border: 3px solid var(--orange); opacity: 0; animation: vPlanOnde 950ms var(--ease-out) var(--impact) forwards; pointer-events: none; }
      @keyframes vPlanJ { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
      @keyframes vPlanOnde { from { opacity: 0.9; transform: scale(1); } to { opacity: 0; transform: scale(1.14, 2.6); } }
      .v-plan-phase { display: flex; align-items: center; gap: 10px; animation: vFadeUp 380ms var(--ease-out) backwards; }
      .v-plan-arrive { animation: vPlanArrive 480ms var(--ease-spring) backwards; }
      @keyframes vPlanArrive { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
      .v-plan-flash { position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 55%, rgba(255,159,10,0.42), transparent 62%); animation: vPlanFlash 1200ms var(--ease-out) 2750ms forwards; }
      @keyframes vPlanFlash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
      .v-timeline { position: relative; padding-left: 26px; }
      .v-timeline::before { content: ""; position: absolute; left: 8px; top: 8px; bottom: 28px; width: 3px; border-radius: 3px; background: var(--fond); }
      .v-timeline::after { content: ""; position: absolute; left: 8px; top: 8px; height: 60px; width: 3px; border-radius: 3px; background: #9BE84F; transform-origin: top; animation: vGrow 700ms var(--ease-out) 300ms backwards; }
      @keyframes vGrow { from { transform: scaleY(0); } }
      .v-phase { position: relative; padding-bottom: 16px; }
      .v-phase::before { content: ""; position: absolute; left: -24px; top: 4px; width: 15px; height: 15px; border-radius: 50%; background: var(--point); border: 3px solid var(--bord); z-index: 1; }
      .v-phase.now::before { background: #9BE84F; border-color: #9BE84F; box-shadow: 0 0 0 5px var(--halo); }
      .v-phase.fin::before { content: "🏁"; border: 0; background: none; font-size: 17px; left: -27px; top: 0; }
      .v-mission { position: relative; overflow: hidden; display: block; border-radius: 28px; padding: 20px; margin-bottom: 16px; background: #0E1209; box-shadow: 0 16px 40px rgba(60,100,20,0.28); font-family: 'Inter', sans-serif; }
      .v-mission::before { content: ""; position: absolute; width: 300px; height: 300px; right: -110px; top: -130px; border-radius: 50%; background: radial-gradient(circle, rgba(155,232,79,0.5), transparent 65%); pointer-events: none; }
      .v-mission > * { position: relative; }
      .v-mission-lab { display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #9BE84F; }
      .v-barre { transition: transform 900ms var(--ease-out); }
      .v-plein { position: fixed; inset: 0; z-index: 300; overflow-y: auto; overscroll-behavior: contain; }
      .v-slides { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; margin: 16px -22px; padding: 4px 22px 12px; scrollbar-width: none; }
      .v-slide { position: relative; flex: 0 0 76%; aspect-ratio: 9 / 16; border-radius: 22px; overflow: hidden; scroll-snap-align: center; display: flex; flex-direction: column; padding: 18px; }
      .v-slide-photo { position: absolute; inset: 0; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 13px; color: rgba(255,255,255,0.6); cursor: pointer; text-align: center; padding: 20px; }
      .v-slide-degrade { position: absolute; inset: 45% 0 0; background: linear-gradient(transparent, rgba(0,0,0,0.85)); pointer-events: none; }
      ::-webkit-scrollbar { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fillCircle { from { stroke-dashoffset: 276; } to { stroke-dashoffset: 0; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes splashPulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(0,255,135,0.5)); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 40px rgba(0,255,135,0.8)); } }
      @keyframes celebrate { from { transform: scale(0.8) rotate(-6deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
      @keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-60px); opacity: 0; } }
      /* Motion design : apparitions, relief au toucher, brillance */
      @keyframes vFadeUp { from { opacity: 0; translate: 0 10px; } }
      @keyframes vScaleIn { from { opacity: 0; scale: 0.95; } }
      @keyframes vFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
      @keyframes vGlow { 0% { box-shadow: 0 0 0 0 rgba(155,232,79,0.45); } 100% { box-shadow: 0 0 0 14px rgba(155,232,79,0); } }
      @keyframes vMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes vProgress { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      @keyframes vShine { 0% { transform: translateX(-120%) skewX(-20deg); } 25%, 100% { transform: translateX(260%) skewX(-20deg); } }
      .v-stagger > * { animation: vFadeUp 300ms var(--ease-out) backwards; }
      ${Array.from({ length: 12 }, (_, i) => `.v-stagger > *:nth-child(${i + 1}) { animation-delay: ${(i * 0.04).toFixed(2)}s; }`).join("\n      ")}
      .v-up { animation: vFadeUp 320ms var(--ease-out) backwards; }
      .v-pop { animation: vScaleIn 240ms var(--ease-out) backwards; }
      .v-float { animation: vFloat 3.2s ease-in-out infinite; }
      .v-glow { animation: vGlow 1.6s ease-out 2; }
      .v-shine { position: relative; overflow: hidden; }
      .v-shine::after { content: ""; position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: vShine 7s var(--ease-out) 1.5s infinite; pointer-events: none; }
      button { transition: var(--t-choix); }
      button:disabled { opacity: 0.55; }
      button:not(:disabled):active { scale: 0.97; }
      [style*="cursor: pointer"]:not(button) { transition: var(--t-choix); }
      [style*="cursor: pointer"]:not(button):active { scale: 0.98; }
      @media (hover: hover) and (pointer: fine) { button:not(:disabled):hover { filter: brightness(1.05); } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; transition-duration: 0.001ms !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        userRef.current = session.user;
      }
      setSessionChecked(true);
      sessionCheckedRef.current = true;
    });

    // Detecter confirmation email via hash URL
    if (window.location.hash.includes("access_token")) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUser(user);
          userRef.current = user;
        }
      });
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_OUT") {
        setUser(null);
        userRef.current = null;
        setScreen("welcome");
      } else if (_event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
        userRef.current = session.user;
      } else if (_event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        userRef.current = session.user;
        // Ne pas rediriger ici — onAuth ou splashDone s'en charge (y compris après la confirmation d'email)
      } else if (_event === "PASSWORD_RECOVERY") {
        // Laisser AuthScreen gérer via isPasswordRecovery
        setScreen("auth");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Router proprement quand splash + session sont prêts
  useEffect(() => {
    if (!splashDone) return;
    const themeOk = !!localStorage.getItem("voltra_theme");
    const doRoute = () => {
      const params = new URLSearchParams(window.location.search);
      const isConfirmed = params.get("confirmed") === "true";
      const hasToken = window.location.hash.includes("access_token");
      const isPaid = params.get("paid") === "true";
      const paidPlanParam = params.get("plan") || "monthly";
      if (isPaid && userRef.current) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setPaidPlan(paidPlanParam);
        setPaidEssai(params.get("essai") !== "0");
        setScreen("payment-success");
        // Le passage en Pro est fait uniquement par le webhook Stripe : on relit le profil (le webhook peut prendre quelques secondes)
        const uid = userRef.current.id;
        let essais = 0;
        const verifierPro = async () => {
          const { data } = await supabase.from("profiles").select("is_pro").eq("id", uid).maybeSingle();
          if (data?.is_pro) setIsPro(true);
          else if (++essais < 15) setTimeout(verifierPro, 2000);
        };
        verifierPro();
        return;
      }
      if (confirmationEmail) {
        // Vient du lien de confirmation d'email → page de connexion, même si l'onboarding n'a pas été fait sur cet appareil
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthConfirmation(confirmationEmail);
        confirmationEmail = null;
        setScreen("auth");
        return;
      }
      if (!themeOk) {
        // Premier lancement : le thème suit celui du téléphone, modifiable ensuite dans le profil
        const theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        DS.colors = THEMES[theme];
        DS.shadow = THEMES[theme].shadow;
        setAppTheme(theme);
        setThemeChosen(true);
        try { localStorage.setItem("voltra_theme", theme); } catch {}
        setScreen(userRef.current ? "app" : "welcome");
      } else if (userRef.current) {
        setScreen("app");
      } else if (isConfirmed || hasToken) {
        // Vient de la confirmation email → aller à la connexion
        setScreen("auth");
      } else if (lireCodeEmail()) {
        // L'iPhone a rechargé l'app pendant la lecture des mails : on revient sur l'écran du code
        setScreen("auth");
      } else {
        setScreen("welcome");
      }
    };
    if (sessionCheckedRef.current) {
      doRoute();
    } else {
      const interval = setInterval(() => {
        if (sessionCheckedRef.current) {
          clearInterval(interval);
          doRoute();
        }
      }, 50);
      const fallback = setTimeout(() => { clearInterval(interval); doRoute(); }, 3000);
      return () => { clearInterval(interval); clearTimeout(fallback); };
    }
  }, [splashDone]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProgrammeActif(null);
    setSportActif(null);
    setOnboardingData(null);
    setIsPro(false);
    setUser(null);
    setCibleEtat(null);
    setAbsentesEtat(null);
    setPricingRetour(false);
    setScreen("welcome");
  };

  useEffect(() => {
    if (screen !== "app" || !user) return;
    // Déjà connecté en ouvrant le lien, ou serveur injoignable à la création du compte
    essayerInvitation();
    supabase
      .from("programmes")
      .select("*")
      .eq("user_id", user.id)
      .eq("statut", "actif")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setProgrammeActif(data);
      });
    supabase
      .from("matchs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date_match", new Date().toISOString().split("T")[0])
      .order("date_match", { ascending: true })
      .limit(5)
      .then(({ data }) => { if (data) setMatchs(data); });
    // Charger le sport et is_pro depuis le profil
    supabase
      .from("profiles")
      .select("sport, is_pro, poids, age, taille")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.sport) setSportActif(data.sport);
        if (data?.is_pro) setIsPro(true);
        if (data) setProfilPhysique({ poids: data.poids, age: data.age, taille: data.taille });
      });
    supabase
      .from("seances")
      .select("*, exercices(*)")
      .eq("user_id", user.id)
      .eq("statut", "faite")
      .order("date_realisee", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setDerniereSeance(data); });
    supabase
      .from("seances")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("statut", "faite")
      .then(({ count }) => { if (count) setSeancesCount(count); });
  }, [screen, user]);

  if (screen === "welcome") return <div key={appTheme}><WelcomeScreen onStart={() => setScreen("onboarding")} onLogin={() => setScreen("auth")} /></div>;
  if (screen === "splash") return <SplashScreen onDone={() => setSplashDone(true)} />;
  if (screen === "payment-success") return <PaymentSuccessScreen
    plan={paidPlan}
    essai={paidEssai}
    onContinue={() => {
      if (programmeLoading || !programmeActif) {
        setScreen("programme-generating");
      } else {
        setScreen("app");
      }
    }}
  />;

  if (screen === "programme-generating") return <ProgrammeGeneratingScreen
    sport={sportActif}
    programmeActif={programmeActif}
    programmeLoading={programmeLoading}
    onboardingData={onboardingData}
    onDone={() => setScreen("app")}
  />;

  if (screen === "cycle-complete") return <CycleCompleteScreen
    programme={programmeActif}
    sport={sportActif}
    cycleLoading={cycleComplete}
    onContinue={() => setScreen("app")}
    onTests={() => { setOuvrirTests(true); setScreen("app"); }}
  />;
  if (screen === "auth") return <AuthScreen confirmation={authConfirmation} onboardingData={onboardingData} onBack={onboardingData || authConfirmation ? null : () => setScreen("welcome")} onAuth={async (u) => {
    setUser(u);
    userRef.current = u;
    const invite = await essayerInvitation();
    let ob = onboardingData;
    const { data: progs } = await supabase.from("programmes").select("id").eq("user_id", u.id).limit(1);
    if (progs?.length) {
      // Compte existant : il retrouve son programme, même s'il a refait le questionnaire avant de se connecter
      ob = null;
      setOnboardingData(null);
      setCibleEtat(null);
    } else if (!ob && u.user_metadata?.onboarding) {
      // Email confirmé dans un autre onglet/appareil : on reprend les réponses gardées avec le compte
      ob = u.user_metadata.onboarding;
      setOnboardingData(ob);
      setSportActif(ob.sport);
    }
    // Sauvegarder le sport dans le profil
    if (ob?.sport) {
      await supabase.from("profiles").upsert({ id: u.id, sport: ob.sport, poids: ob.poids || null, age: ob.age || null, taille: ob.taille || null }, { onConflict: "id" });
    }
    if (ob?.cible) {
      setCibleEtat(ob.cible);
      supabase.auth.updateUser({ data: { cible: ob.cible } });
    }
    if (ob) {
      // Toujours regenerer apres auth — maintenant on a une session valide
      setPricingRetour(false);
      setScreen(invite ? "programme-generating" : "pricing");
      startGeneration(ob);
    } else if (progs && !progs.length) {
      setScreen("onboarding");
    } else {
      setScreen("app");
    }
  }} />;
  if (screen === "onboarding") return <OnboardingScreen onLogin={user ? null : () => setScreen("auth")} onComplete={(data, programme) => {
    if (programme) setProgrammeActif(programme);
    setSportActif(data.sport);
    setOnboardingData(data);
    setScreen("objectif");
  }} />;
  if (screen === "objectif") return <ObjectifScreen key={appTheme} initial={cible} onboardingData={onboardingData} onDone={(nouvelle) => {
    setOnboardingData(d => ({ ...d, cible: nouvelle }));
    setCibleEtat(nouvelle);
    if (user) {
      supabase.auth.updateUser({ data: { cible: nouvelle } });
      startGeneration(onboardingData);
      setPricingRetour(false);
      setScreen(isPro ? "programme-generating" : "pricing");
    } else {
      setScreen("auth");
    }
  }} />;
  if (screen === "objectif-edit") return <ObjectifScreen key={appTheme} edition initial={cible} onboardingData={{ frequence: programmeActif?.frequence }} onBack={() => setScreen("app")} onDone={(nouvelle) => {
    setCibleEtat(nouvelle);
    supabase.auth.updateUser({ data: { cible: nouvelle } });
    setScreen("app");
  }} />;
if (screen === "pricing") return <PricingScreen key={appTheme} programme={programmeActif} user={user} cible={cible} invitationErreur={invitationErreur} onLogout={user ? handleLogout : null} onBack={pricingRetour ? () => setScreen("app") : null} />;

  return (
    <div key={`${appTheme}-${screen}`} style={{ maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100dvh" }}>

      {/* Avertissement 2eme seance dans la journee (Pro uniquement) */}
      {showDoubleSessionWarning && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ width: "100%", maxWidth: 360, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, borderRadius: 24, padding: "28px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>💪</p>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 20, color: DS.colors.textPrimary, marginBottom: 8, lineHeight: 1.15 }}>Tu as déjà fait une séance aujourd'hui</h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: DS.colors.textSec, lineHeight: 1.6, marginBottom: 20 }}>
              Le repos fait partie de la progression. Es-tu sûr de vouloir enchaîner une 2ème séance ?
            </p>
            <button onClick={() => { setShowDoubleSessionWarning(false); if (pendingSeance) setSeanceAPreparer(pendingSeance); setPendingSeance(null); }} style={{ width: "100%", height: 52, background: DS.colors.primary, border: "none", borderRadius: 999, color: "#000", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
              Oui, je continue
            </button>
            <button onClick={() => { setShowDoubleSessionWarning(false); setPendingSeance(null); }} style={{ width: "100%", background: "none", border: "none", color: DS.colors.textSec, fontFamily: "'Inter',sans-serif", fontSize: 13, cursor: "pointer" }}>
              Non, à demain
            </button>
          </div>
        </div>
      )}

      {seanceAPreparer && (
        <FormeDuJour
          onChoix={(forme, peuDeTemps) => { launchSeance(seanceAPreparer, forme, peuDeTemps); setSeanceAPreparer(null); }}
          onFermer={() => setSeanceAPreparer(null)}
        />
      )}

      {showMatchs ? (
        <MatchsScreen user={user} onBack={() => {
          setShowMatchs(false);
          supabase.from("matchs").select("*").eq("user_id", user.id)
            .gte("date_match", new Date().toISOString().split("T")[0])
            .order("date_match", { ascending: true }).limit(5)
            .then(({ data }) => { if (data) setMatchs(data); });
        }} />
      ) : seanceActive ? (
        <SeanceScreen
          isPro={isPro}
          resumeState={resumeState}
          seance={seanceActive}
          sport={sportActif}
          absentes={machinesAbsentes}
          onRemplacer={remplacerExercice}
          onBack={() => setSeanceActive(null)}
          onFinish={async (feedback, completedSetsData, exercices, durationMin) => {
            let ecranSuivant = "app";
            try {
              let resultat = null;
              if (programmeActif?.id && feedback) {
                resultat = await saveCompleteSession(programmeActif.id, { ...seanceActive, exercices }, completedSetsData, feedback, durationMin);
                await chargerRessentis(programmeActif.id);
                const { data } = await supabase.from("programmes").select("*").eq("id", programmeActif.id).single();
                if (data) setProgrammeActif(data);
              }
              // Verifier si le cycle est termine
              const updatedProg = await supabase.from("programmes").select("*").eq("id", programmeActif?.id).single();
              const prog = updatedProg.data;
              if (prog && resultat?.cycleTermine) {
                // Cycle termine → generer nouveau programme plus intense
                setCycleComplete(true);
                ecranSuivant = "cycle-complete";
                // Le cycle suivant garde le profil de l'athlète : niveau, matériel, blessures, poids, âge, taille
                const reponses = onboardingData || user?.user_metadata?.onboarding || {};
                const newData = {
                  sport: sportActif,
                  objectif: prog.objectif || prog.data_json?.objectif,
                  niveau: prog.niveau || prog.data_json?.niveau || reponses.niveau || "intermediaire",
                  frequence: prog.frequence || prog.data_json?.frequence || 3,
                  cycle: cible?.date && joursAvant(cible.date) >= 0
                    ? Math.max(prog.data_json?.startCycle || 1, Math.min(etatPlan(cible).index + 1, 3))
                    : (prog.data_json?.cycle || 1) + 1,
                  jours: prog.data_json?.jours,
                  rythme: prog.data_json?.rythme || reponses.rythme,
                  equipement: prog.data_json?.equipement || reponses.equipement,
                  materiel: prog.data_json?.materiel || reponses.materiel,
                  chargeMaison: prog.data_json?.chargeMaison ?? reponses.chargeMaison,
                  douleurs: prog.data_json?.douleurs || reponses.douleurs,
                  poste: prog.data_json?.poste || reponses.poste,
                  poids: profilPhysique?.poids ?? reponses.poids,
                  age: profilPhysique?.age ?? reponses.age,
                  taille: profilPhysique?.taille ?? reponses.taille,
                };
                generateProgramIA(newData).then(async newProg0 => {
                  const newProg = await attachJours(newProg0, newData.jours);
                  if (newProg) {
                    setProgrammeActif(newProg);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      await supabase.from("programmes")
                        .update({ statut: "termine" })
                        .eq("id", prog.id);
                    }
                  }
                  setCycleComplete(false);
                }).catch(err => {
                  console.error("Cycle regen error:", err);
                  setCycleComplete(false);
                });
                return;
              }

            } catch (err) {
              console.error("onFinish error:", err);
            } finally {
              marquerSeanceTerminee();
              setSeancesCount(prev => prev + 1);
              setSeanceActive(null);
              setActiveTab("dashboard");
              setScreen(ecranSuivant);
            }
          }}
        />
      ) : (
        <>
          {activeTab === "dashboard" && (
            <DashboardScreen
              user={user}
              programme={programmeActif}
              programmeLoading={programmeLoading}
              matchs={matchs}
              derniereSeance={derniereSeance}
              sport={sportActif}
              onOpenMatchs={() => setShowMatchs(true)}
              cible={cible}
              onEditCible={() => setScreen("objectif-edit")}
              isPro={isPro}
              onAbonnement={() => { setPricingRetour(true); setScreen("pricing"); }}
              ouvrirTests={ouvrirTests}
              onTestsOuverts={() => setOuvrirTests(false)}
              onMissionSuivante={(resultat) => {
                const passees = user?.user_metadata?.missions || [];
                const mission = { type: cible?.type, date: cible?.date, debut: cible?.debut, resultat };
                supabase.auth.updateUser({ data: { missions: [...passees.filter(m => m.date !== mission.date), mission].slice(-20) } });
                setScreen("objectif-edit");
              }}
              onResumeSession={(paused) => {
                setResumeState({ exIdx: paused.exIdx, setIdx: paused.setIdx, completedSets: paused.completedSets, elapsed: paused.elapsed });
                localStorage.removeItem("voltra_paused_session");
                setSeanceActive(paused.seance);
              }}
              onStartSession={async (rawSeance) => {
                if (!rawSeance) {
                  console.warn("Pas de séance disponible");
                  return;
                }
                // Verifier si une seance a deja ete faite aujourd'hui
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                  // Sans abonnement ni essai en cours : direction le paywall
                  if (!isPro) {
                    setPricingRetour(true);
                    setScreen("pricing");
                    return;
                  }
                  const { count: doneToday } = await supabase
                    .from("seances")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", session.user.id)
                    .eq("statut", "faite")
                    .gte("date_realisee", todayStart.toISOString());
                  if ((doneToday || 0) >= 1) {
                    setPendingSeance(rawSeance);
                    setShowDoubleSessionWarning(true);
                    return;
                  }
                }
                setSeanceAPreparer(rawSeance);
              }}
            />
          )}
          {activeTab === "historique" && <HistoriqueScreen user={user} sport={sportActif} />}
          {activeTab === "profil" && <ProfilScreen isPro={isPro} user={user} programme={programmeActif} sportActif={sportActif} appTheme={appTheme} onThemeChange={setAppTheme} onLogout={handleLogout} absentes={machinesAbsentes} onChangeAbsentes={changerAbsentes} onRegenerateProgram={async (data, shouldRegen = true) => {
            try {
              if (shouldRegen) {
                const prog0 = await generateProgramIA(data);
                const prog = await attachJours(prog0, data.jours);
                if (prog) { setProgrammeActif(prog); setSportActif(data.sport); }
              } else {
                // Juste rafraichir le programme depuis la base
                setSportActif(data.sport);
                const { data: prog } = await supabase.from("programmes").select("*").eq("id", programmeActif?.id).single();
                if (prog) setProgrammeActif(prog);
              }
            } catch (err) { console.error(err); }
          }} />}
          <BottomNav activeTab={activeTab} setTab={setActiveTab} />
        </>
      )}
    </div>
  );
}
