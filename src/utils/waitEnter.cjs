'use strict';

const { exec } = require('child_process');
const readline = require('node:readline');

/**
 * Prompts the user to press Enter with an optional sound beep before continuing execution.
 *
 * @param {string} message - The message to display in the terminal prompt.
 * @param {boolean} [sound=true] - Whether to play a beep sound before prompting.
 * @returns {Promise<void>} A promise that resolves when the user presses Enter.
 */
function waitEnter(message, sound = true) {
  return new Promise(function (resolve) {
    if (sound) {
      exec('[console]::beep(1000, 500)', { shell: 'powershell.exe' });
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.emitKeypressEvents(process.stdin);

    const onKeypress = (str, key) => {
      if (key && key.name === 'escape') {
        process.exit(1);
      }
    };

    process.stdin.on('keypress', onKeypress);

    rl.question(message.replace(/(\.\.\.)\s*$/, '') + ' (Esc to exit)... ', () => {
      process.stdin.removeListener('keypress', onKeypress);
      rl.close();
      resolve();
    });
  });
}

module.exports = { waitEnter };
