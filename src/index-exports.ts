// Load the JavaScript hook
// import '../.vscode/js-hook.cjs';

// Re-export all modules

export * from './utils/index.js';
export * from './database/index.js';

// Export EndpointManager (puppeteer utility, loaded lazily on access)
export {
  EndpointManager,
  GLOBAL_ENDPOINT_MANAGER_PATH
} from './puppeteer/parallel/EndpointManager.js';
export { GLOBAL_PUPPETEER_DIR } from './puppeteer/profile-manager.js';
export { connectEndpoint } from './puppeteer/parallel/EndpointManager.connector.js';
