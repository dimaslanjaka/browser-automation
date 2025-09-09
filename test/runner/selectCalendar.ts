import moment from 'moment';
import { getPuppeteer, waitForDomStable } from '../../src/puppeteer_utils.js';
import {
  clickDaftarBaru,
  enterSehatIndonesiaKu,
  selectTodayFromRegistrationTanggalPemeriksaan
} from '../../src/runner/sehatindonesiaku-utils.js';

async function main() {
  const { browser } = await getPuppeteer();
  const page = await browser.newPage();
  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (isLoggedIn) {
    await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
    await waitForDomStable(page, 2000, 6000);

    await clickDaftarBaru(page);
    await waitForDomStable(page, 2000, 6000);

    const today = moment().format('DD/MM/YYYY');
    if (!(await selectTodayFromRegistrationTanggalPemeriksaan(page, today))) {
      console.error('Failed to select date');
    } else {
      console.log('Date selected successfully');
    }
  }
}

main().catch(console.error);
