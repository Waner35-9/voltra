# Parcours et écrans

## Nouveau visiteur
splash → choix du thème → accueil (`WelcomeScreen`) → questionnaire (`OnboardingScreen`) → objectif (`ObjectifScreen`) → compte (`AuthScreen`) → page d'abonnement (`PricingScreen`) → Stripe → `payment-success` → tableau de bord.

## Utilisateur existant
- Session enregistrée : tableau de bord directement.
- Déconnecté : accueil, avec le bouton « Se connecter », sans questionnaire.
- À la connexion, un compte qui a déjà un programme le garde, même s'il a refait le questionnaire. Sans programme ni réponses, il passe par le questionnaire.
- Non-Pro qui démarre une séance : page d'abonnement.

## Fonctions réservées au Pro, ajoutées pour la rétention
- Séance : le bouton de lancement passe par « Forme du jour », puis `launchSeance`. La note d'adaptation s'affiche sur l'animation, à la première série.
- Tableau de bord : carte « Ta semaine, par Ace » (fonction `bilan-semaine`, fermée jusqu'au lundi suivant), carte « Parle à Ace » (`AceScreen`, fonction `coach-chat`, mode `libre`, conversation gardée dans le navigateur), et après le jour J « Découvre ton bilan » (`BilanMissionScreen`).
- Rappels : réglages dans le profil. Fonction `rappels` lancée par `pg_cron` chaque matin. Le lien de désinscription (`?rappels=stop&t=…`) marche sans connexion. Les e-mails disent « ouvre Voltra » sans lien vers l'app, car sur iPhone un lien s'ouvre dans Safari.
- `coach-chat` refuse désormais les comptes sans Pro. Il parle d'alimentation avec tout le monde ; régime, perte de poids et compléments seulement si `profiles.age` indique 18 ans ou plus.

## À savoir
- La session est liée à l'adresse du site : chaque lien de déploiement Vercel a la sienne. **Tester sur `www.voltra-app.fr`.**
- `?carrousel` dans l'adresse affiche le bouton du carrousel, réservé aux publicités de Waner.
- `voltra_paused_session` (localStorage) garde une séance en pause, et `voltra_theme` le thème.
- App installable (PWA) : logique dans `src/pwa.js`, bloc `InstallPrompt` sur l'accueil et le tableau de bord, toast `MiseAJour`. Fermer le bloc le cache 7 jours (`voltra_pwa_ferme_le`).
- Sur iPhone, l'app installée a sa propre session : il faut se reconnecter une fois, et les liens des e-mails s'ouvrent dans Safari. L'inscription se valide donc par un code à 6 chiffres, écran dans `AuthScreen`, modèle d'e-mail dans `supabase/email-confirmation-compte.html`. `voltra_code_email` (localStorage) ramène sur le code si l'iPhone recharge l'app.
- Retirer la PWA : ne pas juste enlever le plugin, sinon l'ancien service worker reste sur les téléphones. Déployer d'abord avec `selfDestroying: true` dans `vite.config.ts`.
- Courbes d'animation : tokens `--ease-out`, `--ease-spring`, `--t-choix`. Animer seulement `transform` et `opacity`.
- Volet navigateur caché : les animations se figent. Pour une capture : `document.getAnimations()` puis `finish()`.
