const { chromium } = require('playwright');

async function test() {
  console.log("Lancement du test...");
  const context = await chromium.launchPersistentContext('./test_session', { headless: false });
  const page = await context.newPage();
  console.log("Navigation vers Google...");
  await page.goto('https://www.google.com');
  console.log("Félicitations ! Le navigateur fonctionne.");
  await page.waitForTimeout(5000);
  await context.close();
}

test();