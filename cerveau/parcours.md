# Parcours et écrans

## Nouveau visiteur
splash → accueil (`WelcomeScreen`) → questionnaire (`OnboardingScreen`) → objectif (`ObjectifScreen`) → compte (`AuthScreen`) → page d'abonnement (`PricingScreen`) → Stripe → `payment-success` → tableau de bord.
Le thème suit le réglage du téléphone au premier lancement (plus d'écran de choix), modifiable dans le profil. Âge, taille et poids sont sur un seul écran « Ton profil ».

## Utilisateur existant
- Session enregistrée : tableau de bord directement.
- Déconnecté : accueil, avec le bouton « Se connecter », sans questionnaire.
- À la connexion, un compte qui a déjà un programme le garde, même s'il a refait le questionnaire. Sans programme ni réponses, il passe par le questionnaire.
- Non-Pro qui démarre une séance : page d'abonnement.

## Ami invité
Lien `?invitation=CODE` : le code est gardé dans `voltra_invitation` (localStorage) et dans l'adresse, pour survivre à « Ouvrir dans Safari », puis activé à la création du compte par la fonction `invitation`. Ce lien contourne le cache du service worker (`navigateFallbackDenylist`), car une ancienne version l'ignorerait. Rouvrir le lien une fois connecté active aussi l'accès. Pas de page d'abonnement ni de carte. Sur iPhone, le code n'existe que dans Safari : créer le compte avant d'installer l'app, donc pas de bloc d'installation sur l'accueil. À la fin de l'accès, retour à la page d'abonnement, avec l'essai de 7 jours encore disponible.

## Fonctions réservées au Pro, ajoutées pour la rétention
- Séance : le bouton de lancement passe par « Forme du jour », puis `launchSeance`. La note d'adaptation s'affiche sur l'animation, à la première série.
- Tableau de bord : carte « Ta semaine, par Ace » (fonction `bilan-semaine`, fermée jusqu'au lundi suivant), carte « Parle à Ace » (`AceScreen`, fonction `coach-chat`, mode `libre`, conversation gardée dans le navigateur), et après le jour J « Découvre ton bilan » (`BilanMissionScreen`).
- Rappels : réglages dans le profil. Fonction `rappels` lancée par `pg_cron` chaque matin. Le lien de désinscription (`?rappels=stop&t=…`) marche sans connexion. Les e-mails disent « ouvre Voltra » sans lien vers l'app, car sur iPhone un lien s'ouvre dans Safari.
- `coach-chat` refuse désormais les comptes sans Pro. Il parle d'alimentation avec tout le monde ; régime, perte de poids et compléments seulement si `profiles.age` indique 18 ans ou plus.

## Progression
- « Avant → Maintenant » (`AvantMaintenant`) compare le premier et le dernier test mensuel. « Partager ma progression » crée une image 1080 × 1920 (`dessinerProgression`).
- Carte du corps (`CarteDuCorps`) : l'illustration `public/corps-anatomie.jpg` (générée avec AlexyaAI le 10 novembre 2026, sans photo de personne) est colorée muscle par muscle grâce à `public/corps-zones.jpg` (même cadrage, une couleur unie par zone, voir `ZONES_CARTE`). Les deux images vont ensemble : si l'une change, régénérer l'autre. Deux erreurs de la carte sont corrigées dans `peindreCorps`. Les muscles sont du texte libre écrit par l'IA, regroupés en 10 zones par mots-clés (`ZONES_CORPS`).
- Barème en 7 niveaux, une couleur distincte chacun (Débutant, Novice, Intermédiaire, Confirmé, Avancé, Expert, Élite ; choix de Waner, 13 novembre 2026, pour ne pas tout voir en rouge trop vite) : le niveau de chaque zone (`niveauxEntre`) mélange la force réelle (meilleure charge estimée sur 1 répétition / poids de corps, `SEUILS_FORCE`, 60 %) et le travail fourni (séries par semaine, `SEUILS_VOLUME`, 40 %), par blocs de 4 semaines. Sans charge, seul le travail compte. Le niveau affiché est le meilleur bloc atteint jusque-là : une pause ne fait jamais reculer, et « après » n'est jamais plus clair qu'« avant ». Les doublons (même exercice enregistré deux fois en moins d'une minute) sont ignorés.
- Départ = la première semaine de séances. L'athlète peut corriger avec « Mes points forts et faibles au départ » (fort = au moins Confirmé, faible = Débutant), enregistré dans `user_metadata.points_corps`. Période au choix (1, 3, 6 mois ou depuis le début), bascule « Au départ / Maintenant » et résumé « +N niveaux ». Plus d'étiquettes 🔥 / 💤 sur le corps.
- Sous la carte : 3 tuiles Avant → Maintenant des tests et « Partager ».
- Partage (`PartageProgression`) : story 1080 × 1920 animée en 10 s : le corps du départ (ou du début de la période choisie) se colore au niveau d'aujourd'hui, « +N niveaux » défile, bulles « Muscle : Débutant → Confirmé » sur les 2 plus gros progrès, puis les tests (ou, sans test, les 3 passages de niveau). Dès 6,2 s, scène finale : corps AVANT et APRÈS côte à côte avec les 3 passages de niveau (c'est aussi l'image enregistrée). Données préparées par `corpsPartage`, dessinée par `dessinerCartePartage`. « Enregistrer la vidéo » filme le canvas avec MediaRecorder (MP4 si possible, sinon WebM), « Enregistrer l'image » prend la dernière image. Le corps coloré vient de `peindreCorps`.
- Retirés : volume total, durée moyenne, « séances réussies ».

## Effet de construction du plan
`ConstructionPlan`, dans `ObjectifScreen` : une case par semaine se remplit aux couleurs des phases pendant que le J- descend, puis le jour J s'allume en orange. Durées dans `PLAN_*`, le délai de `.v-plan-flash` doit rester égal à `PLAN_JOUR_J`. Un appui passe à l'étape suivante.

## À savoir
- La session est liée à l'adresse du site : chaque lien de déploiement Vercel a la sienne. **Tester sur `www.voltra-app.fr`.**
- `?carrousel` dans l'adresse affiche le bouton du carrousel, réservé aux publicités de Waner.
- `voltra_paused_session` (localStorage) garde une séance en pause, et `voltra_theme` le thème.
- App installable (PWA) : logique dans `src/pwa.js`, bloc `InstallPrompt` sur l'accueil et le tableau de bord, toast `MiseAJour`. Fermer le bloc le cache 7 jours (`voltra_pwa_ferme_le`).
- Sur iPhone, l'app installée a sa propre session : il faut se reconnecter une fois, et les liens des e-mails s'ouvrent dans Safari. L'inscription se valide donc par un code à 6 chiffres, écran dans `AuthScreen`, modèle d'e-mail dans `supabase/email-confirmation-compte.html`. `voltra_code_email` (localStorage) ramène sur le code si l'iPhone recharge l'app.
- Retirer la PWA : ne pas juste enlever le plugin, sinon l'ancien service worker reste sur les téléphones. Déployer d'abord avec `selfDestroying: true` dans `vite.config.ts`.
- Courbes d'animation : tokens `--ease-out`, `--ease-spring`, `--t-choix`. Animer seulement `transform` et `opacity`.
- Volet navigateur caché : les animations se figent. Pour une capture : `document.getAnimations()` puis `finish()`.
