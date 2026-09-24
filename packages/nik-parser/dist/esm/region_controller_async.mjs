/**
 * Get province data by code (dynamic import).
 */
async function getPropinsi(kode) {
    const provinces = (await import('./data/provinces.mjs')).default;
    return provinces.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
/**
 * Get regency (kabupaten/kota) data by code (dynamic import).
 */
async function getKokab(kode) {
    const regencies = (await import('./data/regencies.mjs')).default;
    return regencies.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
/**
 * Get district (kecamatan) data by code (dynamic import).
 */
async function getKec(kode) {
    const districts = (await import('./data/districts.mjs')).default;
    return districts.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
/**
 * Get list of villages (kelurahan) by district code (dynamic import).
 *
 * @param kode - The district code (string or number).
 * @returns A Promise resolving to an array of Village objects belonging to the district.
 */
async function getKel(kode) {
    const villages = (await import('./data/villages.mjs')).default;
    const data = [];
    villages.find((o, i) => {
        if (parseInt(o.district_id) === parseInt(kode.toString())) {
            data.push(villages[i]);
        }
    });
    return data;
}
/**
 * Guess the correct village (kelurahan) from a NIK's uniqcode and list of kelurahan.
 *
 * @param data - The parsed NIK data object (NikParseSuccess["data"]).
 * @returns The guessed Village object from the kelurahan list.
 *
 * If the uniqcode is within the range of the kelurahan list, it uses it as an index (1-based).
 * Otherwise, it falls back to a modulo-based estimation.
 */
function guessKelurahanByUniqcode(data) {
    const uniqNum = parseInt(data.uniqcode, 10); // ambil angka dari uniqcode
    const kelList = data.kelurahan;
    if (!kelList || kelList.length === 0) {
        return undefined; // jika kelurahan list kosong, kembalikan undefined
    }
    // Jika angka uniqcode <= jumlah kelurahan, langsung pakai indeks
    if (uniqNum >= 1 && uniqNum <= kelList.length) {
        return kelList[uniqNum - 1]; // array 0-based
    }
    // Jika di luar jangkauan, fallback ke estimasi dengan modulo
    const estimatedIndex = (uniqNum - 1) % kelList.length;
    return kelList[estimatedIndex];
}
const nikCache = new Map();
/**
 * Parse and validate an Indonesian NIK (Nomor Induk Kependudukan).
 * Now async due to dynamic imports.
 */
async function nikParser(nik) {
    // ⏪ Check if result already cached
    if (nikCache.has(nik)) {
        return nikCache.get(nik); // non-null assertion
    }
    let res = {
        status: "error",
        message: "NIK tidak valid"
    };
    if (nik.toString().length === 16) {
        const thnNow = new Date().getFullYear().toString().slice(-2);
        const tglLahir = nik.substring(6, 8);
        const blnLahir = nik.substring(8, 10);
        const thnLahir = nik.substring(10, 12);
        const cekProp = await getPropinsi(nik.substring(0, 2));
        const namaProp = cekProp?.name || "";
        const cekKokab = await getKokab(nik.substring(0, 4));
        const namaKokab = cekKokab?.name || "";
        const cekKec = await getKec(nik.substring(0, 6));
        const namaKec = cekKec?.name || "";
        const kels = await getKel(nik.substring(0, 6));
        let jenKel = "L";
        if (parseInt(tglLahir) > 40)
            jenKel = "P";
        let tgLahir = tglLahir;
        if (parseInt(tglLahir) > 40) {
            tgLahir = (parseInt(tglLahir) - 40).toString().padStart(2, "0");
        }
        let thLahir = `19${thnLahir}`;
        if (parseInt(thnLahir) < parseInt(thnNow)) {
            thLahir = `20${thnLahir}`;
        }
        res = {
            status: "success",
            message: "NIK valid",
            data: {
                nik,
                kelamin: jenKel,
                lahir: `${thLahir}-${blnLahir}-${tgLahir}`,
                provinsi: namaProp,
                kotakab: namaKokab,
                namaKec,
                kelurahan: kels,
                uniqcode: nik.substring(12, 16)
            }
        };
        // Urut ulang kelurahan berdasarkan uniqcode (prioritas)
        const guessedKelurahan = guessKelurahanByUniqcode(res.data);
        if (guessedKelurahan) {
            res.data.kelurahan = [guessedKelurahan, ...res.data.kelurahan.filter((kel) => kel !== guessedKelurahan)];
        }
    }
    // ✅ Simpan ke cache
    nikCache.set(nik, res);
    return res;
}

export { getKec, getKel, getKokab, getPropinsi, guessKelurahanByUniqcode, nikParser, nikParser as nikparse };
