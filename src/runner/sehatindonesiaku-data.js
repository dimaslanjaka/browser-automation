import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const xlsxFile = path.join(__dirname, 'FORM PTM BARU JULI 2025 BONJER.xlsx');

export function parseXlsxFile(filePath = xlsxFile) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Format Full';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in file: ${filePath}`);
  }
  // Parse from row 7 (index 6), no header
  const data = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: 6 // 0-based, so 6 = row 7 as first data row
  });
  return data.map((row) => {
    const obj = {
      tanggal_pemeriksaan: '21/08/2025'
    };
    for (let index = 0; index < row.length; index++) {
      if (index === 0) {
        // NIK
        obj['nik'] = row[index];
        continue;
      } else if (index === 1) {
        // Nama
        obj['nama'] = row[index];
        continue;
      } else if (index === 2) {
        // Tanggal Lahir (parse from NIK)
        const nik = row[0];
        let tgl = row[index];
        if (nik && typeof nik === 'string' && nik.length >= 12) {
          let day = parseInt(nik.substring(6, 8), 10);
          let month = parseInt(nik.substring(8, 10), 10);
          let year = parseInt(nik.substring(10, 12), 10);
          if (day > 40) day -= 40;
          year += year <= 24 ? 2000 : 1900;
          // Format as DD/MM/YYYY
          tgl = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().padStart(4, '0')}`;
        }
        obj['tanggal_lahir'] = tgl;
        continue;
      } else if (index === 3) {
        // Jenis Kelamin / Gender
        obj['jenis_kelamin'] = row[index];
        continue;
      } else if (index === 4) {
        // Nomor WhatsApp (WA)
        obj['nomor_wa'] = '+62' + row[index];
        continue;
      } else if (index === 5) {
        // Pekerjaan
        obj['pekerjaan'] = row[index];
        continue;
      } else if (index === 6) {
        // Provinsi
        obj['provinsi'] = row[index];
        continue;
      } else if (index === 7) {
        // Alamat
        obj['alamat'] = row[index];
        continue;
      }
      obj[`Column ${index + 1}`] = row[index]; // Use dynamic keys for each column
    }
    return obj;
  });
}

const result = parseXlsxFile();
const outPath = path.join(__dirname, 'sehatindonesiaku-data.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Parsed XLSX data (Format Full) written to: ${outPath}`);
