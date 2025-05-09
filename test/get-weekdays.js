import { array_random } from 'sbg-utility';
import { getWeekdaysOfCurrentMonth } from '../src/utils.js';

console.log(getWeekdaysOfCurrentMonth(true));
console.log('random:', array_random(getWeekdaysOfCurrentMonth()));
