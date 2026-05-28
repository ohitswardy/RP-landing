import sharp from 'sharp';
import { readdir, stat, writeFile, rename } from 'fs/promises';
import { join, extname, basename } from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../public/People of Regis');

// Max dimension (longest side) — portrait photos display max ~500px wide on card
// 900px covers full-bleed modal at 2x retina
const MAX_PX = 900;
const JPEG_QUALITY = 82;

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await getFiles(full));
    else if (['.jpg', '.jpeg', '.png'].includes(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

const files = await getFiles(ROOT);
let saved = 0;

for (const file of files) {
  const before = (await stat(file)).size;
  const ext = extname(file).toLowerCase();

  try {
    const img = sharp(file).resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true });
    const buf = ext === '.png'
      ? await img.png({ compressionLevel: 9 }).toBuffer()
      : await img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

    if (buf.length < before) {
      const tmp = file + '.tmp';
      await writeFile(tmp, buf);
      await rename(tmp, file);
      const after = buf.length;
      saved += (before - after);
      console.log(`✓ ${basename(file)}  ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB`);
    } else {
      console.log(`— ${basename(file)}  already optimal (${(before/1024).toFixed(0)}KB)`);
    }
  } catch (e) {
    console.error(`✗ ${basename(file)}  ${e.message}`);
  }
}

console.log(`\nTotal saved: ${(saved / 1024 / 1024).toFixed(2)} MB`);
