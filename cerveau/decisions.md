# Décisions déjà prises

À ne pas rediscuter sauf si Waner le demande.

- **Pas de plafond de messages** sur le coach pour l'instant.
- **Le paiement reste sur la page Stripe** pour l'instant (6 novembre 2026). Possible plus tard : le formulaire Stripe intégré à une page de l'app, avec la clé publique `pk_live`.
- **Pas de case de rétractation** dans le parcours d'achat : à la place, remboursement intégral et arrêt immédiat sur demande pendant 14 jours après la souscription.
- **Pas de relecture par un juriste** pour le lancement : choix de Waner, le 5 novembre 2026.
- **Âge minimum 15 ans** (5 novembre 2026), abonnement souscrit par un adulte ou un parent. Pas de notation du physique par photo, à cause des mineurs.
- **Machines : des dessins, pas de photos ni de tutoriel**, car les salles ont déjà leurs explications. Les mouvements libres gardent le bonhomme animé.
- **Pas de 3D pour le MVP** (essai Blender abandonné ; vidéos de test non versionnées dans `docs/videos-test/`).
- **Le plan va jusqu'à la date de l'objectif**, pas un nombre fixe de semaines.
- **Viralité (saut filmé, carte d'athlète, défi d'équipe) : mise de côté** jusqu'après le lancement. Pistes dans l'historique.
- **Le carrousel TikTok sert aux publicités de Waner**, pas aux utilisateurs.
- **Logo** (5 novembre 2026) : le V-éclair vert sur tuile noire. La forme est dans `src/logoForme.js` ; `npm run icones` régénère le favicon et les icônes. L'emoji ⚡ reste pour les contenus, pas comme logo.
- **Moment d'installation** : sur l'accueil, le bloc reste sous le titre (choix de Waner, même si le bouton principal descend). Tableau de bord seulement après une séance terminée ou à partir du lendemain de la première visite. Jamais par-dessus un écran, ni pendant le paiement ou une séance.
- **Mise à jour de l'app** : le toast n'apparaît que sur l'accueil et le tableau de bord, car recharger ferait perdre une séance en cours.
- **Rétention** (6 novembre 2026) : Waner a validé les 5 fonctions (forme du jour, bilan de la semaine, rappels, bilan de mission, Ace partout). La forme du jour n'est pas enregistrée, pour ne pas stocker de nouvelle donnée de santé. La relance est activée par défaut et s'arrête après 3 e-mails ; le rappel du matin se demande.
- **Alimentation et coach** (6 novembre 2026) : Waner autorise Ace à parler d'aliments et de régimes. Limites gardées : pour un mineur ou un âge inconnu, pas de régime amaigrissant, de comptage de calories ni de complément ; pour tous, pas de régime extrême ni de dopant, et un renvoi vers un médecin si le rapport à la nourriture semble difficile.
- **Un fichier principal** `src/App.jsx` : le découper n'est pas prévu avant le lancement.
