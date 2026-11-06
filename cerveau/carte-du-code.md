# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6516 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, theme-choice, welcome
Tables : avatars, exercices, invitations_utilisees, logs_performance, matchs, profiles, programmes, rappels, seances, tests_performance
Fonctions SQL : appliquer_deload, calculer_progression, check_deload_needed

- URL_AU_CHARGEMENT : 11-16
- CLE_INVITATION : 17-17
- lireInvitation : 18-18
- oublierInvitation : 19-33
- getNiveauCycle : 34-41
- generateProgramIA : 42-62
- DAY_OPTIONS : 63-63
- DAY_NAMES : 64-64
- DEFAULT_JOURS : 65-71
- RATIOS_CHARGE : 72-79
- KETTLEBELLS : 80-80
- MEDBALLS : 81-81
- SANS_CHARGE : 82-83
- detecterMateriel : 84-100
- detecterMouvement : 101-125
- securiserExercice : 126-159
- attachJours : 160-167
- DayPicker : 168-191
- StepTitle : 192-201
- WHEEL_ITEM : 202-202
- WheelPicker : 203-232
- RULER_TICK : 233-233
- RulerPicker : 234-271
- saveCompleteSession : 272-348
- AceAvatar : 349-371
- SPORT_THEMES : 372-383
- accentLisible : 384-389
- getSportTheme : 390-401
- THEMES : 402-443
- applyTheme : 444-448
- fonduBas : 449-454
- hautSur : 455-458
- useStaggerUneFois : 459-464
- PrimaryButton : 465-482
- Input : 483-510
- Card : 511-524
- Badge : 525-542
- ProgressBar : 543-565
- MOCK_PROGRAM : 566-580
- SPORTS : 581-589
- SPORT_EMOJIS : 590-594
- OBJECTIFS_PAR_SPORT : 595-634
- OBJECTIFS : 635-635
- NIVEAUX : 636-636
- PLANS : 637-644
- getMuscleIcon : 645-700
- getExerciceColor : 701-711
- MOTIVATION : 712-716
- getRandom : 717-721
- RestTimer : 722-782
- SEG : 783-783
- SOL : 784-786
- ik2 : 787-795
- lerp : 796-796
- lerpCible : 797-800
- resoudre : 801-806
- epauleDe : 807-809
- cibleEntre : 810-815
- calculerPose : 816-833
- DEBOUT : 834-834
- PEND : 835-835
- construireMotif : 836-880
- motifExercice : 881-898
- ExerciseAnimation : 899-993
- poidsAnormal : 994-995
- ChampSerie : 996-1011
- SeanceScreen : 1012-1579
  - formatElapsed : 1065
  - remplacerCourant : 1079
  - sendCoachMessage : 1117
  - handleSetComplete : 1174
  - validerSerie : 1184
  - handlePause : 1207
- PaymentSuccessScreen : 1580-1643
- ProgrammeGeneratingScreen : 1644-1771
- CycleCompleteScreen : 1772-1864
- ThemeChoiceScreen : 1865-1980
- WelcomeScreen : 1981-2072
- SplashScreen : 2073-2111
- LEGAL_EMAIL : 2112-2112
- LEGAL_DATE : 2113-2114
- LEGAL_SIRET : 2115-2115
- LEGAL_STATUT : 2116-2116
- LEGAL_MEDIATEUR : 2117-2117
- LEGAL_DOCS : 2118-2166
- LegalScreen : 2167-2196
- CLE_CODE_EMAIL : 2197-2197
- lireCodeEmail : 2198-2203
- garderCodeEmail : 2204-2211
- avecDelai : 2212-2217
- AuthScreen : 2218-2511
- POSTES_PAR_SPORT : 2512-2550
- DOULEURS : 2551-2559
- EQUIPEMENTS : 2560-2566
- TOTAL_STEPS : 2567-2568
- OnboardingScreen : 2569-3154
  - getStepContent : 2589
  - goNext : 2601
  - getReactionMessage : 2618
  - handleFinish : 2658
  - retryGeneration : 2669
  - skipGeneration : 2674
  - toggleDouleur : 2680
  - canNext : 2695
