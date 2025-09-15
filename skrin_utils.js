import './chunk-BUSYA2B4.js';
import { getAge } from '../src/date.js';
import { typeAndTrigger } from './puppeteer_utils.js';

async function isInvalidAlertVisible(page) {
  return await page.evaluate(() => {
    const elem = document.querySelector(".k-widget.k-tooltip.k-tooltip-validation.k-invalid-msg");
    if (!elem) return false;
    const style = window.getComputedStyle(elem);
    return style && style.display !== "none" && style.visibility !== "hidden" && elem.offsetWidth > 0 && elem.offsetHeight > 0;
  });
}
async function isIdentityModalVisible(page) {
  return await page.evaluate(() => {
    const modal = document.querySelector(".k-widget.k-window.k-window-maximized");
    return modal && window.getComputedStyle(modal).display !== "none" && modal.offsetWidth > 0 && modal.offsetHeight > 0;
  }) || false;
}
async function confirmIdentityModal(page) {
  const iframeElement = await page.$("#dialog iframe.k-content-frame");
  if (!iframeElement) {
    console.log("\u274C Iframe inside #dialog not found!");
    return;
  }
  const iframe = await iframeElement.contentFrame();
  if (!iframe) {
    console.log("\u274C Failed to get content of iframe inside #dialog!");
    return;
  }
  try {
    await iframe.waitForSelector("body", { visible: true, timeout: 1e4 });
    const pilihBtn = await iframe.$("#pilih");
    if (pilihBtn) {
      const box = await pilihBtn.boundingBox();
      if (box) {
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5e3 }).catch(() => null),
            pilihBtn.click({ delay: 100 })
          ]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          const modalStillVisible = await page.$eval("#dialog", (el) => el.offsetParent !== null).catch(() => false);
          if (!modalStillVisible) {
            console.log("\u2705 #pilih clicked, modal gone.");
            return;
          }
          console.warn("\u26A0\uFE0F Modal still visible. Trying JS-based dispatch as fallback...");
          const jsDispatchWorked = await iframe.evaluate(() => {
            const btn = document.querySelector("#pilih");
            if (!btn) return false;
            btn.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window
              })
            );
            return true;
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          const stillVisible = await page.$eval("#dialog", (el) => el.offsetParent !== null).catch(() => false);
          if (!stillVisible && jsDispatchWorked) {
            console.log("\u2705 JS-dispatch click closed modal.");
            return;
          }
          console.log("\u274C JS dispatch didn\u2019t close modal.");
        } catch (err) {
          console.error("\u274C Error while clicking #pilih:", err);
          return;
        }
      } else {
        console.warn("\u26A0\uFE0F #pilih is not visible (no bounding box).");
      }
    }
    const iyaClicked = await iframe.evaluate(() => {
      try {
        const xpath = "//button[contains(translate(., 'IYA', 'iya'), 'iya')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const btn = result.singleNodeValue;
        if (btn instanceof HTMLElement) {
          btn.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );
          return true;
        }
        return false;
      } catch {
        return false;
      }
    });
    if (iyaClicked) {
      console.log('\u2705 Clicked "Iya" button using XPath + JS dispatch.');
    } else {
      console.log('\u274C No #pilih or "Iya" button found or clickable.');
    }
  } catch (err) {
    console.error("\u274C Error in confirmIdentityModal:", err);
  }
}
async function isNikErrorVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll(".k-notification-error");
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      if (isVisible) return true;
    }
    return false;
  });
}
async function isSuccessNotificationVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll(".k-notification-success");
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      if (isVisible) return true;
    }
    return false;
  });
}
async function isNIKNotFoundModalVisible(page) {
  return await page.evaluate(() => {
    const modal = document.querySelector('[aria-labelledby="dialogconfirm_wnd_title"]');
    if (modal && modal.innerText.includes("Data tidak ditemukan")) {
      const style = window.getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    }
    return false;
  });
}
function getRandomInRange(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}
const tinggiRange = {
  "laki-laki": {
    0: [45, 55],
    1: [65, 75],
    2: [75, 85],
    3: [85, 95],
    4: [90, 100],
    5: [100, 108],
    10: [125, 135],
    15: [150, 170],
    20: [168, 190],
    30: [170, 190],
    40: [168, 188],
    50: [165, 185],
    60: [160, 180],
    70: [155, 175],
    80: [150, 170],
    90: [145, 165],
    100: [140, 160]
  },
  perempuan: {
    0: [45, 54],
    1: [64, 74],
    2: [74, 84],
    3: [84, 94],
    4: [89, 99],
    5: [98, 106],
    10: [123, 133],
    15: [148, 165],
    20: [162, 180],
    30: [165, 178],
    40: [162, 175],
    50: [160, 170],
    60: [157, 168],
    70: [154, 165],
    80: [150, 160],
    90: [145, 155],
    100: [140, 150]
  }
};
const beratRange = {
  "laki-laki": {
    0: [2, 5],
    1: [7, 10],
    2: [9, 14],
    3: [12, 16],
    4: [13, 18],
    5: [14, 18],
    10: [25, 35],
    15: [42, 65],
    20: [60, 90],
    30: [65, 95],
    40: [70, 100],
    50: [68, 95],
    60: [65, 90],
    70: [60, 85],
    80: [55, 80],
    90: [50, 75],
    100: [45, 70]
  },
  perempuan: {
    0: [2, 4.5],
    1: [6, 9],
    2: [8, 12],
    3: [10, 15],
    4: [12, 17],
    5: [13, 17],
    10: [24, 34],
    15: [38, 55],
    20: [55, 80],
    30: [60, 85],
    40: [62, 88],
    50: [60, 85],
    60: [58, 82],
    70: [55, 80],
    80: [50, 75],
    90: [45, 70],
    100: [40, 65]
  }
};
function getRange(age, gender, type) {
  if (typeof age !== "number" || age < 0 || age > 120) return null;
  gender = gender.toLowerCase();
  if (gender === "l") gender = "laki-laki";
  if (gender === "p") gender = "perempuan";
  const dataset = type === "tinggi" ? tinggiRange : beratRange;
  const data = dataset[gender];
  if (!data) return null;
  const ages = Object.keys(data).map(Number);
  const closestAge = ages.reduce((prev, curr) => Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev);
  const [min, max] = data[closestAge];
  return { min, max, random: getRandomInRange(min, max), closestAge };
}
function getTinggiBadan(age, gender) {
  const result = getRange(typeof age === "string" ? parseInt(age, 10) : age, gender, "tinggi");
  return result ? result.random : null;
}
function getBeratBadan(age, gender) {
  const result = getRange(typeof age === "string" ? parseInt(age, 10) : age, gender, "berat");
  return result ? result.random : null;
}
async function fixTbAndBb(page, age, gender) {
  const tbValue = await page.$eval("#field_item_tinggi_badan input", (input) => input.value.trim());
  if (!tbValue) {
    const tinggiBadan = getTinggiBadan(age, gender);
    if (tinggiBadan) {
      await typeAndTrigger(page, "#field_item_tinggi_badan input", tinggiBadan.toString());
    } else {
      throw new Error("Tinggi badan tidak valid");
    }
  }
  const bbValue = await page.$eval("#field_item_berat_badan input", (input) => input.value.trim());
  if (!bbValue) {
    const beratBadan = getBeratBadan(age, gender);
    if (beratBadan) {
      await typeAndTrigger(page, "#field_item_berat_badan input", beratBadan.toString());
    } else {
      throw new Error("Berat badan tidak valid");
    }
  }
}
async function getPersonInfo(page) {
  const gender = await page.evaluate(() => {
    var _a;
    return (_a = document.querySelector('input[name="jenis_kelamin_id_input"]')) == null ? void 0 : _a.value;
  });
  const birthDate = await page.evaluate(() => {
    var _a;
    return (_a = document.querySelector('input[name="dt_tgl_lahir"]')) == null ? void 0 : _a.value;
  });
  const age = getAge(birthDate);
  const province = await page.$eval('#field_item_provinsi_ktp_id input[type="text"]', (input) => input.value.trim());
  const city = await page.$eval('#field_item_kabupaten_ktp_id input[type="text"]', (input) => input.value.trim());
  const occupation = await page.evaluate(() => {
    var _a;
    return (_a = document.querySelector('input[name="pekerjaan_id_input"]')) == null ? void 0 : _a.value;
  });
  const bodyWeight = await page.evaluate(
    () => {
      var _a;
      return (_a = document.querySelector('#field_item_berat_badan input[type="text"]')) == null ? void 0 : _a.value;
    }
  );
  const bodyHeight = await page.evaluate(
    () => {
      var _a;
      return (_a = document.querySelector('#field_item_tinggi_badan input[type="text"]')) == null ? void 0 : _a.value;
    }
  );
  return { gender, age, birthDate, location: { province, city }, occupation, bodyWeight, bodyHeight };
}

export { confirmIdentityModal, fixTbAndBb, getBeratBadan, getPersonInfo, getTinggiBadan, isIdentityModalVisible, isInvalidAlertVisible, isNIKNotFoundModalVisible, isNikErrorVisible, isSuccessNotificationVisible };
//# sourceMappingURL=skrin_utils.js.map
//# sourceMappingURL=skrin_utils.js.map