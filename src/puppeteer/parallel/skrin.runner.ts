import minimist from 'minimist';
import parallelSkrin from './skrin.js';

// CLI parsing
const argv = minimist(process.argv.slice(2), {
  boolean: [
    'loop',
    'randomize',
    'help',
    'skip-validate-db',
    'skip-current-month-validation',
    'skip-current-year-validation'
  ],
  alias: {
    l: 'loop',
    r: 'randomize',
    h: 'help',
    v: 'skip-validate-db',
    m: 'skip-current-month-validation',
    y: 'skip-current-year-validation'
  },
  default: { loop: false, randomize: false }
});

if (argv.help) {
  [
    'Usage: node skrin [options]',
    '',
    'Options:',
    '  --loop, -l         Loop over available inputs (default: single input)',
    '  --randomize, -r    Randomize data before processing (default: false)',
    '  --max <n>          Maximum items to process when looping',
    '  --skip-validate-db, -v  Skip validation against DB (default: false)',
    '  --skip-current-month-validation, -m  Skip current month validation (default: false)',
    '  --skip-current-year-validation, -y   Skip current year validation (default: false)',
    '  --help, -h         Show this help message'
  ].forEach((line) => console.log(line));
  process.exit(0);
}

const maxNum = argv.max ? Number(argv.max) : undefined;

parallelSkrin({
  loop: Boolean(argv.loop),
  randomize: Boolean(argv.randomize),
  max: Number.isFinite(maxNum) ? maxNum : undefined,
  argv
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
