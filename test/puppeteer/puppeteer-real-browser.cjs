const { connect } = require('puppeteer-real-browser');
const { noop } = require('sbg-utility');

async function _main() {
  const { browser } = await connect({
    headless: false,

    args: [],

    customConfig: {},

    turnstile: true,

    connectOption: {},

    disableXvfb: false,
    ignoreAllFlags: false
    // proxy:{
    //     host:'<proxy-host>',
    //     port:'<proxy-port>',
    //     username:'<proxy-username>',
    //     password:'<proxy-password>'
    // }
  });

  const goto = async (url) => {
    const page = await browser.newPage();
    await page.goto(url).catch(noop);
  };

  goto('https://accounts.google.com/');
  goto('https://www.scrapingcourse.com/antibot-challenge');
  goto('https://bot.sannysoft.com');
}

_main();
