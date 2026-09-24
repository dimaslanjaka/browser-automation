import Bluebird from 'bluebird';
import puppeteer from 'puppeteer-extra';
import { array_shuffle } from 'sbg-utility';
import { loadCsvData } from '../../../data/index.mjs';
import { createSkrinDatabase } from '../../database/shared.mjs';
import { closeOtherTabs } from '../../puppeteer_utils.mjs';
import { processData } from '../../runner/skrin/direct-process-data.mjs';
import { noop } from '../../utils/browser.mjs';
import goWithRetry from '../goWithRetry.mjs';
import { EndpointManager } from '../../../puppeteer/parallel/EndpointManager.mjs';

/**
 * Connects to an available browser endpoint, registers cleanup handlers,
 * and returns a ready-to-use page.
 */
async function getPage() {
    const endpointManager = new EndpointManager();
    const tried = new Set();
    while (true) {
        const endpoint = await endpointManager.getAvailableEndpoint();
        if (!endpoint) {
            console.error('No free browser endpoint found after trying all endpoints.');
            process.exit(1);
        }
        if (tried.has(endpoint)) {
            console.warn(`Already tried endpoint ${endpoint}, skipping.`);
            continue;
        }
        if (!endpointManager.tryClaimEndpoint(endpoint, process.pid)) {
            tried.add(endpoint);
            continue;
        }
        const release = () => endpointManager.releaseEndpointClaim(endpoint, process.pid);
        process.on('SIGINT', () => {
            release();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            release();
            process.exit(0);
        });
        process.on('exit', release);
        try {
            const browser = await puppeteer.connect({
                browserWSEndpoint: endpoint,
                protocolTimeout: 180_000
            });
            browser.once('disconnected', async () => {
                release();
                console.log('Browser disconnected, exiting.');
                await closeOtherTabs(browser, 2);
                process.exit(0);
            });
            await closeOtherTabs(browser, 2);
            const page = await browser.newPage();
            await goWithRetry(page, 'http://www.webmanajemen.com', {
                timeout: 10000,
                waitUntil: 'networkidle2'
            }).catch(noop);
            await page.bringToFront();
            return page;
        }
        catch (err) {
            release();
            tried.add(endpoint);
            if ((err?.error ?? err)?.code === 'ECONNREFUSED') {
                endpointManager.removeEndpoint(endpoint);
            }
        }
    }
}
async function parallelSkrin(opts) {
    const page = await getPage();
    const argv = opts.argv;
    const cliSkipValidateDb = typeof argv['skip-validate-db'] !== 'undefined' ? Boolean(argv['skip-validate-db']) : undefined;
    const cliSkipMonth = typeof argv['skip-current-month-validation'] !== 'undefined'
        ? Boolean(argv['skip-current-month-validation'])
        : undefined;
    const database = createSkrinDatabase();
    const cliSkipYear = typeof argv['skip-current-year-validation'] !== 'undefined'
        ? Boolean(argv['skip-current-year-validation'])
        : undefined;
    let dataKunto;
    if (cliSkipValidateDb) {
        dataKunto = await loadCsvData();
    }
    else {
        dataKunto = await Bluebird.filter(await loadCsvData(), async (data) => {
            const existing = await database.getLogById(String(data.nik));
            return !(existing && existing.data);
        });
    }
    function exitWorker(code = 0) {
        console.log('Leaving browser running. Exiting worker.');
        if (dataKunto.length > 0) {
            console.log(`Data left: ${dataKunto.length} item(s)`);
        }
        process.exit(code);
    }
    if (!Array.isArray(dataKunto) || dataKunto.length === 0) {
        console.warn('No data available to process.');
        exitWorker(0);
    }
    const options = {
        skipValidateDb: cliSkipValidateDb ?? false,
        skipCurrentMonthValidation: cliSkipMonth ?? false,
        skipCurrentYearValidation: cliSkipYear ?? false
    };
    async function processOne(data) {
        return processData(page, data, database, options).catch((err) => ({
            status: 'error',
            reason: 'process_data_exception',
            description: err instanceof Error ? err.message : String(err)
        }));
    }
    if (opts.loop) {
        const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : Infinity;
        let processed = 0;
        for (const data of array_shuffle(dataKunto)) {
            if (processed >= max)
                break;
            processed++;
            console.log(`Processing item ${processed}${isFinite(max) ? `/${max}` : ''}`);
            const result = await processOne(data);
            if (result.status !== 'success') {
                console.warn('Unexpected result status for item', processed, result);
            }
            else {
                console.log('Processed:', result);
            }
        }
        exitWorker(0);
    }
    else {
        // Apply randomization if requested
        const dataToProcess = opts.randomize ? array_shuffle(dataKunto) : dataKunto;
        const data = dataToProcess.shift();
        if (!data) {
            console.warn('No item to process.');
            exitWorker(0);
        }
        const result = await processOne(data);
        if (result.status !== 'success') {
            console.warn('Unexpected result status:', result.status, result);
            console.log('Leaving browser running due to unexpected status. Exiting worker with error.');
            exitWorker(1);
        }
        console.log(result);
        exitWorker(0);
    }
}

export { parallelSkrin as default, parallelSkrin };
