const data = {
  nik: '3578106311200003',
  kelamin: 'P',
  lahir: '23/11/2020',
  provinsi: 'JAWA TIMUR',
  kotakab: 'KOTA SURABAYA',
  namaKec: 'Tambaksari',
  kelurahan: [
    {
      id: '3578101001',
      district_id: '357810',
      name: 'Tambaksari'
    },
    {
      id: '3578101002',
      district_id: '357810',
      name: 'Ploso'
    },
    {
      id: '3578101003',
      district_id: '357810',
      name: 'Gading'
    },
    {
      id: '3578101004',
      district_id: '357810',
      name: 'Pacarkembang'
    },
    {
      id: '3578101005',
      district_id: '357810',
      name: 'Rangkah'
    },
    {
      id: '3578101006',
      district_id: '357810',
      name: 'Pacarkeling'
    },
    {
      id: '3578101007',
      district_id: '357810',
      name: 'Kapas Madya Baru'
    },
    {
      id: '3578101008',
      district_id: '357810',
      name: 'Dukuh Setro'
    }
  ],
  uniqcode: '0003',
  originalLahir: '2020-11-23'
};

function tebakKelurahan(data) {
  const uniqNum = parseInt(data.uniqcode, 10); // ambil angka dari uniqcode
  const kelList = data.kelurahan;

  // Jika angka uniqcode <= jumlah kelurahan, langsung pakai indeks
  if (uniqNum >= 1 && uniqNum <= kelList.length) {
    return kelList[uniqNum - 1]; // array 0-based
  }

  // Jika di luar jangkauan, fallback ke estimasi dengan modulo
  const estimatedIndex = (uniqNum - 1) % kelList.length;
  return kelList[estimatedIndex];
}

const hasil = tebakKelurahan(data);
console.log(hasil);
