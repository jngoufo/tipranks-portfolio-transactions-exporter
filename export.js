/**
 * Script d'extraction automatique du portefeuille TipRanks
 * Rejoint le navigateur Chromium isolé pour stocker votre session de connexion de manière sécurisée.
 * 
 * Prérequis : 
 * 1. Installer Node.js sur votre machine.
 * 2. Installer Playwright : npm install playwright csv-writer
 */

const { chromium } = require('playwright');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const readline = require('readline');

// Fonction utilitaire pour poser des questions dans le terminal de manière synchrone
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

// Un dossier de profil dédié localisé directement dans votre dossier d'exportation.
// Vos cookies et états de session y seront stockés de manière isolée et sécurisée.
// Lors du tout premier lancement, connectez-vous manuellement. La session sera sauvegardée pour les lancements futurs !
const PROFILE_PATH = path.join(__dirname, 'chromium_user_data');
const OUTPUT_FILE = "tipranks_transactions.csv";

async function run() {
  console.log("🚀 Initialisation de Playwright (Chromium) avec un profil de session isolé...");
  console.log("📂 Dossier de stockage de session : " + PROFILE_PATH);
  console.log("💡 Astuce : Si vous avez un dossier 'user_data' vide ou obsolète issu des anciennes tentatives Firefox, vous pouvez le supprimer.");

  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_PATH, {
      headless: false, // Mode visible pour vous connecter et suivre l'avancement
      viewport: { width: 1280, height: 800 },
      // Masquage de l'automatisation pour contourner les protections anti-bots (Cloudflare)
      args: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  } catch (error) {
    console.error("❌ Impossible de lancer le navigateur.");
    console.error(error.message);
    process.exit(1);
  }

  // Ouvrir un nouvel onglet propre pour notre navigation
  const page = await context.newPage();

  // Injecter un script d'anti-détection pour désactiver navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  
  // Fermer l'onglet vide initial ouvert par défaut s'il existe pour garder un seul onglet propre
  try {
    const pages = context.pages();
    if (pages.length > 1) {
      await pages[0].close();
    }
  } catch (e) {
    // Ignorer si la fermeture échoue
  }
  
  console.log("🌐 Navigation vers le portefeuille TipRanks...");
  await page.goto('https://www.tipranks.com/smart-portfolio/holdings', { waitUntil: 'domcontentloaded' });

  // 1. Attente que la page se charge. Si non connecté, invite l'utilisateur à se connecter.
  console.log("⏱️ Analyse de la session de connexion...");
  try {
    // Attendre un élément spécifique du portefeuille (ex: le tableau des holdings ou le résumé du portefeuille)
    await page.waitForSelector('.portfolio-holdings-table, [class*="HoldingsTable"], [class*="portfolio"]', { timeout: 15000 });
    console.log("✅ Session active détectée ! Vous êtes connecté.");
  } catch (err) {
    console.log("⚠️ Session active non détectée immédiatement.");
    console.log("👉 Veuillez vous connecter manuellement dans la fenêtre Chromium qui vient de s'ouvrir.");
    console.log("⏱️ En attente de connexion (délai maximal de 2 minutes)...");
    try {
      await page.waitForSelector('[class*="HoldingsTable"], .portfolio-holdings-table, [class*="portfolio"]', { timeout: 120000 });
      console.log("🎉 Connexion réussie détectée !");
    } catch (loginErr) {
      console.error("❌ Temps d'attente dépassé. Arrêt du script.");
      await context.close();
      process.exit(1);
    }
  }

  // TipRanks a souvent un onglet ou un bouton "Transactions" / "Activity" dans l'interface du portefeuille
  // Nous essayons de cliquer sur cet onglet s'il existe.
  const transactionTabs = [
    "text=Transactions",
    "text=Transaction History",
    "text=Historique",
    "text=Activités",
    'a[href*="transactions"]',
    'button:has-text("Transactions")'
  ];

  let tabClicked = false;
  for (const tabSelector of transactionTabs) {
    try {
      const tab = await page.$(tabSelector);
      if (tab) {
        console.log("🖱️ Clic sur l'onglet : " + tabSelector);
        await tab.click();
        await page.waitForTimeout(2000);
        tabClicked = true;
        break;
      }
    } catch (e) {
      // Ignorer et essayer le suivant
    }
  }

  if (!tabClicked) {
    console.log("Navigation directe vers l'URL des transactions...");
    await page.goto('https://www.tipranks.com/smart-portfolio/holdings', { waitUntil: 'networkidle' }).catch(() => {});
  }

  // Attendre le chargement de la table des transactions
  console.log("⏱️ Chargement des transactions...");
  await page.waitForTimeout(3000); // Pause de sécurité pour le rendu dynamique
  //
  // [Instructions d'origine]
  // La page contient une liste d'une centaine d'éléments comme celui qui suit: <tr class="rt-tr" data-key="MAN">. valeur du data-key = ticker. a ce stade, voici le processus qu'on va automatiser en le répétant en boucle. supposons que tu es le script...
  // 1. tu me demandes un ticker et tu attends que je te le fournisses
  // 2. tu reçois le ticker. nommons le t
  // dans le DOM, tu vas trouver l'élément comme celui fournit ci-dessus dont data-key="t"
  // tu cliques sur l'élément <td>, premier enfant direct de <tr>
  // tu attends que l'élément suivant s'ouvre ou apparaisse dans l'ui: <div class="flexcs_     displayflex maxWparent positionrelative">
  // tu vas cliquer sur la tab "Transactions" dont voici l'élément dans le DOM:  <div class="flexrcc w12  px3  displayflex h_px1  pr5 bt3_solid borderColortransparent">
  // tu attends que l'élément suivant apparaisse dans l'ui: <div class="displayflex">. il contient cet autre élément: <span class="fonth7_semibold mt4">Transaction History</span> qui doit être visible dans l'UI
  //
  // [Nouvelles Instructions]
  // Suite du programme:
  // 1- dans l'élément <div class="displayflex"> (la tab Transaction History), tu verras une autre tab dont l'élément est <span class="fontWeightsemibold    displayinline-block beforebold" data-text="Reported by me">Reported by me</span>. c'est la tab (parmi les 2 tabs dans Transaction History) qui s'ouvre par défaut quand on est dans Transaction History. assure toi quand meme que c'est elle qui est selectionnée (texte Reported by me est gras)
  // 2- a lintereiur de l'élément <div class="displayflex">, il y a une enfant de troisieme niveau <div class="flexcs_ w12 p3   displayflex"> (enfant niveau 1=<div class="flexcs_ w12  px3  displayflex">; enfant niveau 2 = <div class="mt3 displayblock positionrelative shadowdown-1">). c'est cet enfant de troisieme niveau qui contient toutes les transactions ligne par ligne. à l'intérieur de cet enfant de troisieme niveau se trouve l'élément <div class="rt-tbody">, qui contient lui-meme des enfants: <div class="rt-tr-group">. chacun de ces enfants représentent une transaction unique. dans cahcun des enfants, on a l'élément <div class="rt-tr"> qui contient 5 autres éléments <div class="rt-td rt-left"> contenant des données de transaction suivantes, classés dans l'ordre de succession dans le DOM: Date, Type, Shares, Price. dans chacun des 4 premiers seulement parmi ces 5 éléments, il y a un élément span dont tu va extraire la valeur en la copiant, puis en la collant dans le fichier tipranks_transactions dans le dossier commun TipRanksExport. J'ai déjà préparer le fichier en question avec les colonnes du même nom. tu devras juste coller chaque transaction sur une seule ligne, puis passer à la ligne suivante

  // Affichage d'un message pour démarrer la boucle d'exploration interactive
  console.log("\n🔄 Entrée dans le mode d'exploration interactif.");
  // Astuce pour l'utilisateur sur comment utiliser le script
  console.log("💡 Vous pouvez maintenant saisir un ou plusieurs tickers (ex: MAN, AAPL, EAF) pour inspecter leurs transactions.");
  // Indication de la commande pour quitter le programme
  console.log("💡 Saisissez 'exit' pour quitter le script.");

  // Boucle infinie pour demander continuellement des tickers à l'utilisateur (saisie unique ou multiple)
  while (true) {
    // On pose la question à l'utilisateur dans le terminal de commande et on attend sa réponse
    const userInput = await askQuestion("\n✍️ Entrez un ou plusieurs tickers séparés par des virgules (ex: MAN, AAPL, EAF) ou tapez 'exit' : ");
    // On nettoie la saisie en retirant les espaces superflus au début et à la fin
    const cleanedInput = userInput.trim();

    // Si l'utilisateur souhaite quitter le script
    if (cleanedInput.toUpperCase() === 'EXIT' || cleanedInput.toUpperCase() === 'QUIT') {
      // Message de sortie
      console.log("👋 Sortie du script interactif...");
      // On sort de la boucle principale
      break;
    }

    // Si la saisie est vide, on l'avertit et on passe à l'itération suivante
    if (!cleanedInput) {
      console.log("⚠️ Saisie vide. Veuillez entrer au moins un ticker valide.");
      // On repose la question à la prochaine itération
      continue;
    }

    // On divise la saisie par des séparateurs (virgule, point-virgule ou espaces) pour extraire chaque ticker individuel
    const tickers = cleanedInput
      .split(/[\s,;]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    // Si aucun ticker n'est exploitable après filtrage
    if (tickers.length === 0) {
      console.log("⚠️ Aucun ticker valide trouvé dans votre saisie.");
      // On continue
      continue;
    }

    // Message récapitulatif listant tous les tickers qui vont être traités séquentiellement
    console.log(`📋 ${tickers.length} ticker(s) détecté(s) à traiter l'un après l'autre : ${tickers.join(', ')}`);

    // On parcourt chaque ticker de la liste un par un
    for (let i = 0; i < tickers.length; i++) {
      const t = tickers[i];
      console.log(`\n⏳ [${i + 1}/${tickers.length}] Traitement en cours du ticker "${t}"...`);

    // Message d'information indiquant qu'on cherche la ligne du ticker dans le tableau web
    console.log(`🔍 Recherche de la ligne correspondant au ticker "${t}" dans le tableau (tr[data-key="${t}"])...`);
    try {
      // On cherche l'élément de ligne de table (<tr>) qui possède l'attribut data-key égal au ticker t
      const row = await page.$(`tr[data-key="${t}"]`);

      // Si cet élément n'existe pas dans la page, on informe l'utilisateur et on lui demande un autre ticker
      if (!row) {
        console.log(`❌ Ticker "${t}" introuvable dans la table actuelle. Assurez-vous qu'il figure bien dans la liste.`);
        // On passe à la prochaine itération de la boucle
        continue;
      }

      // Si trouvé, on indique qu'on va cliquer sur la troisième cellule (<td>) pour ouvrir les détails
      console.log(`🖱️ Ticker "${t}" trouvé ! Clic sur la troisième cellule <td> de la ligne...`);
      // On récupère toutes les cellules <td> de la ligne sous forme de tableau
      const tds = await row.$$('td');
      // Si la ligne contient moins de 3 cellules, on signale l'erreur et on passe
      if (tds.length < 3) {
        console.log("❌ Impossible de trouver la troisième cellule <td> pour ce ticker.");
        // On passe à la prochaine itération de la boucle
        continue;
      }
      // On sélectionne la troisième cellule (index 2 dans le tableau, car l'index commence à 0)
      const targetTd = tds[2];
      // On clique sur la troisième cellule pour provoquer l'ouverture du panneau latéral de détails
      await targetTd.click();

      // Message d'attente pendant l'affichage du panneau de détails
      console.log("⏱️ Attente de l'apparition du conteneur de détails...");
      // Sélecteur précis du conteneur de détails fourni par l'utilisateur
      const detailsSelector = 'div[class*="flexcs_"][class*="displayflex"][class*="maxWparent"][class*="positionrelative"]';
      // On attend au maximum 15 secondes que ce conteneur apparaisse à l'écran
      await page.waitForSelector(detailsSelector, { timeout: 15000 });
      // Succès de l'ouverture
      console.log("✅ Conteneur de détails ouvert avec succès !");

      // Message indiquant le clic sur l'onglet d'historique des transactions
      console.log("🖱️ Clic sur l'onglet 'Transactions'...");
      // Sélecteur de l'onglet transactions fourni par l'utilisateur
      const tabSelector = 'div[class*="flexrcc"][class*="w12"][class*="px3"][class*="displayflex"][class*="borderColortransparent"]';
      
      // On recherche l'onglet par sa classe spécifique
      let tabElement = await page.$(tabSelector);
      if (!tabElement) {
        // En cas d'échec ou de légère variation, on utilise une recherche basée sur le texte "Transactions"
        tabElement = await page.$('div[class*="flexcs_"] >> text="Transactions"');
      }

      // Si l'élément d'onglet a été trouvé
      if (tabElement) {
        // On clique dessus pour activer la section de l'historique
        await tabElement.click();
        console.log("✅ Clic sur l'onglet effectué.");
      } else {
        // Sinon, on fait une tentative de clic direct sur le texte brut comme solution de repli
        console.log("⚠️ Onglet non trouvé par les classes spécifiques, tentative de clic par texte direct...");
        await page.click('text=Transactions').catch(() => {});
      }

      // --- ÉTAPE 1 : Assurer la sélection de la sous-tab "Reported by me" ---
      // On cherche l'élément span contenant le texte "Reported by me" et l'attribut data-text correspondant
      const tabReportedByMe = await page.$('span[data-text="Reported by me"]');
      if (tabReportedByMe) {
        console.log("🖱️ Vérification et clic sur l'onglet 'Reported by me' pour assurer sa sélection...");
        // On effectue un clic explicite sur cette tab
        await tabReportedByMe.click();
        // Courte pause d'une seconde pour que l'affichage des lignes de transactions s'actualise
        await page.waitForTimeout(1000);
      } else {
        console.log("⚠️ Onglet 'Reported by me' non trouvé par attribut direct, continuation par défaut.");
      }

      // --- ÉTAPE 2 : Extraction et sauvegarde des transactions ligne par ligne ---
      console.log("📊 Extraction des données de transactions depuis le tableau...");
      // On extrait les lignes en exécutant du code JavaScript directement au sein de la page web ouverte
      const extractedRows = await page.evaluate((tickerSymbol) => {
        // Liste pour stocker toutes les transactions extraites pour ce ticker
        const results = [];
        
        // On trouve le conteneur des détails actuellement affiché à l'écran
        const detailsContainer = document.querySelector('div[class*="flexcs_"][class*="displayflex"][class*="maxWparent"][class*="positionrelative"]');
        if (!detailsContainer) return [];

        // On cherche l'élément de corps de tableau '.rt-tbody' à l'intérieur
        const tbody = detailsContainer.querySelector('.rt-tbody');
        if (!tbody) return [];

        // On récupère tous les éléments de groupe de ligne '.rt-tr-group'
        const trGroups = tbody.querySelectorAll('.rt-tr-group');
        
        // On boucle sur chaque groupe de ligne de transaction
        trGroups.forEach(group => {
          // On accède à la ligne réelle '.rt-tr'
          const tr = group.querySelector('.rt-tr');
          if (!tr) return;

          // On cherche les cellules de colonnes '.rt-td.rt-left' ou '.rt-td'
          const cells = tr.querySelectorAll('.rt-td.rt-left, .rt-td');
          // On s'assure d'avoir au moins les 4 colonnes contenant les informations (Date, Type, Shares, Price)
          if (cells.length >= 4) {
            // Dans chacune des 4 premières cellules, on cherche la balise <span> contenant la valeur textuelle
            const dateSpan = cells[0].querySelector('span');
            const typeSpan = cells[1].querySelector('span');
            const sharesSpan = cells[2].querySelector('span');
            const priceSpan = cells[3].querySelector('span');

            // On récupère les textes nettoyés de chaque colonne
            const dateVal = dateSpan ? dateSpan.innerText.trim() : '';
            const typeVal = typeSpan ? typeSpan.innerText.trim() : '';
            const sharesVal = sharesSpan ? sharesSpan.innerText.trim() : '';
            const priceVal = priceSpan ? priceSpan.innerText.trim() : '';

            // Si au moins l'une des valeurs est présente, on ajoute la transaction à notre liste
            if (dateVal || typeVal || sharesVal || priceVal) {
              results.push({
                ticker: tickerSymbol,
                date: dateVal,
                type: typeVal,
                shares: sharesVal,
                price: priceVal
              });
            }
          }
        });

        // On renvoie les transactions extraites vers notre script principal
        return results;
      }, t);

      // Si nous avons réussi à extraire au moins une transaction
      if (extractedRows && extractedRows.length > 0) {
        // Message affichant le nombre total de lignes extraites pour ce ticker
        console.log(`✅ ${extractedRows.length} transaction(s) extraite(s) pour le ticker "${t}" !`);
        
        // --- ÉTAPE 3 : Conversion, formatage et alignement des colonnes du fichier CSV ---
        // Le fichier CSV existant possède les colonnes suivantes : ID, Ticker, Date, Type, Shares, Price, TotalAmount
        // Nous allons transformer les données brutes pour remplir correctement chacune de ces colonnes et calculer automatiquement le TotalAmount.
        const formattedRows = extractedRows.map((row, index) => {
          // Fonction interne pour nettoyer les caractères spéciaux (ex: $, espaces, virgules) et convertir en nombre décimal
          const cleanNumber = (str) => {
            if (!str) return 0;
            // On retire tout ce qui n'est pas un chiffre, un point ou un signe moins
            return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
          };

          // Conversion et parsing de la quantité d'actions (Shares)
          const parsedShares = cleanNumber(row.shares);
          // Conversion et parsing du prix unitaire (Price)
          const parsedPrice = cleanNumber(row.price);
          // Calcul automatique du montant total (TotalAmount = Shares * Price) arrondi à 2 décimales
          const totalAmount = parseFloat((parsedShares * parsedPrice).toFixed(2));
          
          // Génération d'un identifiant unique (ID) pour cette transaction afin de ne pas perturber les lignes du CSV
          const uniqueId = "tr_" + row.ticker.toLowerCase() + "_" + Date.now() + "_" + index;

          // On retourne l'objet avec les clés exactes configurées dans le header ci-dessous
          return {
            id: uniqueId,            // Correspond à la colonne 'ID'
            ticker: row.ticker,      // Correspond à la colonne 'Ticker'
            date: row.date,          // Correspond à la colonne 'Date'
            type: row.type,          // Correspond à la colonne 'Type'
            shares: row.shares,      // Correspond à la colonne 'Shares'
            price: row.price,        // Correspond à la colonne 'Price'
            totalAmount: totalAmount // Correspond à la colonne 'TotalAmount'
          };
        });

        // Initialisation de l'outil d'écriture CSV (csv-writer)
        // Configuration de l'ordre exact et de la correspondance des clés de nos données avec les en-têtes réels du fichier CSV
        const csvWriterInstance = createCsvWriter({
          path: OUTPUT_FILE,
          header: [
            { id: 'id', title: 'ID' },
            { id: 'ticker', title: 'Ticker' },
            { id: 'date', title: 'Date' },
            { id: 'type', title: 'Type' },
            { id: 'shares', title: 'Shares' },
            { id: 'price', title: 'Price' },
            { id: 'totalAmount', title: 'TotalAmount' }
          ],
          append: true // TRÈS IMPORTANT : Permet d'ajouter les lignes de manière continue sans effacer les anciennes données
        });

        // Écriture effective des lignes formatées à la suite dans notre fichier csv
        await csvWriterInstance.writeRecords(formattedRows);
        // Message de succès dans le terminal
        console.log(`💾 Les transactions pour "${t}" ont été sauvegardées avec succès dans "${OUTPUT_FILE}" !`);
      } else {
        // Alerte si le tableau était vide ou incompréhensible
        console.log(`⚠️ Aucune transaction trouvée ou lisible dans le tableau pour le ticker "${t}".`);
      }

      // --- ÉTAPE 4 : Fermeture du conteneur de détails pour restaurer l'état de l'interface ---
      console.log("🧹 Fermeture du panneau de détails pour réinitialiser l'interface...");
      // Sélecteur précis pour le bouton de fermeture (croix) : <button class="fontSize9 px3 pt3 hoverColorgray-4 positionsticky anchortop z3 bgwhite">
      const closeButtonSelector = '.bgwhite > button';
      
      const closeButton = await page.$(closeButtonSelector);
      if (closeButton) {
        // Clic sur le bouton de fermeture
        await closeButton.click();
        console.log("✅ Le panneau de détails a été fermé avec succès.");
        // Petite pause d'une seconde pour laisser la transition de fermeture se terminer correctement
        await page.waitForTimeout(1000);
      } else {
        console.log("⚠️ Bouton de fermeture du panneau de détails non trouvé par classes, tentative de clic par l'icône...");
        // Tentative de secours en cliquant directement sur l'élément d'icône croix
        await page.click('i[class*="icon-cross"]').catch(() => {});
        // Attente de transition d'une seconde
        await page.waitForTimeout(1000);
      }
      
    } catch (err) {
      // Capture d'erreur pour éviter que le script ne s'arrête brutalement en cas de problème sur un ticker
      console.error(`❌ Erreur lors de l'analyse du ticker "${t}" : `, err.message);
    }

    // Petite pause de sécurité de 1.5 seconde entre deux tickers pour simuler une navigation humaine et stable
    await page.waitForTimeout(1500);
  }
}

  // Étape finale : déconnexion et fermeture propre du navigateur web
  console.log("🔌 Fermeture du navigateur...");
  // Fermeture de l'onglet actif
  await page.close();
  // Fermeture globale du contexte du navigateur pour libérer la mémoire et le verrou de session
  await context.close();
}

// Lancement automatique de la fonction principale du script
run();
