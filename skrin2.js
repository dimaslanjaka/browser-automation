import 'dotenv/config';
import moment from 'moment';
import { fetchXlsxData4 } from './src/fetchXlsxData4.js';
import {
  clickIframeElement,
  getPuppeteer,
  isIframeElementVisible,
  typeAndTriggerIframe,
  typeToIframe
} from './src/puppeteer_utils.js';
import { enterSkriningPage, skrinLogin } from './src/skrin_puppeteer.js';
import { extractNumericWithComma, getNumbersOnly, logLine, sleep, ucwords, waitEnter } from './src/utils.js';
import { fixData, getDataRange } from './src/xlsx-helper.js';

console.clear();

/**
 * Processes a single data entry in the skrining workflow.
 *
 * @async
 * @param {import('puppeteer').Page} page - Puppeteer page instance to operate on.
 * @param {Awaited<ReturnType<typeof getDataRange>>[number]} data - A single data row from getDataRange (already fixed by fixData).
 * @returns {Promise<void>} Resolves when processing is complete.
 */
async function processData(page, data) {
  const fixedData = await fixData(data);
  const NIK = getNumbersOnly(fixedData.NIK);
  let isManualInput = false;
  logLine('Processing', fixedData);

  await enterSkriningPage(page, false);

  // Wait for the dialog window iframe to appear
  await page.waitForSelector('.k-window-content iframe.k-content-frame', { visible: true, timeout: 30000 });

  // Wait for the iframe to load and the datepicker element to be ready
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector('.k-window-content iframe.k-content-frame');
      if (!iframe || !iframe.contentDocument) return false;

      const datePickerElement = iframe.contentDocument.getElementById('dt_tgl_skrining');
      return datePickerElement !== null;
    },
    { timeout: 30000 }
  );

  logLine('Iframe loaded and datepicker element is ready');

  const tanggalEntry = fixedData.tanggal || fixedData['TANGGAL ENTRY'];

  // Set the date value in the iframe's datepicker element
  if (tanggalEntry) {
    // await setIframeElementValue(page, '.k-window-content iframe.k-content-frame', '#dt_tgl_skrining', tanggalEntry, {
    //   triggerEvents: true,
    //   handleDisabled: true
    // });
    typeAndTriggerIframe(page, '.k-window-content iframe.k-content-frame', '#dt_tgl_skrining', tanggalEntry);
    logLine(`Date ${tanggalEntry} applied to #dt_tgl_skrining`);
    await sleep(1000); // Wait for the datepicker to process the input
  }

  await typeAndTriggerIframe(page, '.k-window-content iframe.k-content-frame', '#nik', NIK);

  await sleep(2000); // Wait for the NIK input to process

  if (
    await isIframeElementVisible(
      page,
      '.k-window-content iframe.k-content-frame',
      '[aria-labelledby="dialogconfirm_wnd_title"]'
    )
  ) {
    logLine(`Confirmation modal is visible - Data tidak ditemukan`);

    // You can check for specific buttons too
    const hasYesButton = await isIframeElementVisible(page, '.k-window-content iframe.k-content-frame', '#yesButton');
    const hasNoButton = await isIframeElementVisible(page, '.k-window-content iframe.k-content-frame', '#noButton');

    if (hasYesButton && hasNoButton) {
      logLine(`Both Yes and No buttons are available`);
      // Here you can click on the appropriate button

      // Click the Yes button to continue with manual input
      const clickSuccess = await clickIframeElement(page, '.k-window-content iframe.k-content-frame', '#yesButton');

      if (clickSuccess) {
        logLine(`Successfully clicked Yes button - continuing with manual input`);
        isManualInput = true;
      } else {
        logLine(`Failed to click Yes button`);
      }
    }
  } else {
    logLine(`Confirmation modal is not visible - Data found or no confirmation needed`);
  }

  if (isManualInput) {
    // Proceed with manual input

    logLine(`Proceeding with manual input for NIK: ${NIK}`);

    // Insert default skrining inputs
    await typeAndTriggerIframe(
      page,
      '.k-window-content iframe.k-content-frame',
      'input[name="metode_id_input"]',
      'Tunggal'
    );
    await typeAndTriggerIframe(
      page,
      '.k-window-content iframe.k-content-frame',
      'input[name="tempat_skrining_id_input"]',
      'Puskesmas'
    );

    await typeAndTriggerIframe(
      page,
      '.k-window-content iframe.k-content-frame',
      '#field_item_nama_peserta input[type="text"]',
      fixedData.nama
    );

    if (fixedData.gender !== 'Tidak Diketahui') {
      // Input gender
      await typeAndTriggerIframe(
        page,
        '.k-window-content iframe.k-content-frame',
        '#field_item_jenis_kelamin_id input[type="text"]',
        fixedData.gender
      );
    } else {
      throw new Error(`Gender is not known for NIK: ${NIK}`);
    }

    // Try to find the birth date field in fixedData
    let tglLahir = fixedData['TGL LAHIR'];
    logLine('Resolved tglLahir: ' + tglLahir);
    if (!moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(`Invalid date format for TGL LAHIR: ${tglLahir} (NIK: ${NIK})`);
    } else {
      await typeAndTriggerIframe(
        page,
        '.k-window-content iframe.k-content-frame',
        '#field_item_tgl_lahir input[type="text"]',
        tglLahir
      );
    }

    // Input data job
    await typeAndTriggerIframe(
      page,
      '.k-window-content iframe.k-content-frame',
      'input[name="pekerjaan_id_input"]',
      fixedData.pekerjaan
    );

    // input address
    if (fixedData.parsed_nik && fixedData.parsed_nik.status === 'success') {
      const parsed_nik = fixedData.parsed_nik.data;
      let { kotakab = '', namaKec = '', provinsi = '', kelurahan = [] } = parsed_nik;
      if (kotakab.length > 0 && namaKec.length > 0 && provinsi.length > 0 && kelurahan.length > 0) {
        const selectedKelurahan = kelurahan[0];
        logLine(`Using parsed NIK data for address: ${selectedKelurahan.name}, ${namaKec}, ${kotakab}, ${provinsi}`);

        // Input provinsi -> kabupaten -> kecamatan -> kelurahan -> alamat
        await typeAndTriggerIframe(
          page,
          '.k-window-content iframe.k-content-frame',
          '#field_item_provinsi_ktp_id input[type="text"]',
          ucwords(provinsi)
        );
        await typeAndTriggerIframe(
          page,
          '.k-window-content iframe.k-content-frame',
          '#field_item_kabupaten_ktp_id input[type="text"]',
          ucwords(kotakab)
        );
        await typeAndTriggerIframe(
          page,
          '.k-window-content iframe.k-content-frame',
          '#field_item_kecamatan_ktp_id input[type="text"]',
          ucwords(namaKec)
        );
        await typeAndTriggerIframe(
          page,
          '.k-window-content iframe.k-content-frame',
          '#field_item_kelurahan_ktp_id input[type="text"]',
          ucwords(selectedKelurahan.name)
        );
        await typeAndTriggerIframe(
          page,
          '.k-window-content iframe.k-content-frame',
          '#field_item_alamat_ktp textarea[type="text"]',
          fixedData.alamat
        );
      }
    }
  }

  // Input berat badan and tinggi badan
  const bb = fixedData.bb || fixedData.BB || null;
  const tb = fixedData.tb || fixedData.TB || null;
  logLine(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);
  await typeToIframe(
    page,
    '.k-window-content iframe.k-content-frame',
    '#field_item_berat_badan input[type="text"]',
    extractNumericWithComma(bb)
  );
  await typeToIframe(
    page,
    '.k-window-content iframe.k-content-frame',
    '#field_item_tinggi_badan input[type="text"]',
    extractNumericWithComma(tb)
  );

  // Input tidak
  const iframeSelector = '.k-window-content iframe.k-content-frame';
  const tidakOptions = { clearFirst: true };

  await typeToIframe(
    page,
    iframeSelector,
    '#field_item_risiko_6_id input[type="text"]',
    fixedData.diabetes ? 'Ya' : 'Tidak',
    tidakOptions
  );

  if (fixedData.gender.toLowerCase().trim() === 'perempuan') {
    await typeToIframe(page, iframeSelector, '#field_item_risiko_9_id input[type="text"]', 'Tidak', tidakOptions);
  }

  if (!fixedData.batuk) {
    logLine(`Inputting batuk: Tidak ${fixedData.NAMA} (${NIK})`);
    await typeToIframe(page, iframeSelector, '#field_item_gejala_2_1_id input[type="text"]', 'Tidak', tidakOptions);
    // detach from active element
    await page.keyboard.press('Tab');
  } else {
    let keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
    logLine(`Inputting batuk: ${keteranganBatuk} ${fixedData.NAMA} (${NIK})`);
    if (/\d/m.test(keteranganBatuk)) {
      await typeToIframe(page, iframeSelector, '#field_item_keterangan textarea', keteranganBatuk, tidakOptions);
      logLine(`Keterangan batuk contains a number for NIK: ${NIK}, waiting for user to fix data...`);
      await waitEnter(`Please fix data batuk/demam for ${fixedData.NAMA} (${NIK}). Press Enter to continue...`);
    }
  }

  const tidakFields = [
    '#field_item_cxr_pemeriksaan_id input[type="text"]',
    '#field_item_gejala_2_3_id input[type="text"]',
    '#field_item_gejala_2_4_id input[type="text"]',
    '#field_item_gejala_2_5_id input[type="text"]',
    '#field_item_gejala_6_id input[type="text"]',
    '#field_item_risiko_1_id input[type="text"]',
    '#field_item_risiko_10_id input[type="text"]',
    '#field_item_risiko_11_id input[type="text"]',
    '#field_item_risiko_4_id input[type="text"]',
    '#field_item_risiko_5_id input[type="text"]',
    '#field_item_risiko_7_id input[type="text"]',
    '#field_item_riwayat_kontak_tb_id input[type="text"]'
  ];
  if (fixedData.age < 18) {
    tidakFields.push(
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    );
  }

  for (const selector of tidakFields) {
    await typeToIframe(page, iframeSelector, selector, 'Tidak', tidakOptions);
    // detach from active element
    await page.keyboard.press('Tab');
  }

  // detach from any active element
  await page.keyboard.press('Tab');
}

const main = async () => {
  const { page } = await getPuppeteer();
  await skrinLogin(page);

  const rangeData = await getDataRange(await fetchXlsxData4(), {
    fromNik: '3578106311200003',
    fromNama: 'NI NYOMAN ANINDYA MAHESWARI',
    toNik: '3578101502250001',
    toNama: 'MUHAMMAD NATHAN ALFATIR'
  });

  await processData(page, rangeData.at(0));
};

main();
