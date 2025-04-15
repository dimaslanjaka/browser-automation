import { uniqueArrayObjByKey } from '../src/utils.js';

// { nik: '3578102009820006', bb: '75', tb: '90', dm: 'ya', batuk: 'bapilnas 2 hr' }
const data = [
  { nik: '3578102009820006', bb: '75', tb: '90', dm: '', batuk: 'bapilnas 2 hr' },
  { nik: '3578102009820006', bb: null, tb: null, dm: 'ya' },
  { nik: '3578102009820006', bb: null, tb: null, dm: 'ya', batuk: null }
];

const merged = uniqueArrayObjByKey(data, 'nik');
console.log(merged);
