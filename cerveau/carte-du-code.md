# Carte du code

Générée automatiquement à chaque commit : ne pas modifier à la main.
Pour lire un bloc : `sed -n 'début,finp' fichier`.

## src/App.jsx (6448 lignes)

Écrans : app, auth, cycle-complete, objectif, objectif-edit, onboarding, payment-success, pricing, programme-generating, splash, theme-choice, welcome
Tables : avatars, exercices, invitations_utilisees, logs_performance, matchs, profiles, programmes, rappels, seances, tests_performance
Fonctions SQL : appliquer_deload, calculer_progression, check_deload_needed

- URL_AU_CHARGEMENT : 11-16
- CLE_INVITATION : 17-17
- lireInvitation : 18-18
- oublierInvitation : 19-30
- getNiveauCycle : 31-38
- generateProgramIA : 39-59
- DAY_OPTIONS : 60-60
- DAY_NAMES : 61-61
- DEFAULT_JOURS : 62-68
- RATIOS_CHARGE : 69-76
- KETTLEBELLS : 77-77
- MEDBALLS : 78-78
- SANS_CHARGE : 79-80
- detecterMateriel : 81-97
- detecterMouvement : 98-122
- securiserExercice : 123-156
- attachJours : 157-164
- DayPicker : 165-188
- StepTitle : 189-198
- WHEEL_ITEM : 199-199
- WheelPicker : 200-229
- RULER_TICK : 230-230
- RulerPicker : 231-268
- saveCompleteSession : 269-345
- AceAvatar : 346-368
- SPORT_THEMES : 369-380
- accentLisible : 381-386
- getSportTheme : 387-398
- THEMES : 399-440
- applyTheme : 441-445
- fonduBas : 446-451
- hautSur : 452-455
- useStaggerUneFois : 456-461
- PrimaryButton : 462-479
- Input : 480-507
- Card : 508-521
- Badge : 522-539
- ProgressBar : 540-562
- MOCK_PROGRAM : 563-577
- SPORTS : 578-586
- SPORT_EMOJIS : 587-591
- OBJECTIFS_PAR_SPORT : 592-631
- OBJECTIFS : 632-632
- NIVEAUX : 633-633
- PLANS : 634-641
- getMuscleIcon : 642-697
- getExerciceColor : 698-708
- MOTIVATION : 709-713
- getRandom : 714-718
- RestTimer : 719-779
- SEG : 780-780
- SOL : 781-783
- ik2 : 784-792
- lerp : 793-793
- lerpCible : 794-797
- resoudre : 798-803
- epauleDe : 804-806
- cibleEntre : 807-812
- calculerPose : 813-830
- DEBOUT : 831-831
- PEND : 832-832
- construireMotif : 833-877
- motifExercice : 878-895
- ExerciseAnimation : 896-990
- poidsAnormal : 991-992
- ChampSerie : 993-1008
- SeanceScreen : 1009-1576
  - formatElapsed : 1062
  - remplacerCourant : 1076
  - sendCoachMessage : 1114
  - handleSetComplete : 1171
  - validerSerie : 1181
  - handlePause : 1204
- PaymentSuccessScreen : 1577-1640
- ProgrammeGeneratingScreen : 1641-1768
- CycleCompleteScreen : 1769-1861
- ThemeChoiceScreen : 1862-1977
- WelcomeScreen : 1978-2069
- SplashScreen : 2070-2108
- LEGAL_EMAIL : 2109-2109
- LEGAL_DATE : 2110-2111
- LEGAL_SIRET : 2112-2112
- LEGAL_STATUT : 2113-2113
- LEGAL_MEDIATEUR : 2114-2114
- LEGAL_DOCS : 2115-2163
- LegalScreen : 2164-2193
- CLE_CODE_EMAIL : 2194-2194
- lireCodeEmail : 2195-2200
- garderCodeEmail : 2201-2208
- avecDelai : 2209-2214
- AuthScreen : 2215-2508
- POSTES_PAR_SPORT : 2509-2547
- DOULEURS : 2548-2556
- EQUIPEMENTS : 2557-2563
- TOTAL_STEPS : 2564-2565
- OnboardingScreen : 2566-3151
  - getStepContent : 2586
  - goNext : 2598
  - getReactionMessage : 2615
  - handleFinish : 2655
  - retryGeneration : 2666
  - skipGeneration : 2671
  - toggleDouleur : 2677
  - canNext : 2692
- MESSAGES_INVITATION : 3152-3156
- PricingScreen : 3157-3306
- MatchsScreen : 3307-3451
- DashboardScreen : 3452-3707
- HistoriqueScreen : 3708-3995
- callSubscription : 3996-4008
- AVANTAGES_PRO : 4009-4019
- SubscriptionScreen : 4020-4275
- MaSalleScreen : 4276-4308
- ProfilScreen : 4309-4748
  - handleAvatarUpload : 4330
  - openEdit : 4414
  - saveEdit : 4419
- JOUR_MS : 4749-4749
- CIBLES : 4750-4755
- dateLocale : 4756-4756
- isoDans : 4757-4757
- joursAvant : 4758-4758
- dateLongue : 4759-4761
- phasesObjectif : 4762-4778
- etatPlan : 4779-4792
- datesDeMatch : 4793-4799
- adaptationDuJour : 4800-4813
- cleExercice : 4814-4815
- ressentisParExercice : 4816-4835
- poidsLePlusProche : 4836-4843
- appliquerRessenti : 4844-4859
- exerciceDepuisFiche : 4860-4874
- adapterSeance : 4875-4889
- FORMES : 4890-4897
- adaptationAvecForme : 4898-4904
- seanceCourte : 4905-4912
- Bloom : 4913-4915
- ObjectifScreen : 4916-5057
- MissionCard : 5058-5099
- SemaineCard : 5100-5138
- TESTS_PERF : 5139-5143
- virgule : 5144-5144
- INTERVALLE_TEST : 5145-5146
- useTests : 5147-5157
- TestCard : 5158-5173
- TestScreen : 5174-5246
- dessinerSlide : 5247-5278
- CarrouselScreen : 5279-5346
- BottomNav : 5347-5376
- FormeDuJour : 5377-5406
- Interrupteur : 5407-5418
- progresExercices : 5419-5430
- virguleKg : 5431-5431
- RESULTATS_MISSION : 5432-5437
- BilanMissionScreen : 5438-5523
- appelerFonction : 5524-5532
- activerInvitation : 5533-5548
- lundiCourant : 5549-5554
- BilanSemaineCard : 5555-5598
- QUESTIONS_ACE : 5599-5599
- ACCUEIL_ACE : 5600-5601
- AceScreen : 5602-5696
- RappelsCard : 5697-5731
- JETON_STOP_RAPPELS : 5732-5733
- RappelsStopScreen : 5734-5753
- VoltraApp : 5754-6448
  - changerAbsentes : 5789
  - chargerRessentis : 5794
  - profilDeCharges : 5806
  - remplacerExercice : 5818
  - launchSeance : 5824
  - startGeneration : 5864
  - essayerInvitation : 5874
  - handleLogout : 6098

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
