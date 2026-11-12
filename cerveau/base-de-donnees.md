# Base de données (Supabase)

## Tables
- `profiles` : id, name, sport, objectif, niveau, frequence, plan, is_pro, stripe_customer_id, poids, age, taille
- `programmes` : user_id, titre, sport, objectif, niveau, frequence, total_semaines, semaine_courante, statut, deload_active, deload_raison, skips_semaine, data_json
- `seances` : programme_id, user_id, semaine, jour, titre, type, duree_min, statut, date_prevue, date_realisee
- `exercices` : seance_id, nom, muscles, sets, reps, charge_kg (**le poids prévu**), repos_sec, ordre, conseil
- `logs_performance` : exercice_id, seance_id, user_id, reps_par_set, charge_kg (**le poids réellement soulevé**), rpe, feedback, statut, logged_at
- `exercice_state` : état par exercice calculé par `calculer_progression`, **jamais relu par l'app**
- `matchs`, `tests_performance`, `coach_usage`, `exercise_gifs` (ancien cache d'images)
- `tests_performance.mesures` (jsonb, `supabase/tests-sport.sql`) : tests propres au sport (`TESTS_PAR_SPORT`, et `TESTS_PAR_DISCIPLINE` pour chaque sport de combat). Détente, sprint 20 m et pompes gardent aussi leur colonne. Les tests d'un ancien sport restent affichés.
- `bilans_semaine` : user_id, semaine (lundi de la semaine résumée), seances, prevues, gains, texte. Une ligne par semaine : c'est ce qui limite le coût IA.
- `rappels` : user_id, seance_matin (non par défaut), relance (oui par défaut), derniere_relance, nb_relances. Pas de ligne = valeurs par défaut.
- `invitations` : code, nom, places, utilisees, duree_jours, valable_jusquau. Lisible seulement dans le dashboard. Pour arrêter un lien : `valable_jusquau` à une date passée, ne pas supprimer la ligne.
- `invitations_utilisees` : user_id, code, fin_le, terminee, client_stripe. Une par compte. La tâche `voltra-fin-invitations` retire le Pro chaque matin après `fin_le`, sauf si le compte a pris un abonnement entre-temps.

## Stocké dans le compte (`user_metadata`)
- `cible` : objectif `{type, date, open, debut}`
- `onboarding` : réponses au questionnaire
- `machines_absentes` : ids du catalogue décochés dans « Ma salle »
- `missions` : objectifs terminés `{type, date, debut, resultat}`, 20 au maximum

## Pièges
- `seances` n'a **pas** de colonne `feedback` : il est dans `logs_performance`. L'emoji de la dernière séance au tableau de bord est donc faux.
- `programmes.deload_active` est écrit mais jamais lu : le déload n'a aucun effet sur les séances. `check_deload_needed` compte les exercices, pas les séances.
- Stockage : buckets `avatars` et `exercise-gifs`.

## Fichiers SQL
`supabase/lancement.sql`, `supabase/objectif.sql`, `supabase/securite-fonctions.sql`, `supabase/retention.sql`, `supabase/rappels-cron.sql` et `supabase/invitations.sql` sont déjà appliqués. Waner colle le SQL lui-même ; je ne fais que des lectures.
