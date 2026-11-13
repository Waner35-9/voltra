# Voltra

App web française de préparation physique : programmes IA par sport, séance guidée, coach IA « Ace », abonnement avec essai de 7 jours.
Propriétaire : Waner (Erwan Mantouba), entrepreneur, pas développeur. Réponds en français, simplement.

## Où chercher (avant de lire du code)
`src/App.jsx` fait plus de 5 700 lignes : **ne jamais le lire en entier.**
1. [cerveau/carte-du-code.md](cerveau/carte-du-code.md) donne les lignes de chaque fonction, puis lire seulement ce bloc avec `sed -n` ou `grep`.
2. Fiches à ouvrir seulement si le sujet est concerné :
   - [paiement](cerveau/paiement.md) : offres, Stripe, webhook, résiliation
   - [base de données](cerveau/base-de-donnees.md) : tables et règles
   - [programmes et charges](cerveau/programmes-et-charges.md) : génération, ressenti, poids réel, machines
   - [parcours](cerveau/parcours.md) : écrans, connexion, session
   - [décisions](cerveau/decisions.md) : choix déjà faits, à ne pas rediscuter
   - [lancement](cerveau/lancement.md) : ce qui reste à faire

## Technique
- React + Vite, styles en ligne, design system `DS` / `THEMES` dans `src/App.jsx` (`// @ts-nocheck`).
- Hébergement Vercel : déploiement automatique à chaque push sur `Waner35-9/voltra`, branche `main`. Site : https://www.voltra-app.fr
- Supabase, projet `bsyvuygsdweppcgxzjkb` : Auth, Postgres, Storage, Edge Functions. E-mails via Resend, IA via Anthropic, paiement via Stripe.

## Règles de travail
- **Aucun commit avant que Waner valide**, et c'est lui qui pousse avec GitHub Desktop. Le travail se fait sur `main`.
- Montrer le résultat en local avant de finaliser.
- Avant chaque commit : `npm run verifier` (syntaxe, doublons de fonctions, build).
- Ne jamais écrire de clé secrète dans le code (Stripe `sk_`, `whsec_`, Anthropic, RapidAPI, Resend) : elles vivent dans les secrets Supabase. Waner ne doit pas me les envoyer.
- Edge Functions et SQL : c'est Waner qui les colle dans le dashboard Supabase. Donner le fichier complet, jamais un extrait. Ensuite, vérifier la version en ligne.
- Stripe en mode réel : lecture seule de ma part. Ne pas modifier un abonnement existant.
- Interface en français, lisible en thème clair et sombre.
- Écrans de test : bloc temporaire `// APERCU-LOCAL-DEBUT/FIN` dans `src/App.jsx`, à retirer avant tout commit.

## L'équipe Voltra (agents dans `.claude/agents/`)
La session principale est la **direction** : elle reçoit la demande de Waner, choisit les branches utiles, leur donne une consigne précise, puis rassemble leurs réponses et rend à Waner un seul compte rendu simple. Branches :
- `dev` : code, Edge Functions, SQL, bugs ;
- `programmes` : contenu sportif, séances, tests, prompt de génération ;
- `marketing` : TikTok, accroches, textes qui vendent ;
- `paiement-juridique` : Stripe en lecture seule, CGU, loi ;
- `design` : écrans, animations, thème clair et sombre ;
- `donnees` : inscrits, Pro, statistiques, logs.

Règles de la direction :
- Une petite tâche (une question, un petit correctif) se fait directement, sans agent : chaque agent repart de zéro et coûte des crédits.
- On lance plusieurs branches en même temps quand leurs parts sont indépendantes. Deux branches ne modifient jamais le même fichier en même temps.
- Les agents ne commitent pas : la direction vérifie (`npm run verifier`, aperçu local), montre le résultat à Waner et attend son accord.

## Garder ce cerveau à jour
- La carte du code se régénère seule à chaque commit (`.githooks/pre-commit`).
- Après une décision ou un changement de comportement, corriger la fiche concernée dans le même commit, en une ou deux lignes. Ne garder que ce que le code ne dit pas.
- Quand une tâche de `cerveau/lancement.md` est faite, la retirer.
