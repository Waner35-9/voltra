# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (7520 lignes)

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
- securiserExercice : 195-230
- attachJours : 231-238
- DayPicker : 239-269
- RythmeClub : 270-311
- StepTitle : 312-321
- RULER_TICK : 322-322
- RulerPicker : 323-360
- saveCompleteSession : 361-441
- AceAvatar : 442-464
- SPORT_THEMES : 465-476
- accentLisible : 477-482
- getSportTheme : 483-494
- THEMES : 495-536
- applyTheme : 537-541
- fonduBas : 542-547
- hautSur : 548-551
- useStaggerUneFois : 552-557
- PrimaryButton : 558-575
- Input : 576-603
- Card : 604-617
- Badge : 618-635
- ProgressBar : 636-658
- MOCK_PROGRAM : 659-673
- SPORTS : 674-682
- SPORT_EMOJIS : 683-687
- OBJECTIFS_PAR_SPORT : 688-727
- OBJECTIFS : 728-728
- NIVEAUX : 729-729
- PLANS : 730-737
- getMuscleIcon : 738-793
- getExerciceColor : 794-804
- MOTIVATION : 805-809
- getRandom : 810-814
- RestTimer : 815-875
- SEG : 876-876
- SOL : 877-879
- ik2 : 880-888
- lerp : 889-889
- lerpCible : 890-893
- resoudre : 894-899
- epauleDe : 900-902
- cibleEntre : 903-908
- calculerPose : 909-926
- DEBOUT : 927-927
- PEND : 928-928
- construireMotif : 929-973
- motifExercice : 974-991
- ExerciseAnimation : 992-1086
- poidsAnormal : 1087-1088
- ChampSerie : 1089-1104
- SeanceScreen : 1105-1713
  - formatElapsed : 1159
  - remplacerCourant : 1196
  - sendCoachMessage : 1238
  - handleSetComplete : 1295
  - validerSerie : 1305
  - handlePause : 1329
- PaymentSuccessScreen : 1714-1777
- ProgrammeGeneratingScreen : 1778-1905
- CycleCompleteScreen : 1906-2009
- WelcomeScreen : 2010-2101
- SplashScreen : 2102-2140
- LEGAL_EMAIL : 2141-2141
- LEGAL_DATE : 2142-2143
- LEGAL_SIRET : 2144-2144
- LEGAL_STATUT : 2145-2145
- LEGAL_MEDIATEUR : 2146-2146
- LEGAL_DOCS : 2147-2195
- LegalScreen : 2196-2225
- CLE_CODE_EMAIL : 2226-2226
- lireCodeEmail : 2227-2232
- garderCodeEmail : 2233-2240
- avecDelai : 2241-2246
- AuthScreen : 2247-2540
- POSTES_PAR_SPORT : 2541-2579
- DOULEURS : 2580-2588
- EQUIPEMENTS : 2589-2595
- MATERIEL_LIEU : 2596-2611
- CHARGES_MAISON : 2612-2614
- MaterielLieu : 2615-2638
- TOTAL_STEPS : 2639-2640
- OnboardingScreen : 2641-3236
  - getStepContent : 2662
  - goNext : 2674
  - getReactionMessage : 2696
  - handleFinish : 2739
  - retryGeneration : 2750
  - skipGeneration : 2755
  - toggleDouleur : 2761
  - canNext : 2776
- MESSAGES_INVITATION : 3237-3241
- PricingScreen : 3242-3391
- MatchsScreen : 3392-3536
- DashboardScreen : 3537-3817
- ecartTest : 3818-3822
- minSec : 3823-3823
- valeurTest : 3824-3824
- semainesEntre : 3825-3826
- AvantMaintenant : 3827-3880
- ZONES_CORPS : 3881-3892
- sansAccents : 3893-3895
- zonesDepuisMuscles : 3896-3907
- COULEURS_NIVEAU : 3908-3908
- rgbNiveau : 3909-3917
- ZONES_CARTE : 3918-3922
- chargerImage : 3923-3928
- peindreCorps : 3929-3986
- CorpsIllustre : 3987-4008
- ANCRES_ZONES : 4009-4015
- NIVEAUX_CORPS : 4016-4017
- SEUILS_FORCE : 4018-4023
- SEUILS_VOLUME : 4024-4024
- palier : 4025-4025
- PERIODES_CORPS : 4026-4027
- useSeriesCorps : 4028-4043
- niveauxEntre : 4044-4063
- lireSeries : 4064-4083
- corpsPartage : 4084-4091
- tNiveau : 4092-4093
- CarteDuCorps : 4094-4171
- PARTAGE_DUREE : 4172-4172
- lisse : 4173-4173
- entre : 4174-4175
- dessinerCartePartage : 4176-4298
- PartageProgression : 4299-4378
- HistoriqueScreen : 4379-4648
- callSubscription : 4649-4661
- AVANTAGES_PRO : 4662-4672
- SubscriptionScreen : 4673-4928
- MaSalleScreen : 4929-4961
- ProfilScreen : 4962-5420
  - handleAvatarUpload : 4983
  - openEdit : 5067
  - memes : 5073
  - saveEdit : 5077
