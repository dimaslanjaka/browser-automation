import * as puppeteer_core from 'puppeteer-core';

/**
 * Connects to a Puppeteer endpoint using EndpointManager.
 * Finds a free endpoint, claims it exclusively for the current process,
 * connects to it, performs a sample navigation, and then releases the claim.
 *
 * @returns Resolves when the connection and operations complete, or returns undefined if an endpoint could not be claimed.
 */
declare function connectEndpoint(): Promise<{
    release: () => void;
    browser: puppeteer_core.Browser;
}>;

export { connectEndpoint };
