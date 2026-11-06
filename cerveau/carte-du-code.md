# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (5879 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, theme-choice, welcome
Tables : avatars, exercices, logs_performance, matchs, profiles, programmes, seances, tests_performance
Fonctions SQL : appliquer_deload, calculer_progression, check_deload_needed

- URL_AU_CHARGEMENT : 11-20
- getNiveauCycle : 21-28
- generateProgramIA : 29-49
- DAY_OPTIONS : 50-50
- DAY_NAMES : 51-51
- DEFAULT_JOURS : 52-58
- RATIOS_CHARGE : 59-66
- KETTLEBELLS : 67-67
- MEDBALLS : 68-68
- SANS_CHARGE : 69-70
- detecterMateriel : 71-87
- detecterMouvement : 88-112
- securiserExercice : 113-146
- attachJours : 147-154
- DayPicker : 155-178
- StepTitle : 179-188
- WHEEL_ITEM : 189-189
- WheelPicker : 190-219
- RULER_TICK : 220-220
- RulerPicker : 221-258
- saveCompleteSession : 259-333
- AceAvatar : 334-356
- SPORT_THEMES : 357-368
- accentLisible : 369-374
- getSportTheme : 375-386
- THEMES : 387-428
- applyTheme : 429-433
- fonduBas : 434-439
- hautSur : 440-443
- useStaggerUneFois : 444-449
- PrimaryButton : 450-467
- Input : 468-495
- Card : 496-509
- Badge : 510-527
- ProgressBar : 528-550
- MOCK_PROGRAM : 551-565
- SPORTS : 566-574
- SPORT_EMOJIS : 575-579
- OBJECTIFS_PAR_SPORT : 580-619
- OBJECTIFS : 620-620
- NIVEAUX : 621-621
- PLANS : 622-629
- getMuscleIcon : 630-685
- getExerciceColor : 686-696
- MOTIVATION : 697-701
- getRandom : 702-706
- RestTimer : 707-767
- SEG : 768-768
- SOL : 769-771
- ik2 : 772-780
- lerp : 781-781
- lerpCible : 782-785
- resoudre : 786-791
- epauleDe : 792-794
- cibleEntre : 795-800
- calculerPose : 801-818
- DEBOUT : 819-819
- PEND : 820-820
- construireMotif : 821-865
- motifExercice : 866-883
- ExerciseAnimation : 884-978
- poidsAnormal : 979-980
- ChampSerie : 981-996
- SeanceScreen : 997-1558
  - formatElapsed : 1050
  - remplacerCourant : 1064
  - sendCoachMessage : 1102
  - handleSetComplete : 1158
  - validerSerie : 1168
  - handlePause : 1191
- PaymentSuccessScreen : 1559-1622
- ProgrammeGeneratingScreen : 1623-1750
- CycleCompleteScreen : 1751-1843
- ThemeChoiceScreen : 1844-1959
- WelcomeScreen : 1960-2050
- SplashScreen : 2051-2089
- LEGAL_EMAIL : 2090-2090
- LEGAL_DATE : 2091-2092
- LEGAL_SIRET : 2093-2093
- LEGAL_STATUT : 2094-2094
- LEGAL_MEDIATEUR : 2095-2095
- LEGAL_DOCS : 2096-2144
- LegalScreen : 2145-2174
- CLE_CODE_EMAIL : 2175-2175
- lireCodeEmail : 2176-2181
- garderCodeEmail : 2182-2188
- AuthScreen : 2189-2482
- POSTES_PAR_SPORT : 2483-2521
- DOULEURS : 2522-2530
- EQUIPEMENTS : 2531-2537
- TOTAL_STEPS : 2538-2539
- OnboardingScreen : 2540-3125
  - getStepContent : 2560
  - goNext : 2572
  - getReactionMessage : 2589
  - handleFinish : 2629
  - retryGeneration : 2640
  - skipGeneration : 2645
  - toggleDouleur : 2651
  - canNext : 2666
- PricingScreen : 3126-3250
- MatchsScreen : 3251-3395
- DashboardScreen : 3396-3639
- HistoriqueScreen : 3640-3927
- callSubscription : 3928-3940
- SubscriptionScreen : 3941-4145
- MaSalleScreen : 4146-4178
- ProfilScreen : 4179-4615
  - handleAvatarUpload : 4200
  - openEdit : 4284
  - saveEdit : 4289
- JOUR_MS : 4616-4616
- CIBLES : 4617-4622
- dateLocale : 4623-4623
- isoDans : 4624-4624
- joursAvant : 4625-4625
- dateLongue : 4626-4628
- phasesObjectif : 4629-4645
- etatPlan : 4646-4659
- datesDeMatch : 4660-4666
- adaptationDuJour : 4667-4680
- cleExercice : 4681-4682
- ressentisParExercice : 4683-4702
- poidsLePlusProche : 4703-4710
- appliquerRessenti : 4711-4726
- exerciceDepuisFiche : 4727-4741
- adapterSeance : 4742-4754
- Bloom : 4755-4757
- ObjectifScreen : 4758-4899
- MissionCard : 4900-4941
- SemaineCard : 4942-4980
- TESTS_PERF : 4981-4985
- virgule : 4986-4986
- INTERVALLE_TEST : 4987-4988
- useTests : 4989-4999
- TestCard : 5000-5015
- TestScreen : 5016-5088
- dessinerSlide : 5089-5120
- CarrouselScreen : 5121-5188
- BottomNav : 5189-5215
- VoltraApp : 5216-5879
  - changerAbsentes : 5249
  - chargerRessentis : 5254
  - profilDeCharges : 5266
  - remplacerExercice : 5278
  - launchSeance : 5284
  - startGeneration : 5323
  - handleLogout : 5548

