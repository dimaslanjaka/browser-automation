import { parseBabyName } from '../src/runner/skrin-utils.js';

describe('parseBabyName', () => {
  test('should return mother name when entry ends with "/ BAYI"', () => {
    const result = parseBabyName('Muhammad Arkan Raffasya Al-Fattah / BAYI');
    expect(result).toBe('Muhammad Arkan Raffasya Al-Fattah');
  });

  test('should return mother name from "MUHAMMAD ARSHAKA NAUFAL, BY (BAYI"', () => {
    const result = parseBabyName('MUHAMMAD ARSHAKA NAUFAL, BY (BAYI');
    expect(result).toBe('MUHAMMAD ARSHAKA NAUFAL');
  });

  test('should return mother name from "MOCH ABIDZAR SAKHI MOTAZ, BY (BAYI"', () => {
    const result = parseBabyName('MOCH ABIDZAR SAKHI MOTAZ, BY (BAYI');
    expect(result).toBe('MOCH ABIDZAR SAKHI MOTAZ');
  });

  test('should return mother name from "AZAHIRA MAULIDIYA NAILA, BY"', () => {
    const result = parseBabyName('AZAHIRA MAULIDIYA NAILA, BY');
    expect(result).toBe('AZAHIRA MAULIDIYA NAILA');
  });

  test('should return mother name from "AZKIA AULIA IZZATUNISA, BY (BAYI NYONYA UCI PERTIWI)"', () => {
    const result = parseBabyName('AZKIA AULIA IZZATUNISA, BY (BAYI NYONYA UCI PERTIWI)');
    expect(result).toBe('AZKIA AULIA IZZATUNISA');
  });

  test('should return mother name from "AZZAM KHALIF PUTRANTO / BY NY REKA MULYA SARI"', () => {
    const result = parseBabyName('AZZAM KHALIF PUTRANTO / BY NY REKA MULYA SARI');
    expect(result).toBe('AZZAM KHALIF PUTRANTO');
  });

  test('should return mother name from "BAYI NY. NUR FADILAH / ERZHAN AKHTAR DIMNASTIAR, BY"', () => {
    const result = parseBabyName('BAYI NY. NUR FADILAH / ERZHAN AKHTAR DIMNASTIAR, BY');
    expect(result).toBe('ERZHAN AKHTAR DIMNASTIAR');
  });
});
