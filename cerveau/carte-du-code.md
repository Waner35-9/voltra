# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6592 lignes)

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
- DashboardScreen : 3290-3546
- ecartTest : 3547-3551
- valeurTest : 3552-3552
- semainesEntre : 3553-3555
- dessinerProgression : 3556-3580
- AvantMaintenant : 3581-3643
- ZONES_CORPS : 3644-3655
- sansAccents : 3656-3658
- zonesDepuisMuscles : 3659-3670
- COULEURS_NIVEAU : 3671-3671
- rgbNiveau : 3672-3680
- ZONES_CARTE : 3681-3685
- chargerImage : 3686-3689
- CorpsIllustre : 3690-3760
- ANCRES_ZONES : 3761-3765
- CarteDuCorps : 3766-3808
- HistoriqueScreen : 3809-4075
- callSubscription : 4076-4088
- AVANTAGES_PRO : 4089-4099
- SubscriptionScreen : 4100-4355
- MaSalleScreen : 4356-4388
- ProfilScreen : 4389-4828
  - handleAvatarUpload : 4410
  - openEdit : 4494
  - saveEdit : 4499
- JOUR_MS : 4829-4829
- CIBLES : 4830-4835
- dateLocale : 4836-4836
- isoDans : 4837-4837
- joursAvant : 4838-4838
- dateLongue : 4839-4841
- phasesObjectif : 4842-4858
- etatPlan : 4859-4872
- datesDeMatch : 4873-4879
- adaptationDuJour : 4880-4893
- cleExercice : 4894-4895
- ressentisParExercice : 4896-4915
- poidsLePlusProche : 4916-4923
- appliquerRessenti : 4924-4939
- exerciceDepuisFiche : 4940-4954
- adapterSeance : 4955-4969
- FORMES : 4970-4977
- adaptationAvecForme : 4978-4984
- seanceCourte : 4985-4992
- Bloom : 4993-4996
- PLAN_DEBUT : 4997-4999
- ConstructionPlan : 5000-5062
- ObjectifScreen : 5063-5189
- MissionCard : 5190-5231
- SemaineCard : 5232-5270
- TESTS_PERF : 5271-5275
- virgule : 5276-5276
- INTERVALLE_TEST : 5277-5278
- useTests : 5279-5289
- TestCard : 5290-5305
- TestScreen : 5306-5378
- dessinerSlide : 5379-5410
- CarrouselScreen : 5411-5478
- BottomNav : 5479-5508
- FormeDuJour : 5509-5538
- Interrupteur : 5539-5550
- progresExercices : 5551-5562
- virguleKg : 5563-5563
- RESULTATS_MISSION : 5564-5569
- BilanMissionScreen : 5570-5655
- appelerFonction : 5656-5664
- activerInvitation : 5665-5680
- lundiCourant : 5681-5686
- BilanSemaineCard : 5687-5730
- QUESTIONS_ACE : 5731-5731
- ACCUEIL_ACE : 5732-5733
- AceScreen : 5734-5828
- RappelsCard : 5829-5863
- JETON_STOP_RAPPELS : 5864-5865
- RappelsStopScreen : 5866-5885
- VoltraApp : 5886-6592
  - changerAbsentes : 5921
  - chargerRessentis : 5926
  - profilDeCharges : 5938
  - remplacerExercice : 5950
  - launchSeance : 5956
  - startGeneration : 5996
  - essayerInvitation : 6006
  - handleLogout : 6250

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
