import { fetchAndSaveFingerprintToCache, getRandomCachedFingerprint, parseScreenSize } from './fingerprint_utils.js';

async function _fetch() {
  const tags = ['Microsoft Windows', 'Chrome'];
  const { fingerprint = null, filePath = null } = await fetchAndSaveFingerprintToCache({
    tags,
    enablePrecomputedFingerprints: Math.random() < 0.5 // Randomly decide whether to use precomputed fingerprints or not
    // maxHeight: 800
    // maxWidth: 1366
  });
  if (fingerprint && filePath) {
    console.log('Saved fingerprint file path:', filePath);
    const screenData = parseScreenSize(JSON.parse(fingerprint));
    console.log('Parsed screen size from fingerprint:', screenData);
  } else {
    console.warn('No fingerprint was fetched or saved.');
  }
}

async function _cache() {
  const data = await getRandomCachedFingerprint();
  if (data) {
    const screenData = parseScreenSize(JSON.parse(data));
    console.log('Parsed screen size from cached fingerprint:', screenData);
  } else {
    console.warn('No cached fingerprint found.');
  }
}

async function _getSpecificScreenSize() {
  const fingerprint = await getRandomCachedFingerprint([], { maxHeight: 800, maxWidth: 1366 });
  if (fingerprint) {
    const screenData = parseScreenSize(JSON.parse(fingerprint));
    console.log('Found matching fingerprint with screen size:', screenData);
  } else {
    console.warn('No cached fingerprint found with the specified screen size.');
  }
}

_getSpecificScreenSize()
  .then(_fetch)
  .catch((error) => {
    console.error('Fingerprint fetch failed:', error?.stack || error);
    process.exitCode = 1;
  });
