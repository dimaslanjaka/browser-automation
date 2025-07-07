import { logLine } from '../src/utils.js';

logLine('This is a test log message.');
logLine(123);
logLine(true);
logLine(null);
logLine([1, 'two', false, null]);
logLine({ key: 'value', number: 42, flag: true, empty: null });
