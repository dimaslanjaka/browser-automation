import { encryptJson, decryptJson } from '../src/utils/json-crypto.js';

describe('json-crypto', () => {
  const secret = 'test_secret_key';
  const testData = { foo: 'bar', num: 42, arr: [1, 2, 3], obj: { a: 1 } };
  const arrayData = [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob', active: false },
    { id: 3, name: 'Charlie', active: true }
  ];

  it('should encrypt and decrypt JSON object correctly (Node)', () => {
    const encrypted = encryptJson(testData, secret);
    expect(typeof encrypted).toBe('string');
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted).toEqual(testData);
  });

  it('should encrypt and decrypt array data correctly', () => {
    const encrypted = encryptJson(arrayData, secret);
    expect(typeof encrypted).toBe('string');
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted).toEqual(arrayData);
  });

  it('should throw error on invalid decryption', () => {
    expect(() => decryptJson('invalid_encrypted_string', secret)).toThrow();
  });

  it('should handle empty object', () => {
    const encrypted = encryptJson({}, secret);
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted).toEqual({});
  });

  it('should handle empty array', () => {
    const encrypted = encryptJson([], secret);
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted).toEqual([]);
  });

  it('should handle nested arrays and objects', () => {
    const nested = { arr: [{ a: [1, 2, { b: 'c' }] }] };
    const encrypted = encryptJson(nested, secret);
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted).toEqual(nested);
  });

  it('should handle circular references', () => {
    const circ = { name: 'circular' };
    circ.self = circ;
    circ.child = { parent: circ };
    const encrypted = encryptJson(circ, secret);
    const decrypted = decryptJson(encrypted, secret);
    expect(decrypted.name).toBe('circular');
    expect(decrypted.self).toBe(decrypted);
    expect(decrypted.child.parent).toBe(decrypted);
  });
});
