import csvParser from 'csv-parser';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import moment from 'moment';
import minimist from 'minimist';
import path from 'upath';
import xlsx from 'xlsx';
import { createReadStream } from 'fs';
import NIKDatabase, { KTPResidentInput } from './NIKDatabase.js';
import { isValidNik } from '../utils/xlsx/fixData.js';
import { nikParserStrictSync } from 'nik-parser-jurusid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptName = path.basename(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env'), override: true, quiet: true });

const argv = minimist(process.argv.slice(2), {
  alias: {
    i: 'input',
    f: 'force',
    h: 'help'
  },
  boolean: ['force', 'help'],
  default: { force: false, help: false }
});

if (argv.help) {
  console.log(`Usage: node --loader ts-node/esm ${scriptName} [options]

Options:
  -i, --input <file>   Input CSV or XLSX file(s), comma-separated
  -f, --force          Write to MySQL (default: dry-run)
  -h, --help           Show this help

Examples:
  node --loader ts-node/esm ${scriptName}
  node --loader ts-node/esm ${scriptName} -i data/drive.csv --force
  node --loader ts-node/esm ${scriptName} -i data/GADING.xlsx`);
  process.exit(0);
}

type RawRow = Record<string, any>;

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: unknown): string | undefined {
  if (!hasValue(value)) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
}

function normalizeDate(value: unknown, sourceFormat?: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : moment(value).format('DD/MM/YYYY');
  }
  if (typeof value === 'number') {
    const dateParts = xlsx.SSF.parse_date_code(value);
    if (!dateParts) {
      return null;
    }
    return moment({ year: dateParts.y, month: dateParts.m - 1, day: dateParts.d }).format('DD/MM/YYYY');
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const compactDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (compactDateMatch) {
    const first = parseInt(compactDateMatch[1], 10);
    const second = parseInt(compactDateMatch[2], 10);
    const yearTwoDigits = parseInt(compactDateMatch[3], 10);
    const currentTwoDigits = new Date().getFullYear() % 100;
    const year = yearTwoDigits <= currentTwoDigits ? 2000 + yearTwoDigits : 1900 + yearTwoDigits;
    const monthDay = sourceFormat === 'xlsx';
    const month = monthDay ? first : second;
    const day = monthDay ? second : first;
    return moment({ year, month: month - 1, day }).format('DD/MM/YYYY');
  }

  const formats =
    sourceFormat === 'xlsx'
      ? ['MM/DD/YYYY', 'M/D/YYYY', 'MM/DD/YY', 'M/D/YY', 'DD/MM/YYYY', 'D/M/YYYY', 'DD/MM/YY', 'D/M/YY', 'YYYY-MM-DD']
      : ['DD/MM/YYYY', 'D/M/YYYY', 'DD/MM/YY', 'D/M/YY', 'MM/DD/YYYY', 'M/D/YYYY', 'MM/DD/YY', 'M/D/YY', 'YYYY-MM-DD'];

  const parsed = moment(text, formats, true);
  if (parsed.isValid()) {
    return parsed.format('DD/MM/YYYY');
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    const dateParts = xlsx.SSF.parse_date_code(numeric);
    if (dateParts) {
      return moment({ year: dateParts.y, month: dateParts.m - 1, day: dateParts.d }).format('DD/MM/YYYY');
    }
  }

  return null;
}

function normalizeGender(value: unknown): 'L' | 'P' | null | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  const text = String(value).trim().toUpperCase();
  if (['L', 'LAKI-LAKI', 'LAKI LAKI', 'PRIA', 'MALE', 'LK'].includes(text)) {
    return 'L';
  }
  if (['P', 'PEREMPUAN', 'WANITA', 'FEMALE', 'PR'].includes(text)) {
    return 'P';
  }
  return null;
}

function normalizeChar(value: unknown, length: number): string | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }
  const digits = text.replace(/\D/g, '');
  if (!digits) {
    return text;
  }
  return digits.padStart(length, '0').slice(-length);
}

function normalizeBlood(value: unknown): KTPResidentInput['golongan_darah'] | undefined {
  const text = normalizeText(value)?.toUpperCase();
  if (!text) {
    return undefined;
  }
  if (['A', 'B', 'AB', 'O', '-'].includes(text)) {
    return text as KTPResidentInput['golongan_darah'];
  }
  return undefined;
}

function getFirstValue(row: Record<string, any>, keys: string[]): unknown {
  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey in row && hasValue(row[normalizedKey])) {
      return row[normalizedKey];
    }
  }
  return undefined;
}

function canonicalizeRow(row: RawRow): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = value;
  }
  return normalized;
}

function mergeResident(
  existing: Partial<KTPResidentInput>,
  incoming: Partial<KTPResidentInput>
): Partial<KTPResidentInput> {
  const merged: Partial<KTPResidentInput> = { ...existing };
  const target = merged as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming) as Array<[keyof KTPResidentInput, any]>) {
    if (!hasValue(value)) {
      continue;
    }
    if (!hasValue(merged[key])) {
      target[key as string] = value;
    }
  }
  return merged;
}

