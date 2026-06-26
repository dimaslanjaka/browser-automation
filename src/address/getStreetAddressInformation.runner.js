import { getStreetAddressInformation } from './getStreetAddressInformation.js';

(async () => {
  const keyword = 'DUKUH SETRO 12 NO 5 A Surabaya, Jawa Timur';
  const result = await getStreetAddressInformation(keyword, { verbose: true, noCache: true });
  if (result) {
    console.log('Street address information:');
    console.log({
      kelurahan: result.kelurahan,
      kecamatan: result.kecamatan,
      kota: result.kota,
      kabupaten: result.kabupaten,
      provinsi: result.provinsi,
      country: result.country,
      provider: result.provider,
      fullAddress: result.fullAddress,
      latitude: result.latitude,
      longitude: result.longitude
    });
  } else {
    console.log('No street address information found for keyword:', keyword);
  }
})();
