# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6397 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, theme-choice, welcome
Tables : avatars, exercices, logs_performance, matchs, profiles, programmes, rappels, seances, tests_performance
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
- saveCompleteSession : 259-335
- AceAvatar : 336-358
- SPORT_THEMES : 359-370
- accentLisible : 371-376
- getSportTheme : 377-388
- THEMES : 389-430
- applyTheme : 431-435
- fonduBas : 436-441
- hautSur : 442-445
- useStaggerUneFois : 446-451
- PrimaryButton : 452-469
- Input : 470-497
- Card : 498-511
- Badge : 512-529
- ProgressBar : 530-552
- MOCK_PROGRAM : 553-567
- SPORTS : 568-576
- SPORT_EMOJIS : 577-581
- OBJECTIFS_PAR_SPORT : 582-621
- OBJECTIFS : 622-622
- NIVEAUX : 623-623
- PLANS : 624-631
- getMuscleIcon : 632-687
- getExerciceColor : 688-698
- MOTIVATION : 699-703
- getRandom : 704-708
- RestTimer : 709-769
- SEG : 770-770
- SOL : 771-773
- ik2 : 774-782
- lerp : 783-783
- lerpCible : 784-787
- resoudre : 788-793
- epauleDe : 794-796
- cibleEntre : 797-802
- calculerPose : 803-820
- DEBOUT : 821-821
- PEND : 822-822
- construireMotif : 823-867
- motifExercice : 868-885
- ExerciseAnimation : 886-980
- poidsAnormal : 981-982
- ChampSerie : 983-998
- SeanceScreen : 999-1566
  - formatElapsed : 1052
  - remplacerCourant : 1066
  - sendCoachMessage : 1104
  - handleSetComplete : 1161
  - validerSerie : 1171
  - handlePause : 1194
- PaymentSuccessScreen : 1567-1630
- ProgrammeGeneratingScreen : 1631-1758
- CycleCompleteScreen : 1759-1851
- ThemeChoiceScreen : 1852-1967
- WelcomeScreen : 1968-2058
- SplashScreen : 2059-2097
- LEGAL_EMAIL : 2098-2098
- LEGAL_DATE : 2099-2100
- LEGAL_SIRET : 2101-2101
- LEGAL_STATUT : 2102-2102
- LEGAL_MEDIATEUR : 2103-2103
- LEGAL_DOCS : 2104-2152
- LegalScreen : 2153-2182
- CLE_CODE_EMAIL : 2183-2183
- lireCodeEmail : 2184-2189
- garderCodeEmail : 2190-2197
- avecDelai : 2198-2203
- AuthScreen : 2204-2497
- POSTES_PAR_SPORT : 2498-2536
- DOULEURS : 2537-2545
- EQUIPEMENTS : 2546-2552
- TOTAL_STEPS : 2553-2554
- OnboardingScreen : 2555-3140
  - getStepContent : 2575
  - goNext : 2587
  - getReactionMessage : 2604
  - handleFinish : 2644
  - retryGeneration : 2655
  - skipGeneration : 2660
  - toggleDouleur : 2666
  - canNext : 2681
- PricingScreen : 3141-3289
- MatchsScreen : 3290-3434
- DashboardScreen : 3435-3690
- HistoriqueScreen : 3691-3978
- callSubscription : 3979-3991
- AVANTAGES_PRO : 3992-4002
- SubscriptionScreen : 4003-4251
- MaSalleScreen : 4252-4284
- ProfilScreen : 4285-4724
  - handleAvatarUpload : 4306
  - openEdit : 4390
  - saveEdit : 4395
- JOUR_MS : 4725-4725
- CIBLES : 4726-4731
- dateLocale : 4732-4732
- isoDans : 4733-4733
- joursAvant : 4734-4734
- dateLongue : 4735-4737
- phasesObjectif : 4738-4754
- etatPlan : 4755-4768
- datesDeMatch : 4769-4775
- adaptationDuJour : 4776-4789
- cleExercice : 4790-4791
- ressentisParExercice : 4792-4811
- poidsLePlusProche : 4812-4819
- appliquerRessenti : 4820-4835
- exerciceDepuisFiche : 4836-4850
- adapterSeance : 4851-4865
- FORMES : 4866-4873
- adaptationAvecForme : 4874-4880
- seanceCourte : 4881-4888
- Bloom : 4889-4891
- ObjectifScreen : 4892-5033
- MissionCard : 5034-5075
- SemaineCard : 5076-5114
- TESTS_PERF : 5115-5119
- virgule : 5120-5120
- INTERVALLE_TEST : 5121-5122
- useTests : 5123-5133
- TestCard : 5134-5149
- TestScreen : 5150-5222
- dessinerSlide : 5223-5254
- CarrouselScreen : 5255-5322
- BottomNav : 5323-5352
- FormeDuJour : 5353-5382
- Interrupteur : 5383-5394
- progresExercices : 5395-5406
- virguleKg : 5407-5407
- RESULTATS_MISSION : 5408-5413
- BilanMissionScreen : 5414-5499
- appelerFonction : 5500-5507
- lundiCourant : 5508-5513
- BilanSemaineCard : 5514-5557
- QUESTIONS_ACE : 5558-5558
- ACCUEIL_ACE : 5559-5560
- AceScreen : 5561-5655
- RappelsCard : 5656-5690
- JETON_STOP_RAPPELS : 5691-5692
- RappelsStopScreen : 5693-5712
- VoltraApp : 5713-6397
  - changerAbsentes : 5748
  - chargerRessentis : 5753
  - profilDeCharges : 5765
  - remplacerExercice : 5777
  - launchSeance : 5783
  - startGeneration : 5823
  - handleLogout : 6050

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
