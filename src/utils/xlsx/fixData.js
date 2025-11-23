import ansiColors from 'ansi-colors';
import moment from 'moment';
import { nikParserStrictSync as nikParserStrict } from 'nik-parser-jurusid';
import { array_random } from 'sbg-utility';
import { geocodeWithNominatim } from '../../address/nominatim.js';
import { extractMonthName, getAge, getDatesWithoutSundays } from '../../date.js';
import { getBeratBadan, getTinggiBadan } from '../../skrin_utils.js';
import { getNumbersOnly } from '../../utils-browser.js';
import { logLine } from '../../utils.js';

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
    autofillTanggalEntry: false
  }
) {
  /** @type {Partial<import('../../../globals').fixDataResult>} */
  const initialData = data || null;
  if (!initialData) throw new Error('Invalid data format: data is required');

  // Normalize key fields
  let nik = initialData.NIK || initialData.nik || null;
  let nama = initialData.NAMA || initialData.nama || null;
  if (!nik || !nama) throw new Error('Invalid data format: NIK and NAMA are required');

  nik = getNumbersOnly(nik);
  if (nik.length !== 16) throw new Error(`Invalid NIK length: ${nik} (expected 16 characters)`);

  const normalizedNama = nama
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove quotation marks
    .replace(/['"]/g, '')
    .trim();
  initialData.nama = normalizedNama; // Update nama to normalized version
  initialData.NAMA = normalizedNama; // Update NAMA to normalized version
  if (normalizedNama.length < 3) {
    throw new Error(`Invalid NAMA length: ${normalizedNama} (expected at least 3 characters)`);
  }

  initialData.nik = nik; // Ensure both lowercase and uppercase keys are set
  initialData.NIK = nik; // Ensure both lowercase and uppercase keys are set

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
  let tanggalEntry = initialData['TANGGAL ENTRY'] || initialData.tanggal || '';
  if (String(tanggalEntry).trim().length === 0) {
    if (options.autofillTanggalEntry) {
      tanggalEntry = getDatesWithoutSundays('november', 2025, 'DD/MM/YYYY', true)[0];
      logLine(`${ansiColors.cyan('[fixData]')} Generated new tanggal entry for missing value: ${tanggalEntry}`);
    } else {
      throw new Error(`Tanggal entry is required.\n\n${JSON.stringify(initialData, null, 2)}\n`);
    }
  }
  if (!moment(tanggalEntry, 'DD/MM/YYYY', true).isValid()) {
    if (
      typeof tanggalEntry === 'string' &&
      /\b(jan(uari)?|feb(ruari)?|mar(et)?|apr(il)?|mei|jun(i|e)?|jul(i|y)?|agu(stus)?|aug(ust)?|sep(tember)?|okt(ober)?|oct(ober)?|nov(ember)?|des(ember)?|dec(ember)?|bln\s+\w+|bulan\s+\w+)\b/i.test(
        tanggalEntry
      )
    ) {
      const monthName = extractMonthName(tanggalEntry);
      if (!monthName) throw new Error(`Month name not found in tanggalEntry: ${tanggalEntry}`);
      tanggalEntry = array_random(getDatesWithoutSundays(monthName, 2025, 'DD/MM/YYYY', true));
      logLine(
        `${ansiColors.cyan('[fixData]')} Generated new date for "${tanggalEntry}" from month name in entry: ${tanggalEntry}`
      );
    }
    const reparseTglLahir = moment(tanggalEntry, 'DD/MM/YYYY', true);
    if (reparseTglLahir.day() === 0) throw new Error(`Tanggal entry cannot be a Sunday: ${tanggalEntry}`);
    if (!reparseTglLahir.isValid())
      throw new Error(`Invalid tanggalEntry format: ${tanggalEntry} (expected DD/MM/YYYY)`);
    initialData.tanggal = tanggalEntry;
    initialData['TANGGAL ENTRY'] = tanggalEntry;
  } else {
    const parsedDate = moment(tanggalEntry, 'DD/MM/YYYY', true);
    // Check if the date is a Sunday
    if (parsedDate.day() === 0) {
      throw new Error(`Tanggal entry cannot be a Sunday: ${tanggalEntry}`);
    }
    // Check if the date is not greater than today
    if (parsedDate.isAfter(moment())) {
      throw new Error(`Tanggal entry ${nik} cannot be in the future: ${tanggalEntry}`);
    }
  }

  // TGL LAHIR normalization
  let tglLahir = initialData['TGL LAHIR'] || initialData.tgl_lahir || null;
  if (tglLahir) {
    if (typeof tglLahir === 'number') {
      const baseDate = moment('1900-01-01');
      let days = tglLahir - 1;
      if (days > 59) days--;
      tglLahir = baseDate.add(days, 'days').format('DD/MM/YYYY');
      logLine(`${ansiColors.cyan('[fixData]')} Converted Excel serial date to: ${tglLahir}`);
    } else if (typeof tglLahir === 'string' && !moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(`Invalid TGL LAHIR format: ${tglLahir} (expected DD/MM/YYYY)`);
    }
    if (!moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(`Invalid TGL LAHIR date: ${tglLahir} (expected DD/MM/YYYY)`);
    }
    // Check if year of TGL LAHIR is more than current year
    const yearOfTglLahir = moment(tglLahir, 'DD/MM/YYYY').year();
    const currentYear = moment().year();
    if (yearOfTglLahir > currentYear) {
      if (parsed_nik.status === 'success' && parsed_nik.data.lahir) {
        tglLahir = parsed_nik.data.lahir;
        logLine(`${ansiColors.cyan('[fixData]')} Corrected TGL LAHIR from NIK: ${tglLahir}`);
      } else {
        console.log('\nTGL LAHIR year cannot be greater than current year', initialData, '\n');
        throw new Error(`TGL LAHIR year cannot be greater than current year: ${tglLahir}`);
      }
    }
    initialData['TGL LAHIR'] = tglLahir;
  }

  // Gender
  let gender = parsed_nik.status === 'success' ? parsed_nik?.data.kelamin : 'Tidak Diketahui';
  if (gender.toLowerCase() === 'l' || gender.toLowerCase() === 'laki-laki') {
    gender = 'Laki-laki';
  } else if (gender.toLowerCase() === 'p' || gender.toLowerCase() === 'perempuan') {
    gender = 'Perempuan';
  }
  initialData.gender = gender; // fixData gender result

  // Age calculation
  let age = 0;
  let birthDate = initialData.tgl_lahir || initialData['TGL LAHIR'] || null;
  if (birthDate) {
    age = getAge(birthDate, 'DD/MM/YYYY');
    logLine(`${ansiColors.cyan('[fixData]')} Age from TGL LAHIR: ${age} years`);
  } else if (parsed_nik.status === 'success' && parsed_nik.data.lahir) {
    age = getAge(parsed_nik.data.lahir);
    logLine(`${ansiColors.cyan('[fixData]')} Age from NIK: ${age} years`);
  }
  data.age = age; // Ensure age is set in the data object

  // Pekerjaan normalization
  let pekerjaan = initialData.pekerjaan || initialData.PEKERJAAN || null;
  if (!pekerjaan) {
    if (!pekerjaan) {
      if (age > 55 || age <= 20) {
        pekerjaan = 'Tidak Bekerja';
      } else {
        pekerjaan = gender && gender.toLowerCase() === 'perempuan' ? 'IRT' : 'Wiraswasta';
      }
    }
  } else {
    logLine(`${ansiColors.cyan('[fixData]')} Pekerjaan: ${pekerjaan}`);
  }
  const jobMappings = [
    { pattern: /rumah\s*tangga|irt/i, value: 'IRT' },
    { pattern: /swasta|pedagang/i, value: 'Wiraswasta' },
    { pattern: /tukang|buruh/i, value: 'Buruh ' },
    { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun|belum\/tidak\s*bekerja/i, value: 'Tidak Bekerja' },
    { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/i, value: 'PNS ' },
    { pattern: /guru|dosen/i, value: 'Guru/ Dosen' },
    { pattern: /perawat|dokter/i, value: 'Tenaga Profesional Medis ' },
    { pattern: /pengacara|wartawan/i, value: 'Tenaga Profesional Non Medis ' },
    { pattern: /pelajar|siswa|siswi|sekolah/i, value: 'Pelajar/ Mahasiswa' },
    { pattern: /s[o,u]pir/i, value: 'Sopir ' }
  ];
  for (const { pattern, value } of jobMappings) {
    if (pattern.test(pekerjaan.toLowerCase())) {
      pekerjaan = value;
      logLine(`${ansiColors.cyan('[fixData]')} Pekerjaan mapped: ${pekerjaan}`);
      break;
    }
  }
  if (pekerjaan) {
    initialData.pekerjaan = pekerjaan;
    initialData.PEKERJAAN = pekerjaan;
    logLine(`${ansiColors.cyan('[fixData]')} Pekerjaan fixed: ${pekerjaan}`);
  } else {
    throw new Error(`Pekerjaan could not be determined for NIK: ${nik}`);
  }

  // Fix alamat
  let alamat = initialData.alamat || initialData.ALAMAT || null;
  if (!alamat) {
    if (initialData.parsed_nik && initialData.parsed_nik.status === 'success') {
      const parsed_data = initialData.parsed_nik.data;
      alamat = [parsed_data.kelurahan?.[0]?.name, parsed_data.namaKec, parsed_data.kotakab, parsed_data.provinsi]
        .filter((part) => part !== undefined && part !== null && part !== '')
        .join(', ');
      logLine(`${ansiColors.cyan('[fixData]')} Alamat from parsed NIK: ${alamat}`);
      const keywordAddr = `${parsed_data.kelurahan}, ${parsed_data.namaKec}, Surabaya, Jawa Timur`.trim();
      const address = await geocodeWithNominatim(keywordAddr);
      data._address = address;

      let { kotakab = '', namaKec = '', provinsi = '', kelurahan = [] } = parsed_data;

      if (kotakab.length === 0 || namaKec.length === 0 || provinsi.length === 0) {
        logLine(`Fetching address from Nominatim for: ${keywordAddr}`);
        logLine('Nominatim result:', address);

        const addr = address.address || {};

        if (kelurahan.length === 0) kelurahan = [addr.village || addr.hamlet || ''];
        if (namaKec.length === 0) namaKec = addr.suburb || addr.city_district || '';
        if (kotakab.length === 0) kotakab = addr.city || addr.town || addr.village || 'Kota Surabaya';
        if (provinsi.length === 0) provinsi = addr.state || addr.province || 'Jawa Timur';

        if (kotakab.toLowerCase().includes('surabaya')) {
          kotakab = 'Kota Surabaya';
        }

        if (kotakab.length === 0 || namaKec.length === 0) {
          throw new Error("❌ Failed to take the patient's city or town");
        }

        parsed_data.kelurahan = kelurahan;
        parsed_data.namaKec = namaKec;
        parsed_data.kotakab = kotakab;
        parsed_data.provinsi = provinsi;
        initialData.parsed_nik.data = parsed_data; // Update parsed_nik with new
      }
    } else {
      throw new Error(`Alamat is required for NIK: ${nik}`);
    }
  }
  initialData.alamat = alamat; // Ensure both lowercase and uppercase keys are set
  initialData.ALAMAT = alamat; // Ensure both lowercase and uppercase keys are set

  if (initialData.parsed_nik && initialData.parsed_nik.status === 'success') {
    const parsed_data = initialData.parsed_nik.data;
    if (/kota adm\.?/i.test(parsed_data.kotakab.toLowerCase())) {
      parsed_data.kotakab = parsed_data.kotakab.replace(/kota adm\.?/i, 'kota').trim();
    }
    initialData.parsed_nik.data = parsed_data; // Update parsed_nik with new
  }

  // Fix tinggi and berat badan
  let tinggi = initialData.TB || initialData.tb || null;
  let berat = initialData.bb || initialData.BB || null;

  if (!tinggi) {
    tinggi = getTinggiBadan(age, gender);
  }
  if (!berat) {
    berat = getBeratBadan(age, gender);
  }

  initialData.tb = tinggi; // Ensure both lowercase and uppercase keys are set
  initialData.TB = tinggi; // Ensure both lowercase and uppercase keys are set
  initialData.bb = berat; // Ensure both lowercase and uppercase keys are set
  initialData.BB = berat; // Ensure both lowercase and uppercase keys are set

  return initialData;
}

// CLI test
if (process.argv[1].includes('fixData.js')) {
  (async () => {
    try {
      const sampleData = {
        NIK: '3573041506980002',
        NAMA: '  John   Doe  ',
        'TANGGAL ENTRY': '15 November',
        PEKERJAAN: 'Guru',
        ALAMAT: ''
      };
      const fixedData = await fixData(sampleData, { autofillTanggalEntry: true });
      console.log('Fixed Data:', fixedData);
    } catch (error) {
      console.error('Error in fixData CLI test:', error);
    }
  })();
}