- MESSAGES_INVITATION : 3155-3159
- PricingScreen : 3160-3309
- MatchsScreen : 3310-3454
- DashboardScreen : 3455-3710
- HistoriqueScreen : 3711-3998
- callSubscription : 3999-4011
- AVANTAGES_PRO : 4012-4022
- SubscriptionScreen : 4023-4278
- MaSalleScreen : 4279-4311
- ProfilScreen : 4312-4751
  - handleAvatarUpload : 4333
  - openEdit : 4417
  - saveEdit : 4422
- JOUR_MS : 4752-4752
- CIBLES : 4753-4758
- dateLocale : 4759-4759
- isoDans : 4760-4760
- joursAvant : 4761-4761
- dateLongue : 4762-4764
- phasesObjectif : 4765-4781
- etatPlan : 4782-4795
- datesDeMatch : 4796-4802
- adaptationDuJour : 4803-4816
- cleExercice : 4817-4818
- ressentisParExercice : 4819-4838
- poidsLePlusProche : 4839-4846
- appliquerRessenti : 4847-4862
- exerciceDepuisFiche : 4863-4877
- adapterSeance : 4878-4892
- FORMES : 4893-4900
- adaptationAvecForme : 4901-4907
- seanceCourte : 4908-4915
- Bloom : 4916-4919
- PLAN_DEBUT : 4920-4922
- ConstructionPlan : 4923-4985
- ObjectifScreen : 4986-5112
- MissionCard : 5113-5154
- SemaineCard : 5155-5193
- TESTS_PERF : 5194-5198
- virgule : 5199-5199
- INTERVALLE_TEST : 5200-5201
- useTests : 5202-5212
- TestCard : 5213-5228
- TestScreen : 5229-5301
- dessinerSlide : 5302-5333
- CarrouselScreen : 5334-5401
- BottomNav : 5402-5431
- FormeDuJour : 5432-5461
- Interrupteur : 5462-5473
- progresExercices : 5474-5485
- virguleKg : 5486-5486
- RESULTATS_MISSION : 5487-5492
- BilanMissionScreen : 5493-5578
- appelerFonction : 5579-5587
- activerInvitation : 5588-5603
- lundiCourant : 5604-5609
- BilanSemaineCard : 5610-5653
- QUESTIONS_ACE : 5654-5654
- ACCUEIL_ACE : 5655-5656
- AceScreen : 5657-5751
- RappelsCard : 5752-5786
- JETON_STOP_RAPPELS : 5787-5788
- RappelsStopScreen : 5789-5808
- VoltraApp : 5809-6516
  - changerAbsentes : 5844
  - chargerRessentis : 5849
  - profilDeCharges : 5861
  - remplacerExercice : 5873
  - launchSeance : 5879
  - startGeneration : 5919
  - essayerInvitation : 5929
  - handleLogout : 6166

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


## supabase/functions/bilan-semaine/index.ts (140 lignes)

Tables : bilans_semaine, logs_performance, profiles, programmes, seances
Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- repondre : 13-15
- JOUR_MS : 16-16
- TEXTE_SANS_SEANCE : 17-18
- isoParis : 19-21
- lundis : 22-28
- calculerGains : 29-46
- ecrireConseil : 47-140

## supabase/functions/coach-chat/index.ts (122 lignes)

Tables : profiles
Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- repondre : 13-15
- court : 16-16
- liste : 17-19
- reglesCommunes : 20-29
- promptSeance : 30-54
- promptLibre : 55-122

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

## supabase/functions/invitation/index.ts (43 lignes)

Fonctions SQL : utiliser_invitation
Secrets lus (noms seulement) : SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

- json : 10-43

## supabase/functions/rappels/index.ts (172 lignes)

Tables : profiles, programmes, rappels, seances
Secrets lus (noms seulement) : RAPPELS_SECRET, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

- repondre : 13-15
- JOUR_MS : 16-16
- JOURS_AVANT_RELANCE : 17-17
- JOURS_ENTRE_RELANCES : 18-18
- MAX_RELANCES : 19-19
- SITE : 20-21
- echapper : 22-23
- signer : 24-29
- egal : 30-36
- maintenantParis : 37-41
- contenuEmail : 42-172

## supabase/functions/stripe-checkout/index.ts (111 lignes)

Secrets lus (noms seulement) : STRIPE_SECRET_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- json : 10-23
- JOURS_ESSAI : 24-31
- lireStripe : 32-41
- aDejaEteAbonne : 42-111

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
