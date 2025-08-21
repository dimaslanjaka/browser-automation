import { newLogPath } from '../src/runner/skrin.log-restart.js';
import { getLogData } from '../src/utils.js';

const data = getLogData(newLogPath);
console.log(data[0]);
