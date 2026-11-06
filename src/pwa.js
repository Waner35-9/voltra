// État de la PWA : installation, mise à jour, et bon moment pour les proposer.
import { useSyncExternalStore } from "react";
// @ts-ignore
import { registerSW } from "virtual:pwa-register";

const CLE_FERME = "voltra_pwa_ferme_le";
const CLE_PREMIERE_VISITE = "voltra_pwa_premiere_visite";
const SEPT_JOURS = 7 * 24 * 60 * 60 * 1000;

function lire(cle) { try { return localStorage.getItem(cle); } catch { return null; } }
function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch { /* navigation privée */ } }

export const estInstallee = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

// « ios-safari » : Partager > Sur l'écran d'accueil. « ios-autre » : il faut d'abord passer par Safari.
// Ailleurs, seul l'événement beforeinstallprompt dit si l'installation est possible.
export function plateforme() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return "autre";
  const safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|Brave|YaBrowser|Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Snapchat|Pinterest|LinkedInApp|Twitter|Line\//.test(ua);
  return safari ? "ios-safari" : "ios-autre";
}

let etat = {
  theme: "light",
  calme: false, // écran où recharger la page ne fait rien perdre
  invitation: null, // beforeinstallprompt gardé pour le bouton « Installer Voltra »
  installee: estInstallee(),
  fermee: Date.now() - Number(lire(CLE_FERME) || 0) < SEPT_JOURS,
  majDispo: false,
};
const abonnes = new Set();
function changer(modif) {
  etat = { ...etat, ...modif };
  abonnes.forEach(f => f());
}
export const usePwa = () => useSyncExternalStore(f => { abonnes.add(f); return () => abonnes.delete(f); }, () => etat);

export const signalerEcran = ({ theme, calme }) => {
  if (theme !== etat.theme || calme !== etat.calme) changer({ theme, calme });
};

export function fermerInvitation() {
  ecrire(CLE_FERME, String(Date.now()));
  changer({ fermee: true });
}

export async function lancerInstallation() {
  const invitation = etat.invitation;
  if (!invitation) return;
  invitation.prompt();
  const { outcome } = await invitation.userChoice;
  changer({ invitation: null });
  if (outcome !== "accepted") fermerInvitation();
}

// Tableau de bord : pas à la toute première arrivée. Juste après une séance terminée, ou à partir du jour suivant.
let seanceTerminee = false;
export const marquerSeanceTerminee = () => { seanceTerminee = true; };
export function momentBanniere() {
  const aujourdhui = new Date().toDateString();
  const premiere = lire(CLE_PREMIERE_VISITE);
  if (!premiere) ecrire(CLE_PREMIERE_VISITE, aujourdhui);
  return { ok: seanceTerminee || (!!premiere && premiere !== aujourdhui), apresSeance: seanceTerminee };
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  changer({ invitation: e });
});
window.addEventListener("appinstalled", () => changer({ invitation: null, installee: true }));

const installerMaj = registerSW({
  onNeedRefresh: () => changer({ majDispo: true }),
  // Sur iPhone l'app reste souvent ouverte en arrière-plan : on cherche une nouvelle version à chaque retour
  onRegisteredSW: (_url, enregistrement) => {
    if (!enregistrement) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine) enregistrement.update().catch(() => {});
    });
  },
});
export const appliquerMaj = () => installerMaj(true);
