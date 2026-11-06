# Reste à faire

## Waner : obligatoire avant de vendre
- [ ] Statut et SIRET, à reporter dans `LEGAL_STATUT` et `LEGAL_SIRET` (`src/App.jsx`). Mention « TVA non applicable, art. 293 B du CGI » sur les factures si elle s'applique.
- [ ] Médiateur de la consommation, à reporter dans `LEGAL_MEDIATEUR`.
- [ ] Adresse postale complète dans les CGU et les mentions légales (aujourd'hui seulement « Rennes »).
- [ ] Coller `stripe-portal` dans Supabase, puis tester la rétractation sur un compte d'essai et sur un vrai paiement.

## Waner : avant le lancement
- [ ] Résilier l'essai de `reloterwan+test5@gmail.com` dans l'app avant le 13 novembre 2026 (supprimer le compte n'arrête pas Stripe), puis supprimer les comptes `reloterwan+test…` dans Supabase.
- [ ] Retirer le Pro des faux comptes, après le 11 novembre 2026 pour vérifier d'abord la coupure automatique du compte de test.
- [ ] Supprimer les fonctions `exercise-gif`, `quick-processor`, `smart-processor`, `validate-session` dans Supabase. L'app ne les appelle plus, et `exercise-gif` est ouverte à tous.
- [ ] Plafond de dépenses chez Anthropic.
- [ ] Tester l'e-mail de rappel avec un autre compte d'essai (jour 4), puis résilier avant le jour 7.

## À vérifier par Claude
- [ ] Après le 11 novembre 2026 à 22h53 : le compte de test est passé à `is_pro = false`, sans facture.

## Après le lancement
- Empêcher les essais répétés (`stripe-checkout`).
- Corriger l'emoji de la dernière séance (voir base de données).
- Protection contre les mots de passe piratés dans Supabase.
