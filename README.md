# TipRanks Smart Portfolio Exporter

Ce script automatise l'extraction de l'historique des transactions de votre TipRanks Smart Portfolio vers un fichier CSV. Il a été conçu pour être fiable, simple d'utilisation sous Windows, et utilise Playwright pour interagir avec le site de manière sécurisée en contournant les protections anti-bots.

## 🌟 Fonctionnalités
- **Connexion persistante** : Connectez-vous manuellement lors du premier lancement. Votre session est sauvegardée localement (de manière sécurisée) pour que vous n'ayez plus besoin de vous identifier aux lancements suivants.
- **Extraction par lots** : Demandez l'extraction pour un ou plusieurs tickers simultanément (ex: `AAPL, MSFT, TSLA`). Le script les traitera un par un de manière totalement automatisée.
- **Sauvegarde CSV structurée** : Les transactions (Date, Type, Quantité, Prix) sont extraites, formatées, et le montant total est calculé automatiquement. Elles sont ensuite ajoutées proprement au fichier `tipranks_transactions.csv`.
- **Évite la détection** : Utilise un contexte persistant avec Chromium et des scripts d'anti-détection pour éviter d'être bloqué.

---

## 🛠️ Pré-requis techniques (Windows)

Pour utiliser ce script, vous avez uniquement besoin d'installer **Node.js** (l'environnement d'exécution de JavaScript).

1. **Télécharger Node.js** :
   - Rendez-vous sur le site officiel : [nodejs.org](https://nodejs.org/).
   - Téléchargez la version **LTS (Long Term Support)** (recommandée).
   - Lancez l'installateur et cliquez sur "Suivant" en laissant tous les paramètres par défaut.

2. **Vérifier l'installation** :
   - Ouvrez l'**Invite de commande** (tapez `cmd` dans la barre de recherche Windows).
   - Tapez `node -v` et appuyez sur Entrée. (Un numéro de version comme `v18.x.x` ou `v20.x.x` doit s'afficher).
   - Tapez `npm -v` et appuyez sur Entrée. (Un numéro de version doit s'afficher).

---

## 🚀 Installation du projet

1. **Préparer le dossier** :
   - Créez un dossier sur votre bureau ou dans vos documents, par exemple `TipRanksExport`.
   - Placez-y le fichier principal du script (nommez-le `export.js`).

2. **Ouvrir le terminal dans ce dossier** :
   - Ouvrez votre dossier `TipRanksExport`.
   - Cliquez dans la barre d'adresse en haut de la fenêtre (où est affiché le chemin d'accès), effacez le contenu, tapez `cmd` et appuyez sur **Entrée**.
   - Une fenêtre noire (Invite de commande) s'ouvre directement dans le bon dossier.

3. **Installer les dépendances** :
   - Dans cette fenêtre noire, tapez la commande suivante pour télécharger les outils nécessaires au script :
     ```bash
     npm install playwright csv-writer
     ```
   - Ensuite, installez le navigateur "Chromium" que le script va utiliser pour naviguer :
     ```bash
     npx playwright install chromium
     ```

---

## 💻 Comment exploiter le programme

Chaque fois que vous souhaitez utiliser le script pour extraire de nouvelles transactions, suivez ces étapes simples :

### 1. Démarrer le script
Dans l'Invite de commande (ouverte dans le dossier de votre projet), tapez :
```bash
node export.js
```

### 2. Le processus d'exécution

- **La phase de connexion (uniquement la première fois) :**
  - Une page de navigateur Chromium va s'ouvrir sur TipRanks.
  - Le terminal indiquera qu'il est "En attente de connexion (délai maximal de 2 minutes)".
  - Connectez-vous normalement à votre compte TipRanks. 
  - Dès que vous êtes connecté et que votre portefeuille s'affiche, le script le détectera automatiquement et enregistrera votre session dans un sous-dossier `chromium_user_data`. (Les fois suivantes, cette étape sera instantanée car vous serez déjà identifié !).

- **La phase d'extraction :**
  - Le terminal (fenêtre noire) vous demandera de saisir vos tickers :
    ```text
    ✍️ Entrez un ou plusieurs tickers séparés par des virgules (ex: MAN, AAPL, EAF) ou tapez 'exit' :
    ```
  - Tapez simplement les symboles que vous souhaitez extraire, par exemple `AAPL, MAN`, et faites Entrée.
  - Regardez le script travailler tout seul : il va chercher la ligne, ouvrir les détails, extraire les transactions, et les enregistrer dans un fichier Excel (CSV).

- **Où sont mes données ?**
  - Un fichier nommé `tipranks_transactions.csv` est créé dans le même dossier que le script. Vous pouvez l'ouvrir avec Excel ou Google Sheets. Les nouvelles extractions s'ajouteront toujours à la fin du fichier sans effacer les précédentes.

- **Quitter proprement :**
  - Lorsque vous avez terminé, tapez simplement `exit` ou `quit` dans le terminal et appuyez sur Entrée. Le script fermera le navigateur proprement.

---

## ⚠️ Notes importantes et dépannage

- **Ne supprimez pas le dossier `chromium_user_data`** : Ce dossier est créé automatiquement. Il contient les "cookies" de votre session. C'est grâce à lui que le script se souvient de vous à chaque lancement. Si vous le supprimez, vous devrez vous reconnecter manuellement.
- **Erreur `Error: Cannot find module 'playwright'`** : Cela signifie que vous avez sauté l'étape d'installation des dépendances. Refaites `npm install playwright csv-writer` dans l'invite de commande de ce dossier.
- **Le script plante ou est bloqué** : L'interface web de TipRanks peut parfois être lente à charger ou bien elle peut afficher des bannières. En cas de lenteur, le script patiente, mais si la page bogue, vous pouvez arrêter le script en faisant `Ctrl + C` dans le terminal, puis le relancer avec `node export.js`. En cas d'affichage de bannière soit dans le haut de page, soit dans la page au complet, fermez-la manuellement; fermer la bannière n'interrompt pas le script. Notez que la bannière en bas de page n'a aucun impact sur l'exécution du script. Vous pouvez donc l'ignorer.
- **Sensibilité aux mises à jour TipRanks** : Ce programme interagit avec l'interface web (DOM) de TipRanks. Si les développeurs de TipRanks changent radicalement le design du site (boutons, tableaux), le script pourrait ne plus trouver les éléments et nécessiterait une mise à jour des sélecteurs.
