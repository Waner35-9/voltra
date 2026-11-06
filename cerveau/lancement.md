# Reste à faire

## Waner : obligatoire avant de vendre
- [ ] Statut et SIRET, à reporter dans `LEGAL_STATUT` et `LEGAL_SIRET` (`src/App.jsx`). Mention « TVA non applicable, art. 293 B du CGI » sur les factures si elle s'applique.
- [ ] Médiateur de la consommation, à reporter dans `LEGAL_MEDIATEUR`.
- [ ] Adresse postale complète dans les CGU et les mentions légales (aujourd'hui seulement « Rennes »).

## Waner : fin de la mise en ligne des fonctions de rétention
- [ ] Tester le bilan de la semaine à partir du lundi suivant une séance.

## Waner : avant le lancement
- [ ] Supprimer `paxeh15844@emailkeep.com` une fois sa coupure vérifiée (après le 11 novembre 2026).
- [ ] Supprimer les fonctions `exercise-gif`, `quick-processor`, `smart-processor`, `validate-session` dans Supabase. L'app ne les appelle plus, et `exercise-gif` est ouverte à tous.
- [ ] Tester l'e-mail de rappel avec un autre compte d'essai (jour 4), puis résilier avant le jour 7.

## À vérifier par Claude
- [ ] Après le premier passage de `voltra-rappels` (7 novembre 2026, 6 h 30 UTC) : le journal de la fonction `rappels` ne montre ni erreur ni 401.
- [ ] Après le 11 novembre 2026 à 22h53 : le compte de test est passé à `is_pro = false`, sans facture.

## Après le lancement
- Corriger l'emoji de la dernière séance (voir base de données).
- Protection contre les mots de passe piratés dans Supabase.
