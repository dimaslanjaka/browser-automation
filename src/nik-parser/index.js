import { U } from './U.js';
import { G } from './G.js';
import { R } from './R.js';
import { T } from './T.js';

/**
 * Parses an Indonesian National Identification Number (NIK) into detailed personal data,
 * such as gender, birthdate, place of birth, zodiac, Javanese market day (pasaran), age, and birthday countdown.
 *
 * @param {string|number} nik - The 16-digit NIK to be parsed.
 * @param {(result: {
 *   status: 'success' | 'error',
 *   pesan: string,
 *   data?: {
 *     nik: string,
 *     kelamin: 'LAKI-LAKI' | 'PEREMPUAN',
 *     lahir: string, // Birthdate in DD/MM/YYYY format
 *     provinsi: string, // Province name
 *     kotakab: string,  // City or Regency name
 *     kecamatan: string, // District name
 *     uniqcode: string, // Unique NIK code (last 4 digits)
 *     tambahan: {
 *       kodepos: string, // Postal code
 *       pasaran: string, // Javanese market day, e.g. "Monday Kliwon, 01 January 1990"
 *       usia: string,    // Age in "X Years Y Months Z Days"
 *       ultah: string,   // Time until next birthday, e.g. "2 Months 14 Days Left"
 *       zodiak: string   // Zodiac sign, e.g. "Capricorn"
 *     }
 *   }
 * }) => void} callback - Callback function to handle the parsing result.
 */
export function nikParse(nik, callback) {
  // Output NIK tidak valid
  let res = {
    status: 'error',
    pesan: 'NIK tidak valid'
  };

  // validasi NIK
  if (
    16 == (nik = nik.toString()).length &&
    null != U.provinsi[nik.substring(0, 2)] &&
    U.kabkot[nik.substring(0, 4)] &&
    U.kecamatan[nik.substring(0, 6)]
  ) {
    const N = new Date().getFullYear().toString().substr(-2); // tahun sekarang
    const E = nik.substring(10, 12); // tahun NIK
    const O = nik.substring(6, 8); // tanggal NIK
    const K = U.kecamatan[nik.substring(0, 6)].toUpperCase().split(' -- '); // kecamatan & kodepos

    // Kecamatan
    const L = K[0];

    // Kode POS
    const B = K[1];

    // Jenis kelamin
    let M = 'LAKI-LAKI';
    if (O > 40) {
      M = 'PEREMPUAN';
    }

    // Tanggal lahir
    let S = O;
    if (O > 40) {
      const day = O - 40;
      S = day.toString().padStart(2, '0');
    }

    // Bulan lahir
    const P = nik.substring(8, 10);

    // Tahun lahir
    let D = `19${E}`;
    if (E < N) {
      D = `20${E}`;
    }

    // Menerjemahkan tanggal lahir ke pasaran, usia, zodiak & ulang tahun
    const H = (function (A) {
      const N = new Date(),
        U = N.getFullYear(),
        I = N.getMonth(),
        E = A.split('-'),
        O = I < E[1] ? U : U + 1;

      // Ulang tahun counter
      const K = (function (A) {
        const N = new Date(),
          U =
            (function (A) {
              const N = A.split(/\D/),
                U = new Date(N[2], --N[1], N[0]);
              return (U && U.getMonth() == N[1]) || U.getMonth() == ++N[1] ? U : new Date(NaN);
            })(A) - N,
          I = Math.floor(U / 2592e6),
          G = Math.floor((U % 2592e6) / 864e5);
        return `${I} Bulan ${G} Hari`;
      })(`${parseInt(E[0]) + 1}/${E[1]}/${O}`);

      const L = T(E[0]), // int tanggal lahir
        B = T(E[1]), // int bulan lahir
        M = E[2]; // int tahun lahir

      // Pasaran
      const S = new Date(70, 0, 2),
        P = new Date(M, B - 1, L),
        V = (P.getTime() - S.getTime() + 864e5) / 432e6,
        D = Math.round(10 * (V - Math.floor(V))) / 2,
        H = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'][D],
        Z = `${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][R('w', G(0, 0, 0, B, L, M))]} ${H}, ${L} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'Nopember', 'Desember'][B - 1]} ${M}`;

      // Usia
      let utahun = R('Y') - M;
      let ubulan = R('m') - B;
      let uhari = R('j') - L;
      if (uhari < 0) {
        uhari = R('t', G(0, 0, 0, B - 1, R('m'), R('Y'))) - Math.abs(uhari);
        ubulan -= 1;
      }
      if (ubulan < 0) {
        ubulan = 12 - Math.abs(ubulan);
        utahun -= 1;
      }
      const X = `${utahun} Tahun ${ubulan} Bulan ${uhari} Hari`;

      // Zodiak
      let W = '';
      if ((B === 1 && L >= 20) || (B === 2 && L < 19)) {
        W = 'Aquarius';
      } else if ((B === 2 && L >= 19) || (B === 3 && L < 21)) {
        W = 'Pisces';
      } else if ((B === 3 && L >= 21) || (B === 4 && L < 20)) {
        W = 'Aries';
      } else if ((B === 4 && L >= 20) || (B === 5 && L < 21)) {
        W = 'Taurus';
      } else if ((B === 5 && L >= 21) || (B === 6 && L < 22)) {
        W = 'Gemini';
      } else if ((B === 6 && L >= 21) || (B === 7 && L < 23)) {
        W = 'Cancer';
      } else if ((B === 7 && L >= 23) || (B === 8 && L < 23)) {
        W = 'Leo';
      } else if ((B === 8 && L >= 23) || (B === 9 && L < 23)) {
        W = 'Virgo';
      } else if ((B === 9 && L >= 23) || (B === 10 && L < 24)) {
        W = 'Libra';
      } else if ((B === 10 && L >= 24) || (B === 11 && L < 23)) {
        W = 'Scorpio';
      } else if ((B === 11 && L >= 23) || (B === 12 && L < 22)) {
        W = 'Sagitarius';
      } else {
        W = 'Capricorn';
      }

      return {
        pasaran: Z,
        usia: X,
        ultah: K,
        zodiak: W
      };
    })(`${S}-${P}-${D}`);

    // Output NIK valid
    res = {
      status: 'success',
      pesan: 'NIK valid',
      data: {
        nik: nik,
        kelamin: M,
        lahir: `${S}/${P}/${D}`,
        provinsi: U.provinsi[nik.substring(0, 2)],
        kotakab: U.kabkot[nik.substring(0, 4)],
        kecamatan: L,
        uniqcode: nik.substring(12, 16),
        tambahan: {
          kodepos: B,
          pasaran: H.pasaran,
          usia: H.usia,
          ultah: `${H.ultah} Lagi`,
          zodiak: H.zodiak
        }
      }
    };
  }

  callback(res);
}
