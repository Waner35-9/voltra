# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (5892 lignes)

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
- garderCodeEmail : 2182-2189
- avecDelai : 2190-2195
- AuthScreen : 2196-2489
- POSTES_PAR_SPORT : 2490-2528
- DOULEURS : 2529-2537
- EQUIPEMENTS : 2538-2544
- TOTAL_STEPS : 2545-2546
- OnboardingScreen : 2547-3132
  - getStepContent : 2567
  - goNext : 2579
  - getReactionMessage : 2596
  - handleFinish : 2636
  - retryGeneration : 2647
  - skipGeneration : 2652
  - toggleDouleur : 2658
  - canNext : 2673
- PricingScreen : 3133-3257
- MatchsScreen : 3258-3402
- DashboardScreen : 3403-3646
- HistoriqueScreen : 3647-3934
- callSubscription : 3935-3947
- SubscriptionScreen : 3948-4157
- MaSalleScreen : 4158-4190
- ProfilScreen : 4191-4628
  - handleAvatarUpload : 4212
  - openEdit : 4296
  - saveEdit : 4301
- JOUR_MS : 4629-4629
- CIBLES : 4630-4635
- dateLocale : 4636-4636
- isoDans : 4637-4637
- joursAvant : 4638-4638
- dateLongue : 4639-4641
- phasesObjectif : 4642-4658
- etatPlan : 4659-4672
- datesDeMatch : 4673-4679
- adaptationDuJour : 4680-4693
- cleExercice : 4694-4695
- ressentisParExercice : 4696-4715
- poidsLePlusProche : 4716-4723
- appliquerRessenti : 4724-4739
- exerciceDepuisFiche : 4740-4754
- adapterSeance : 4755-4767
- Bloom : 4768-4770
- ObjectifScreen : 4771-4912
- MissionCard : 4913-4954
- SemaineCard : 4955-4993
- TESTS_PERF : 4994-4998
- virgule : 4999-4999
- INTERVALLE_TEST : 5000-5001
- useTests : 5002-5012
- TestCard : 5013-5028
- TestScreen : 5029-5101
- dessinerSlide : 5102-5133
- CarrouselScreen : 5134-5201
- BottomNav : 5202-5228
- VoltraApp : 5229-5892
  - changerAbsentes : 5262
  - chargerRessentis : 5267
  - profilDeCharges : 5279
  - remplacerExercice : 5291
  - launchSeance : 5297
  - startGeneration : 5336
  - handleLogout : 5561

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
