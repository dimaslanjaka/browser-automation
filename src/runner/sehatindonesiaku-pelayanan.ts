import { Page } from 'puppeteer';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';
import { UnauthorizedError } from './sehatindonesiaku-errors.js';
import { getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { sleep } from '../utils-browser.js';
import minimist from 'minimist';
import { normalizePathUnix } from 'sbg-utility';

const args = minimist(process.argv.slice(2), { alias: { h: 'help' } });

export function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  -h, --help     Show help');
}

async function main() {
  const puppeteer = await getPuppeteer();
  processData(puppeteer.page);
}

async function processData(page: Page) {
  const browser = page.browser();
  // Close tab when more than 5 tabs open
  const pages = await browser.pages();
  if (pages.length > 5) {
    console.log(`Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close(); // Close the first tab
  }

  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new UnauthorizedError();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 2000, 6000);
  await sleep(1000);

  // Select puskesmas <div data-v-ec20952b="" class="p-3 h-[85%] border-1 border-solid border-rd-xl border-[#E4E5E7]"><div data-v-ec20952b="" class="flex gap-2"><div data-v-ec20952b="" class="rounded-full h-4 w-4 flex justify-center items-center border-1 border-solid border-primaryColor"><label data-v-ec20952b="" class="custom-radio-button h-full px-4 flex items-center justify-between w-full"><input data-v-ec20952b="" id="role" type="radio" class="active:ring-2 active:ring-primaryColor" value="puskesmas"><span data-v-ec20952b="" class="helping-el2"></span></label></div><div data-v-ec20952b="" class="flex items-center"><div data-v-ec20952b="" class="text-[14px] font-bold">Puskesmas</div></div></div><div data-v-ec20952b="" class="pl-7 text-[14px] font-400">Melakukan pemeriksaan sebagai nakes di puskesmas.</div></div>
  await clickRadioPuskesmas(page);

  // Click save <div data-v-ec20952b="" class="w-full flex justify-end mt-6"><div data-v-ec20952b=""><button type="submit" class="w-fill btn-fill-primary h-11"><div class="flex flex-row justify-center gap-2"><!----><div class="tracking-wide">Simpan <!----></div></div></button></div></div>
  await clickSubmit(page);
}

export async function clickSubmit(page: Page) {
  const wrappers = await page.$$('div.justify-end');
  for (const wrapper of wrappers) {
    const buttons = await wrapper.$$('button[type="submit"]');

    for (const button of buttons) {
      const text = await button.evaluate((el) => el.textContent?.replace(/\s+/g, ' ').trim());
      if (text && text.includes('Simpan')) {
        await button.evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'center' }));
        await button.click({ delay: 50 });
        return;
      }
    }
  }

  throw new Error("❌ Submit button with text 'Simpan' not found");
}

async function clickRadioPuskesmas(page: Page) {
  // Locate the label wrapping the input
  const label = await page.$('label.custom-radio-button');
  if (!label) throw new Error("❌ Label for 'Puskesmas' not found");

  // Scroll into view
  await label.evaluate((el) => {
    (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'center' });
  });

  // Click the label (this will toggle the radio)
  await label.click({ delay: 50 });
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-pelayanan'))) {
  (async () => {
    if (args.help) {
      showHelp();
      return;
    }
    try {
      await main();
    } catch (err) {
      console.error(err);
    }
  })();
}
