import { puppeteerTempPath } from '../../../.puppeteerrc.cjs';
import EndpointManager from './EndpointManager.js';

(async () => {
  const endpointManager = new EndpointManager(puppeteerTempPath);
  const endpoints = await endpointManager.getAllActiveEndpoints();
  console.log('Active browser endpoints:');
  endpoints.forEach((item, index) => {
    let status: string;
    if (item.locked) {
      status = `LOCKED (PID: ${item.ownerPid})`;
    } else if (item.inactive) {
      status = 'INACTIVE (stale lock)';
    } else if (!item.puppeteerAvailable) {
      status = 'UNAVAILABLE (no response)';
    } else {
      status = 'AVAILABLE';
    }
    console.log(`${index + 1}. ${item.endpoint} - ${status}`);
  });
})();
