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
- Courbes d'animation : tokens `--ease-out`, `--ease-spring`, `--t-choix`. Animer seulement `transform` et `opacity`.
- Volet navigateur caché : les animations se figent. Pour une capture : `document.getAnimations()` puis `finish()`.
