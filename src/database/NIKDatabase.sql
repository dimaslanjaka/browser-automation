CREATE TABLE IF NOT EXISTS ktp_residents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Identity
    nik CHAR(16) NOT NULL,
    nama_lengkap VARCHAR(150) NOT NULL,
    tempat_lahir VARCHAR(100) NULL,
    tanggal_lahir DATE NULL,

    -- Demographics
    jenis_kelamin ENUM('L', 'P') NULL,
    golongan_darah ENUM('A', 'B', 'AB', 'O', '-') NULL,
    agama VARCHAR(50) NULL,
    status_perkawinan VARCHAR(50) NULL,
    pekerjaan VARCHAR(100) NULL,
    kewarganegaraan CHAR(3) NOT NULL DEFAULT 'WNI',

    -- Address
    alamat VARCHAR(255) NULL,
    rt CHAR(3) NULL,
    rw CHAR(3) NULL,
    kelurahan VARCHAR(100) NULL,
    kecamatan VARCHAR(100) NULL,
    kabupaten_kota VARCHAR(100) NULL,
    provinsi VARCHAR(100) NULL,
    kode_pos CHAR(5) NULL,

    -- Family / administration
    no_kk CHAR(16) NULL,

    -- KTP administration
    status_ktp ENUM(
        'BELUM_TERDAFTAR',
        'AKTIF',
        'TIDAK_AKTIF'
    ) NOT NULL DEFAULT 'AKTIF',

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_ktp_residents_nik (nik),
    KEY idx_ktp_residents_nama (nama_lengkap),
    KEY idx_ktp_residents_tanggal_lahir (tanggal_lahir),
    KEY idx_ktp_residents_no_kk (no_kk),
    KEY idx_ktp_residents_wilayah (
        provinsi,
        kabupaten_kota,
        kecamatan,
        kelurahan
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;