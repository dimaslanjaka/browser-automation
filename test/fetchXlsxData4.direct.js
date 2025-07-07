import { fetchXlsxData4 } from '../src/fetchXlsxData4.js';

const data = await fetchXlsxData4();
const index7489 = data.filter((item) => Object.values(item).includes('3578106311200003'));
console.log({ index7489 });
console.log({ first: data[0] });
