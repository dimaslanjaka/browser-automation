import { getAge } from '../../utils/date.js';

/**
 * Get patient data information from the page form elements.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<{gender: string, age: number, birthDate: string, location: {province: string, city: string}, occupation: string, bodyWeight: string, bodyHeight: string}>} Patient information object.
 */
export async function getPersonInfo(page) {
  const gender = await page.evaluate(() => document.querySelector('input[name="jenis_kelamin_id_input"]')?.value);
  const birthDate = await page.evaluate(() => document.querySelector('input[name="dt_tgl_lahir"]')?.value);
  const age = getAge(birthDate);
  const province = await page.$eval('#field_item_provinsi_ktp_id input[type="text"]', (input) => input.value.trim());
  const city = await page.$eval('#field_item_kabupaten_ktp_id input[type="text"]', (input) => input.value.trim());
  const occupation = await page.evaluate(() => document.querySelector('input[name="pekerjaan_id_input"]')?.value);
  const bodyWeight = await page.evaluate(
    () => document.querySelector('#field_item_berat_badan input[type="text"]')?.value
  );
  const bodyHeight = await page.evaluate(
    () => document.querySelector('#field_item_tinggi_badan input[type="text"]')?.value
  );
  return { gender, age, birthDate, location: { province, city }, occupation, bodyWeight, bodyHeight };
}
