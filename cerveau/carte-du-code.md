# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (7300 lignes)

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
- DEFAULT_JOURS : 65-67
- COMPETITIONS : 68-74
- definirSport : 75-79
- motsSport : 80-86
- SAISONS : 87-91
- RYTHME_DEFAUT : 92-94
- frequenceConseillee : 95-101
- joursConseilles : 102-121
- TYPES_SEANCE : 122-127
- typeSeance : 128-129
- duree : 130-131
- dosage : 132-138
- RATIOS_CHARGE : 139-146
- KETTLEBELLS : 147-147
- MEDBALLS : 148-148
- SANS_CHARGE : 149-150
- detecterMateriel : 151-169
- detecterMouvement : 170-194
- securiserExercice : 195-228
- attachJours : 229-236
- DayPicker : 237-267
- RythmeClub : 268-309
- StepTitle : 310-319
- RULER_TICK : 320-320
- RulerPicker : 321-358
- saveCompleteSession : 359-439
- AceAvatar : 440-462
- SPORT_THEMES : 463-474
- accentLisible : 475-480
- getSportTheme : 481-492
- THEMES : 493-534
- applyTheme : 535-539
- fonduBas : 540-545
- hautSur : 546-549
- useStaggerUneFois : 550-555
- PrimaryButton : 556-573
- Input : 574-601
- Card : 602-615
- Badge : 616-633
- ProgressBar : 634-656
- MOCK_PROGRAM : 657-671
- SPORTS : 672-680
- SPORT_EMOJIS : 681-685
- OBJECTIFS_PAR_SPORT : 686-725
- OBJECTIFS : 726-726
- NIVEAUX : 727-727
- PLANS : 728-735
- getMuscleIcon : 736-791
- getExerciceColor : 792-802
- MOTIVATION : 803-807
- getRandom : 808-812
- RestTimer : 813-873
- SEG : 874-874
- SOL : 875-877
- ik2 : 878-886
- lerp : 887-887
- lerpCible : 888-891
- resoudre : 892-897
- epauleDe : 898-900
- cibleEntre : 901-906
- calculerPose : 907-924
- DEBOUT : 925-925
- PEND : 926-926
- construireMotif : 927-971
- motifExercice : 972-989
- ExerciseAnimation : 990-1084
- poidsAnormal : 1085-1086
- ChampSerie : 1087-1102
- SeanceScreen : 1103-1711
  - formatElapsed : 1157
  - remplacerCourant : 1194
  - sendCoachMessage : 1236
  - handleSetComplete : 1293
  - validerSerie : 1303
  - handlePause : 1327
- PaymentSuccessScreen : 1712-1775
- ProgrammeGeneratingScreen : 1776-1903
- CycleCompleteScreen : 1904-2007
- WelcomeScreen : 2008-2099
- SplashScreen : 2100-2138
- LEGAL_EMAIL : 2139-2139
- LEGAL_DATE : 2140-2141
- LEGAL_SIRET : 2142-2142
- LEGAL_STATUT : 2143-2143
- LEGAL_MEDIATEUR : 2144-2144
- LEGAL_DOCS : 2145-2193
- LegalScreen : 2194-2223
- CLE_CODE_EMAIL : 2224-2224
- lireCodeEmail : 2225-2230
- garderCodeEmail : 2231-2238
- avecDelai : 2239-2244
- AuthScreen : 2245-2538
- POSTES_PAR_SPORT : 2539-2577
- DOULEURS : 2578-2586
- EQUIPEMENTS : 2587-2593
- TOTAL_STEPS : 2594-2595
- OnboardingScreen : 2596-3190
  - getStepContent : 2617
  - goNext : 2629
  - getReactionMessage : 2651
  - handleFinish : 2694
  - retryGeneration : 2705
  - skipGeneration : 2710
  - toggleDouleur : 2716
  - canNext : 2731
- MESSAGES_INVITATION : 3191-3195
- PricingScreen : 3196-3345
- MatchsScreen : 3346-3490
- DashboardScreen : 3491-3771
- ecartTest : 3772-3776
- minSec : 3777-3777
- valeurTest : 3778-3778
- semainesEntre : 3779-3780
- AvantMaintenant : 3781-3834
- ZONES_CORPS : 3835-3846
- sansAccents : 3847-3849
- zonesDepuisMuscles : 3850-3861
- COULEURS_NIVEAU : 3862-3862
- rgbNiveau : 3863-3871
- ZONES_CARTE : 3872-3876
- chargerImage : 3877-3882
- peindreCorps : 3883-3940
- CorpsIllustre : 3941-3962
- ANCRES_ZONES : 3963-3967
- useSeriesCorps : 3968-3986
- lireSeries : 3987-3993
- CarteDuCorps : 3994-4024
- PARTAGE_DUREE : 4025-4025
- lisse : 4026-4026
- entre : 4027-4028
- dessinerCartePartage : 4029-4092
- PartageProgression : 4093-4172
- HistoriqueScreen : 4173-4441
- callSubscription : 4442-4454
- AVANTAGES_PRO : 4455-4465
- SubscriptionScreen : 4466-4721
- MaSalleScreen : 4722-4754
- ProfilScreen : 4755-5204
  - handleAvatarUpload : 4776
  - openEdit : 4860
  - memes : 4866
  - saveEdit : 4870
