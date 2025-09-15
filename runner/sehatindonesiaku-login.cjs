'use strict';

var puppeteer_utils_js = require('../puppeteer_utils.js');
var sehatindonesiakuUtils_js = require('./sehatindonesiaku-utils.js');

async function main() {
  const { page } = await puppeteer_utils_js.getPuppeteer();
  await page.goto("https://sehatindonesiaku.kemkes.go.id/auth/login", { waitUntil: "networkidle2" });
  await sehatindonesiakuUtils_js._login(page, { clearCookies: true });
}
main();
//# sourceMappingURL=sehatindonesiaku-login.cjs.map
//# sourceMappingURL=sehatindonesiaku-login.cjs.map