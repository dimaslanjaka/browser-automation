import { nikParse } from '../src/nik-parser/index.js';
// import region_controller from 'nik-parser-jurusid';

const nik = '3678101007220001';
const result = nikParse(nik);
console.log(result);
