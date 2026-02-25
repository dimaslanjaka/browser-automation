import moment from 'moment';
import { nikParserStrictSync as nikParserStrict } from 'nik-parser-jurusid';
import { getNumbersOnly } from '../../utils-browser.js';
import { loadCsvData } from '../../../data/index.js';
import { fixNama } from './fixData/nama.js';
import { fixPekerjaan } from './fixData/pekerjaan.js';
import { fixAlamat } from './fixData/alamat.js';
import { fixBirth } from './fixData/birth.js';
import { fixTanggalEntry } from './fixData/tanggal-entry.js';
import { fixTbBb } from './fixData/tb-bb.js';
import { FixDataCache } from './FixDataCache.js';

/**
 * Normalize, validate and augment a row of Excel data.
 *
 * This function accepts different Excel row shapes (legacy lowercase keys or
 * uppercase keys produced by various parsers) and normalizes them to a
 * consistent shape. It performs the following transformations and checks:
 *
 * - Ensure `nik`/`NIK` exists and is numeric with length 16. Parses NIK for
 *   birth date and gender and stores the parser result on `parsed_nik`.
 * - Normalize `nama`/`NAMA` by trimming, collapsing whitespace and removing
 *   quotes.
 * - Normalize and validate `tanggal`/`TANGGAL ENTRY`. Can autofill or choose a
 *   date from a month name when `options.autofillTanggalEntry` is truthy.
 * - Convert Excel serial dates for `TGL LAHIR` to `DD/MM/YYYY` and validate.
 * - Derive `age` from `TGL LAHIR` or from parsed NIK when necessary.
 * - Normalize `pekerjaan`/`PEKERJAAN` into a small set of canonical values.
 * - Resolve `alamat`/`ALAMAT` from parsed NIK and optionally by calling
 *   `geocodeWithNominatim`. Augmented address is attached on `_address`.
 * - Fill `tb`/`TB` and `bb`/`BB` (height/weight) if missing using helper
 *   heuristics.
 *
 * The function mutates the provided object in place and also returns the
 * updated object. Augmented or canonical fields are written to both the
 * lowercase and uppercase variants (when applicable) so downstream code can
 * reliably read either form.
 *
 * Contract
 * - Input: partial Excel row object (see `globals.ExcelfRowData` /
 *   `globals.ExcelfRowData4`).
 * - Output: the same object mutated to include normalized fields described
 *   below.
 * - Error modes: throws Error on missing required fields, invalid formats,
 *   Sunday or future `tanggal` entries, or when critical resolution steps
 *   (like `pekerjaan` mapping or address resolution) cannot be completed.
 *
 * Augmented fields (examples)
 * - `nik`, `NIK` (string, digits only, length 16)
 * - `nama`, `NAMA` (normalized string)
 * - `parsed_nik` (object|null) — result of `nik-parser-jurusid` strict parser
 * - `tanggal`, `TANGGAL ENTRY` (string in `DD/MM/YYYY`)
 * - `TGL LAHIR` (string in `DD/MM/YYYY`)
 * - `age` (number)
 * - `gender` (string: `Laki-laki`, `Perempuan`, or `Tidak Diketahui`)
 * - `pekerjaan`, `PEKERJAAN` (canonical string)
 * - `alamat`, `ALAMAT` (string)
 * - `_address` (object) — raw geocode result when geocoding was performed
 * - `tb`/`TB`, `bb`/`BB` (numbers or strings depending on helpers)
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} data
 *   The raw Excel row object to normalize and validate. The object is mutated
 *   in-place and returned.
 * @param {object} [options]
 * @param {boolean} [options.autofillTanggalEntry=true]
 *   When true, missing or month-name-only `tanggal` entries are auto-filled
 *   from the helper `getDatesWithoutSundays` (uses November 2025 by default
 *   in current implementation). When false, a missing `tanggal` will cause an
 *   error.
 * @param {boolean} [options.verbose=false]
 *   When true, logs will be printed during processing. When false, no logs
 *   will be output.
 * @param {boolean} [options.fixNamaBayi=false]
 *   When true, parses baby names (e.g., "Bayi Laki-laki" is parsed).
 *   When false, baby names are allowed as-is without parsing.
 * @param {boolean} [options.useCache=true]
 *   When true, results are cached by NIK to avoid reprocessing the same
 *   entries. The cache preserves the original generation timestamp. When
 *   false, caching is bypassed and fresh data is always generated.
 * @param {string} [options.cacheDir]
 *   Optional custom cache directory path. Defaults to `./tmp/fixdata-cache`.
 * @returns {Promise<import('../../../globals').fixDataResult>}
 *   The same (mutated) data object augmented with normalized fields and any
 *   additional data (for example `_address` when geocoding occurred).
 * @throws {Error} When required fields are missing or invalid (invalid NIK,
 *   invalid dates, Sunday/future tanggal, unresolved pekerjaan or address,
 *   etc.).
 */
