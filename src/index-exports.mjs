export { extractNumericWithComma, getNumbersOnly, getWeekdaysOfCurrentMonth, loadJS, noop, randomStr, sleep, stripProtocol, uniqueArrayObjByKey } from './utils/browser.mjs';
import '../_virtual/waitEnter.mjs';
import '../_virtual/logs.mjs';
export { multiBeep, singleBeep } from './utils/beep.mjs';
export { containsMonth, dateStringToDDMMYYYY, enforceDateFormat, extractMonthName, getAge, getAgeFromDateString, getDatesWithoutSundays, dateStringToDDMMYYYY as parseDate } from './utils/date.mjs';
export { LogDatabase } from './database/LogDatabase.mjs';
export { MysqlLogDatabase, defaultOptions as mysqlDefaultOptions } from './database/MysqlLogDatabase.mjs';
export { SQLiteLogDatabase, getDatabaseFilePath } from './database/SQLiteLogDatabase.mjs';
export { toValidMySQLDatabaseName } from './database/db_utils.mjs';
export { MySQLHelper } from './database/MySQLHelper.mjs';
export { createContext } from './puppeteer/context/CreateContext.mjs';
export { PageContext } from './puppeteer/context/PageContext.mjs';
export { PuppeteerCookies } from './puppeteer/Cookies.mjs';
export { elementExists } from './puppeteer/elementExists.mjs';
export { elementsContainText } from './puppeteer/elementsContainText.mjs';
export { elementWithTextExists } from './puppeteer/elementWithTextExists.mjs';
export { fetchAndSaveFingerprintToCache, getFingerprintCacheDir, getLatestCachedFingerprint, getRandomCachedFingerprint, listCachedFingerprintFiles, parseScreenSize, saveFingerprintToCache } from './puppeteer/fingerprint_utils.mjs';
export { getActivePage } from './puppeteer/getActivePage.mjs';
export { extractFormValues, getFormValuesFromFrame } from './puppeteer/getFormValuesFromFrame.mjs';
export { default as goWithRetry } from './puppeteer/goWithRetry.mjs';
export { connectEndpoint } from '../puppeteer/parallel/EndpointManager.connector.mjs';
export { EndpointManager, GLOBAL_ENDPOINT_MANAGER_PATH } from '../puppeteer/parallel/EndpointManager.mjs';
export { getPuppeteerWithParallel } from './puppeteer/parallel/getPuppeteerWithParallel.mjs';
export { parallelLauncher, useDefault } from './puppeteer/parallel/launcher.mjs';
export { connect, endpointManager, launch } from './puppeteer/parallel/utils.mjs';
export { getParallelSkrinCheckClaimedEndpoint, parallelSkrinCheck, parallelSkrinCheckEndpointManager } from './puppeteer/parallel/skrin-check-data.mjs';
export { default as parallelSkrin } from './puppeteer/parallel/skrin.mjs';
export { GLOBAL_PROFILES_DIR, GLOBAL_PUPPETEER_DIR, getFallbackProfileDir, isUserDataDirInUse, launchWithProfileFallback, prepareLaunchOptionsWithProfileFallback, reserveClusterUserDataDir, reserveNextFallbackProfileDir } from './puppeteer/profile-manager.mjs';
export { triggerInputChange } from './puppeteer/triggerInputChange.mjs';
export { setupXhrCapture } from './puppeteer/xhr/capture-xhr.mjs';

// Load the JavaScript hook
// import '../.vscode/js-hook.cjs';
// Re-export all modules
