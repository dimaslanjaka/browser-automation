import nikParserSync from './region_controller.mjs';

/**
 * Validates an Indonesian NIK (Nomor Induk Kependudukan).
 * @param nik - The NIK string to validate.
 * @returns true if valid, false otherwise.
 */
function isValidNIK(nik, debug = false) {
    // NIK must be 16 digits
    if (!/^[0-9]{16}$/.test(nik)) {
        if (debug)
            console.log("NIK failed: not 16 digits");
        return false;
    }
    const parse = nikParserSync(nik);
    if (parse.status !== "success") {
        if (debug)
            console.log("NIK failed: parsing error");
        return false;
    }
    else {
        if (parse.data.lahir === "0000-00-00") {
            if (debug)
                console.log("NIK failed: invalid birth date");
            return false;
        }
        const invalid = parse.data.lahir === "2000-00-00" && parse.data.provinsi.length === 0 && parse.data.kotakab.length === 0 && parse.data.namaKec.length === 0 && parse.data.kelurahan.length === 0;
        if (invalid) {
            if (debug)
                console.log("NIK failed: invalid region or birth date");
            return false;
        }
    }
    return true;
}

export { isValidNIK, isValidNIK as nikValidator };