## src/Auth.jsx (119 lignes)

- Auth : 9-119

## src/InstallPrompt.jsx (92 lignes)

- STYLES : 5-23
- IconePartager : 24-29
- IconeAjouter : 30-38
- InstallPrompt : 39-92

## src/Logo.jsx (14 lignes)

- LogoVoltra : 4-14

## src/MiseAJour.jsx (63 lignes)

- STYLES : 5-20
- MiseAJour : 21-57
- FondBarreEtat : 58-63

## src/catalogueEquipements.js (182 lignes)

- fiche : 10-14
- GD : 15-20
- CATALOGUE : 21-130
- STATIONS : 131-142
- normaliser : 143-145
- NOMS : 146-148
- PAR_NOM : 149-149
- PAR_ID : 150-151
- ficheParId : 152-154
- ficheExercice : 155-167
- alternativesDisponibles : 168-172
- machinesParCategorie : 173-182

## src/illustrationsMachines.jsx (530 lignes)

- CADRE : 4-4
- CADRE_FONCE : 5-5
- COUSSIN : 6-6
- BORD : 7-8
- Barre : 9-9
- Coussin : 10-12
- Sol : 13-15
- Pile : 16-23
- Poignee : 24-24
- Disque : 25-31
- DESSINS : 32-484
- DESSIN_PAR_FICHE : 485-515
- aUneIllustration : 516-517
- IllustrationMachine : 518-528
- DESSINS_NOMS : 529-530

## src/logoForme.js (7 lignes)

- FORME_LOGO : 3-3
- VERT_LOGO : 4-4
- FOND_LOGO_HAUT : 5-5
- FOND_LOGO_BAS : 6-7

## src/pwa.js (86 lignes)

- CLE_FERME : 6-6
- CLE_PREMIERE_VISITE : 7-7
- SEPT_JOURS : 8-9
- lire : 10-10
- ecrire : 11-12
- estInstallee : 13-17
- plateforme : 18-34
- changer : 35-38
- usePwa : 39-40
- signalerEcran : 41-44
- fermerInvitation : 45-49
- lancerInstallation : 50-60
- marquerSeanceTerminee : 61-61
- momentBanniere : 62-84
- appliquerMaj : 85-86

## src/supabase.js (7 lignes)


## supabase/functions/coach-chat/index.ts (84 lignes)

Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- repondre : 13-15
- court : 16-84

## supabase/functions/exercise-gif/index.ts (154 lignes)

Tables : exercise_gifs
Secrets lus (noms seulement) : EXERCISEDB_RESOLUTIONS, RAPIDAPI_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

- VERSION : 16-18
- RESOLUTIONS : 19-33
- equipementDemande : 34-58
- normaliser : 59-60
- MOTS_VIDES : 61-61
- mots : 62-64
- score : 65-154

## supabase/functions/generate-program/index.ts (487 lignes)

Tables : programmes
Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- KETTLEBELLS : 29-29
- MEDBALLS : 30-31
- SANS_CHARGE : 32-33
- detecterMateriel : 34-50
- detecterMouvement : 51-75
- niveauIndex : 76-80
- premiersReps : 81-85
- chargeMax : 86-101
- arrondirMateriel : 102-112
- securiserExercice : 113-124
- SYSTEM_PROMPT : 125-129
- MACHINES_SALLE : 130-139
- CROSS_SALLE : 140-142
- MACHINES_SECOURS : 143-151
- garantirMachines : 152-168
- FACTEURS_SEMAINE : 169-169
- expandWeeks : 170-214
- securiserProgramme : 215-227
- buildPrompt : 228-487

## supabase/functions/stripe-checkout/index.ts (84 lignes)

Secrets lus (noms seulement) : STRIPE_SECRET_KEY

- JOURS_ESSAI : 20-84

## supabase/functions/stripe-portal/index.ts (187 lignes)

Secrets lus (noms seulement) : RESEND_API_KEY, STRIPE_SECRET_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- json : 10-12
- stripe : 13-27
- findSubscription : 28-38
- RETRACTATION_SECONDES : 39-41
- paiementsRemboursables : 42-46
- totalEuros : 47-49
- euros : 50-52
- envoyerAccuseRetractation : 53-187

## supabase/functions/stripe-webhook/index.ts (155 lignes)

Tables : profiles
Secrets lus (noms seulement) : RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

- verifyStripeSignature : 10-38
- envoyerRappelEssai : 39-155
