import '../chunk-BUSYA2B4.js';
import 'dotenv/config.js';
import fs from 'fs-extra';
import moment from 'moment';
import path from 'upath';
import { waitForDomStable, clearCurrentPageCookies } from '../puppeteer_utils.js';

async function clickKembali(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => {
      let t = el.innerText || "";
      t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
      t = t.replace(/[^\p{L}\p{N} ]/gu, "");
      t = t.replace(/\s+/g, " ").trim().toLowerCase();
      return t;
    });
    if (text === "kembali") {
      await btn.click();
      return;
    }
  }
  throw new Error("\u274C 'Kembali' button not found");
}
const ID_MONTHS = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agt: 7,
  agu: 7,
  agust: 7,
  agustus: 7,
  agst: 7,
  sep: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11
};
function monthIndexFromHeader(text) {
  const key = text.trim().toLowerCase();
  if (key in ID_MONTHS) return ID_MONTHS[key];
  const short = key.slice(0, 3);
  if (short in ID_MONTHS) return ID_MONTHS[short];
  throw new Error(`Unrecognized month label in header: "${text}"`);
}
async function selectDayFromCalendar(page, dateStr) {
  const day = moment(dateStr, "DD/MM/YYYY", true).date().toString();
  const calendarWrapper = await page.$(".form-data-individu");
  if (!calendarWrapper) return false;
  const calendarPanels = await calendarWrapper.$$("div.shadow-gmail");
  for (const panel of calendarPanels) {
    const clicked = await panel.evaluate((root, wantedDay) => {
      var _a;
      const buttons = Array.from(root.querySelectorAll("button"));
      for (const btn of buttons) {
        if (btn.disabled || btn.classList.contains("cursor-not-allowed")) continue;
        const span = btn.querySelector("span.font-bold");
        if (span && ((_a = span.textContent) == null ? void 0 : _a.trim()) === wantedDay) {
          btn.click();
          return true;
        }
      }
      return false;
    }, day);
    if (clicked) return true;
  }
  return false;
}
async function selectCalendar(page, dateStr) {
  const m = moment(dateStr, "DD/MM/YYYY", true);
  if (!m.isValid()) {
    throw new Error(`Invalid date string: ${dateStr}, expected DD/MM/YYYY`);
  }
  const targetDay = m.date();
  const targetMonth = m.month();
  const targetYear = m.year();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1e3)));
  const daysGrid = await page.$(".grid.grid-cols-7.gap-1.mt-2");
  if (!daysGrid) throw new Error("Calendar days grid not found");
  const rootHandle = await daysGrid.evaluateHandle((el) => el.closest("div.relative"));
  if (!rootHandle) throw new Error("Calendar root not found");
  async function readHeader(root) {
    const info = await root.$eval(":scope .flex.justify-between", (hdr) => {
      var _a, _b;
      const left = hdr.querySelector(".flex.items-center");
      const btns = left ? Array.from(left.querySelectorAll("button")) : [];
      const monthText = (((_a = btns[0]) == null ? void 0 : _a.textContent) || "").trim();
      const yearText = (((_b = btns[1]) == null ? void 0 : _b.textContent) || "").trim();
      return { monthText, yearText };
    });
    const curMonth = monthIndexFromHeader(info.monthText);
    const curYear = parseInt(info.yearText, 10);
    return { curMonth, curYear };
  }
  async function getNavButtons(root) {
    const buttons = await root.$$(":scope .flex.items-center.justify-center > button");
    if (buttons.length < 2) throw new Error("Prev/Next buttons not found");
    return { prevBtn: buttons[0], nextBtn: buttons[1] };
  }
  const { prevBtn, nextBtn } = await getNavButtons(rootHandle);
  for (let safety = 0; safety < 600; safety++) {
    const { curMonth, curYear } = await readHeader(rootHandle);
    if (curMonth === targetMonth && curYear === targetYear) break;
    const diff = (targetYear - curYear) * 12 + (targetMonth - curMonth);
    if (diff < 0) {
      await prevBtn.click();
    } else {
      await nextBtn.click();
    }
    await waitForDomStable(page, 150);
    if (safety === 599) throw new Error(`Failed to reach ${targetMonth + 1}/${targetYear}`);
  }
  const clicked = await rootHandle.evaluate((root, wantedDay) => {
    var _a;
    const grid = root.querySelector(".grid.grid-cols-7");
    if (!grid) return false;
    const btns = Array.from(grid.querySelectorAll("button"));
    for (const btn of btns) {
      if (btn.classList.contains("cursor-not-allowed") || btn.disabled) continue;
      const daySpan = btn.querySelector("span.font-bold");
      const txt = ((_a = daySpan == null ? void 0 : daySpan.textContent) == null ? void 0 : _a.trim()) || "";
      if (Number(txt) === wantedDay) {
        btn.click();
        return true;
      }
    }
    return false;
  }, targetDay);
  if (!clicked) {
    console.error(`Day ${targetDay} not found in current month view`);
  }
  return clicked;
}
async function screenshot(page, filePath = "tmp/screenshot.png") {
  fs.ensureDirSync(path.dirname(filePath));
  await page.screenshot({
    path: filePath,
    fullPage: true
  });
  console.log(`Screenshot saved as ${filePath}`);
}
async function clickDaftarBaru(page) {
  const buttonHandle = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.find((btn) => {
      const div = btn.querySelector("div.text-white");
      return div && div.textContent && div.textContent.trim() === "Daftar Baru";
    }) || null;
  });
  if (buttonHandle) {
    const isVisible = await buttonHandle.evaluate(
      (el) => el !== null && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
    if (isVisible) {
      await buttonHandle.click();
      await page.evaluate(async () => {
        function waitForDomStable2(timeout = 1e4, stableMs = 800) {
          return new Promise((resolve, reject) => {
            let lastChange = Date.now();
            let observer;
            const timer = setTimeout(() => {
              if (observer) observer.disconnect();
              reject(new Error("DOM did not stabilize in time"));
            }, timeout);
            observer = new MutationObserver(() => {
              lastChange = Date.now();
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
            (function check() {
              if (Date.now() - lastChange > stableMs) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(void 0);
              } else {
                setTimeout(check, 100);
              }
            })();
          });
        }
        await waitForDomStable2();
      });
    } else {
      console.log("Button exists but is not visible");
    }
  } else {
    throw new Error('Button "Daftar Baru" not found');
  }
}
async function _login(page, options = {}) {
  const {
    username = process.env.SIH_USERNAME || "",
    password = process.env.SIH_PASSWORD || "",
    clearCookies = false
  } = options;
  await page.goto("https://sehatindonesiaku.kemkes.go.id/auth/login", { waitUntil: "networkidle2" });
  if (clearCookies) {
    await clearCurrentPageCookies(page);
    await page.goto("https://sehatindonesiaku.kemkes.go.id/auth/login", { waitUntil: "networkidle2" });
  }
  if (!page.url().includes("/auth/login")) {
    console.log("Already logged in, skipping login step");
    return;
  }
  await page.type('input[name="Email"]', username);
  await page.type('input[name="Kata sandi"]', password);
  await page.waitForSelector('input[name="Captcha"]', { visible: true });
  const loginButtonSelector = 'div.text-center .bg-disabled, div.text-center button[type="submit"]';
  await page.waitForSelector(loginButtonSelector, { visible: true });
  const isDisabled = await page.$eval(loginButtonSelector, (el) => el.classList.contains("bg-disabled"));
  if (!isDisabled) {
    await Promise.all([
      page.click('div.text-center button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);
    console.log("Login successful");
  } else {
    console.log("Login button is disabled. Please check if all fields are filled and captcha is handled.");
  }
}
async function enterSehatIndonesiaKu(page) {
  await page.goto("https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu", { waitUntil: "networkidle2" });
  await page.evaluate(async () => {
    function waitForDomStable2(timeout = 1e4, stableMs = 800) {
      return new Promise((resolve, reject) => {
        let lastChange = Date.now();
        let observer;
        const timer = setTimeout(() => {
          if (observer) observer.disconnect();
          reject(new Error("DOM did not stabilize in time"));
        }, timeout);
        observer = new MutationObserver(() => {
          lastChange = Date.now();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        (function check() {
          if (Date.now() - lastChange > stableMs) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(void 0);
          } else {
            setTimeout(check, 100);
          }
        })();
      });
    }
    await waitForDomStable2();
  });
  const currentUrl = page.url();
  if (!currentUrl.includes("/login")) {
    return true;
  } else {
    await _login(page);
    return false;
  }
}

export { _login, clickDaftarBaru, clickKembali, enterSehatIndonesiaKu, screenshot, selectCalendar, selectDayFromCalendar };
//# sourceMappingURL=sehatindonesiaku-utils.js.map
//# sourceMappingURL=sehatindonesiaku-utils.js.map