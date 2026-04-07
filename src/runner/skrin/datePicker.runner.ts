import Bluebird from 'bluebird';
import { array_shuffle, scheduler } from 'sbg-utility';
import { loadCsvData } from '../../../data/index.js';
import EndpointManager from '../../puppeteer/parallel/EndpointManager.js';
import { puppeteerTempPath } from '../../puppeteer/parallel/utils.js';
import { closeOtherTabs, getPuppeteer } from '../../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import { fixData } from '../../xlsx-helper.js';
import { selectDateWithUI } from './datePicker.js';

scheduler.register();

async function main() {
  const endpointManager = new EndpointManager(puppeteerTempPath);
  const endpoint = endpointManager.getAvailableEndpoint();
  let claimedEndpoint: string | undefined;
  if (endpointManager.tryClaimEndpoint(endpoint, process.pid)) {
    claimedEndpoint = endpoint;
  }
  const { page, browser } = await getPuppeteer({ autoSwitchProfileDir: true, browserWSEndpoint: claimedEndpoint });
  scheduler.add('browser-close', async () => {
    if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
    console.log('Received SIGINT, exiting.');
    await closeOtherTabs(browser, 2);
    process.exit(0);
  });
  await closeOtherTabs(browser, 2);

  const raw = await loadCsvData();
  const dataKunto = await Bluebird.map(
    raw,
    async (data) => {
      try {
        return await fixData(data, { autofillTanggalEntry: true });
      } catch {
        return null;
      }
    },
    {
      concurrency: 10
    }
  );

  const filtered = dataKunto.filter((d) => d != null);
  const data = array_shuffle(filtered).shift();
  console.log('Selected data:', data);
  await autoLoginAndEnterSkriningPage(page);
  const dateValue = data['TANGGAL ENTRY'];
  await selectDateWithUI(page, dateValue);
  // <a href="#" role="button" aria-live="assertive" aria-atomic="true" class="k-link k-nav-fast k-state-hover" aria-disabled="false">April 2026</a>
}

if (process.argv.some((arg) => arg.includes('datepicker.runner'))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
