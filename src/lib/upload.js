import fs from 'fs';
import path from 'path';

/**
 * Saves a base64 image data URI to public/uploads/<folder>/
 * If already a URL or path, returns it unchanged.
 * Returns relative URL path e.g. '/uploads/categories/cat_12345.png'
 */
export function saveUploadedImage(imageData, subfolder = 'products', prefix = 'img') {
  if (!imageData || typeof imageData !== 'string') return null;
  const trimmed = imageData.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    try {
      const parts = trimmed.split(';base64,');
      if (parts.length === 2) {
        const mime = parts[0].replace('data:image/', '');
        let ext = mime.split('+')[0].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (!ext || ext.length > 10) ext = 'png';

        const buffer = Buffer.from(parts[1], 'base64');
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', subfolder);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

        // 1. Save to primary dashboard app public uploads
        const primaryDir = path.join(process.cwd(), 'public', 'uploads', subfolder);
        if (!fs.existsSync(primaryDir)) {
          fs.mkdirSync(primaryDir, { recursive: true });
        }
        fs.writeFileSync(path.join(primaryDir, filename), buffer);

        // 2. Save to storefront website app public uploads
        try {
          const webDir = path.join('/var/www/invincible-website', 'public', 'uploads', subfolder);
          if (!fs.existsSync(webDir)) {
            fs.mkdirSync(webDir, { recursive: true });
          }
          fs.writeFileSync(path.join(webDir, filename), buffer);
        } catch (webErr) {
          console.warn('Web uploads dir write warning:', webErr.message);
        }

        return `/uploads/${subfolder}/${filename}`;
      }
    } catch (e) {
      console.error(`Error saving ${subfolder} image:`, e);
      return null;
    }
  }

  // Already a URL or relative path
  return trimmed;
}

export function saveProductImage(imageData) {
  return saveUploadedImage(imageData, 'products', 'prod');
}

export function saveCategoryImage(imageData) {
  return saveUploadedImage(imageData, 'categories', 'cat');
}
