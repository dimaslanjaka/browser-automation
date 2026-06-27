/**
 * Normalize address fragments to Indonesian naming style.
 *
 * Examples:
 * - South Sumatra -> Sumatera selatan
 * - West Java -> Jawa barat
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeAddressNameToIndonesian(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (cleaned.length === 0) {
    return '';
  }

  const directionMap = {
    north: 'utara',
    south: 'selatan',
    east: 'timur',
    west: 'barat',
    central: 'tengah'
  };

  const wordMap = {
    sumatra: 'sumatera',
    java: 'jawa',
    borneo: 'kalimantan',
    celebes: 'sulawesi'
  };

  const normalizeWords = (text) =>
    text
      .split(/\s+/)
      .map((part) => wordMap[part.toLowerCase()] || part)
      .join(' ');

  const lowered = cleaned.toLowerCase();

  const startDirection = lowered.match(/^(north|south|east|west|central)\s+(.+)$/i);
  if (startDirection) {
    const direction = directionMap[startDirection[1].toLowerCase()] || startDirection[1].toLowerCase();
    const name = normalizeWords(startDirection[2]);
    return `${name} ${direction}`;
  }

  const endDirection = lowered.match(/^(.+)\s+(north|south|east|west|central)$/i);
  if (endDirection) {
    const name = normalizeWords(endDirection[1]);
    const direction = directionMap[endDirection[2].toLowerCase()] || endDirection[2].toLowerCase();
    return `${name} ${direction}`;
  }

  return normalizeWords(cleaned);
}
