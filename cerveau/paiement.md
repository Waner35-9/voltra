# Paiement

## Offres
- Essai gratuit de 7 jours avec carte, sur tout. Pas de plan gratuit, pas d'accès à vie.
- Mensuel : 14,99 €/mois, sans promotion.
- Annuel : 74,99 €/an, sélectionné par défaut, affiché 6,25 €/mois avec le badge -58 %. Première année à 56,24 € (-25 %), puis 74,99 €.
- Coach sans plafond de messages pour l'instant.

## Stripe (compte `acct_1TgqdU8P7FaKivct`)
- Prix réels : mensuel `price_1UY4vx8P7FaKivctS2lES6I0`, annuel `price_1UY4vE8P7FaKivcttzImHDEx`.
- Prix de test : mensuel `price_1Tkhvu8P7FaKivct2II0H82c`, annuel `price_1UY4c18P7FaKivctBlZDe1eL`.
- Coupons : `WELCOME25_ESSAI` (-25 %, 1 mois, pour tomber sur le premier vrai paiement et pas sur la facture à 0 €), `RETENTION30`, `RETENTION30_YEAR`.
- Webhook `we_1UXJEO8P7FaKivctWllgO6zr` « Voltra production », 5 événements dont `customer.subscription.trial_will_end`.

## Comportement
- `checkout.session.completed` passe `profiles.is_pro` à vrai, `customer.subscription.deleted` à faux. Répond 500 en cas d'échec pour que Stripe réessaie.
- **Une résiliation arrive de Stripe avec `cancel_at`, et `cancel_at_period_end` reste faux** : tester les deux champs (`stripe-portal`). Réactiver : vider `cancel_at`.
- Pas de rappel de fin d'essai si l'abonnement est déjà résilié (`stripe-webhook`).
- Pendant l'essai, la résiliation saute l'offre de rétention.

## Vérifié en réel (4 novembre 2026)
Essai, activation du Pro, prochaine facture à 56,24 €, résiliation.

## Limites connues
- Un utilisateur peut reprendre un nouvel essai après avoir résilié (`stripe-checkout` ne vérifie pas l'historique).
- `stripe-checkout` reçoit `user_id` et `email` du navigateur sans les comparer au compte connecté.