export default async function fixData(
  data,
  options = {
    autofillTanggalEntry: false,
    verbose: false,
    useCache: true
  }
) {
  /** @type {Partial<import('../../../globals').fixDataResult>} */
  const initialData = data || null;
  if (!initialData) throw new Error(`Invalid data format: data is required\n\n${JSON.stringify(initialData, null, 2)}`);

  // Normalize key fields for cache lookup
  let nik = initialData.NIK || initialData.nik || null;
  let nama = initialData.NAMA || initialData.nama || null;
  if (!nik || !nama)
    throw new Error(`Invalid data format: NIK and NAMA are required\n\n${JSON.stringify(initialData, null, 2)}`);

  nik = getNumbersOnly(nik);
  if (nik.length !== 16) {
    throw new Error(`Invalid NIK length: ${nik} (expected 16 characters)\n\n${JSON.stringify(initialData, null, 2)}`);
  }

  // Initialize cache with custom directory if provided
  const cache = new FixDataCache(options.cacheDir);

  // Check cache before processing
  const cachedResult = await cache.get({ nik, ...initialData }, options);
  if (cachedResult) {
    if (options.verbose) {
      console.log(`✅ Using cached result for NIK: ${nik}`);
    }
    // Return cached result but preserve any new input data properties
    return { ...cachedResult, ...initialData };
  }

  // Set normalized NIK on both key variants
  initialData.nik = nik;
  initialData.NIK = nik;

  // Normalize nama
  const namaResult = fixNama(initialData, { verbose: options.verbose, fixNamaBayi: options.fixNamaBayi === true });
  initialData.nama = namaResult.nama;
  initialData.NAMA = namaResult.nama;

  // Parse NIK
  const parsed_nik = nikParserStrict(nik);
  if (parsed_nik.status == 'success' && parsed_nik.data.lahir) {
    // Normalize date format for lahir
    parsed_nik.data.originalLahir = parsed_nik.data.lahir;
    const momentParseNik = moment(parsed_nik.data.lahir, 'YYYY-MM-DD', true);
    if (momentParseNik.isValid()) {
      parsed_nik.data.lahir = momentParseNik.format('DD/MM/YYYY');
    }
  }
  initialData.parsed_nik = parsed_nik.status === 'success' ? parsed_nik : null;

  // Tanggal entry normalization
  const tanggalResult = fixTanggalEntry(initialData, {
    verbose: options.verbose,
    autofillTanggalEntry: options.autofillTanggalEntry
  });
  initialData.tanggal = tanggalResult.tanggalEntry;
  initialData['TANGGAL ENTRY'] = tanggalResult.tanggalEntry;

  // TGL LAHIR normalization and age calculation
  let age = 0;
  const birthResult = fixBirth(initialData, { verbose: options.verbose });
  age = birthResult.age;
  initialData.age = age;

  // Gender
  let gender = parsed_nik.status === 'success' ? parsed_nik?.data.kelamin : 'Tidak Diketahui';
  if (gender.toLowerCase() === 'l' || gender.toLowerCase() === 'laki-laki') {
    gender = 'Laki-laki';
  } else if (gender.toLowerCase() === 'p' || gender.toLowerCase() === 'perempuan') {
    gender = 'Perempuan';
  }
  initialData.gender = gender; // fixData gender result

  // Pekerjaan normalization
  const pekerjaanResult = fixPekerjaan(initialData, { verbose: options.verbose });
  initialData.pekerjaan = pekerjaanResult.pekerjaan;
  initialData.PEKERJAAN = pekerjaanResult.pekerjaan;

  // Fix alamat
  let alamat = initialData.alamat || initialData.ALAMAT || null;
  const alamatResult = await fixAlamat(alamat, initialData.parsed_nik, nik, initialData, data, {
    verbose: options.verbose
  });
  initialData.alamat = alamatResult.alamat;
  initialData.ALAMAT = alamatResult.alamat;

  // Fix tinggi and berat badan
  const tbBbResult = fixTbBb(initialData, { verbose: options.verbose });
  initialData.tb = tbBbResult.tb;
  initialData.TB = tbBbResult.tb;
  initialData.bb = tbBbResult.bb;
  initialData.BB = tbBbResult.bb;

  // Cache the result before returning (preserves generation timestamp)
  await cache.set({ nik, ...initialData }, initialData, options);

  return initialData;
}

// CLI test
if (process.argv[1].includes('fixData.js')) {
  (async () => {
    try {
      const dataKunto = await loadCsvData();
      for (const item of dataKunto) {
        try {
          const fixed = await fixData(item, { autofillTanggalEntry: true });
          console.log('✅ Fixed data for NIK:', fixed.nik);
        } catch (error) {
          console.error('❌ Error fixing data for item:', item);
          console.error(error);
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error in fixData CLI test:', error);
    }
  })();
}
