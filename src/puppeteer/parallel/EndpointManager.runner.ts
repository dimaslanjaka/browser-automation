import { noop } from 'sbg-utility';
import { connectEndpoint } from './EndpointManager.connector.js';

async function main() {
  const { browser } = await connectEndpoint();
  const goto = async (url: string, newTab = true) => {
    const page = newTab ? await browser.newPage() : (await browser.pages())[0] || (await browser.newPage());
    await page.goto(url).catch(noop);
  };

  goto('https://accounts.google.com/');
  goto('https://www.scrapingcourse.com/antibot-challenge');
  goto('https://bot.sannysoft.com');
}

main().catch((e) => console.error(e));
