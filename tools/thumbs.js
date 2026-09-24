#!/usr/bin/env node
/**
 * thumbs.js — optional. Makes small WebP previews so the grid loads fast
 * even when you drop 40MB exports straight out of Lightroom.
 *
 * Needs sharp:  npm install
 * Skips itself silently if sharp is not installed, so `npm run build`
 * always works on a clean machine.
 *
 * Run scan.js AFTER this so the manifest picks the thumbnails up.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');
const OUT = path.join(MEDIA, '_thumbs');
const WIDTH = 900;      // plenty for a grid tile on a retina screen
const QUALITY = 78;

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('\n  · sharp not installed — skipping thumbnails (the site still works,');
  console.log('    it just serves the full-size images in the grid).');
  console.log('    Run `npm install` to enable them.\n');
  process.exit(0);
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

function keyFor(full) {
  return path.relative(MEDIA, full).split(path.sep).join('/')
    .replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const sources = walk(path.join(MEDIA, 'photos')).concat(walk(path.join(MEDIA, 'videos')));
  const valid = new Set();
  let made = 0, skipped = 0;

  for (const src of sources) {
    const key = keyFor(src);
    valid.add(key + '.webp');
    const dest = path.join(OUT, key + '.webp');

    // Only regenerate when the source is newer than the thumbnail
    if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs) { skipped++; continue; }

    try {
      await sharp(src).rotate().resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY }).toFile(dest);
      made++;
    } catch (err) {
      console.warn(`  ! ${path.relative(ROOT, src)}: ${err.message}`);
    }
  }

  // Delete thumbnails whose source photo was removed
  let pruned = 0;
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.webp') && !valid.has(f)) { fs.unlinkSync(path.join(OUT, f)); pruned++; }
  }

  console.log(`\n  ✓ thumbnails — ${made} new, ${skipped} up to date, ${pruned} removed\n`);
})();
