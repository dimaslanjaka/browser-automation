import minimist from 'minimist';
import moment from 'moment';
import { normalizePathUnix } from 'sbg-utility';
import { sehatindonesiakuPref } from './sehatindonesiaku-data.js';

const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' }
});

/**
 * Print usage and options help to the console.
 */
function showHelp() {
  // Print the command and file from process.argv
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  -h, --help                Show this help message');
  console.log('  --tanggal_pemeriksaan      Set the tanggal_pemeriksaan (DD/MM/YYYY)');
  console.log('  --provinsi                 Set the provinsi');
  console.log('  --kabupaten                Set the kabupaten');
  console.log('  --kecamatan                Set the kecamatan');
  console.log('  --kelurahan                Set the kelurahan');
}

if (args.help) {
  showHelp();
  process.exit(0);
}

/**
 * Check if a string is empty or consists only of whitespace.
 */
function isEmpty(str?: string): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Exit with an error message.
 */
function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}

// Validation map
const validators: Record<string, (val: string) => void> = {
  tanggal_pemeriksaan: (val) => {
    const parsed = moment(val, 'DD/MM/YYYY', true);
    if (!parsed.isValid()) exitWithError('Invalid tanggal_pemeriksaan format, expected DD/MM/YYYY');
    sehatindonesiakuPref.putString('tanggal_pemeriksaan', val);
  },
  provinsi: (val) => {
    if (isEmpty(val)) exitWithError('Invalid provinsi, cannot be empty');
    sehatindonesiakuPref.putString('provinsi', val);
  },
  kabupaten: (val) => {
    if (isEmpty(val)) exitWithError('Invalid kabupaten, cannot be empty');
    sehatindonesiakuPref.putString('kabupaten', val);
  },
  kecamatan: (val) => {
    if (isEmpty(val)) exitWithError('Invalid kecamatan, cannot be empty');
    sehatindonesiakuPref.putString('kecamatan', val);
  },
  kelurahan: (val) => {
    if (isEmpty(val)) exitWithError('Invalid kelurahan, cannot be empty');
    sehatindonesiakuPref.putString('kelurahan', val);
  }
};

let noMatch = true;
// Iterate through defined validators
for (const [key, validate] of Object.entries(validators)) {
  const val = args[key];
  if (val !== undefined) {
    validate(val);
    noMatch = false;
  }
}

if (noMatch) {
  console.log('No valid options provided.');
  showHelp();
  process.exit(0);
}
