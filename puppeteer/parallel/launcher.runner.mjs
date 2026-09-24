import { parallelLauncher } from '../../src/puppeteer/parallel/launcher.mjs';

parallelLauncher()
    .then(() => {
    console.log('Launcher process completed.');
    process.exit(0);
})
    .catch((err) => {
    console.error('Error in launcher process:', err);
    process.exit(1);
});
