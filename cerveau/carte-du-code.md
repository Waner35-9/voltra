# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6350 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, welcome
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
- RULER_TICK : 202-202
- RulerPicker : 203-240
- saveCompleteSession : 241-317
- AceAvatar : 318-340
- SPORT_THEMES : 341-352
- accentLisible : 353-358
- getSportTheme : 359-370
- THEMES : 371-412
- applyTheme : 413-417
- fonduBas : 418-423
- hautSur : 424-427
- useStaggerUneFois : 428-433
- PrimaryButton : 434-451
- Input : 452-479
- Card : 480-493
- Badge : 494-511
- ProgressBar : 512-534
- MOCK_PROGRAM : 535-549
- SPORTS : 550-558
- SPORT_EMOJIS : 559-563
- OBJECTIFS_PAR_SPORT : 564-603
- OBJECTIFS : 604-604
- NIVEAUX : 605-605
- PLANS : 606-613
- getMuscleIcon : 614-669
- getExerciceColor : 670-680
- MOTIVATION : 681-685
- getRandom : 686-690
- RestTimer : 691-751
- SEG : 752-752
- SOL : 753-755
- ik2 : 756-764
- lerp : 765-765
- lerpCible : 766-769
- resoudre : 770-775
- epauleDe : 776-778
- cibleEntre : 779-784
- calculerPose : 785-802
- DEBOUT : 803-803
- PEND : 804-804
- construireMotif : 805-849
- motifExercice : 850-867
- ExerciseAnimation : 868-962
- poidsAnormal : 963-964
- ChampSerie : 965-980
- SeanceScreen : 981-1548
  - formatElapsed : 1034
  - remplacerCourant : 1048
  - sendCoachMessage : 1086
  - handleSetComplete : 1143
  - validerSerie : 1153
  - handlePause : 1176
- PaymentSuccessScreen : 1549-1612
- ProgrammeGeneratingScreen : 1613-1740
- CycleCompleteScreen : 1741-1830
- WelcomeScreen : 1831-1922
- SplashScreen : 1923-1961
- LEGAL_EMAIL : 1962-1962
- LEGAL_DATE : 1963-1964
- LEGAL_SIRET : 1965-1965
- LEGAL_STATUT : 1966-1966
- LEGAL_MEDIATEUR : 1967-1967
- LEGAL_DOCS : 1968-2016
- LegalScreen : 2017-2046
- CLE_CODE_EMAIL : 2047-2047
- lireCodeEmail : 2048-2053
- garderCodeEmail : 2054-2061
- avecDelai : 2062-2067
- AuthScreen : 2068-2361
- POSTES_PAR_SPORT : 2362-2400
- DOULEURS : 2401-2409
- EQUIPEMENTS : 2410-2416
- TOTAL_STEPS : 2417-2418
- OnboardingScreen : 2419-2989
  - getStepContent : 2439
  - goNext : 2451
  - getReactionMessage : 2468
  - handleFinish : 2508
  - retryGeneration : 2519
  - skipGeneration : 2524
  - toggleDouleur : 2530
  - canNext : 2545
- MESSAGES_INVITATION : 2990-2994
- PricingScreen : 2995-3144
- MatchsScreen : 3145-3289
- DashboardScreen : 3290-3545
- HistoriqueScreen : 3546-3833
- callSubscription : 3834-3846
- AVANTAGES_PRO : 3847-3857
- SubscriptionScreen : 3858-4113
- MaSalleScreen : 4114-4146
- ProfilScreen : 4147-4586
  - handleAvatarUpload : 4168
  - openEdit : 4252
  - saveEdit : 4257
- JOUR_MS : 4587-4587
- CIBLES : 4588-4593
- dateLocale : 4594-4594
- isoDans : 4595-4595
- joursAvant : 4596-4596
- dateLongue : 4597-4599
- phasesObjectif : 4600-4616
- etatPlan : 4617-4630
- datesDeMatch : 4631-4637
- adaptationDuJour : 4638-4651
- cleExercice : 4652-4653
- ressentisParExercice : 4654-4673
- poidsLePlusProche : 4674-4681
- appliquerRessenti : 4682-4697
- exerciceDepuisFiche : 4698-4712
- adapterSeance : 4713-4727
- FORMES : 4728-4735
- adaptationAvecForme : 4736-4742
- seanceCourte : 4743-4750
- Bloom : 4751-4754
- PLAN_DEBUT : 4755-4757
- ConstructionPlan : 4758-4820
- ObjectifScreen : 4821-4947
- MissionCard : 4948-4989
- SemaineCard : 4990-5028
- TESTS_PERF : 5029-5033
- virgule : 5034-5034
- INTERVALLE_TEST : 5035-5036
- useTests : 5037-5047
- TestCard : 5048-5063
- TestScreen : 5064-5136
- dessinerSlide : 5137-5168
- CarrouselScreen : 5169-5236
- BottomNav : 5237-5266
- FormeDuJour : 5267-5296
- Interrupteur : 5297-5308
- progresExercices : 5309-5320
- virguleKg : 5321-5321
- RESULTATS_MISSION : 5322-5327
- BilanMissionScreen : 5328-5413
- appelerFonction : 5414-5422
- activerInvitation : 5423-5438
- lundiCourant : 5439-5444
- BilanSemaineCard : 5445-5488
- QUESTIONS_ACE : 5489-5489
- ACCUEIL_ACE : 5490-5491
- AceScreen : 5492-5586
- RappelsCard : 5587-5621
- JETON_STOP_RAPPELS : 5622-5623
- RappelsStopScreen : 5624-5643
- VoltraApp : 5644-6350
  - changerAbsentes : 5679
  - chargerRessentis : 5684
  - profilDeCharges : 5696
  - remplacerExercice : 5708
  - launchSeance : 5714
  - startGeneration : 5754
  - essayerInvitation : 5764
  - handleLogout : 6008

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
