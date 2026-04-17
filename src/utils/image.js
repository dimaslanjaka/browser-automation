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
