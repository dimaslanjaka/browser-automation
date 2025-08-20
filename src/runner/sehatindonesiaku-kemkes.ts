import 'dotenv/config.js';
import fs from 'fs-extra';
import { Page } from 'puppeteer';
import path from 'upath';
import { getPuppeteer } from '../puppeteer_utils.js';
import { sleep } from '../utils-browser.js';
import { DataItem } from './sehatindonesiaku-data.js';
import { fileURLToPath } from 'url';
import data from './sehatindonesiaku-data.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main entry point for the automation script.
 * Launches Puppeteer, navigates to the registration page, waits for DOM stability,
 * and processes the first data item.
 */
async function main() {
  const { page, browser: _browser } = await getPuppeteer();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });

  // Wait for DOM to stabilize (no mutations for 800ms)
  await page.evaluate(async () => {
    function waitForDomStable(timeout = 10000, stableMs = 800) {
      return new Promise((resolve, reject) => {
        let lastChange = Date.now();
        // eslint-disable-next-line prefer-const
        let observer: MutationObserver;
        const timer = setTimeout(() => {
          if (observer) observer.disconnect();
          reject(new Error('DOM did not stabilize in time'));
        }, timeout);
        observer = new MutationObserver(() => {
          lastChange = Date.now();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        (function check() {
          if (Date.now() - lastChange > stableMs) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(undefined);
          } else {
            setTimeout(check, 100);
          }
        })();
      });
    }
    await waitForDomStable();
  });

  // Now safe to interact with the DOM

  // Use a compatible selector and textContent check since :has and :contains are not supported in querySelector
  const buttonHandle = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return (
      buttons.find((btn) => {
        const div = btn.querySelector('div.text-white');
        return div && div.textContent && div.textContent.trim() === 'Daftar Baru';
      }) || null
    );
  });
  if (buttonHandle) {
    const isVisible = await buttonHandle.evaluate(
      (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
    if (!isVisible) {
      console.log('Button exists but is not visible');
    }
  } else {
    console.log('Button does not exist, login may be required');
    await _login(page);
    return;
  }

  // for (const item of data) {
  //   await processData(page, item);
  // }

  processData(page, data[0]); // Process the first item for demonstration
}

/**
 * Process a single data item by interacting with the registration form.
 * @param page Puppeteer page instance
 * @param item Data item to process
 */
async function processData(page: Page, item: DataItem) {
  // Use a compatible selector and textContent check since :has and :contains are not supported in querySelector
  const buttonHandle = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return (
      buttons.find((btn) => {
        const div = btn.querySelector('div.text-white');
        return div && div.textContent && div.textContent.trim() === 'Daftar Baru';
      }) || null
    );
  });
  if (buttonHandle) {
    const isVisible = await buttonHandle.evaluate(
      (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
    if (isVisible) {
      await buttonHandle.click();
      // Wait for dom to stabilize after clicking
      await page.evaluate(async () => {
        function waitForDomStable(timeout = 10000, stableMs = 800) {
          return new Promise((resolve, reject) => {
            let lastChange = Date.now();
            // eslint-disable-next-line prefer-const
            let observer: MutationObserver;
            const timer = setTimeout(() => {
              if (observer) observer.disconnect();
              reject(new Error('DOM did not stabilize in time'));
            }, timeout);
            observer = new MutationObserver(() => {
              lastChange = Date.now();
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
            (function check() {
              if (Date.now() - lastChange > stableMs) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(undefined);
              } else {
                setTimeout(check, 100);
              }
            })();
          });
        }
        await waitForDomStable();
      });
    } else {
      console.log('Button exists but is not visible');
    }
  } else {
    throw new Error('Button "Daftar Baru" not found');
  }

  // Common input
  await commonInput(page, item);

  // Input datepicker
  await vueDatePicker(page, item);

  // Select gender (Jenis Kelamin)
  await vueGenderSelect(page, item);

  // Select pekerjaan (Pekerjaan)
  await vuePekerjaanSelect(page, item);

  // Select provinsi (Province)
  await vueSelectAddress(page, item);
}

/**
 * Select provinsi (Province) by interacting with the Vue-based dropdown/modal picker.
 * Handles opening the "Alamat Domisili" dropdown, waits for the modal, and selects the province option by matching normalized text.
 * Uses Puppeteer's real user click for robust interaction with custom UI components.
 *
 * @param page Puppeteer page instance
 * @param item Data item containing the 'provinsi' field (province name)
 */
async function vueSelectAddress(page: Page, _item: DataItem) {
  // Find and click the "Alamat Domisili" dropdown to open the province selector
  const clicked = await page.evaluate(() => {
    // Find all divs with class "font-semibold"
    const allDivs = Array.from(document.querySelectorAll('div.font-semibold'));
    // Find the one whose text starts with "Alamat Domisili"
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith('Alamat Domisili'));
    if (!labelDiv) return false;
    // The dropdown trigger is the next sibling .relative.flex container
    let container = labelDiv.parentElement;
    // Find the .relative.flex container (dropdown root)
    let dropdownContainer = null;
    while (container && !dropdownContainer) {
      dropdownContainer = Array.from(container.querySelectorAll('div.relative'))[0];
      if (!dropdownContainer) container = container.parentElement;
    }
    // Fallback: try next sibling if not found
    if (!dropdownContainer && labelDiv.nextElementSibling) {
      dropdownContainer = labelDiv.nextElementSibling;
    }
    if (!dropdownContainer) return false;
    // Click the div with class containing min-h-[2.9rem] inside the container
    const trigger = Array.from(dropdownContainer.querySelectorAll('div')).find(
      (div) => (div as Element).className && (div as Element).className.includes('min-h-[2.9rem]')
    ) as Element | null;
    if (!trigger) return false;
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error('Alamat Domisili dropdown not found or not clickable');

  // Wait for the modal to appear
  await sleep(500);

  // Use fixed value for testing
  const provinsi = 'DKI Jakarta';
  const kabupaten = 'Kota Adm. Jakarta Barat';
  const kecamatan = 'Kebon Jeruk';
  const kelurahan = 'Kebon Jeruk';

  // Type to search the province in the modal's input
  await page.evaluate((provinsi) => {
    const input = document.querySelector('input[placeholder="Cari Provinsi"]');
    if (input) {
      (input as HTMLInputElement).value = provinsi;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, provinsi);
  await sleep(300);

  // Click the province button only inside Daftar Provinsi section
  const provinsiHandle = await page.evaluateHandle((provinsi) => {
    // Find the section with text 'Daftar Provinsi'
    const daftarProvinsiDiv = Array.from(document.querySelectorAll('div')).find(
      (div) => div.textContent && div.textContent.includes('Daftar Provinsi')
    );
    if (!daftarProvinsiDiv) return null;
    // Find the button inside this section whose text matches provinsi
    const btns = daftarProvinsiDiv.parentElement?.querySelectorAll('button');
    if (!btns) return null;
    return (
      Array.from(btns).find((b) => {
        // The button text is inside a child div
        const div = b.querySelector('div');
        return div && div.textContent && div.textContent.trim().toLowerCase() === provinsi.toLowerCase();
      }) || null
    );
  }, provinsi);
  if (provinsiHandle) {
    const isVisible = await provinsiHandle.evaluate((btn) => !!btn && btn.offsetParent !== null);
    if (isVisible) {
      await provinsiHandle.click();
    }
    await provinsiHandle.dispose();
  }

  await sleep(1000); // Wait for the modal to close

  // Type to search the kabupaten in the modal's input (if available)
  await page.evaluate((kabupaten) => {
    const input = document.querySelector('input[placeholder="Cari Kabupaten/Kota"]');
    if (input) {
      (input as HTMLInputElement).value = kabupaten;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, kabupaten);

  await sleep(300); // Wait for the modal to refresh after typing kabupaten

  // Click kabupaten/kota (only inside Daftar Kabupaten/Kota section)
  const kabupatenHandle = await page.evaluateHandle((kabupaten) => {
    // Find the section with text 'Daftar Kabupaten/Kota'
    const daftarKabupatenDiv = Array.from(document.querySelectorAll('div')).find(
      (div) => div.textContent && div.textContent.includes('Daftar Kabupaten/Kota')
    );
    if (!daftarKabupatenDiv) return null;
    // Find the button inside this section whose text matches kabupaten
    const btns = daftarKabupatenDiv.parentElement?.querySelectorAll('button');
    if (!btns) return null;
    return (
      Array.from(btns).find((b) => b.textContent && b.textContent.trim().toLowerCase() === kabupaten.toLowerCase()) ||
      null
    );
  }, kabupaten);
  if (kabupatenHandle) {
    const isVisible = await kabupatenHandle.evaluate((btn) => !!btn && btn.offsetParent !== null);
    if (isVisible) {
      await kabupatenHandle.click();
    }
    await kabupatenHandle.dispose();
  }

  await sleep(1000); // Wait for the modal to refresh after selecting kabupaten

  // Type to search the kecamatan in the modal's input (if available)
  await page.evaluate((kecamatan) => {
    const input = document.querySelector('input[placeholder="Cari Kecamatan"]');
    if (input) {
      (input as HTMLInputElement).value = kecamatan;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, kecamatan);

  await sleep(300); // Wait for the modal to refresh after typing kecamatan

  // Click kecamatan (only inside Daftar Kecamatan section)
  const kecamatanHandle = await page.evaluateHandle((kecamatan) => {
    // Find the section with text 'Daftar Kecamatan'
    const daftarKecamatanDiv = Array.from(document.querySelectorAll('div')).find(
      (div) => div.textContent && div.textContent.includes('Daftar Kecamatan')
    );
    if (!daftarKecamatanDiv) return null;
    // Find the button inside this section whose text matches kecamatan
    const btns = daftarKecamatanDiv.parentElement?.querySelectorAll('button');
    if (!btns) return null;
    return (
      Array.from(btns).find((b) => b.textContent && b.textContent.trim().toLowerCase() === kecamatan.toLowerCase()) ||
      null
    );
  }, kecamatan);
  if (kecamatanHandle) {
    const isVisible = await kecamatanHandle.evaluate((btn) => !!btn && btn.offsetParent !== null);
    if (isVisible) {
      await kecamatanHandle.click();
    }
    await kecamatanHandle.dispose();
  }

  await sleep(1000); // Wait for the modal to refresh after selecting kecamatan

  // Type to search the kelurahan in the modal's input (if available)
  await page.evaluate((kelurahan) => {
    const input = document.querySelector('input[placeholder="Cari Kelurahan"]');
    if (input) {
      (input as HTMLInputElement).value = kelurahan;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, kelurahan);

  await sleep(300); // Wait for the modal to refresh after typing kelurahan

  // Click kelurahan (only inside Daftar Kelurahan section)
  const kelurahanHandle = await page.evaluateHandle((kelurahan) => {
    // Find the section with text 'Daftar Kelurahan'
    const daftarKelurahanDiv = Array.from(document.querySelectorAll('div')).find(
      (div) => div.textContent && div.textContent.includes('Daftar Kelurahan')
    );
    if (!daftarKelurahanDiv) return null;
    // Find the button inside this section whose text matches kelurahan
    const btns = daftarKelurahanDiv.parentElement?.querySelectorAll('button');
    if (!btns) return null;
    return (
      Array.from(btns).find((b) => b.textContent && b.textContent.trim().toLowerCase() === kelurahan.toLowerCase()) ||
      null
    );
  }, kelurahan);
  if (kelurahanHandle) {
    const isVisible = await kelurahanHandle.evaluate((btn) => !!btn && btn.offsetParent !== null);
    if (isVisible) {
      await kelurahanHandle.click();
    }
    await kelurahanHandle.dispose();
  }

  await sleep(1000); // Wait for the modal to refresh after selecting kelurahan
}

/**
 * Fill common input fields in the registration form (NIK, Nama, Nomor Whatsapp).
 * @param page Puppeteer page instance
 * @param item Data item containing input values
 */
async function commonInput(page: Page, item: DataItem) {
  // Input <input id="nik" type="text" class="form-input border-gray-3 focus-within:border-black" name="NIK" placeholder="Masukkan NIK" autocomplete="off" maxlength="16">
  await page.focus('input[id="nik"]');
  await page.type('input[id="nik"]', item.nik, { delay: 100 });

  // Input <input id="Nama Lengkap" type="text" class="form-input border-gray-3 focus-within:border-black" name="Nama" placeholder="Masukkan nama lengkap" autocomplete="off" maxlength="300">
  await page.focus('input[id="Nama Lengkap"]');
  await page.type('input[id="Nama Lengkap"]', item.nama, { delay: 100 });

  // Input phone number <input id="No Whatsapp" type="text" class="w-full form-input rounded-l-none" name="Nomor Whatsapp" placeholder="Masukkan nomor whatsapp" autocomplete="off" maxlength="300">
  await page.focus('input[name="Nomor Whatsapp"]');
  await page.type('input[name="Nomor Whatsapp"]', item.nomor_wa.replace(/^\+62/, ''), { delay: 100 });
}

/**
 * Select pekerjaan (Pekerjaan) by clicking the SVG icon near the label and choosing the correct option.
 * @param page Puppeteer page instance
 * @param item Data item containing pekerjaan
 */
async function vuePekerjaanSelect(page: Page, item: DataItem) {
  // Map pekerjaan to a standardized value using regex patterns matching the button text
  const pekerjaanPatterns = [
    { re: /Belum\/?Tidak Bekerja/i, value: 'Belum/Tidak Bekerja' },
    { re: /Pelajar/i, value: 'Pelajar' },
    { re: /Mahasiswa/i, value: 'Mahasiswa' },
    { re: /Ibu Rumah Tangga/i, value: 'Ibu Rumah Tangga' },
    { re: /TNI/i, value: 'TNI' },
    { re: /POLRI/i, value: 'POLRI' },
    { re: /ASN.*Kantor Pemerintah/i, value: 'ASN (Kantor Pemerintah)' },
    { re: /Pegawai Swasta|wiraswasta/i, value: 'Pegawai Swasta' },
    { re: /Wirausaha|Wiraswasta|Pekerja Mandiri/i, value: 'Wirausaha/Pekerja Mandiri' },
    { re: /Pensiunan/i, value: 'Pensiunan' },
    { re: /Pejabat Negara|Pejabat Daerah/i, value: 'Pejabat Negara / Pejabat Daerah' },
    { re: /Pengusaha/i, value: 'Pengusaha' },
    { re: /Dokter/i, value: 'Dokter' },
    { re: /Bidan/i, value: 'Bidan' },
    { re: /Perawat/i, value: 'Perawat' },
    { re: /Apoteker/i, value: 'Apoteker' },
    { re: /Psikolog/i, value: 'Psikolog' },
    { re: /Tenaga Kesehatan Lainnya/i, value: 'Tenaga Kesehatan Lainnya' },
    { re: /Dosen/i, value: 'Dosen' },
    { re: /Guru/i, value: 'Guru' },
    { re: /Peneliti/i, value: 'Peneliti' },
    { re: /Pengacara/i, value: 'Pengacara' },
    { re: /Notaris/i, value: 'Notaris' },
    { re: /Hakim|Jaksa|Tenaga Peradilan/i, value: 'Hakim/Jaksa/Tenaga Peradilan Lainnya' },
    { re: /Akuntan/i, value: 'Akuntan' },
    { re: /Insinyur/i, value: 'Insinyur' },
    { re: /Arsitek/i, value: 'Arsitek' },
    { re: /Konsultan/i, value: 'Konsultan' },
    { re: /Wartawan/i, value: 'Wartawan' },
    { re: /Pedagang/i, value: 'Pedagang' },
    { re: /Petani|Pekebun/i, value: 'Petani / Pekebun' },
    { re: /Nelayan|Perikanan/i, value: 'Nelayan / Perikanan' },
    { re: /Peternak/i, value: 'Peternak' },
    { re: /Tokoh Agama/i, value: 'Tokoh Agama' },
    { re: /Juru Masak/i, value: 'Juru Masak' },
    { re: /Pelaut/i, value: 'Pelaut' },
    { re: /Sopir/i, value: 'Sopir' },
    { re: /Pilot/i, value: 'Pilot' },
    { re: /Masinis/i, value: 'Masinis' },
    { re: /Atlet/i, value: 'Atlet' },
    { re: /Pekerja Seni/i, value: 'Pekerja Seni' },
    { re: /Penjahit|Perancang Busana/i, value: 'Penjahit / Perancang Busana' },
    { re: /Karyawan kantor|Pegawai Administratif/i, value: 'Karyawan kantor / Pegawai Administratif' },
    { re: /Teknisi|Mekanik/i, value: 'Teknisi / Mekanik' },
    { re: /Pekerja Pabrik|Buruh/i, value: 'Pekerja Pabrik / Buruh' },
    { re: /Pekerja Konstruksi/i, value: 'Pekerja Konstruksi' },
    { re: /Pekerja Pertukangan/i, value: 'Pekerja Pertukangan' },
    { re: /Pekerja Migran/i, value: 'Pekerja Migran' },
    { re: /Lainnya/i, value: 'Lainnya' }
  ];

  // Find standardized pekerjaan value
  let pekerjaanValue = 'Lainnya';
  for (const { re, value } of pekerjaanPatterns) {
    if (re.test(item.pekerjaan)) {
      pekerjaanValue = value;
      break;
    }
  }

  console.log(`${item.pekerjaan} -> ${pekerjaanValue}`);

  // Click the SVG icon near the "Pekerjaan" label to open the dropdown
  const clicked = await page.evaluate(() => {
    // Find the label div
    const allDivs = Array.from(document.querySelectorAll('div.font-semibold'));
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith('Pekerjaan'));
    if (!labelDiv) return false;
    // Find the nearest parent with class w-full or the next sibling with the dropdown
    let container = labelDiv.parentElement;
    // Find the .relative.flex container (dropdown root)
    let dropdownContainer = null;
    while (container && !dropdownContainer) {
      dropdownContainer = Array.from(container.querySelectorAll('div.relative.flex'))[0];
      if (!dropdownContainer) container = container.parentElement;
    }
    // Fallback: try next sibling if not found
    if (!dropdownContainer && labelDiv.nextElementSibling) {
      dropdownContainer = labelDiv.nextElementSibling;
    }
    if (!dropdownContainer) return false;
    // Find the svg icon inside the container
    const svg = dropdownContainer.querySelector('svg');
    if (!svg) return false;
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error('Pekerjaan SVG icon not found or not clickable');

  // Wait for the dropdown to appear
  await sleep(500);

  // Select the pekerjaan option in the modal by matching normalized text (case/space-insensitive)
  await page.evaluate((pekerjaan) => {
    function normalize(str) {
      return str
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .trim()
        .toLowerCase();
    }
    const target = normalize(pekerjaan);
    // Find the modal with z-9000 and look for divs with the button text
    const modal = document.querySelector('div.z-9000, div[class*="z-9000"]');
    if (!modal) throw new Error('Pekerjaan modal not found');
    const divs = Array.from(modal.querySelectorAll('div.flex.items-center.justify-between.gap-2'));
    let found = false;
    for (const div of divs) {
      if (normalize(div.textContent) === target) {
        // Click the parent button
        const btn = div.closest('button');
        if (btn) btn.click();
        found = true;
        break;
      }
    }
    if (!found) throw new Error('Pekerjaan option not found in modal: ' + pekerjaan);
  }, pekerjaanValue);
}

/**
 * Select gender (Jenis Kelamin) by clicking the SVG icon near the label and choosing the correct option.
 * @param page Puppeteer page instance
 * @param item Data item containing gender
 */
async function vueGenderSelect(page: Page, item: DataItem) {
  // Select gender (Jenis Kelamin) by clicking the SVG icon near the label (from Puppeteer context)
  const clickGenderDropdown = await page.evaluate(() => {
    // Find the label div
    const allDivs = Array.from(document.querySelectorAll('div.font-semibold'));
    const labelDiv = allDivs.find((div) => div.textContent && div.textContent.trim().startsWith('Jenis Kelamin'));
    if (!labelDiv) return false;
    // Find the nearest parent with class w-full
    let container = labelDiv;
    while (container && (!container.classList || !container.classList.contains('w-full'))) {
      container = container.parentElement;
    }
    if (!container) return false;
    // Find the svg icon inside the container
    const svg = container.querySelector('svg');
    if (!svg) return false;
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!clickGenderDropdown) throw new Error('Jenis Kelamin SVG icon not found or not clickable');
  // Simplified: select gender option from visible dropdown
  await sleep(500); // Wait for dropdown to appear
  await page.evaluate((gender) => {
    // Find all visible gender options in the dropdown
    const dropdowns = Array.from(
      document.querySelectorAll('div.z-2000, div[style*="z-index: 2000"], div[style*="z-index:2000"]')
    );
    let found = false;
    for (const dropdown of dropdowns) {
      const options = Array.from(dropdown.querySelectorAll('div.cursor-pointer'));
      for (const opt of options) {
        // Look for nested div with exact gender text
        const match = Array.from(opt.querySelectorAll('div')).find(
          (d) => d.textContent && d.textContent.trim() === gender
        );
        if (match) {
          (opt as HTMLElement).click();
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error('Gender option not found: ' + gender);
  }, item.jenis_kelamin);
}

async function vueDatePicker(page: Page, item: DataItem): Promise<void> {
  /**
   * Select a date in the datepicker popup.
   * @param page Puppeteer page instance
   * @param selector CSS selector for the datepicker container
   * @param tanggal Date string in DD/MM/YYYY
   */
  async function selectDate(page: import('puppeteer').Page, selector: string, tanggal: string): Promise<void> {
    const [day, month, year] = tanggal.split('/');
    const bulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

    // 1. Open datepicker
    await page.click(`${selector} .mx-datepicker`);
    await page.waitForSelector('.mx-calendar', { visible: true });

    // --- YEAR ---
    // Try to find the year panel directly (newer mx-datepicker uses .mx-calendar-panel-year)
    const yearPanelSelector = '.mx-calendar .mx-calendar-year-panel, .mx-calendar.mx-calendar-panel-year';
    // Try to find a year button to open the panel, but if already open, skip
    const yearPanel = await page.$(yearPanelSelector);
    if (!yearPanel) {
      // Try multiple possible year buttons
      const yearBtnSel = [
        '.mx-calendar .mx-btn.mx-btn-text.mx-btn-year',
        '.mx-calendar .mx-btn.mx-btn-text.mx-btn-current-year',
        '.mx-calendar .mx-btn-year'
      ].join(',');
      const yearBtn = await page.$(yearBtnSel);
      if (!yearBtn) throw new Error('Year button not found in datepicker');
      await yearBtn.click();
      await page.waitForSelector(yearPanelSelector, { visible: true });
    }

    // Now select the year
    let foundYear = false;
    while (!foundYear) {
      // Try both old and new year panel structures
      const years: string[] = await page.$$eval(
        '.mx-calendar-year-panel td, .mx-calendar.mx-calendar-panel-year .mx-table-year td',
        (els: Element[]) => els.map((el) => (el.textContent ?? '').trim())
      );
      if (years.includes(String(year))) {
        await page.evaluate((year: string) => {
          const yearCells = Array.from(
            document.querySelectorAll(
              '.mx-calendar-year-panel td, .mx-calendar.mx-calendar-panel-year .mx-table-year td'
            )
          );
          const target = yearCells.find((td) => (td.textContent ?? '').trim() === String(year));
          if (target) (target as HTMLElement).click();
        }, year);
        foundYear = true;
      } else {
        // Move panel left/right depending on target year
        const nums = years.map(Number).filter(Boolean);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (Number(year) < min) {
          // Try both old and new prev buttons
          const prevBtn = await page.$(
            '.mx-calendar-year-panel .mx-btn-icon-double-left, .mx-calendar.mx-calendar-panel-year .mx-btn-icon-double-left'
          );
          if (prevBtn) await prevBtn.click();
        } else if (Number(year) > max) {
          const nextBtn = await page.$(
            '.mx-calendar-year-panel .mx-btn-icon-double-right, .mx-calendar.mx-calendar-panel-year .mx-btn-icon-double-right'
          );
          if (nextBtn) await nextBtn.click();
        } else {
          throw new Error(`Year ${year} not in panel, but can't navigate`);
        }
        // Use a standard delay instead of page.waitForTimeout
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // --- MONTH ---
    // Try to open month panel if not already in month selection mode
    const monthPanelSelector = '.mx-calendar .mx-calendar-month-panel, .mx-calendar.mx-calendar-panel-month';
    const monthPanel = await page.$(monthPanelSelector);
    if (!monthPanel) {
      // Try to find a month button to open the panel, but if already open, skip
      const monthBtnSel = [
        '.mx-calendar .mx-btn.mx-btn-text.mx-btn-month',
        '.mx-calendar .mx-btn-month',
        '.mx-calendar .mx-btn.mx-btn-current-year' // fallback: sometimes year button opens month panel
      ].join(',');
      const monthBtn = await page.$(monthBtnSel);
      if (!monthBtn) throw new Error('Month button not found in datepicker');
      await monthBtn.click();
      await page.waitForSelector(monthPanelSelector, { visible: true });
    }

    // Now select the month
    await page.evaluate((monthText: string) => {
      // Try both old and new month panel structures
      const monthCells = Array.from(
        document.querySelectorAll(
          '.mx-calendar-month-panel td, .mx-calendar.mx-calendar-panel-month .mx-table-month td'
        )
      );
      const target = monthCells.find((td) => (td.textContent ?? '').trim().startsWith(monthText));
      if (target) (target as HTMLElement).click();
    }, bulan[Number(month)]);

    // --- DAY ---
    // Select the correct day cell by matching both the day number and the title attribute (YYYY-MM-DD)
    const yyyy = year;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const targetDate = `${yyyy}-${mm}-${dd}`;
    await page.evaluate(
      (targetDate: string, day: string) => {
        // Find all day cells in the current month
        const dayCells = Array.from(document.querySelectorAll('.mx-table-date td.cell'));
        const targetCell = dayCells.find(
          (td) =>
            td.getAttribute('title') === targetDate &&
            td.querySelector('div') &&
            (td.querySelector('div')!.textContent ?? '').trim() === String(Number(day))
        );
        if (targetCell) {
          (targetCell as HTMLElement).click();
        } else {
          // fallback: try to click the button inside the cell if present
          const btn = targetCell && targetCell.querySelector('button');
          if (btn) (btn as HTMLElement).click();
        }
      },
      targetDate,
      day
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Usage
  await selectDate(page, '#Tanggal\\ Lahir', item.tanggal_lahir);
}

/**
 * Perform login on the sehatindonesiaku.kemkes.go.id site.
 * @param page Puppeteer page instance
 */
async function _login(page: Page) {
  await page.goto('https://sehatindonesiaku.kemkes.go.id/auth/login', { waitUntil: 'networkidle2' });
  // Fill email (username)
  await page.type('input[name="Email"]', process.env.SIH_USERNAME);
  // Fill password
  await page.type('input[name="Kata sandi"]', process.env.SIH_PASSWORD);
  // Wait for captcha input to be visible
  await page.waitForSelector('input[name="Captcha"]', { visible: true });
  // Optionally, you can add code to handle captcha here (manual or automated)
  // Uncomment below to prompt for captcha input from user
  // const captcha = await promptUserForCaptcha();
  // await page.type('input[name="Captcha"]', captcha);
  // Wait for the login button to be enabled and click it
  const loginButtonSelector = 'div.text-center .bg-disabled, div.text-center button[type="submit"]';
  // Try to find enabled button, fallback to disabled for waiting
  await page.waitForSelector(loginButtonSelector, { visible: true });
  // If the button is not disabled, click it
  const isDisabled = await page.$eval(loginButtonSelector, (el) => el.classList.contains('bg-disabled'));
  if (!isDisabled) {
    await Promise.all([
      page.click('div.text-center button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    console.log('Login successful');
  } else {
    console.log('Login button is disabled. Please check if all fields are filled and captcha is handled.');
  }
}

async function _ss(page, filePath = 'tmp/screenshot.png') {
  fs.ensureDirSync(path.dirname(filePath));
  await page.screenshot({
    path: filePath,
    fullPage: true
  });
  console.log(`Screenshot saved as ${filePath}`);
}

main().catch((err) => {
  if (err instanceof Error) {
    console.error(err.stack || err.message);
  } else {
    try {
      console.error('Non-Error thrown:', JSON.stringify(err, null, 2));
    } catch (e) {
      console.error('Non-Error thrown:', e);
    }
  }
});