- JOUR_MS : 5421-5421
- CIBLES : 5422-5427
- dateLocale : 5428-5428
- isoDans : 5429-5429
- joursAvant : 5430-5430
- dateLongue : 5431-5433
- phasesObjectif : 5434-5450
- etatPlan : 5451-5464
- datesDeMatch : 5465-5471
- adaptationDuJour : 5472-5485
- cleExercice : 5486-5487
- ressentisParExercice : 5488-5507
- poidsLePlusProche : 5508-5515
- appliquerRessenti : 5516-5531
- exerciceDepuisFiche : 5532-5546
- adapterSeance : 5547-5561
- FORMES : 5562-5569
- adaptationAvecForme : 5570-5576
- seanceCourte : 5577-5584
- Bloom : 5585-5588
- PLAN_DEBUT : 5589-5591
- ConstructionPlan : 5592-5654
- ObjectifScreen : 5655-5781
- MissionCard : 5782-5823
- isoDe : 5824-5824
- lireLocal : 5825-5825
- ecrireLocal : 5826-5827
- cleApresCompet : 5828-5830
- derniereCompet : 5831-5840
- choixApresCompet : 5841-5847
- blocCompensation : 5848-5856
- adaptationApresCompet : 5857-5865
- SEMAINE_CHARGEE : 5866-5866
- plusLeger : 5867-5868
- ApresCompetCard : 5869-5897
- MATERIEL_DEPANNAGE : 5898-5908
- MATERIEL_DEPANNAGE_SPORT : 5909-5917
- genererDepannage : 5918-5927
- DepannageChargement : 5928-5981
- DepannageSheet : 5982-6035
- SemaineCard : 6036-6106
- TESTS_CATALOGUE : 6107-6127
- TESTS_PAR_SPORT : 6128-6136
- COLONNES_TEST : 6137-6138
- TESTS_PAR_DISCIPLINE : 6139-6147
- testsDuSport : 6148-6148
- virgule : 6149-6149
- INTERVALLE_TEST : 6150-6152
- comparables : 6153-6158
- useTests : 6159-6170
- TestCard : 6171-6186
- TestScreen : 6187-6263
- dessinerSlide : 6264-6295
- CarrouselScreen : 6296-6366
- BottomNav : 6367-6396
- FormeDuJour : 6397-6426
- Interrupteur : 6427-6438
- progresExercices : 6439-6450
- virguleKg : 6451-6451
- RESULTATS_MISSION : 6452-6457
- BilanMissionScreen : 6458-6543
- appelerFonction : 6544-6552
- activerInvitation : 6553-6568
- lundiCourant : 6569-6574
- BilanSemaineCard : 6575-6619
- questionsAce : 6620-6620
- ACCUEIL_ACE : 6621-6622
- AceScreen : 6623-6729
- RappelsCard : 6730-6764
- JETON_STOP_RAPPELS : 6765-6766
- RappelsStopScreen : 6767-6786
- VoltraApp : 6787-7520
  - changerAbsentes : 6825
  - chargerRessentis : 6830
  - profilDeCharges : 6842
  - remplacerExercice : 6855
  - launchSeance : 6861
  - startGeneration : 6918
  - essayerInvitation : 6928
  - handleLogout : 7172

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

## supabase/functions/generate-program/index.ts (888 lignes)

Tables : profiles, programmes
Secrets lus (noms seulement) : ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, SUPABASE_URL

- KETTLEBELLS : 29-29
- MEDBALLS : 30-31
- SANS_CHARGE : 32-33
- detecterMateriel : 34-52
- detecterMouvement : 53-77
- niveauIndex : 78-82
- premiersReps : 83-87
- chargeMax : 88-105
- arrondirMateriel : 106-116
- securiserExercice : 117-130
- SYSTEM_PROMPT : 131-135
- MACHINES_SALLE : 136-145
- CROSS_SALLE : 146-148
- MACHINES_SECOURS : 149-157
- garantirMachines : 158-176
- FACTEURS_SEMAINE : 177-178
- BLOCS_CARDIO : 179-179
- DUREE_CARDIO : 180-180
- expandWeeks : 181-234
- securiserProgramme : 235-251
- NOMS_JOURS : 252-252
- LUNDI_DABORD : 253-264
- MIX_DEFAUT : 265-267
- mixSaison : 268-282
- planifierSemaine : 283-335
- TYPES_VALIDES : 336-336
- imposerPlan : 337-461
- REGLES_COACH : 462-495
- MATERIEL_LOURD : 496-528
- vocabulaire : 529-536
- buildPrompt : 537-733
- consigneSeance : 734-745
- demanderSeance : 746-888

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
