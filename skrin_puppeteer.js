import './chunk-BUSYA2B4.js';
import { waitForDomStable } from './puppeteer_utils.js';

async function skrinLogin(page) {
  await page.goto("https://sumatera.sitb.id/sitb2024/app", { waitUntil: "networkidle2" });
  await page.type('input[name="username"]', process.env.skrin_username);
  await page.type('input[name="password"]', process.env.skrin_password);
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2" })]);
  console.log("Login successful");
}
async function enterSkriningPage(page, replacePage = true) {
  await page.goto("https://sumatera.sitb.id/sitb2024/skrining", {
    waitUntil: "networkidle2",
    timeout: 12e4
  });
  await waitForDomStable(page, 3e3, 3e4);
  await page.waitForSelector("#btnAdd_ta_skrining", { visible: true });
  await page.click("#btnAdd_ta_skrining");
  if (replacePage) {
    await page.goto("https://sumatera.sitb.id/sitb2024/Skrining/add", {
      waitUntil: "networkidle2",
      timeout: 12e4
    });
  }
  await waitForDomStable(page, 3e3, 3e4);
}

export { enterSkriningPage, skrinLogin };
//# sourceMappingURL=skrin_puppeteer.js.map
//# sourceMappingURL=skrin_puppeteer.js.map