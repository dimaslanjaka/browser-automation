import { parallelLauncher } from './launcher.js';

parallelLauncher()
  .then(() => {
    console.log('Launcher process completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error in launcher process:', err);
    process.exit(1);
  });
