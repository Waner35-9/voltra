# Programmes et charges

## Génération (`generate-program`)
- L'IA crée la semaine 1 (noms d'exercices en anglais pour renforcement et vitesse, en français pour cardio, mobilité, échauffement et retour au calme). Le serveur construit les semaines 2 à 4 : +5 %, +10 %, -10 % ; cardio fractionné +1, +2, -1 bloc, endurance +10 %, +20 %, -20 %.
- Une demande à l'IA par séance, toutes en parallèle (`demanderSeance`), avec un contexte commun (`buildPrompt`) et la consigne de la séance (`consigneSeance`) : séances complètes sans dépasser le temps d'une Edge Function. Durée visée : environ 45 min par séance (choix de Waner), 8 exercices maximum, échauffement 8-10 min, retour au calme 5 min. Coût : autant d'appels que de séances.
- Contenu sport par sport dans `FICHES_SPORT` (exigences, renfo, cardio, vitesse, prévention, échauffement, retour au calme) et `FICHES_POSTE` (disciplines de combat, postes), plus `REGLES_COACH` (échauffement RAMP, ordre vitesse > force > cardio, volumes de pliométrie, formats de fractionné). Sources citées en commentaire.
- Chaque séance a un `type` (`renforcement`, `cardio`, `vitesse`, `mobilite`), un `echauffement`, des `exercices` et un `retourCalme`. Le type est choisi par le serveur (`planifierSemaine`), pas par l'IA : mélange propre au sport (`MIX_SPORT`), saison, puis autour du club et du match (lendemain = mobilité, veille = vitesse courte, pas de cardio dur à J-2 ni un jour de club).
- `data_json.rythme` = `{ club: [jours], match: jour | null, saison: pre | saison | treve }`, aussi gardé dans les réponses d'inscription. Changer club, match ou jours dans le profil recrée le programme.
- Séances conseillées (`frequenceConseillee`) : 5 en saison, 6 en pré-saison et trêve, moins les jours de club et de match, au moins 2. Simple conseil, l'utilisateur peut en choisir plus.
- Exercice au chrono (`travailSec`) : jamais de charge. Dans la séance guidée, minuteur, et les blocs de fractionné s'enchaînent seuls après la récupération.
- Échauffement et retour au calme ne sont pas enregistrés ; cardio et mobilité sont enregistrés sans muscle, pour ne pas fausser la carte du corps.
- Limite : 5 programmes par compte sur 24 h.
- Équipements : `salle_complete`, `salle_basique`, `maison`, `terrain`.
- Maison et extérieur : l'athlète coche son matériel (`data_json.materiel`, mêmes repères que le dépannage) et, s'il a des haltères ou une kettlebell, la plus lourde (`chargeMaison`) : aucune charge ne la dépasse. Le serveur ajoute alors `LIEUX` (méthodes sans salle : unilatéral, tempo, isométrie, élastiques, pliométrie 60-100 contacts) et `SPORT_LIEU` (spécifique au sport). Changer le lieu ou le matériel dans le profil recrée le programme.
- Salle complète : 1 à 2 machines par séance de renforcement (2 pour un débutant), jamais en premier. Si l'IA en oublie, `garantirMachines` en ajoute une compatible avec les douleurs.
- Les garde-fous `RATIOS`, `detecterMateriel`, `detecterMouvement` et `securiserExercice` existent en **double** : `generate-program` et `src/App.jsx`. Changer les deux.

## Charge affichée dans une séance (`launchSeance`, `src/App.jsx`)
Dans l'ordre : adaptation aux matchs, renommage et remplacement par le catalogue, `securiserExercice`, puis `appliquerRessenti`.

`ressentisParExercice` lit `logs_performance` du **programme en cours** :
- `ecart` = poids réel / poids prévu, cumulé ;
- `ajust` = Facile +5 %, Dur -5 %, limité à ±15 %.

Un poids que l'utilisateur a soulevé passe outre le plafond de sécurité (jusqu'à 110 % de ce poids). Un poids très éloigné du prévu demande confirmation (`poidsAnormal`).

## Forme du jour (`FormeDuJour`, `src/App.jsx`)
Question posée à chaque lancement de séance : réponse non enregistrée. Fatigue -15 %, gêne -30 %, 1 série de moins. « Peu de temps » garde 60 % des exercices, les premiers.
- Avec un match, c'est le plus léger des deux qui s'applique, jamais les deux.
- `seance.allegee` : `saveCompleteSession` enregistre un ressenti neutre et ne compte pas un poids supérieur au prévu, pour que la séance ne fasse pas bouger les charges suivantes. Une adaptation de match seule n'a pas cette protection.

## Catalogue et images
- `src/catalogueEquipements.js` : 83 fiches sans doublons, 1 fiche = 1 fonction, les autres noms sont dans `variantes`. Ajouter une machine : une fiche ici, son nom dans `MACHINES_SALLE` de `generate-program`, un dessin ci-dessous.
- `src/illustrationsMachines.jsx` : dessins créés pour Voltra pour les machines, poulies et matériel de préparation physique, reliés par `DESSIN_PAR_FICHE`.
- Mouvements libres : `ExerciseAnimation` (bonhomme animé), mouvement choisi par `animation` de la fiche ou `motifExercice`.
- « Ma salle » : tout est disponible par défaut. Les machines décochées sont remplacées au lancement de la séance par la première alternative disponible.

- Vocabulaire par sport (`motsSport` côté appli, `vocabulaire` côté serveur) : combat pour les sports de combat, course pour natation et sprint, match ailleurs. Le champ technique reste `rythme.match`.
- Médecine-ball et kettlebell : poids fixes, la charge ne bouge pas d'une semaine à l'autre, on ajoute une série en semaine 3.
- Après la compétition (`ApresCompetCard`) : la veille ou l'avant-veille d'un jour de compétition habituel, question « tu as joué combien ? ». À fond : séance allégée. Pas joué : bloc de compensation propre au sport (`blocCompensation`) ajouté une seule fois. Réponse gardée sur le téléphone (`voltra_apres_<date>`).
- Semaine différente (dans `SemaineCard`) : pas de compétition, pas de club, ou semaine chargée (charges -15 %, 1 série de moins). Gardé sur le téléphone jusqu'au dimanche (`voltra_semaine_<lundi>`). Ne régénère rien.
- Séance de dépannage : `generate-program` avec `mode: "depannage"`, abonnés seulement. Matériel, durée (20/30/45 min) et type au choix. Une seule séance, renvoyée sans être enregistrée dans `programmes`, puis lancée comme une séance normale.

## Limites connues
- Les programmes déjà créés n'ont pas de machines.
- Une seule charge par exercice est enregistrée : la plus lourde des séries.
- Séance de dépannage : pas de limite par jour, chaque demande coûte un appel IA.
