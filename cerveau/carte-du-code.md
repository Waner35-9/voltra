# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6972 lignes)

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
- SAISONS : 68-72
- RYTHME_DEFAUT : 73-75
- frequenceConseillee : 76-82
- joursConseilles : 83-102
- TYPES_SEANCE : 103-108
- typeSeance : 109-110
- duree : 111-112
- dosage : 113-119
- RATIOS_CHARGE : 120-127
- KETTLEBELLS : 128-128
- MEDBALLS : 129-129
- SANS_CHARGE : 130-131
- detecterMateriel : 132-150
- detecterMouvement : 151-175
- securiserExercice : 176-209
- attachJours : 210-217
- DayPicker : 218-247
- RythmeClub : 248-288
- StepTitle : 289-298
- RULER_TICK : 299-299
- RulerPicker : 300-337
- saveCompleteSession : 338-418
- AceAvatar : 419-441
- SPORT_THEMES : 442-453
- accentLisible : 454-459
- getSportTheme : 460-471
- THEMES : 472-513
- applyTheme : 514-518
- fonduBas : 519-524
- hautSur : 525-528
- useStaggerUneFois : 529-534
- PrimaryButton : 535-552
- Input : 553-580
- Card : 581-594
- Badge : 595-612
- ProgressBar : 613-635
- MOCK_PROGRAM : 636-650
- SPORTS : 651-659
- SPORT_EMOJIS : 660-664
- OBJECTIFS_PAR_SPORT : 665-704
- OBJECTIFS : 705-705
- NIVEAUX : 706-706
- PLANS : 707-714
- getMuscleIcon : 715-770
- getExerciceColor : 771-781
- MOTIVATION : 782-786
- getRandom : 787-791
- RestTimer : 792-852
- SEG : 853-853
- SOL : 854-856
- ik2 : 857-865
- lerp : 866-866
- lerpCible : 867-870
- resoudre : 871-876
- epauleDe : 877-879
- cibleEntre : 880-885
- calculerPose : 886-903
- DEBOUT : 904-904
- PEND : 905-905
- construireMotif : 906-950
- motifExercice : 951-968
- ExerciseAnimation : 969-1063
- poidsAnormal : 1064-1065
- ChampSerie : 1066-1081
- SeanceScreen : 1082-1690
  - formatElapsed : 1136
  - remplacerCourant : 1173
  - sendCoachMessage : 1215
  - handleSetComplete : 1272
  - validerSerie : 1282
  - handlePause : 1306
- PaymentSuccessScreen : 1691-1754
- ProgrammeGeneratingScreen : 1755-1882
- CycleCompleteScreen : 1883-1972
- WelcomeScreen : 1973-2064
- SplashScreen : 2065-2103
- LEGAL_EMAIL : 2104-2104
- LEGAL_DATE : 2105-2106
- LEGAL_SIRET : 2107-2107
- LEGAL_STATUT : 2108-2108
- LEGAL_MEDIATEUR : 2109-2109
- LEGAL_DOCS : 2110-2158
- LegalScreen : 2159-2188
- CLE_CODE_EMAIL : 2189-2189
- lireCodeEmail : 2190-2195
- garderCodeEmail : 2196-2203
- avecDelai : 2204-2209
- AuthScreen : 2210-2503
- POSTES_PAR_SPORT : 2504-2542
- DOULEURS : 2543-2551
- EQUIPEMENTS : 2552-2558
- TOTAL_STEPS : 2559-2560
- OnboardingScreen : 2561-3154
  - getStepContent : 2581
  - goNext : 2593
  - getReactionMessage : 2615
  - handleFinish : 2658
  - retryGeneration : 2669
  - skipGeneration : 2674
  - toggleDouleur : 2680
  - canNext : 2695
