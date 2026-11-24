import { parallelLauncherAgent } from './launcher-agent.js';

parallelLauncherAgent()
  .then(() => {
    console.log('Agent launcher process completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error in agent launcher process:', err);
    process.exit(1);
  });
