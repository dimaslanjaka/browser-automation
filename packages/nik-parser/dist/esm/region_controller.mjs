import provinces from './data/provinces.mjs';
import regencies from './data/regencies.mjs';
import districts from './data/districts.mjs';
import villages from './data/villages.mjs';

function getPropinsiSync(kode) {
    return provinces.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
function getKokabSync(kode) {
    return regencies.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
function getKecSync(kode) {
    return districts.find((element) => parseInt(element.id) === parseInt(kode.toString()));
}
function getKelSync(kode) {
    return villages.filter((o) => parseInt(o.district_id) === parseInt(kode.toString()));
}
function guessKelurahanByUniqcodeSync(data) {
    const uniqNum = parseInt(data.uniqcode, 10);
    const kelList = data.kelurahan;
    if (!kelList || kelList.length === 0) {
        return undefined;
    }
    if (uniqNum >= 1 && uniqNum <= kelList.length) {
        return kelList[uniqNum - 1];
    }
    const estimatedIndex = (uniqNum - 1) % kelList.length;
    return kelList[estimatedIndex];
}
const nikCacheSync = new Map();
function nikParserSync(nik) {
    if (nikCacheSync.has(nik)) {
        return nikCacheSync.get(nik);
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
        const cekProp = getPropinsiSync(nik.substring(0, 2));
        const namaProp = cekProp?.name || "";
        const cekKokab = getKokabSync(nik.substring(0, 4));
        const namaKokab = cekKokab?.name || "";
        const cekKec = getKecSync(nik.substring(0, 6));
        const namaKec = cekKec?.name || "";
        const kels = getKelSync(nik.substring(0, 6));
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
        const guessedKelurahan = guessKelurahanByUniqcodeSync(res.data);
        if (guessedKelurahan) {
            res.data.kelurahan = [guessedKelurahan, ...res.data.kelurahan.filter((kel) => kel !== guessedKelurahan)];
        }
    }
    nikCacheSync.set(nik, res);
    return res;
}

export { nikParserSync as default, getKecSync, getKelSync, getKokabSync, getPropinsiSync, guessKelurahanByUniqcodeSync, nikParserSync, nikParserSync as nikparse };