function toResidentInput(rawRow: RawRow): Partial<KTPResidentInput> | null {
  const row = canonicalizeRow(rawRow);

  const nikValue = getFirstValue(row, ['nik', 'nikpasien']);
  const nik = String(nikValue).trim();
  const nama_lengkap = normalizeText(getFirstValue(row, ['nama_lengkap', 'nama', 'namapasien']));

  if (!isValidNik(nik) || !nama_lengkap) {
    return null;
  }

  const alamat = normalizeText(
    getFirstValue(row, ['alamat', 'alamatpasien', 'alamatdomisili']) ?? getFirstValue(row, ['tempattinggal'])
  );

  return {
    nik,
    nama_lengkap,
    tempat_lahir: normalizeText(getFirstValue(row, ['tempat_lahir', 'tempatlahir'])),
    tanggal_lahir: normalizeDate(
      getFirstValue(row, ['tanggal_lahir', 'tanggallahir', 'tgl_lahir', 'tgllahir']),
      normalizeText(getFirstValue(row, ['source_format']))
    ),
    jenis_kelamin: normalizeGender(getFirstValue(row, ['jenis_kelamin', 'jeniskelamin'])),
    golongan_darah: normalizeBlood(getFirstValue(row, ['golongan_darah', 'golongandarah'])),
    agama: normalizeText(getFirstValue(row, ['agama'])),
    status_perkawinan: normalizeText(getFirstValue(row, ['status_perkawinan', 'statusperkawinan'])),
    pekerjaan: normalizeText(getFirstValue(row, ['pekerjaan'])),
    kewarganegaraan: normalizeText(getFirstValue(row, ['kewarganegaraan'])) || undefined,
    alamat,
    rt: normalizeChar(getFirstValue(row, ['rt', 'rtdomisili']), 3),
    rw: normalizeChar(getFirstValue(row, ['rw', 'rwdomisili']), 3),
    kelurahan: normalizeText(getFirstValue(row, ['kelurahan', 'kelurahandomisili'])),
    kecamatan: normalizeText(getFirstValue(row, ['kecamatan', 'kecamatandomisili'])),
    kabupaten_kota: normalizeText(getFirstValue(row, ['kabupaten_kota', 'kabupatenkota', 'kabupaten', 'kotamadya'])),
    provinsi: normalizeText(getFirstValue(row, ['provinsi'])),
    kode_pos: normalizeChar(getFirstValue(row, ['kode_pos', 'kodepos']), 5),
    no_kk: normalizeText(getFirstValue(row, ['no_kk', 'nokk', 'nokkkeluarga'])),
    status_ktp: normalizeText(getFirstValue(row, ['status_ktp'])) as KTPResidentInput['status_ktp'] | undefined
  };
}

async function loadCsvRows(filePath: string): Promise<RawRow[]> {
  return await new Promise((resolve, reject) => {
    const rows: RawRow[] = [];
    createReadStream(filePath)
      .pipe(
        csvParser({
          mapValues: ({ value }) => (typeof value === 'string' ? value.trim() : value)
        })
      )
      .on('data', (row) => {
        rows.push({ ...row, __source_format: 'csv' });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function loadXlsxRows(filePath: string): Promise<RawRow[]> {
  const workbook = xlsx.readFile(filePath);
  const rows: RawRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const sheetRows = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      dateNF: 'DD/MM/YYYY'
    }) as RawRow[];
    for (const row of sheetRows) {
      rows.push({ ...row, __source_sheet: sheetName, __source_format: 'xlsx' });
    }
  }
  return rows;
}

async function loadSourceRows(filePath: string): Promise<RawRow[]> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.csv') {
    return await loadCsvRows(filePath);
  }
  if (extension === '.xlsx') {
    return await loadXlsxRows(filePath);
  }
  throw new Error(`Unsupported file extension "${extension}" for ${filePath}`);
}

function resolveInputFiles(): string[] {
  const explicitInputs = asArray(argv.input ?? argv._);
  if (explicitInputs.length > 0) {
    return explicitInputs.map((input) => path.resolve(String(input)));
  }

  const fallbackInputs = [path.join(process.cwd(), 'data/drive.csv'), path.join(process.cwd(), 'data/GADING.xlsx')];
  return fallbackInputs.filter((filePath) => fs.pathExistsSync(filePath));
}

function loadDatabaseConfig() {
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME, MYSQL_PORT } = process.env;
  return {
    host: MYSQL_HOST || 'localhost',
    user: MYSQL_USER || 'root',
    password: MYSQL_PASS || '',
    database: MYSQL_DBNAME || 'browser_automation_nik',
    port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : 3306
  };
}

