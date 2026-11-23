# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (7542 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, welcome
Tables : avatars, exercices, invitations_utilisees, logs_performance, matchs, profiles, programmes, rappels, seances, tests_performance
Fonctions SQL : appliquer_deload, calculer_progression, check_deload_needed

- URL_AU_CHARGEMENT : 11-18
- CLE_INVITATION : 19-19
- lireInvitation : 20-20
- oublierInvitation : 21-35
- getNiveauCycle : 36-43
- generateProgramIA : 44-64
- DAY_OPTIONS : 65-65
- DAY_NAMES : 66-66
- DEFAULT_JOURS : 67-69
- COMPETITIONS : 70-76
- definirSport : 77-81
- motsSport : 82-88
- SAISONS : 89-93
- RYTHME_DEFAUT : 94-96
- frequenceConseillee : 97-103
- joursConseilles : 104-123
- TYPES_SEANCE : 124-129
- typeSeance : 130-131
- duree : 132-133
- dosage : 134-140
- RATIOS_CHARGE : 141-148
- KETTLEBELLS : 149-149
- MEDBALLS : 150-150
- SANS_CHARGE : 151-152
- detecterMateriel : 153-171
- detecterMouvement : 172-196
- securiserExercice : 197-232
- attachJours : 233-240
- DayPicker : 241-271
- RythmeClub : 272-313
- StepTitle : 314-323
- RULER_TICK : 324-324
- RulerPicker : 325-362
- saveCompleteSession : 363-443
- AceAvatar : 444-466
- SPORT_THEMES : 467-478
- accentLisible : 479-484
- getSportTheme : 485-496
- THEMES : 497-538
- applyTheme : 539-543
- fonduBas : 544-549
- hautSur : 550-553
- useStaggerUneFois : 554-559
- PrimaryButton : 560-577
- Input : 578-605
- Card : 606-619
- Badge : 620-637
- ProgressBar : 638-660
- MOCK_PROGRAM : 661-675
- SPORTS : 676-684
- SPORT_EMOJIS : 685-689
- OBJECTIFS_PAR_SPORT : 690-729
- OBJECTIFS : 730-730
- NIVEAUX : 731-731
- PLANS : 732-739
- getMuscleIcon : 740-795
- getExerciceColor : 796-806
- MOTIVATION : 807-811
- getRandom : 812-816
- RestTimer : 817-877
- SEG : 878-878
- SOL : 879-881
- ik2 : 882-890
- lerp : 891-891
- lerpCible : 892-895
- resoudre : 896-901
- epauleDe : 902-904
- cibleEntre : 905-910
- calculerPose : 911-928
- DEBOUT : 929-929
- PEND : 930-930
- construireMotif : 931-975
- motifExercice : 976-993
- ExerciseAnimation : 994-1088
- poidsAnormal : 1089-1090
- ChampSerie : 1091-1106
- SeanceScreen : 1107-1715
  - formatElapsed : 1161
  - remplacerCourant : 1198
  - sendCoachMessage : 1240
  - handleSetComplete : 1297
  - validerSerie : 1307
  - handlePause : 1331
- PaymentSuccessScreen : 1716-1779
- ProgrammeGeneratingScreen : 1780-1907
- CycleCompleteScreen : 1908-2011
- WelcomeScreen : 2012-2103
- SplashScreen : 2104-2142
- LEGAL_EMAIL : 2143-2143
- LEGAL_DATE : 2144-2145
- LEGAL_SIRET : 2146-2146
- LEGAL_STATUT : 2147-2147
- LEGAL_MEDIATEUR : 2148-2148
- LEGAL_DOCS : 2149-2197
- LegalScreen : 2198-2227
- CLE_CODE_EMAIL : 2228-2228
- lireCodeEmail : 2229-2234
- garderCodeEmail : 2235-2242
- avecDelai : 2243-2248
- AuthScreen : 2249-2543
- POSTES_PAR_SPORT : 2544-2582
- DOULEURS : 2583-2591
- EQUIPEMENTS : 2592-2598
- MATERIEL_LIEU : 2599-2614
- CHARGES_MAISON : 2615-2617
- MaterielLieu : 2618-2641
- TOTAL_STEPS : 2642-2643
- OnboardingScreen : 2644-3239
  - getStepContent : 2665
  - goNext : 2677
  - getReactionMessage : 2699
  - handleFinish : 2742
  - retryGeneration : 2753
  - skipGeneration : 2758
  - toggleDouleur : 2764
  - canNext : 2779
