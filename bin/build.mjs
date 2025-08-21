import { spawnSync } from 'child_process';
import fs from 'fs';
import * as glob from 'glob';
import path from 'path';
import { getChecksum } from 'sbg-utility';

const checksumFile = path.join(process.cwd(), 'checksum.txt');
const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8').trim() : null;
const files = glob.sync('**/*.{js,cjs,mjs,ts,tsx,jsx}', {
  cwd: path.join(process.cwd(), 'src')
});
const checksum = getChecksum(
  path.join(process.cwd(), 'package.json'),
  ...files.map((file) => path.join(process.cwd(), file))
);

if (lastChecksum !== checksum) {
  console.log('Checksum has changed, running build...');
  // Run the build command with shell:true to ensure all output is shown
  const result = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  console.log(`Build process exited with code: ${result.status}`);
  if (result.error) {
    console.error('Error running build:', result.error);
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
  // Update the checksum file
  fs.writeFileSync(checksumFile, checksum);
}
