# Parcours et écrans

## Nouveau visiteur
splash → choix du thème → accueil (`WelcomeScreen`) → questionnaire (`OnboardingScreen`) → objectif (`ObjectifScreen`) → compte (`AuthScreen`) → page d'abonnement (`PricingScreen`) → Stripe → `payment-success` → tableau de bord.

## Utilisateur existant
- Session enregistrée : tableau de bord directement.
- Déconnecté : accueil, avec le bouton « Se connecter », sans questionnaire.
- À la connexion, un compte qui a déjà un programme le garde, même s'il a refait le questionnaire. Sans programme ni réponses, il passe par le questionnaire.
- Non-Pro qui démarre une séance : page d'abonnement.

## À savoir
- La session est liée à l'adresse du site : chaque lien de déploiement Vercel a la sienne. **Tester sur `www.voltra-app.fr`.**
- `?carrousel` dans l'adresse affiche le bouton du carrousel, réservé aux publicités de Waner.
- `voltra_paused_session` (localStorage) garde une séance en pause, et `voltra_theme` le thème.
- App installable (PWA) : logique dans `src/pwa.js`, bloc `InstallPrompt` sur l'accueil et le tableau de bord, toast `MiseAJour`. Fermer le bloc le cache 7 jours (`voltra_pwa_ferme_le`).
- Sur iPhone, l'app installée a sa propre session : il faut se reconnecter une fois, et les liens des e-mails s'ouvrent dans Safari. L'inscription se valide donc par un code à 6 chiffres, écran dans `AuthScreen`, modèle d'e-mail dans `supabase/email-confirmation-compte.html`. `voltra_code_email` (localStorage) ramène sur le code si l'iPhone recharge l'app.
- Retirer la PWA : ne pas juste enlever le plugin, sinon l'ancien service worker reste sur les téléphones. Déployer d'abord avec `selfDestroying: true` dans `vite.config.ts`.
- Courbes d'animation : tokens `--ease-out`, `--ease-spring`, `--t-choix`. Animer seulement `transform` et `opacity`.
- Volet navigateur caché : les animations se figent. Pour une capture : `document.getAnimations()` puis `finish()`.
