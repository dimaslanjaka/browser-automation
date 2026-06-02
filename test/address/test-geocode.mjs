import { geoCodeWithGeoapify } from '../../src/address/geoapify.js';
import { geocodeWithNominatim } from '../../src/address/nominatim.js';
import util from 'node:util';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debugPrint = (label, value) => {
  console.log(label);
  console.log(
    util.inspect(value, {
      depth: null,
      colors: true,
      maxArrayLength: null,
      compact: false
    })
  );
};

const addresses = [
  // { keyword: 'TEMBOK GEDE I/51-H SURABAYA' },
  // { keyword: 'LEBAK REJO UTARA 1/8 SURABAYA' },
  // { keyword: 'KAPAS GADING MADYA 3D/2' },
  // { keyword: 'Jl. Lebak Arum Barat 82-84' },
  { keyword: 'Jl. Lebak Arum Barat 82-84 Kota Surabaya, Jawa Timur' }
];

for (const { keyword } of addresses) {
  try {
    const nominatim = await geocodeWithNominatim(keyword);
    if (!nominatim) {
      const geoapify = await geoCodeWithGeoapify(keyword, null);
      if (geoapify) {
        debugPrint(`Nominatim failed but Geoapify succeeded for "${keyword}":`, geoapify);
      } else {
        console.log(`Both Nominatim and Geoapify failed to geocode "${keyword}"`);
      }
    } else {
      debugPrint(`Result for "${keyword}":`, nominatim);
    }
  } catch (error) {
    console.error(`Error geocoding "${keyword}":`, error);
  }

  await wait(1000);
}
