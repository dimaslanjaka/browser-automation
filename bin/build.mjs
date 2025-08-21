import color from 'ansi-colors';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getChecksum } from 'sbg-utility';

const checksumFile = path.join(process.cwd(), 'tmp/checksum.txt');
const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8').trim() : null;
const checksum = getChecksum(path.join(process.cwd(), 'package.json'), path.join(process.cwd(), 'src'));

if (lastChecksum !== checksum) {
  console.log(
    [
      'Checksum changed, running build...',
      `  Previous: ${color.yellow(lastChecksum)}`,
      `  Current:  ${color.green(checksum)}`
    ].join('\n')
  );
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
} else {
  console.log(
    [
      'No changes detected, skipping build.',
      `  Previous: ${color.yellow(lastChecksum)}`,
      `  Current:  ${color.green(checksum)}`
    ].join('\n')
  );
}
