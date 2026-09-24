'use strict';

var require$$0 = require('child_process');
var require$$1 = require('node:readline');

var waitEnter_1;
var hasRequiredWaitEnter;

function requireWaitEnter () {
	if (hasRequiredWaitEnter) return waitEnter_1;
	hasRequiredWaitEnter = 1;
	const { exec } = require$$0;
	const readline = require$$1;
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
	waitEnter_1 = { waitEnter };
	return waitEnter_1;
}

exports.__require = requireWaitEnter;
