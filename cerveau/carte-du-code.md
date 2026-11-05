# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (5706 lignes)

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
- PricingScreen : 3001-3124
- MatchsScreen : 3125-3269
- DashboardScreen : 3270-3512
- HistoriqueScreen : 3513-3800
- callSubscription : 3801-3813
- SubscriptionScreen : 3814-3981
- MaSalleScreen : 3982-4014
- ProfilScreen : 4015-4451
  - handleAvatarUpload : 4036
  - openEdit : 4120
  - saveEdit : 4125
- JOUR_MS : 4452-4452
- CIBLES : 4453-4458
- dateLocale : 4459-4459
- isoDans : 4460-4460
- joursAvant : 4461-4461
- dateLongue : 4462-4464
- phasesObjectif : 4465-4481
- etatPlan : 4482-4495
- datesDeMatch : 4496-4502
- adaptationDuJour : 4503-4516
- cleExercice : 4517-4518
- ressentisParExercice : 4519-4538
- poidsLePlusProche : 4539-4546
- appliquerRessenti : 4547-4562
- exerciceDepuisFiche : 4563-4577
- adapterSeance : 4578-4590
- Bloom : 4591-4593
- ObjectifScreen : 4594-4735
- MissionCard : 4736-4777
- SemaineCard : 4778-4816
- TESTS_PERF : 4817-4821
- virgule : 4822-4822
- INTERVALLE_TEST : 4823-4824
- useTests : 4825-4835
- TestCard : 4836-4851
- TestScreen : 4852-4924
- dessinerSlide : 4925-4956
- CarrouselScreen : 4957-5024
- BottomNav : 5025-5051
- VoltraApp : 5052-5706
  - changerAbsentes : 5085
  - chargerRessentis : 5090
  - profilDeCharges : 5102
  - remplacerExercice : 5114
  - launchSeance : 5120
  - startGeneration : 5159
  - handleLogout : 5376

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

## supabase/functions/stripe-portal/index.ts (127 lignes)

Secrets lus (noms seulement) : STRIPE_SECRET_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- json : 10-12
- stripe : 13-27
- findSubscription : 28-127

## supabase/functions/stripe-webhook/index.ts (155 lignes)

Tables : profiles
Secrets lus (noms seulement) : RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

- verifyStripeSignature : 10-38
- envoyerRappelEssai : 39-155
