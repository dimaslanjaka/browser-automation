import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Transform an image file to a data URL (base64-encoded string for embedding in HTML).
 * @param {string} filePath - Path to the image file.
 * @param {string} [mimeType] - Optional MIME type (e.g., 'image/png'). If not provided, tries to infer from extension.
 * @returns {string} Data URL string (e.g., 'data:image/png;base64,...')
 */
export function imageFileToDataUrl(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let type = mimeType;
  if (!type) {
    if (ext === '.png') type = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') type = 'image/jpeg';
    else if (ext === '.gif') type = 'image/gif';
    else if (ext === '.webp') type = 'image/webp';
    else if (ext === '.svg') type = 'image/svg+xml';
    else type = 'application/octet-stream';
  }
  const base64 = buffer.toString('base64');
  return `data:${type};base64,${base64}`;
}

export { imageFileToDataUrl as imageToUri };

/**
 * Open an image file with the default system image viewer.
 * Works on Windows, macOS, and Linux (xdg-open).
 * @param {string} filePath
 */
export async function openImageExternally(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    return;
  }
  try {
    const safePath = String(filePath).replace(/"/g, '\\"');
    const cmd =
      process.platform === 'win32'
        ? `start "" "${safePath}"`
        : process.platform === 'darwin'
          ? `open "${safePath}"`
          : `xdg-open "${safePath}"`;
    exec(cmd, (err) => {
      if (err) console.error('Failed to open image:', err && err.message ? err.message : err);
    });
  } catch (e) {
    // ignore
  }
}

if (process.argv.some((arg) => arg.includes('image.js'))) {
  // const body = await got('https://sindresorhus.com/unicorn').buffer();
  // const preview = await displayImageInTerminal(body);
  // console.log(preview);
}
