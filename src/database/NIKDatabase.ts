import MySQLHelper, { MySQLConfig } from './MySQLHelper.js';
import moment from 'moment';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import parseSql from './parseSql.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface KTPResident {
  id?: number;
  nik: string;
  nama_lengkap: string;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | Date | null;
  jenis_kelamin?: 'L' | 'P' | null;
  golongan_darah?: 'A' | 'B' | 'AB' | 'O' | '-' | null;
  agama?: string | null;
  status_perkawinan?: string | null;
  pekerjaan?: string | null;
  kewarganegaraan?: string;
  alamat?: string | null;
  rt?: string | null;
  rw?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kabupaten_kota?: string | null;
  provinsi?: string | null;
  kode_pos?: string | null;
  no_kk?: string | null;
  status_ktp?: 'BELUM_TERDAFTAR' | 'AKTIF' | 'TIDAK_AKTIF';
  created_at?: string;
  updated_at?: string;
}

export type KTPResidentInput = Omit<KTPResident, 'id' | 'created_at' | 'updated_at'>;

export class NIKDatabase extends MySQLHelper {
  private schemaPath: string;

  constructor(config: MySQLConfig) {
    super(config);
    // Resolve schema file relative to this module's location
    this.schemaPath = path.resolve(__dirname, 'NIKDatabase.sql');
  }

  private async loadSchema(): Promise<void> {
    const sql = await fs.readFile(this.schemaPath, 'utf-8');
    const statements = parseSql(sql);
    for (const stmt of statements) {
      if (stmt.trim()) {
        await this.execute(stmt);
      }
    }
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.loadSchema();
  }

  private parseTanggalLahir(value: string | Date | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) return value;
    const parsed = moment(value, 'DD/MM/YYYY', true);
    if (!parsed.isValid()) {
      throw new Error(`Invalid tanggal_lahir "${value}". Expected format DD/MM/YYYY.`);
    }
    return parsed.toDate();
  }

  // --- Insert ---

  async insertResident(data: KTPResidentInput, suppress: boolean = false): Promise<number> {
    const tanggal_lahir = this.parseTanggalLahir(data.tanggal_lahir);
    const sql = `
      INSERT INTO ktp_residents (
        nik, nama_lengkap, tempat_lahir, tanggal_lahir,
        jenis_kelamin, golongan_darah, agama, status_perkawinan,
        pekerjaan, kewarganegaraan, alamat, rt, rw,
        kelurahan, kecamatan, kabupaten_kota, provinsi, kode_pos,
        no_kk, status_ktp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.nik,
      data.nama_lengkap,
      data.tempat_lahir,
      tanggal_lahir,
      data.jenis_kelamin,
      data.golongan_darah,
      data.agama,
      data.status_perkawinan,
      data.pekerjaan,
      data.kewarganegaraan ?? 'WNI',
      data.alamat,
      data.rt,
      data.rw,
      data.kelurahan,
      data.kecamatan,
      data.kabupaten_kota,
      data.provinsi,
      data.kode_pos,
      data.no_kk,
      data.status_ktp ?? 'AKTIF'
    ];

    try {
      const result = await this.execute(sql, params);
      return result.insertId!;
    } catch (err: any) {
      if (suppress) {
        return 0;
      }
      throw err;
    }
  }

  // --- Find by NIK ---

  async findByNik(nik: string): Promise<KTPResident | null> {
    const rows = await this.query<KTPResident>('SELECT * FROM ktp_residents WHERE nik = ?', [nik]);
    return rows[0] ?? null;
  }

  // --- Find by NKK ---

  async findByNoKk(no_kk: string): Promise<KTPResident[]> {
    return this.query<KTPResident>('SELECT * FROM ktp_residents WHERE no_kk = ?', [no_kk]);
  }

  // --- Search by name ---

  async findByName(nama: string): Promise<KTPResident[]> {
    return this.query<KTPResident>(
      'SELECT * FROM ktp_residents WHERE nama_lengkap LIKE CONCAT(?, "%") ORDER BY nama_lengkap',
      [nama]
    );
  }

  // --- Search by wilayah ---

  async findByWilayah(filters: {
    provinsi?: string;
    kabupaten_kota?: string;
    kecamatan?: string;
    kelurahan?: string;
  }): Promise<KTPResident[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filters.provinsi) {
      conditions.push('provinsi = ?');
      params.push(filters.provinsi);
    }
    if (filters.kabupaten_kota) {
      conditions.push('kabupaten_kota = ?');
      params.push(filters.kabupaten_kota);
    }
    if (filters.kecamatan) {
      conditions.push('kecamatan = ?');
      params.push(filters.kecamatan);
    }
    if (filters.kelurahan) {
      conditions.push('kelurahan = ?');
      params.push(filters.kelurahan);
    }
    const where = conditions.length ? conditions.join(' AND ') : '1=1';
    return this.query<KTPResident>(`SELECT * FROM ktp_residents WHERE ${where} ORDER BY nama_lengkap`, params);
  }

  // --- Update ---

  async updateResident(nik: string, data: Partial<KTPResidentInput>): Promise<number> {
    const allowedFields = [
      'nama_lengkap',
      'tempat_lahir',
      'tanggal_lahir',
      'jenis_kelamin',
      'golongan_darah',
      'agama',
      'status_perkawinan',
      'pekerjaan',
      'kewarganegaraan',
      'alamat',
      'rt',
      'rw',
      'kelurahan',
      'kecamatan',
      'kabupaten_kota',
      'provinsi',
      'kode_pos',
      'no_kk',
      'status_ktp'
    ];
    const entries = Object.entries(data).filter(
      ([key]) => allowedFields.includes(key) && data[key as keyof typeof data] !== undefined
    );
    if (entries.length === 0) return 0;

    // Validate and transform tanggal_lahir if present
    const processedEntries = entries.map(([key, value]) => {
      if (key === 'tanggal_lahir') {
        return [key, this.parseTanggalLahir(value as string | Date | null)];
      }
      return [key, value];
    });

    const sets = processedEntries.map(([k]) => `\`${k}\` = ?`);
    const values = processedEntries.map(([, v]) => v);
    const sql = `UPDATE ktp_residents SET ${sets.join(', ')} WHERE nik = ?`;
    const result = await this.execute(sql, [...values, nik]);
    return result.affectedRows;
  }

  // --- Delete ---

  async deleteByNik(nik: string): Promise<number> {
    const result = await this.execute('DELETE FROM ktp_residents WHERE nik = ?', [nik]);
    return result.affectedRows;
  }

  // --- Upsert ---

  async upsertResident(data: KTPResidentInput): Promise<number> {
    const existing = await this.findByNik(data.nik);
    if (existing) {
      await this.updateResident(data.nik, data);
      return existing.id;
    }
    return this.insertResident(data);
  }
}

export default NIKDatabase;
