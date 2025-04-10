import { getBeratBadan, getTinggiBadan } from '../src/skrin_utils.js';

const ages = Array.from({ length: 46 }, (_, i) => i + 5); // Dari umur 5 sampai 50
const genders = ['laki-laki', 'perempuan'];

const testData = [];

for (const age of ages) {
  for (const gender of genders) {
    testData.push({
      age,
      gender,
      tb: getTinggiBadan(age, gender),
      bb: getBeratBadan(age, gender)
    });
  }
}

console.log(testData);
