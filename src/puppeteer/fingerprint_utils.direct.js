import { fetchAndSaveFingerprintToCache } from './fingerprint_utils.js';

async function _fetch() {
  const tags = ['Microsoft Windows', 'Chrome'];
  const { fingerprint = null, filePath = null } = await fetchAndSaveFingerprintToCache({
    tags,
    enablePrecomputedFingerprints: true
    // maxHeight: 800
    // maxWidth: 1366
  });
  if (fingerprint && filePath) {
    console.log('Fetched fingerprint:', fingerprint);
    console.log('Saved fingerprint file path:', filePath);
  } else {
    console.warn('No fingerprint was fetched or saved.');
  }
}

_fetch().catch((error) => {
  console.error('Fingerprint fetch failed:', error?.stack || error);
  process.exitCode = 1;
});