type ResidentAction = 'insert' | 'update' | 'skip';

interface ResidentPlan {
  resident: KTPResidentInput;
  action: ResidentAction;
  conflicts: string[];
  reasons?: string[];
}

async function planResidents(
  db: NIKDatabase,
  residents: KTPResidentInput[]
): Promise<{ plans: ResidentPlan[]; inserted: number; updated: number; skipped: number }> {
  const plans: ResidentPlan[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const resident of residents) {
    const existing = await db.findByNik(resident.nik);
    if (!existing) {
      plans.push({ resident, action: 'insert', conflicts: [] });
      inserted++;
      continue;
    }

    const conflicts: string[] = [];
    if (existing.nama_lengkap.toUpperCase() !== resident.nama_lengkap.toUpperCase()) {
      conflicts.push(`nama: DB="${existing.nama_lengkap}" vs input="${resident.nama_lengkap}"`);
    }

    const parsed = nikParserStrictSync(resident.nik);
    if (parsed.status === 'success') {
      const nikBirth = moment(parsed.data.lahir, 'YYYY-MM-DD');
      const dbBirth = existing.tanggal_lahir ? moment(existing.tanggal_lahir) : null;
      if (dbBirth && nikBirth.isValid() && !nikBirth.isSame(dbBirth, 'day')) {
        conflicts.push(`tanggal_lahir: DB="${dbBirth.format('DD/MM/YYYY')}" vs NIK="${nikBirth.format('DD/MM/YYYY')}"`);
      }
    }

    if (conflicts.length > 0) {
      // Map low-level conflict strings to short human-readable reasons
      const reasons = conflicts.map((c) => {
        if (c.startsWith('nama:')) return 'Name mismatch (DB vs input)';
        if (c.startsWith('tanggal_lahir:')) return 'Birthdate mismatch (DB vs NIK)';
        return 'Data mismatch';
      });

      console.warn(`[SKIP] NIK ${resident.nik} — ${conflicts.join('; ')} — Reason(s): ${reasons.join('; ')}`);
      plans.push({ resident, action: 'skip', conflicts, reasons });
      skipped++;
      continue;
    }

    plans.push({ resident, action: 'update', conflicts: [] });
    updated++;
  }

  return { plans, inserted, updated, skipped };
}

async function main() {
  const inputFiles = resolveInputFiles();
  const dryRun = !argv.force;

  if (inputFiles.length === 0) {
    console.error(
      'Error: Input file is required. Use --input <file> or place data/drive.csv and/or data/GADING.xlsx in the data folder.'
    );
    process.exit(1);
  }

  for (const inputFile of inputFiles) {
    if (!fs.pathExistsSync(inputFile)) {
      throw new Error(`Input file does not exist: ${inputFile}`);
    }
  }

  const mergedResidents = new Map<string, Partial<KTPResidentInput>>();
  const loadSummary: Array<{ file: string; rows: number }> = [];

  for (const inputFile of inputFiles) {
    const rows = await loadSourceRows(inputFile);
    loadSummary.push({ file: inputFile, rows: rows.length });

    for (const rawRow of rows) {
      const resident = toResidentInput(rawRow);
      if (!resident?.nik || !resident.nama_lengkap) {
        continue;
      }

      const existing = mergedResidents.get(resident.nik) || {};
      mergedResidents.set(resident.nik, mergeResident(existing, resident));
    }
  }

  const residents = [...mergedResidents.values()].filter((resident): resident is KTPResidentInput => {
    return hasValue(resident.nik) && hasValue(resident.nama_lengkap);
  });

  console.log('Loaded files:');
  for (const summary of loadSummary) {
    console.log(`- ${summary.file}: ${summary.rows} rows`);
  }
  console.log(`Prepared residents: ${residents.length}`);

  const db = new NIKDatabase(loadDatabaseConfig());

  try {
    await db.initialize();

    console.log('\nAnalyzing database for existing records...');
    const { plans, inserted, updated, skipped } = await planResidents(db, residents);

    if (dryRun) {
      console.log('\n--- DRY RUN SUMMARY ---');
      console.log(`Would insert: ${inserted}`);
      console.log(`Would update: ${updated}`);
      console.log(`Would skip (conflicts): ${skipped}`);
      console.log('Pass -f/--force to write to MySQL.');
      return;
    }

    console.log('\n--- EXECUTING CHANGES ---');
    let actInserted = 0;
    let actUpdated = 0;

    for (const plan of plans) {
      if (plan.action === 'insert') {
        await db.insertResident(plan.resident);
        actInserted++;
      } else if (plan.action === 'update') {
        await db.updateResident(plan.resident.nik, plan.resident);
        actUpdated++;
      }
    }

    console.log(`Inserted: ${actInserted}`);
    console.log(`Updated: ${actUpdated}`);
    console.log(`Skipped (manual review): ${skipped}`);
    console.log(`Total processed: ${residents.length}`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
