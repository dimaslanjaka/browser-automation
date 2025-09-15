'use strict';

require('../chunk-4IBVXDKH.cjs');
require('dotenv/config.js');
var puppeteer_utils_js = require('../puppeteer_utils.js');
var sehatindonesiakuErrors_js = require('./sehatindonesiaku-errors.js');

async function isSpecificModalVisible(page, textToMatch = "Data belum sesuai KTP") {
  const modals = await page.$$("div.shadow-gmail");
  for (const modal of modals) {
    const text = await page.evaluate((el) => el.innerText, modal);
    if (!text.trim().toLowerCase().includes(textToMatch.toLowerCase())) continue;
    const visible = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0 && el.offsetParent !== null;
    }, modal);
    if (visible) return true;
  }
  return false;
}
async function clickDaftarkanDenganNIK(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim().toLowerCase();
    });
    if (text === "daftarkan dengan nik") {
      await btn.click();
      return;
    }
  }
  throw new Error("\u274C 'Daftarkan dengan NIK' button not found");
}
async function handleKuotaHabisModal(page) {
  const modals = await page.$$("div.shadow-gmail");
  for (const modal of modals) {
    const text = await page.evaluate((el) => el.innerText, modal);
    if (text.includes("Kuota Pemeriksaan Habis")) {
      const visible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isVisible = style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        return isVisible;
      }, modal);
      if (!visible) return false;
      const buttons = await modal.$$("button");
      for (const btn of buttons) {
        const btnText = await page.evaluate((el) => el.innerText.trim(), btn);
        if (btnText.startsWith("Lanjut")) {
          await btn.click();
          return true;
        }
      }
    }
  }
  return false;
}
async function handleConfirmationModal(page, choice, item) {
  const isAgeLimitCheckDisplayed = await puppeteer_utils_js.anyElementWithTextExists(page, "div.pb-2", "Pembatasan Umur Pemeriksaan") || await isSpecificModalVisible(page, "Pembatasan Umur Pemeriksaan");
  console.log(`Is age limit check displayed: ${isAgeLimitCheckDisplayed}`);
  if (isAgeLimitCheckDisplayed) {
    throw new sehatindonesiakuErrors_js.PembatasanUmurError(item.nik);
  }
  if (choice === "lanjut") {
    console.log(`Clicking "Pilih" button inside individu terdaftar table...`);
    await clickPilihButton(page);
    console.log(`Clicking "Daftarkan dengan NIK" button...`);
    await clickDaftarkanDenganNIK(page);
  }
}
async function clickPilihButton(page) {
  const buttons = await page.$$(".table-individu-terdaftar table button");
  let clicked = false;
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.innerText.trim());
    const isPilih = text.trim().toLowerCase() === "pilih";
    if (isPilih) {
      const isDisabled = await btn.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.opacity === "0.5" || style.pointerEvents === "none";
      });
      const isVisible = await btn.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isVisible2 = style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        return isVisible2;
      });
      if (isDisabled) {
        throw new Error(`'Pilih' button is disabled`);
      } else if (!isVisible) {
        throw new Error(`'Pilih' button is not visible`);
      } else {
        await btn.click();
        clicked = true;
        break;
      }
    }
  }
  if (!clicked) {
    const foundTexts = await Promise.all(buttons.map((b) => b.evaluate((el) => el.innerText.trim())));
    throw new Error(`\u274C 'Pilih' button not found. Found: ${JSON.stringify(foundTexts)}`);
  }
  await puppeteer_utils_js.waitForDomStable(page, 2e3);
}
async function clickSubmit(page) {
  const disabledSelanjutnya = await page.$(
    "div.h-11.flex.items-center.justify-center.rounded-lg.bg-disabled.px-2.text-sm.text-gray-5.font-normal.cursor-not-allowed"
  );
  if (disabledSelanjutnya) {
    const text = await disabledSelanjutnya.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim();
    });
    if (text && text.includes("Selanjutnya")) {
      throw new Error("\u274C 'Selanjutnya' button is disabled");
    }
  }
  const buttons = await page.$$('button[type="submit"]');
  let found = false;
  for (const btn of buttons) {
    const hasText = await btn.evaluate((el) => {
      return Array.from(el.querySelectorAll("*")).some(
        (node) => node.textContent && node.textContent.trim().includes("Selanjutnya")
      );
    });
    if (hasText) {
      await btn.click();
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error("\u274C 'Selanjutnya' button not found");
  }
  await puppeteer_utils_js.waitForDomStable(page, 2e3);
}
async function clickKelurahan(page, kelurahan) {
  await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kelurahan")])', { visible: true });
  const kelSection = await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kelurahan")])');
  if (!kelSection) {
    throw new Error("Daftar Kelurahan section not found");
  }
  const parent = await kelSection.evaluateHandle((el) => el.parentElement);
  const divs = await parent.asElement().$$("button > div");
  let found = false;
  for (const div of divs) {
    const text = await div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim().toLowerCase();
    });
    if (text === kelurahan.trim().toLowerCase()) {
      const button = await div.evaluateHandle((el) => el.parentElement);
      await button.asElement().click();
      found = true;
      break;
    }
  }
  if (!found) {
    const allTexts = await Promise.all(divs.map((div) => div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim();
    })));
    console.error("Available Kelurahan options:", allTexts);
    throw new Error(`Kelurahan '${kelurahan}' not found`);
  }
  await puppeteer_utils_js.waitForDomStable(page, 500);
}
async function clickKecamatan(page, kecamatan) {
  await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kecamatan")])', { visible: true });
  const kecSection = await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kecamatan")])');
  if (!kecSection) {
    throw new Error("Daftar Kecamatan section not found");
  }
  const parent = await kecSection.evaluateHandle((el) => el.parentElement);
  const divs = await parent.asElement().$$("button > div");
  let found = false;
  for (const div of divs) {
    const text = await div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim().toLowerCase();
    });
    if (text === kecamatan.trim().toLowerCase()) {
      const button = await div.evaluateHandle((el) => el.parentElement);
      await button.asElement().click();
      found = true;
      break;
    }
  }
  if (!found) {
    const allTexts = await Promise.all(divs.map((div) => div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim();
    })));
    console.error("Available Kecamatan options:", allTexts);
    throw new Error(`Kecamatan '${kecamatan}' not found`);
  }
  await puppeteer_utils_js.waitForDomStable(page, 500);
}
async function clickKabupatenKota(page, kota) {
  await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kabupaten/Kota")])', { visible: true });
  const kotaSection = await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Kabupaten/Kota")])');
  if (!kotaSection) {
    throw new Error("Daftar Kabupaten/Kota section not found");
  }
  const parent = await kotaSection.evaluateHandle((el) => el.parentElement);
  const divs = await parent.asElement().$$("button > div");
  let found = false;
  for (const div of divs) {
    const text = await div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim().toLowerCase();
    });
    if (text === kota.trim().toLowerCase()) {
      const button = await div.evaluateHandle((el) => el.parentElement);
      await button.asElement().click();
      found = true;
      break;
    }
  }
  if (!found) {
    const allTexts = await Promise.all(divs.map((div) => div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim();
    })));
    console.error("Available Kabupaten/Kota options:", allTexts);
    throw new Error(`Kota '${kota}' not found`);
  }
  await puppeteer_utils_js.waitForDomStable(page, 500);
}
async function clickProvinsi(page, provinsi) {
  await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Provinsi")])', { visible: true });
  const provSection = await page.waitForSelector('::-p-xpath(//div[contains(text(), "Daftar Provinsi")])');
  if (!provSection) {
    throw new Error("Daftar Provinsi section not found");
  }
  const parent = await provSection.evaluateHandle((el) => el.parentElement);
  const divs = await parent.asElement().$$("button > div");
  let found = false;
  for (const div of divs) {
    const text = await div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim().toLowerCase();
    });
    if (text === provinsi.trim().toLowerCase()) {
      const button = await div.evaluateHandle((el) => el.parentElement);
      await button.asElement().click();
      found = true;
      break;
    }
  }
  if (!found) {
    const allTexts = await Promise.all(divs.map((div) => div.evaluate((el) => {
      var _a;
      return (_a = el.textContent) == null ? void 0 : _a.trim();
    })));
    console.error("Available provinsi options:", allTexts);
    throw new Error(`Provinsi '${provinsi}' not found`);
  }
  await puppeteer_utils_js.waitForDomStable(page, 500);
}
async function clickAddressModal(page) {
  const clicked = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll("div.font-semibold"));
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith("Alamat Domisili"));
    if (!labelDiv) return false;
    let container = labelDiv.parentElement;
    let dropdownContainer = null;
    while (container && !dropdownContainer) {
      dropdownContainer = Array.from(container.querySelectorAll("div.relative"))[0];
      if (!dropdownContainer) container = container.parentElement;
    }
    if (!dropdownContainer && labelDiv.nextElementSibling) {
      dropdownContainer = labelDiv.nextElementSibling;
    }
    if (!dropdownContainer) return false;
    const trigger = Array.from(dropdownContainer.querySelectorAll("div")).find(
      (div) => div.className && div.className.includes("min-h-[2.9rem]")
    );
    if (!trigger) return false;
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error("Alamat Domisili dropdown not found or not clickable");
  await puppeteer_utils_js.waitForDomStable(page, 500);
}
async function commonInput(page, item) {
  await page.focus('input[id="nik"]');
  await page.type('input[id="nik"]', item.nik, { delay: 100 });
  await page.focus('input[id="Nama Lengkap"]');
  await page.type('input[id="Nama Lengkap"]', item.nama, { delay: 100 });
  await page.focus('input[name="Nomor Whatsapp"]');
  await page.type('input[name="Nomor Whatsapp"]', item.nomor_wa.replace(/^\+62/, ""), { delay: 100 });
  await page.focus('textarea[id="detail-domisili"]');
  await page.type('textarea[id="detail-domisili"]', item.alamat, { delay: 100 });
}
async function selectPekerjaan(page, item) {
  const pekerjaanPatterns = [
    { re: /Belum\/?Tidak Bekerja/i, value: "Belum/Tidak Bekerja" },
    { re: /Pelajar/i, value: "Pelajar" },
    { re: /Mahasiswa/i, value: "Mahasiswa" },
    { re: /Ibu Rumah Tangga/i, value: "Ibu Rumah Tangga" },
    { re: /TNI/i, value: "TNI" },
    { re: /POLRI/i, value: "POLRI" },
    { re: /ASN.*Kantor Pemerintah/i, value: "ASN (Kantor Pemerintah)" },
    { re: /Pegawai Swasta|wiraswasta/i, value: "Pegawai Swasta" },
    { re: /Wirausaha|Wiraswasta|Pekerja Mandiri/i, value: "Wirausaha/Pekerja Mandiri" },
    { re: /Pensiunan/i, value: "Pensiunan" },
    { re: /Pejabat Negara|Pejabat Daerah/i, value: "Pejabat Negara / Pejabat Daerah" },
    { re: /Pengusaha/i, value: "Pengusaha" },
    { re: /Dokter/i, value: "Dokter" },
    { re: /Bidan/i, value: "Bidan" },
    { re: /Perawat/i, value: "Perawat" },
    { re: /Apoteker/i, value: "Apoteker" },
    { re: /Psikolog/i, value: "Psikolog" },
    { re: /Tenaga Kesehatan Lainnya/i, value: "Tenaga Kesehatan Lainnya" },
    { re: /Dosen/i, value: "Dosen" },
    { re: /Guru/i, value: "Guru" },
    { re: /Peneliti/i, value: "Peneliti" },
    { re: /Pengacara/i, value: "Pengacara" },
    { re: /Notaris/i, value: "Notaris" },
    { re: /Hakim|Jaksa|Tenaga Peradilan/i, value: "Hakim/Jaksa/Tenaga Peradilan Lainnya" },
    { re: /Akuntan/i, value: "Akuntan" },
    { re: /Insinyur/i, value: "Insinyur" },
    { re: /Arsitek/i, value: "Arsitek" },
    { re: /Konsultan/i, value: "Konsultan" },
    { re: /Wartawan/i, value: "Wartawan" },
    { re: /Pedagang/i, value: "Pedagang" },
    { re: /Petani|Pekebun/i, value: "Petani / Pekebun" },
    { re: /Nelayan|Perikanan/i, value: "Nelayan / Perikanan" },
    { re: /Peternak/i, value: "Peternak" },
    { re: /Tokoh Agama/i, value: "Tokoh Agama" },
    { re: /Juru Masak/i, value: "Juru Masak" },
    { re: /Pelaut/i, value: "Pelaut" },
    { re: /Sopir/i, value: "Sopir" },
    { re: /Pilot/i, value: "Pilot" },
    { re: /Masinis/i, value: "Masinis" },
    { re: /Atlet/i, value: "Atlet" },
    { re: /Pekerja Seni/i, value: "Pekerja Seni" },
    { re: /Penjahit|Perancang Busana/i, value: "Penjahit / Perancang Busana" },
    { re: /Karyawan kantor|Pegawai Administratif/i, value: "Karyawan kantor / Pegawai Administratif" },
    { re: /Teknisi|Mekanik/i, value: "Teknisi / Mekanik" },
    { re: /Pekerja Pabrik|Buruh/i, value: "Pekerja Pabrik / Buruh" },
    { re: /Pekerja Konstruksi/i, value: "Pekerja Konstruksi" },
    { re: /Pekerja Pertukangan/i, value: "Pekerja Pertukangan" },
    { re: /Pekerja Migran/i, value: "Pekerja Migran" },
    { re: /Lainnya/i, value: "Lainnya" }
  ];
  let pekerjaanValue = "Lainnya";
  for (const { re, value } of pekerjaanPatterns) {
    if (re.test(item.pekerjaan)) {
      pekerjaanValue = value;
      break;
    }
  }
  console.log(`[job] ${item.nik} - ${item.pekerjaan} -> ${pekerjaanValue}`);
  const clicked = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll("div.font-semibold"));
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith("Pekerjaan"));
    if (!labelDiv) return false;
    let container = labelDiv.parentElement;
    let dropdownContainer = null;
    while (container && !dropdownContainer) {
      dropdownContainer = Array.from(container.querySelectorAll("div.relative.flex"))[0];
      if (!dropdownContainer) container = container.parentElement;
    }
    if (!dropdownContainer && labelDiv.nextElementSibling) {
      dropdownContainer = labelDiv.nextElementSibling;
    }
    if (!dropdownContainer) return false;
    const svg = dropdownContainer.querySelector("svg");
    if (!svg) return false;
    svg.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    svg.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error("Pekerjaan SVG icon not found or not clickable");
  await puppeteer_utils_js.waitForDomStable(page, 500);
  await page.evaluate((pekerjaan) => {
    function normalize(str) {
      return str.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim().toLowerCase();
    }
    const target = normalize(pekerjaan);
    const modal = document.querySelector('div.z-9000, div[class*="z-9000"]');
    if (!modal) throw new Error("Pekerjaan modal not found");
    const divs = Array.from(modal.querySelectorAll("div.flex.items-center.justify-between.gap-2"));
    let found = false;
    for (const div of divs) {
      if (normalize(div.textContent) === target) {
        const btn = div.closest("button");
        if (btn) btn.click();
        found = true;
        break;
      }
    }
    if (!found) throw new Error("Pekerjaan option not found in modal: " + pekerjaan);
  }, pekerjaanValue);
}
async function selectGender(page, item) {
  const clickGenderDropdown = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll("div.font-semibold"));
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith("Jenis Kelamin"));
    if (!labelDiv) return false;
    let container = labelDiv;
    while (container && (!container.classList || !container.classList.contains("w-full"))) {
      container = container.parentElement;
    }
    if (!container) return false;
    const svg = container.querySelector("svg");
    if (!svg) return false;
    svg.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    svg.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
  if (!clickGenderDropdown) throw new Error("Jenis Kelamin SVG icon not found or not clickable");
  await puppeteer_utils_js.waitForDomStable(page, 500);
  await page.evaluate((gender) => {
    const dropdowns = Array.from(
      document.querySelectorAll('div.z-2000, div[style*="z-index: 2000"], div[style*="z-index:2000"]')
    );
    let found = false;
    for (const dropdown of dropdowns) {
      const options = Array.from(dropdown.querySelectorAll("div.cursor-pointer"));
      for (const opt of options) {
        const match = Array.from(opt.querySelectorAll("div")).find(
          (d) => d.textContent && d.textContent.trim() === gender
        );
        if (match) {
          opt.click();
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error("Gender option not found: " + gender);
  }, item.jenis_kelamin);
}
async function selectTanggalLahir(page, item) {
  async function selectDate(page2, selector, tanggal) {
    const [day, month, year] = tanggal.split("/");
    const bulan = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    await page2.click(`${selector} .mx-datepicker`);
    await page2.waitForSelector(".mx-calendar", { visible: true });
    const yearPanelSelector = ".mx-calendar .mx-calendar-year-panel, .mx-calendar.mx-calendar-panel-year";
    const yearPanel = await page2.$(yearPanelSelector);
    if (!yearPanel) {
      const yearBtnSel = [
        ".mx-calendar .mx-btn.mx-btn-text.mx-btn-year",
        ".mx-calendar .mx-btn.mx-btn-text.mx-btn-current-year",
        ".mx-calendar .mx-btn-year"
      ].join(",");
      const yearBtn = await page2.$(yearBtnSel);
      if (!yearBtn) throw new Error("Year button not found in datepicker");
      await yearBtn.click();
      await page2.waitForSelector(yearPanelSelector, { visible: true });
    }
    let foundYear = false;
    while (!foundYear) {
      const years = await page2.$$eval(
        ".mx-calendar-year-panel td, .mx-calendar.mx-calendar-panel-year .mx-table-year td",
        (els) => els.map((el) => (el.textContent ?? "").trim())
      );
      if (years.includes(String(year))) {
        await page2.evaluate((year2) => {
          const yearCells = Array.from(
            document.querySelectorAll(
              ".mx-calendar-year-panel td, .mx-calendar.mx-calendar-panel-year .mx-table-year td"
            )
          );
          const target = yearCells.find((td) => (td.textContent ?? "").trim() === String(year2));
          if (target) target.click();
        }, year);
        foundYear = true;
      } else {
        const nums = years.map(Number).filter(Boolean);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (Number(year) < min) {
          const prevBtn = await page2.$(
            ".mx-calendar-year-panel .mx-btn-icon-double-left, .mx-calendar.mx-calendar-panel-year .mx-btn-icon-double-left"
          );
          if (prevBtn) await prevBtn.click();
        } else if (Number(year) > max) {
          const nextBtn = await page2.$(
            ".mx-calendar-year-panel .mx-btn-icon-double-right, .mx-calendar.mx-calendar-panel-year .mx-btn-icon-double-right"
          );
          if (nextBtn) await nextBtn.click();
        } else {
          throw new Error(`Year ${year} not in panel, but can't navigate`);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    const monthPanelSelector = ".mx-calendar .mx-calendar-month-panel, .mx-calendar.mx-calendar-panel-month";
    const monthPanel = await page2.$(monthPanelSelector);
    if (!monthPanel) {
      const monthBtnSel = [
        ".mx-calendar .mx-btn.mx-btn-text.mx-btn-month",
        ".mx-calendar .mx-btn-month",
        ".mx-calendar .mx-btn.mx-btn-current-year"
        // fallback: sometimes year button opens month panel
      ].join(",");
      const monthBtn = await page2.$(monthBtnSel);
      if (!monthBtn) throw new Error("Month button not found in datepicker");
      await monthBtn.click();
      await page2.waitForSelector(monthPanelSelector, { visible: true });
    }
    await page2.evaluate((monthText) => {
      const monthCells = Array.from(
        document.querySelectorAll(
          ".mx-calendar-month-panel td, .mx-calendar.mx-calendar-panel-month .mx-table-month td"
        )
      );
      const target = monthCells.find((td) => (td.textContent ?? "").trim().startsWith(monthText));
      if (target) target.click();
    }, bulan[Number(month)]);
    const yyyy = year;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const targetDate = `${yyyy}-${mm}-${dd}`;
    await page2.evaluate(
      (targetDate2, day2) => {
        const dayCells = Array.from(document.querySelectorAll(".mx-table-date td.cell"));
        const targetCell = dayCells.find(
          (td) => td.getAttribute("title") === targetDate2 && td.querySelector("div") && (td.querySelector("div").textContent ?? "").trim() === String(Number(day2))
        );
        if (targetCell) {
          targetCell.click();
        } else {
          const btn = targetCell && targetCell.querySelector("button");
          if (btn) btn.click();
        }
      },
      targetDate,
      day
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await selectDate(page, "#Tanggal\\ Lahir", item.tanggal_lahir);
}

exports.clickAddressModal = clickAddressModal;
exports.clickDaftarkanDenganNIK = clickDaftarkanDenganNIK;
exports.clickKabupatenKota = clickKabupatenKota;
exports.clickKecamatan = clickKecamatan;
exports.clickKelurahan = clickKelurahan;
exports.clickPilihButton = clickPilihButton;
exports.clickProvinsi = clickProvinsi;
exports.clickSubmit = clickSubmit;
exports.commonInput = commonInput;
exports.handleConfirmationModal = handleConfirmationModal;
exports.handleKuotaHabisModal = handleKuotaHabisModal;
exports.isSpecificModalVisible = isSpecificModalVisible;
exports.selectGender = selectGender;
exports.selectPekerjaan = selectPekerjaan;
exports.selectTanggalLahir = selectTanggalLahir;
//# sourceMappingURL=sehatindonesiaku-register-utils.cjs.map
//# sourceMappingURL=sehatindonesiaku-register-utils.cjs.map