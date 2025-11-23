import { geocodeWithNominatim } from '../../src/address/nominatim.js';

describe('geocodeWithNominatim (no mocks)', () => {
  test('throws TypeError when keyword is invalid', async () => {
    await expect(geocodeWithNominatim(123)).rejects.toThrow(TypeError);
    await expect(geocodeWithNominatim('')).rejects.toThrow(TypeError);
  });

  test('returns null for an unlikely/unresolvable place', async () => {
    // Use a random string unlikely to resolve to avoid depending on specific OSM data
    const result = await geocodeWithNominatim('this-place-should-not-exist-1234567890');
    expect(result).toBeNull();
  }, 20000);

  test('returns valid result for a known place', async () => {
    const result = await geocodeWithNominatim('Eiffel Tower, Paris', { noCache: true });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('lat');
    expect(result).toHaveProperty('lon');
    expect(result).toHaveProperty('display_name');
    expect(result.display_name).toMatch(/Eiffel Tower/i);
  }, 20000);

  test('uses proxy to make request', async () => {
    // Adjust the proxy URL as needed for your test environment.
    const proxyUrl = 'http://13.59.113.45:8819';
    const result = await geocodeWithNominatim('Eiffel Tower, Paris', 'GET', { proxy: proxyUrl, noCache: true });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('lat');
    expect(result).toHaveProperty('lon');
    expect(result).toHaveProperty('display_name');
    expect(result.display_name).toMatch(/Eiffel Tower/i);
  }, 20000);
});