- MESSAGES_INVITATION : 3155-3159
- PricingScreen : 3160-3309
- MatchsScreen : 3310-3454
- DashboardScreen : 3455-3722
- ecartTest : 3723-3727
- minSec : 3728-3728
- valeurTest : 3729-3729
- semainesEntre : 3730-3731
- AvantMaintenant : 3732-3785
- ZONES_CORPS : 3786-3797
- sansAccents : 3798-3800
- zonesDepuisMuscles : 3801-3812
- COULEURS_NIVEAU : 3813-3813
- rgbNiveau : 3814-3822
- ZONES_CARTE : 3823-3827
- chargerImage : 3828-3833
- peindreCorps : 3834-3891
- CorpsIllustre : 3892-3913
- ANCRES_ZONES : 3914-3918
- useSeriesCorps : 3919-3937
- lireSeries : 3938-3944
- CarteDuCorps : 3945-3975
- PARTAGE_DUREE : 3976-3976
- lisse : 3977-3977
- entre : 3978-3979
- dessinerCartePartage : 3980-4043
- PartageProgression : 4044-4123
- HistoriqueScreen : 4124-4392
- callSubscription : 4393-4405
- AVANTAGES_PRO : 4406-4416
- SubscriptionScreen : 4417-4672
- MaSalleScreen : 4673-4705
- ProfilScreen : 4706-5155
  - handleAvatarUpload : 4727
  - openEdit : 4811
  - memes : 4817
  - saveEdit : 4821
- JOUR_MS : 5156-5156
- CIBLES : 5157-5162
- dateLocale : 5163-5163
- isoDans : 5164-5164
- joursAvant : 5165-5165
- dateLongue : 5166-5168
- phasesObjectif : 5169-5185
- etatPlan : 5186-5199
- datesDeMatch : 5200-5206
- adaptationDuJour : 5207-5220
- cleExercice : 5221-5222
- ressentisParExercice : 5223-5242
- poidsLePlusProche : 5243-5250
- appliquerRessenti : 5251-5266
- exerciceDepuisFiche : 5267-5281
- adapterSeance : 5282-5296
- FORMES : 5297-5304
- adaptationAvecForme : 5305-5311
- seanceCourte : 5312-5319
- Bloom : 5320-5323
- PLAN_DEBUT : 5324-5326
- ConstructionPlan : 5327-5389
- ObjectifScreen : 5390-5516
- MissionCard : 5517-5558
- SemaineCard : 5559-5609
- TESTS_CATALOGUE : 5610-5623
- TESTS_PAR_SPORT : 5624-5632
- COLONNES_TEST : 5633-5633
- testsDuSport : 5634-5634
- virgule : 5635-5635
- INTERVALLE_TEST : 5636-5638
- comparables : 5639-5644
- useTests : 5645-5656
- TestCard : 5657-5672
- TestScreen : 5673-5749
- dessinerSlide : 5750-5781
- CarrouselScreen : 5782-5849
- BottomNav : 5850-5879
- FormeDuJour : 5880-5909
- Interrupteur : 5910-5921
- progresExercices : 5922-5933
- virguleKg : 5934-5934
- RESULTATS_MISSION : 5935-5940
- BilanMissionScreen : 5941-6026
- appelerFonction : 6027-6035
- activerInvitation : 6036-6051
- lundiCourant : 6052-6057
- BilanSemaineCard : 6058-6101
- QUESTIONS_ACE : 6102-6102
- ACCUEIL_ACE : 6103-6104
- AceScreen : 6105-6199
- RappelsCard : 6200-6234
- JETON_STOP_RAPPELS : 6235-6236
- RappelsStopScreen : 6237-6256
- VoltraApp : 6257-6972
  - changerAbsentes : 6292
  - chargerRessentis : 6297
  - profilDeCharges : 6309
  - remplacerExercice : 6321
  - launchSeance : 6327
  - startGeneration : 6375
  - essayerInvitation : 6385
  - handleLogout : 6629

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

## supabase/functions/generate-program/index.ts (784 lignes)

Tables : programmes
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
- expandWeeks : 179-229
- securiserProgramme : 230-246
- NOMS_JOURS : 247-247
- LUNDI_DABORD : 248-259
- MIX_DEFAUT : 260-262
- mixSaison : 263-277
- planifierSemaine : 278-330
- TYPES_VALIDES : 331-331
- imposerPlan : 332-456
- REGLES_COACH : 457-478
- buildPrompt : 479-657
- consigneSeance : 658-669
- demanderSeance : 670-784

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
