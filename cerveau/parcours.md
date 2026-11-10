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
- « Ton corps ce mois-ci » (`CarteDuCorps`) colore l'illustration anatomique `public/corps-anatomie.jpg` (générée avec AlexyaAI le 10 novembre 2026, sans photo de personne) muscle par muscle grâce à la carte de couleurs unies `public/corps-zones.jpg` (même cadrage, une couleur par zone, voir `ZONES_CARTE`). Les deux images vont ensemble : si l'une change, régénérer l'autre. Deux erreurs de la carte sont corrigées dans `CorpsIllustre` (intérieur des cuisses et haut des trapèzes, vue de face). selon les séries des 30 derniers jours, du clair (sable, peu travaillé) au foncé (bordeaux, la zone la plus travaillée). Le calcul est relatif à la zone la plus travaillée, pas un objectif fixe. Les muscles sont du texte libre écrit par l'IA, regroupés en 10 zones par mots-clés (`ZONES_CORPS`) : ajouter un mot-clé si une nouvelle formulation n'est pas reconnue.
- Mise en page « corps en grand » : le corps détouré (canvas, fond transparent) en haut, avec les étiquettes 🔥 le plus et 💤 le moins travaillé (`ANCRES_ZONES`), puis 3 tuiles Avant → Maintenant et « Partager ».
- Partage (`PartageProgression`) : story 1080 × 1920 animée en 6,5 s (scan du corps, étiquette 🔥, chiffres qui défilent), dessinée par `dessinerCartePartage`. « Enregistrer la vidéo » filme le canvas avec MediaRecorder (MP4 si possible, sinon WebM), « Enregistrer l'image » prend la dernière image. Le corps coloré vient de `peindreCorps`.
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
