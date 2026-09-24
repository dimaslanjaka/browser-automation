/**
 * Global shared directory for endpoint data, nested under {@link GLOBAL_PUPPETEER_DIR}.
 */
declare const GLOBAL_ENDPOINT_MANAGER_PATH: string;
declare class EndpointManager {
    /** Directory path for endpoint data. */
    basePath: string;
    /** Path to the JSON file holding all registered endpoints. */
    endpointFile: string;
    /** Directory path for per-endpoint lock files. */
    endpointLocksPath: string;
    /**
     * @param basePath - Directory to store endpoint data. Defaults to a
     *   fixed path under `os.tmpdir()` so all processes share the same
     *   endpoint registry regardless of their working directory.
     */
    private endpointAvailabilityCache;
    constructor(basePath?: string);
    clearAvailabilityCache(): void;
    /**
     * Parse raw file content into an array of endpoint strings.
     * @param content - Raw JSON string from the endpoint file.
     */
    private parseEndpoints;
    /**
     * Build the filesystem path for the lock file of a given endpoint.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private getEndpointLockPath;
    /**
     * Read and parse the lock file for an endpoint.
     * Returns `undefined` if the file does not exist or is unreadable.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private readEndpointLock;
    /**
     * Check whether a given PID is still alive.
     * Uses `process.kill(pid, 0)` which tests existence without sending a signal.
     * @param pid - Process ID to check.
     */
    private isProcessRunning;
    /**
     * Return the lock for an endpoint if it exists and its owner is still alive.
     * Stale locks are cleaned up automatically.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private getActiveEndpointLock;
    /**
     * Check whether an endpoint has a live (non-stale) lock.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    isEndpointLocked(endpoint: string): boolean;
    /**
     * Read all registered endpoint URLs from the shared JSON file.
     * Returns an empty array when the file does not exist yet or is unreadable.
     */
    readEndpoints(): string[];
    /**
     * Register an endpoint URL in the shared JSON file (deduplicated).
     * @param endpoint - The browser WebSocket endpoint URL to register.
     */
    writeEndpoint(endpoint: string): void;
    /**
     * Remove an endpoint URL from the shared registry and delete its lock file.
     * @param endpoint - The browser WebSocket endpoint URL to remove.
     */
    removeEndpoint(endpoint: string): void;
    /**
     * Checks if a Puppeteer endpoint is available by attempting Puppeteer.connect.
     */
    private isPuppeteerEndpointAvailable;
    /**
     * Returns the first available endpoint (not locked, not stale, and Puppeteer responds)
     */
    getAvailableEndpoint(): Promise<string | undefined>;
    /**
     * Returns all endpoints with their lock status, inactive status, and Puppeteer availability
     */
    getAllActiveEndpoints(): Promise<Array<{
        endpoint: string;
        locked: boolean;
        inactive: boolean;
        ownerPid: number | null;
        claimedAt: string | null;
        puppeteerAvailable: boolean;
    }>>;
    /**
     * Atomically claim an endpoint lock for a given process.
     * Fails if the endpoint is already locked by a different alive process.
     * @param endpoint - The browser WebSocket endpoint URL.
     * @param ownerPid - PID of the claiming process.
     * @returns `true` when the lock was acquired, `false` if already claimed.
     */
    tryClaimEndpoint(endpoint: string, ownerPid: number): boolean;
    /**
     * Release a claim on an endpoint. Only succeeds if the caller is the
     * current owner or the owning process is no longer alive.
     * @param endpoint - The browser WebSocket endpoint URL.
     * @param ownerPid - PID that originally claimed the endpoint.
     */
    releaseEndpointClaim(endpoint: string, ownerPid: number): void;
    /**
     * Return the current lock status for every registered endpoint.
     * Does not perform a Puppeteer reachability check.
     */
    readEndpointStatus(): {
        endpoint: string;
        inUse: boolean;
        ownerPid: number;
    }[];
}

export { EndpointManager, GLOBAL_ENDPOINT_MANAGER_PATH, EndpointManager as default };
