const glob = require('glob');
const spawn = require('cross-spawn');
const fs = require('fs-extra');
const upath = require('upath');

function run(file) {
  const ext = upath.extname(file);

  const isTs = ext === '.ts' || file.endsWith('.mts') || file.endsWith('.cts');

  const cmd = isTs ? 'npx' : 'node';
  const args = isTs ? ['ts-node', file] : [file];

  console.log(`\n[builder] running: ${file}`);

  const result = spawn.sync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`Builder failed: ${file}`);
  }
}

function main() {
  const pattern = upath.join('src', '**', '*.builder.*');

  const files = glob.sync(pattern, {
    nodir: true,
    absolute: false
  });

  if (!files.length) {
    console.log('[builder] no builder files found');
    return;
  }

  console.log(`[builder] found ${files.length} file(s)`);

  for (const file of files) {
    const normalized = upath.toUnix(file);

    if (!fs.existsSync(normalized)) continue;

    run(normalized);
  }

  console.log('\n[builder] done');
}

main();
