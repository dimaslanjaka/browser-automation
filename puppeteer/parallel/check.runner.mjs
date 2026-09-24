import { EndpointManager } from './EndpointManager.mjs';

(async () => {
    const endpointManager = new EndpointManager();
    const endpoints = await endpointManager.getAllActiveEndpoints();
    console.log('Active browser endpoints:');
    endpoints.forEach((item, index) => {
        let status;
        if (item.locked) {
            status = `LOCKED (PID: ${item.ownerPid})`;
        }
        else if (item.inactive) {
            status = 'INACTIVE (stale lock)';
        }
        else if (!item.puppeteerAvailable) {
            status = 'UNAVAILABLE (no response)';
        }
        else {
            status = 'AVAILABLE';
        }
        console.log(`${index + 1}. ${item.endpoint} - ${status}`);
    });
})();
