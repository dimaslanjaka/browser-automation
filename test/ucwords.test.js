import { describe, expect, it } from '@jest/globals';
import { ucwords } from '../src/utils';

describe('ucwords', () => {
  it('should capitalize the first letter of each word', () => {
    expect(ucwords('hello world')).toBe('Hello World');
    expect(ucwords('multiple words here')).toBe('Multiple Words Here');
  });

  it('should handle single word', () => {
    expect(ucwords('test')).toBe('Test');
  });

  it('should handle empty string', () => {
    expect(ucwords('')).toBe('');
  });

  it('should handle words with mixed case', () => {
    expect(ucwords('hELLo wORld')).toBe('HELLo WORld');
  });

  it('should handle strings with punctuation or special chars', () => {
    expect(ucwords('hello-world test_case')).toBe('Hello-World Test_Case');
    expect(ucwords('hello-world_test_case')).toBe('Hello-World_Test_Case');
    expect(ucwords('hello_world')).toBe('Hello_World');
    expect(ucwords('test_case_example')).toBe('Test_Case_Example');
  });

  it('should handle strings with leading/trailing spaces', () => {
    expect(ucwords('  hello world  ')).toBe('  Hello World  ');
    expect(ucwords('hello    world')).toBe('Hello    World');
  });

  it('should handle strings with numbers', () => {
    expect(ucwords('hello world 123')).toBe('Hello World 123');
  });

  it('should not change already capitalized words', () => {
    expect(ucwords('Hello World')).toBe('Hello World');
  });

  it('should handle uppercase words', () => {
    expect(ucwords('HELLO WORLD')).toBe('Hello World');
  });

  it('should handle strings with non-ASCII characters', () => {
    expect(ucwords('café crème')).toBe('Café Crème');
    expect(ucwords('naïve approach')).toBe('Naïve Approach');
  });
});
