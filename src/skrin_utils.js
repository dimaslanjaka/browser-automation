import { typeAndTrigger } from './puppeteer_utils.js';
import { getRandomInRange } from './utils/number.js';

/**
 * Height ranges (in cm) by age and gender for Indonesian population.
 * Data structure: { gender: { age: [min, max] } }
 * @type {Object<string, Object<number, [number, number]>>}
 */
const tinggiRange = {
  'laki-laki': {
    0: [45, 55],
    1: [65, 75],
    2: [75, 85],
    3: [85, 95],
    4: [90, 100],
    5: [100, 108],
    10: [125, 135],
    15: [150, 170],
    20: [168, 190],
    30: [170, 190],
    40: [168, 188],
    50: [165, 185],
    60: [160, 180],
    70: [155, 175],
    80: [150, 170],
    90: [145, 165],
    100: [140, 160]
  },
  perempuan: {
    0: [45, 54],
    1: [64, 74],
    2: [74, 84],
    3: [84, 94],
    4: [89, 99],
    5: [98, 106],
    10: [123, 133],
    15: [148, 165],
    20: [162, 180],
    30: [165, 178],
    40: [162, 175],
    50: [160, 170],
    60: [157, 168],
    70: [154, 165],
    80: [150, 160],
    90: [145, 155],
    100: [140, 150]
  }
};

/**
 * Weight ranges (in kg) by age and gender for Indonesian population.
 * Data structure: { gender: { age: [min, max] } }
 * @type {Object<string, Object<number, [number, number]>>}
 */
const beratRange = {
  'laki-laki': {
    0: [2, 5],
    1: [7, 10],
    2: [9, 14],
    3: [12, 16],
    4: [13, 18],
    5: [14, 18],
    10: [25, 35],
    15: [42, 65],
    20: [60, 90],
    30: [65, 95],
    40: [70, 100],
    50: [68, 95],
    60: [65, 90],
    70: [60, 85],
    80: [55, 80],
    90: [50, 75],
    100: [45, 70]
  },
  perempuan: {
    0: [2, 4.5],
    1: [6, 9],
    2: [8, 12],
    3: [10, 15],
    4: [12, 17],
    5: [13, 17],
    10: [24, 34],
    15: [38, 55],
    20: [55, 80],
    30: [60, 85],
    40: [62, 88],
    50: [60, 85],
    60: [58, 82],
    70: [55, 80],
    80: [50, 75],
    90: [45, 70],
    100: [40, 65]
  }
};

/**
 * Ambil range tinggi/berat berdasarkan umur & gender.
 * @param {number} age - umur orang
 * @param {string} gender - 'laki-laki' / 'perempuan' / 'L' / 'P'
 * @param {'tinggi'|'berat'} type - jenis data yang diambil
 * @returns {{min: number, max: number, random: number, closestAge: number}|null}
 */
function getRange(age, gender, type) {
  // Validasi umur
  if (typeof age !== 'number' || age < 0 || age > 120) return null;

  // Normalisasi gender
  gender = gender.toLowerCase();
  if (gender === 'l') gender = 'laki-laki';
  if (gender === 'p') gender = 'perempuan';

  const dataset = type === 'tinggi' ? tinggiRange : beratRange;
  const data = dataset[gender];
  if (!data) return null;

  // Cari umur terdekat
  const ages = Object.keys(data).map(Number);
  const closestAge = ages.reduce((prev, curr) => (Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev));

  const [min, max] = data[closestAge];
  return { min, max, random: getRandomInRange(min, max), closestAge };
}

/**
 * Get a random height value for a person based on age and gender.
 * @param {number|string} age - The age of the person.
 * @param {string} gender - The gender ('laki-laki', 'perempuan', 'L', or 'P').
 * @returns {number|null} A random height value in cm, or null if invalid parameters.
 */
function getTinggiBadan(age, gender) {
  const result = getRange(typeof age === 'string' ? parseInt(age, 10) : age, gender, 'tinggi');
  return result ? result.random : null;
}

/**
 * Get a random weight value for a person based on age and gender.
 * @param {number|string} age - The age of the person.
 * @param {string} gender - The gender ('laki-laki', 'perempuan', 'L', or 'P').
 * @returns {number|null} A random weight value in kg, or null if invalid parameters.
 */
function getBeratBadan(age, gender) {
  const result = getRange(typeof age === 'string' ? parseInt(age, 10) : age, gender, 'berat');
  return result ? result.random : null;
}

export { getBeratBadan, getTinggiBadan };

/**
 * Fix the height and weight input fields if they are empty.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {number|string} age - The age of the person.
 * @param {string} gender - The gender of the person ('laki-laki' or 'perempuan').
 */
export async function fixTbAndBb(page, age, gender) {
  const tbValue = await page.$eval('#field_item_tinggi_badan input', (input) => input.value.trim());
  if (!tbValue) {
    const tinggiBadan = getTinggiBadan(age, gender);
    if (tinggiBadan) {
      await typeAndTrigger(page, '#field_item_tinggi_badan input', tinggiBadan.toString());
    } else {
      throw new Error('Tinggi badan tidak valid');
    }
  }

  const bbValue = await page.$eval('#field_item_berat_badan input', (input) => input.value.trim());
  if (!bbValue) {
    const beratBadan = getBeratBadan(age, gender);
    if (beratBadan) {
      await typeAndTrigger(page, '#field_item_berat_badan input', beratBadan.toString());
    } else {
      throw new Error('Berat badan tidak valid');
    }
  }
}
