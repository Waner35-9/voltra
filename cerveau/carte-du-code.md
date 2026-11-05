# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (5744 lignes)

Écrans : auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, theme-choice, welcome
Tables : avatars, exercices, logs_performance, matchs, profiles, programmes, seances, tests_performance
Fonctions SQL : appliquer_deload, calculer_progression, check_deload_needed

- URL_AU_CHARGEMENT : 8-17
- getNiveauCycle : 18-25
- generateProgramIA : 26-46
- DAY_OPTIONS : 47-47
- DAY_NAMES : 48-48
- DEFAULT_JOURS : 49-55
- RATIOS_CHARGE : 56-63
- KETTLEBELLS : 64-64
- MEDBALLS : 65-65
- SANS_CHARGE : 66-67
- detecterMateriel : 68-84
- detecterMouvement : 85-109
- securiserExercice : 110-143
- attachJours : 144-151
- DayPicker : 152-175
- StepTitle : 176-185
- WHEEL_ITEM : 186-186
- WheelPicker : 187-216
- RULER_TICK : 217-217
- RulerPicker : 218-255
- saveCompleteSession : 256-330
- AceAvatar : 331-353
- SPORT_THEMES : 354-365
- accentLisible : 366-371
- getSportTheme : 372-383
- THEMES : 384-425
- applyTheme : 426-430
- fonduBas : 431-437
- useStaggerUneFois : 438-443
- PrimaryButton : 444-461
- Input : 462-489
- Card : 490-503
- Badge : 504-521
- ProgressBar : 522-544
- MOCK_PROGRAM : 545-559
- SPORTS : 560-568
- SPORT_EMOJIS : 569-573
- OBJECTIFS_PAR_SPORT : 574-613
- OBJECTIFS : 614-614
- NIVEAUX : 615-615
- PLANS : 616-623
- getMuscleIcon : 624-679
- getExerciceColor : 680-690
- MOTIVATION : 691-695
- getRandom : 696-700
- RestTimer : 701-761
- SEG : 762-762
- SOL : 763-765
- ik2 : 766-774
- lerp : 775-775
- lerpCible : 776-779
- resoudre : 780-785
- epauleDe : 786-788
- cibleEntre : 789-794
- calculerPose : 795-812
- DEBOUT : 813-813
- PEND : 814-814
- construireMotif : 815-859
- motifExercice : 860-877
- ExerciseAnimation : 878-972
- poidsAnormal : 973-974
- ChampSerie : 975-990
- SeanceScreen : 991-1552
  - formatElapsed : 1044
  - remplacerCourant : 1058
  - sendCoachMessage : 1096
  - handleSetComplete : 1152
  - validerSerie : 1162
  - handlePause : 1185
- PaymentSuccessScreen : 1553-1616
- ProgrammeGeneratingScreen : 1617-1744
- CycleCompleteScreen : 1745-1837
- ThemeChoiceScreen : 1838-1953
- WelcomeScreen : 1954-2042
- SplashScreen : 2043-2082
- LEGAL_EMAIL : 2083-2083
- LEGAL_DATE : 2084-2085
- LEGAL_SIRET : 2086-2086
- LEGAL_STATUT : 2087-2087
- LEGAL_MEDIATEUR : 2088-2088
- LEGAL_DOCS : 2089-2137
- LegalScreen : 2138-2166
- AuthScreen : 2167-2357
- POSTES_PAR_SPORT : 2358-2396
- DOULEURS : 2397-2405
- EQUIPEMENTS : 2406-2412
- TOTAL_STEPS : 2413-2414
- OnboardingScreen : 2415-3000
  - getStepContent : 2435
  - goNext : 2447
  - getReactionMessage : 2464
  - handleFinish : 2504
  - retryGeneration : 2515
  - skipGeneration : 2520
  - toggleDouleur : 2526
  - canNext : 2541
- PricingScreen : 3001-3125
- MatchsScreen : 3126-3270
- DashboardScreen : 3271-3513
- HistoriqueScreen : 3514-3801
- callSubscription : 3802-3814
- SubscriptionScreen : 3815-4019
- MaSalleScreen : 4020-4052
- ProfilScreen : 4053-4489
  - handleAvatarUpload : 4074
  - openEdit : 4158
  - saveEdit : 4163
- JOUR_MS : 4490-4490
- CIBLES : 4491-4496
- dateLocale : 4497-4497
- isoDans : 4498-4498
- joursAvant : 4499-4499
- dateLongue : 4500-4502
- phasesObjectif : 4503-4519
- etatPlan : 4520-4533
- datesDeMatch : 4534-4540
- adaptationDuJour : 4541-4554
- cleExercice : 4555-4556
- ressentisParExercice : 4557-4576
- poidsLePlusProche : 4577-4584
- appliquerRessenti : 4585-4600
- exerciceDepuisFiche : 4601-4615
- adapterSeance : 4616-4628
- Bloom : 4629-4631
- ObjectifScreen : 4632-4773
- MissionCard : 4774-4815
- SemaineCard : 4816-4854
- TESTS_PERF : 4855-4859
- virgule : 4860-4860
- INTERVALLE_TEST : 4861-4862
- useTests : 4863-4873
- TestCard : 4874-4889
- TestScreen : 4890-4962
- dessinerSlide : 4963-4994
- CarrouselScreen : 4995-5062
- BottomNav : 5063-5089
- VoltraApp : 5090-5744
  - changerAbsentes : 5123
  - chargerRessentis : 5128
  - profilDeCharges : 5140
  - remplacerExercice : 5152
  - launchSeance : 5158
  - startGeneration : 5197
  - handleLogout : 5414

## src/Auth.jsx (119 lignes)

- Auth : 9-119

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
