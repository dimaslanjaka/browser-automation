import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Install CommonJS-like globals for ESM modules.
 * Call this once at startup, or per-module with that module's import.meta.url.
 *
 * @param {string|URL} [metaUrl=import.meta.url]
 * @returns {{__filename: string, __dirname: string}}
 */
export function installDirname(metaUrl = import.meta.url) {
  const __filename = fileURLToPath(metaUrl);
  const __dirname = path.dirname(__filename);

  globalThis.__filename = __filename;
  globalThis.__dirname = __dirname;

  return { __filename, __dirname };
}

const installed = installDirname(import.meta.url);

export const __filename = installed.__filename;
export const __dirname = installed.__dirname;

export default installDirname;
