# Programmes et charges

## Génération (`generate-program`)
- L'IA crée la semaine 1 (noms d'exercices en anglais). Le serveur construit les semaines 2 à 4 : +5 %, +10 %, -10 %.
- Limite : 5 programmes par compte sur 24 h.
- Équipements : `salle_complete`, `salle_basique`, `maison`, `terrain`.
- Salle complète : 1 à 2 machines par séance (2 pour un débutant), jamais en premier. Si l'IA en oublie, `garantirMachines` en ajoute une compatible avec les douleurs.
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

## Limites connues
- Les programmes déjà créés n'ont pas de machines.
- Une seule charge par exercice est enregistrée : la plus lourde des séries.
