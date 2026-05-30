import minimist from 'minimist';
import {
  parallelSkrinCheckEndpointManager,
  parallelSkrinCheckClaimedEndpoint,
  parallelSkrinCheck
} from './skrin-check-data.js';

// CLI parsing
const argv = minimist(process.argv.slice(2), {
  string: ['nik'],
  boolean: ['force', 'help', 'open'],
  alias: {
    f: 'force',
    h: 'help',
    n: 'nik',
    o: 'open'
  },
  default: { force: false, nik: '', open: false }
});

if (argv.help) {
  const helpLines = [
    'Usage: node skrin-check-data [options]',
    '',
    'Options:',
    '  --nik, -n <nik>    Process specific NIK(s) (comma-separated allowed)',
    '  --force, -f        Process all data',
    '  --open, -o         Open saved screenshot(s) after capture',
    '  --help, -h         Show this help message',
    '',
    'Notes:',
    '  - Screenshots are saved to tmp/screenshot as JPEG for local inspection.',
    '  - Per-entry encrypted .bin files are written to',
    '    public/assets/data/screenshots/<md5>.bin and referenced in',
    '    tmp/screenshot/metadata.bin (encrypted).',
    '  - Ensure VITE_JSON_SECRET is set in the environment for encryption.',
    '',
    'Examples:',
    '  node skrin-check-data -n 3201',
    '  node skrin-check-data -n 3201 -n 3202',
    '  node skrin-check-data -n 3201,3202,3203',
    '  node skrin-check-data -f'
  ];
  helpLines.forEach(console.log);
  process.exit(0);
}

// normalize nik (supports single, multiple, comma-separated)
const specificNiks: string[] = ([] as string[])
  .concat(argv.nik || [])
  .flatMap((n: string) => String(n).split(','))
  .map((n) => n.trim())
  .filter(Boolean);

if (specificNiks.length > 0) {
  console.log('Specific NIK mode:', specificNiks.join(', '));
}

const force = Boolean(argv.force);
const openScreenshots = Boolean(argv.open);

if (force) {
  console.log('Force mode enabled: all data will be processed.');
}

parallelSkrinCheck({ specificNiks, force, openScreenshots })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    // Do not close the browser here to allow inspection of the final state.
    // If you want to close it, you can uncomment the following lines:
    parallelSkrinCheckEndpointManager.releaseEndpointClaim(parallelSkrinCheckClaimedEndpoint!, process.pid);
    process.exit(0);
  });