- MESSAGES_INVITATION : 3240-3244
- PricingScreen : 3245-3394
- MatchsScreen : 3395-3539
- DashboardScreen : 3540-3820
- ecartTest : 3821-3825
- minSec : 3826-3826
- valeurTest : 3827-3827
- semainesEntre : 3828-3829
- AvantMaintenant : 3830-3883
- ZONES_CORPS : 3884-3895
- sansAccents : 3896-3898
- zonesDepuisMuscles : 3899-3911
- COULEURS_NIVEAU : 3912-3912
- rgbNiveau : 3913-3921
- ZONES_CARTE : 3922-3926
- chargerImage : 3927-3932
- peindreCorps : 3933-3990
- CorpsIllustre : 3991-4012
- ANCRES_ZONES : 4013-4019
- NIVEAUX_CORPS : 4020-4021
- SEUILS_FORCE : 4022-4027
- SEUILS_VOLUME : 4028-4028
- palier : 4029-4029
- PERIODES_CORPS : 4030-4031
- useSeriesCorps : 4032-4054
- niveauxEntre : 4055-4074
- lireSeries : 4075-4099
- corpsPartage : 4100-4107
- tNiveau : 4108-4109
- CarteDuCorps : 4110-4187
- PARTAGE_DUREE : 4188-4188
- lisse : 4189-4189
- entre : 4190-4191
- dessinerCartePartage : 4192-4314
- PartageProgression : 4315-4394
- HistoriqueScreen : 4395-4664
- callSubscription : 4665-4677
- AVANTAGES_PRO : 4678-4688
- SubscriptionScreen : 4689-4944
- MaSalleScreen : 4945-4977
- ProfilScreen : 4978-5436
  - handleAvatarUpload : 4999
  - openEdit : 5083
  - memes : 5089
  - saveEdit : 5093
- JOUR_MS : 5437-5437
- CIBLES : 5438-5443
- dateLocale : 5444-5444
- isoDans : 5445-5445
- joursAvant : 5446-5446
- dateLongue : 5447-5449
- phasesObjectif : 5450-5466
- etatPlan : 5467-5480
- datesDeMatch : 5481-5487
- adaptationDuJour : 5488-5501
- cleExercice : 5502-5503
- ressentisParExercice : 5504-5523
- poidsLePlusProche : 5524-5531
- appliquerRessenti : 5532-5547
- exerciceDepuisFiche : 5548-5562
- adapterSeance : 5563-5577
- FORMES : 5578-5585
- adaptationAvecForme : 5586-5592
- seanceCourte : 5593-5600
- Bloom : 5601-5604
- PLAN_DEBUT : 5605-5607
- ConstructionPlan : 5608-5670
- ObjectifScreen : 5671-5797
- MissionCard : 5798-5839
- isoDe : 5840-5840
- lireLocal : 5841-5841
- ecrireLocal : 5842-5843
- cleApresCompet : 5844-5846
- derniereCompet : 5847-5856
- choixApresCompet : 5857-5863
- blocCompensation : 5864-5872
- adaptationApresCompet : 5873-5881
- SEMAINE_CHARGEE : 5882-5882
- plusLeger : 5883-5884
- ApresCompetCard : 5885-5913
- MATERIEL_DEPANNAGE : 5914-5924
- MATERIEL_DEPANNAGE_SPORT : 5925-5933
- genererDepannage : 5934-5943
- DepannageChargement : 5944-5997
- DepannageSheet : 5998-6051
- SemaineCard : 6052-6122
- TESTS_CATALOGUE : 6123-6143
- TESTS_PAR_SPORT : 6144-6152
- COLONNES_TEST : 6153-6154
- TESTS_PAR_DISCIPLINE : 6155-6163
- testsDuSport : 6164-6164
- virgule : 6165-6165
- INTERVALLE_TEST : 6166-6168
- comparables : 6169-6174
- useTests : 6175-6186
- TestCard : 6187-6202
- TestScreen : 6203-6279
- dessinerSlide : 6280-6311
- CarrouselScreen : 6312-6382
- BottomNav : 6383-6412
- FormeDuJour : 6413-6442
- Interrupteur : 6443-6454
- progresExercices : 6455-6466
- virguleKg : 6467-6467
- RESULTATS_MISSION : 6468-6473
- BilanMissionScreen : 6474-6559
- appelerFonction : 6560-6568
- activerInvitation : 6569-6584
- lundiCourant : 6585-6590
- BilanSemaineCard : 6591-6635
- questionsAce : 6636-6636
- ACCUEIL_ACE : 6637-6638
- AceScreen : 6639-6745
- RappelsCard : 6746-6780
- JETON_STOP_RAPPELS : 6781-6782
- RappelsStopScreen : 6783-6802
- VoltraApp : 6803-7542
  - changerAbsentes : 6841
  - chargerRessentis : 6846
  - profilDeCharges : 6858
  - remplacerExercice : 6871
  - launchSeance : 6877
  - startGeneration : 6934
  - essayerInvitation : 6944
  - handleLogout : 7194

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
