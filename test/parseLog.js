import { newLogPath } from '../src/runner/skrin.log-restart.js';
import { getLogData } from '../src/utils/index.js';

const data = getLogData(newLogPath);
console.log(data[0]);
