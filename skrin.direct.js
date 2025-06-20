import { runEntrySkrining } from './skrin.js';
import { multiBeep } from './src/utils.js';

// Override dates
// runEntrySkrining(function (data) {
//   const day = array_random([1, 2, 3, 5, 6, 7, 8, 9]);
//   // Add leading zero if the number is a single digit
//   const formattedDay = day < 10 ? `0${day}` : `${day}`;
//   data.tanggal = `${formattedDay}/05/2025`;
//   return data;
// }).catch((e) => {
//   multiBeep();
//   console.error(e);
// });

// Normal runs
runEntrySkrining().catch((e) => {
  multiBeep();
  console.error(e);
});
