/* eslint-env jest */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import ansiColors from 'ansi-colors';
import { logInline, logLine } from '../src/utils';

describe('logLine and logInline', () => {
  let writeSpy;
  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    global.__lastLogWasInline = false;
  });
  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('logs a string', () => {
    logLine('hello');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });

  it('logs a number (magenta)', () => {
    logLine(42);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.magenta('42')));
  });

  it('logs a boolean (blue)', () => {
    logLine(true);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.blue('true')));
  });

  it('logs null (gray)', () => {
    logLine(null);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.gray('null')));
  });

  it('logs an array with colorized JSON', () => {
    logLine([1, 'a', false, null]);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.cyan('[\n')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.magenta('1')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.yellow('"a"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.blue('false')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.gray('null')));
  });

  it('logs an object with colorized JSON', () => {
    logLine({ foo: 'bar', num: 1, bool: false, nil: null });
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.green('"foo"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.yellow('"bar"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.green('"num"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.magenta('1')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.green('"bool"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.blue('false')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.green('"nil"')));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(ansiColors.gray('null')));
  });

  it('logInline does not add newline', () => {
    logInline('inline');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringMatching(/^\rinline/));
  });

  it('logLine after logInline prepends newline', () => {
    logInline('inline');
    logLine('next');
    expect(writeSpy).toHaveBeenLastCalledWith(expect.stringMatching(/^\nnext/));
  });
});