- JOUR_MS : 5205-5205
- CIBLES : 5206-5211
- dateLocale : 5212-5212
- isoDans : 5213-5213
- joursAvant : 5214-5214
- dateLongue : 5215-5217
- phasesObjectif : 5218-5234
- etatPlan : 5235-5248
- datesDeMatch : 5249-5255
- adaptationDuJour : 5256-5269
- cleExercice : 5270-5271
- ressentisParExercice : 5272-5291
- poidsLePlusProche : 5292-5299
- appliquerRessenti : 5300-5315
- exerciceDepuisFiche : 5316-5330
- adapterSeance : 5331-5345
- FORMES : 5346-5353
- adaptationAvecForme : 5354-5360
- seanceCourte : 5361-5368
- Bloom : 5369-5372
- PLAN_DEBUT : 5373-5375
- ConstructionPlan : 5376-5438
- ObjectifScreen : 5439-5565
- MissionCard : 5566-5607
- isoDe : 5608-5608
- lireLocal : 5609-5609
- ecrireLocal : 5610-5611
- cleApresCompet : 5612-5614
- derniereCompet : 5615-5624
- choixApresCompet : 5625-5631
- blocCompensation : 5632-5640
- adaptationApresCompet : 5641-5649
- SEMAINE_CHARGEE : 5650-5650
- plusLeger : 5651-5652
- ApresCompetCard : 5653-5681
- MATERIEL_DEPANNAGE : 5682-5692
- MATERIEL_DEPANNAGE_SPORT : 5693-5701
- genererDepannage : 5702-5711
- DepannageChargement : 5712-5765
- DepannageSheet : 5766-5818
- SemaineCard : 5819-5889
- TESTS_CATALOGUE : 5890-5910
- TESTS_PAR_SPORT : 5911-5919
- COLONNES_TEST : 5920-5921
- TESTS_PAR_DISCIPLINE : 5922-5930
- testsDuSport : 5931-5931
- virgule : 5932-5932
- INTERVALLE_TEST : 5933-5935
- comparables : 5936-5941
- useTests : 5942-5953
- TestCard : 5954-5969
- TestScreen : 5970-6046
- dessinerSlide : 6047-6078
- CarrouselScreen : 6079-6149
- BottomNav : 6150-6179
- FormeDuJour : 6180-6209
- Interrupteur : 6210-6221
- progresExercices : 6222-6233
- virguleKg : 6234-6234
- RESULTATS_MISSION : 6235-6240
- BilanMissionScreen : 6241-6326
- appelerFonction : 6327-6335
- activerInvitation : 6336-6351
- lundiCourant : 6352-6357
- BilanSemaineCard : 6358-6402
- questionsAce : 6403-6403
- ACCUEIL_ACE : 6404-6405
- AceScreen : 6406-6512
- RappelsCard : 6513-6547
- JETON_STOP_RAPPELS : 6548-6549
- RappelsStopScreen : 6550-6569
- VoltraApp : 6570-7300
  - changerAbsentes : 6608
  - chargerRessentis : 6613
  - profilDeCharges : 6625
  - remplacerExercice : 6637
  - launchSeance : 6643
  - startGeneration : 6700
  - essayerInvitation : 6710
  - handleLogout : 6954

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

## supabase/functions/generate-program/index.ts (826 lignes)

Tables : profiles, programmes
Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- KETTLEBELLS : 29-29
- MEDBALLS : 30-31
- SANS_CHARGE : 32-33
- detecterMateriel : 34-52
- detecterMouvement : 53-77
- niveauIndex : 78-82
- premiersReps : 83-87
- chargeMax : 88-103
- arrondirMateriel : 104-114
- securiserExercice : 115-128
- SYSTEM_PROMPT : 129-133
- MACHINES_SALLE : 134-143
- CROSS_SALLE : 144-146
- MACHINES_SECOURS : 147-155
- garantirMachines : 156-174
- FACTEURS_SEMAINE : 175-176
- BLOCS_CARDIO : 177-177
- DUREE_CARDIO : 178-178
- expandWeeks : 179-232
- securiserProgramme : 233-249
- NOMS_JOURS : 250-250
- LUNDI_DABORD : 251-262
- MIX_DEFAUT : 263-265
- mixSaison : 266-280
- planifierSemaine : 281-333
- TYPES_VALIDES : 334-334
- imposerPlan : 335-459
- REGLES_COACH : 460-487
- vocabulaire : 488-495
- buildPrompt : 496-674
- consigneSeance : 675-686
- demanderSeance : 687-826

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
