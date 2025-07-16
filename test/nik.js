import region_controller from 'nik-parser-jurusid';
// import region_controller from 'nik-parser-jurusid/region_controller_async';

const niks = ['4360000000000658', '3678101007220001', '3578104704210002'];

const nik = niks[2]; // Change this to test different NIKs
const regionResult = region_controller(nik);

console.log({
  nik,
  region: regionResult
});
