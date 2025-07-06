import region_controller from 'nik-parser-jurusid';

const niks = ['4360000000000658', '3678101007220001'];

const nik = niks[0]; // Change this to test different NIKs
const regionResult = region_controller(nik);

console.log({
  nik,
  region: regionResult
});
