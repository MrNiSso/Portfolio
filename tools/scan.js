#!/usr/bin/env node
/**
 * scan.js — turns the media/ folder into data/gallery.json
 *
 * The whole "add a photo" workflow is: drop a file in media/photos/<category>/
 * and run `npm run scan` (or just push — the GitHub Action runs it for you).
 *
 * FILENAME GRAMMAR
 *   [order] - Title [token] [token].ext
 *
 *   "01 - Golden Hour Vows.jpg"              -> order 1, title "Golden Hour Vows"
 *   "golden-hour-vows.jpg"                   -> title "Golden Hour Vows"
 *   "02 - First Dance [featured].jpg"        -> shown in the hero slideshow
 *   "03 - Brand Film [yt=dQw4w9WgXcQ].jpg"   -> YouTube video, this image is the poster
 *   "04 - Reel [vimeo=76979871].jpg"         -> Vimeo video, this image is the poster
 *   "05 - Teaser.mp4"                        -> self-hosted video (poster: same name .jpg)
 *   "_anything.jpg"                          -> ignored (leading underscore)
 *
 * Other tokens: [2024] year · [portrait]/[landscape] force orientation · [wide] spans 2 columns
 * Zero dependencies on purpose — it must run anywhere, forever.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');
const OUT = path.join(ROOT, 'data', 'gallery.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);

/* ------------------------------------------------------------------ *
 * Image dimensions, read straight from the file header.
 * We only need the first few KB — never the whole 40MB raw export.
 * ------------------------------------------------------------------ */
function readDimensions(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(65536);
    const bytes = fs.readSync(fd, buf, 0, 65536, 0);
    const b = buf.subarray(0, bytes);

    // PNG: IHDR is always at byte 16
    if (b.length > 24 && b.toString('hex', 0, 8) === '89504e470d0a1a0a') {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    // GIF
    if (b.length > 10 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a')) {
      return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    }
    // WebP (VP8 / VP8L / VP8X)
    if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = b.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') {
        return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8X') {
        const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
        const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
        return { width: w, height: h };
      }
    }
    // JPEG: walk the marker segments until a Start-Of-Frame
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        // SOF0..SOF15, skipping the non-frame markers DHT/JPG/DAC
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    // AVIF / HEIC and anything exotic: fall through to the default ratio
  } catch { /* unreadable header — use the fallback */ }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
  return null;
}

/* ------------------------------------------------------------------ *
 * Filename -> metadata
 * ------------------------------------------------------------------ */
function parseName(filename) {
  const ext = path.extname(filename).toLowerCase();
  let base = path.basename(filename, path.extname(filename));

  // Pull out every [token]
  const tokens = [];
  base = base.replace(/\[([^\]]+)\]/g, (_, t) => { tokens.push(t.trim()); return ' '; });

  // Leading order prefix: "01 - ", "01_", "01."
  let order = null;
  const m = base.match(/^\s*(\d{1,4})\s*[-_.)]\s*/);
  if (m) { order = parseInt(m[1], 10); base = base.slice(m[0].length); }

  // Slug-style names become Title Case words
  let title = base.trim();
  if (title && !/\s/.test(title)) title = title.replace(/[-_]+/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();
  title = title.replace(/\b\w/g, c => c.toUpperCase());

  const meta = { order, title, ext, featured: false, wide: false, year: null, provider: null, videoId: null };

  for (const raw of tokens) {
    const t = raw.toLowerCase();
    const kv = t.match(/^(yt|youtube|vimeo|vm)\s*[=:]\s*(.+)$/);
    if (kv) {
      meta.provider = kv[1].startsWith('y') ? 'youtube' : 'vimeo';
      meta.videoId = raw.split(/[=:]/).slice(1).join('=').trim();
      continue;
    }
    if (t === 'featured' || t === 'feat' || t === 'hero') { meta.featured = true; continue; }
    if (t === 'wide' || t === 'span' || t === 'big') { meta.wide = true; continue; }
    if (/^(19|20)\d{2}$/.test(t)) { meta.year = t; continue; }
  }
  return meta;
}

function prettify(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => d.name).sort();
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => d.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// media/_thumbs/photos-weddings-01-golden-hour-vows.webp, if thumbs.js has run
function thumbFor(relPath) {
  const key = relPath.replace(/^media\//, '').replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const candidate = path.join(MEDIA, '_thumbs', key + '.webp');
  return fs.existsSync(candidate) ? `media/_thumbs/${key}.webp` : null;
}

/* ------------------------------------------------------------------ *
 * Walk media/photos and media/videos
 * ------------------------------------------------------------------ */
function collect() {
  const items = [];
  const warnings = [];

  for (const kind of ['photos', 'videos']) {
    const kindDir = path.join(MEDIA, kind);
    if (!fs.existsSync(kindDir)) continue;

    // Files sitting directly in media/photos/ land in an "uncategorised" bucket
    const buckets = [['', kindDir], ...listDirs(kindDir).map(c => [c, path.join(kindDir, c)])];

    for (const [category, dir] of buckets) {
      const files = listFiles(dir);
      const videoPosters = new Set();

      // A .jpg next to a .mp4 with the same name is that video's poster, not a photo
      for (const f of files) {
        if (VIDEO_EXT.has(path.extname(f).toLowerCase())) {
          const stem = path.basename(f, path.extname(f));
          for (const g of files) {
            if (g !== f && IMAGE_EXT.has(path.extname(g).toLowerCase()) &&
                path.basename(g, path.extname(g)) === stem) videoPosters.add(g);
          }
        }
      }

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const isImage = IMAGE_EXT.has(ext);
        const isVideo = VIDEO_EXT.has(ext);
        if (!isImage && !isVideo) continue;
        if (videoPosters.has(file)) continue;

        const rel = path.posix.join('media', kind, category, file).replace(/\/+/g, '/');
        const meta = parseName(file);
        const cat = category || 'other';

        const id = rel.replace(/^media\//, '').replace(/\.[^.]+$/, '')
          .replace(/[^a-z0-9]+/gi, '-').toLowerCase();

        // An image carrying [yt=..]/[vimeo=..] is an embedded video using this image as its poster
        const isEmbed = isImage && meta.provider;

        if (isImage && !isEmbed) {
          const dim = readDimensions(path.join(dir, file));
          if (!dim) warnings.push(`Could not read dimensions for ${rel} — assuming 3:2.`);
          const width = dim ? dim.width : 1500;
          const height = dim ? dim.height : 1000;
          items.push({
            id, type: 'photo', title: meta.title || prettify(path.basename(file, ext)),
            category: cat, src: rel, thumb: thumbFor(rel),
            width, height, ratio: +(width / height).toFixed(4),
            featured: meta.featured, wide: meta.wide, year: meta.year,
            order: meta.order ?? 9999
          });
        } else {
          const poster = isEmbed ? rel : (() => {
            const stem = path.basename(file, ext);
            for (const g of files) {
              if (IMAGE_EXT.has(path.extname(g).toLowerCase()) &&
                  path.basename(g, path.extname(g)) === stem) {
                return path.posix.join('media', kind, category, g).replace(/\/+/g, '/');
              }
            }
            return null;
          })();

          let width = 1600, height = 900;
          if (poster) {
            const dim = readDimensions(path.join(ROOT, poster));
            if (dim) { width = dim.width; height = dim.height; }
          } else {
            warnings.push(`${rel} has no poster image — add "${path.basename(file, ext)}.jpg" beside it for a thumbnail.`);
          }

          items.push({
            id, type: 'video',
            provider: isEmbed ? meta.provider : 'file',
            videoId: isEmbed ? meta.videoId : null,
            src: isEmbed ? null : rel,
            title: meta.title || prettify(path.basename(file, ext)),
            category: cat, poster, thumb: poster ? thumbFor(poster) : null,
            width, height, ratio: +(width / height).toFixed(4),
            featured: meta.featured, wide: meta.wide, year: meta.year,
            order: meta.order ?? 9999
          });
        }
      }
    }
  }

  items.sort((a, b) =>
    a.order - b.order ||
    a.category.localeCompare(b.category) ||
    a.title.localeCompare(b.title));
  return { items, warnings };
}

/* ------------------------------------------------------------------ *
 * Build the manifest
 * ------------------------------------------------------------------ */
function main() {
  let config = {};
  try { config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')); }
  catch { console.warn('! site.config.json missing or invalid — using folder names for labels.'); }

  const labels = config.categories || {};
  const { items, warnings } = collect();

  const counts = new Map();
  for (const it of items) counts.set(it.category, (counts.get(it.category) || 0) + 1);

  const categories = [...counts.keys()].map(id => ({
    id,
    label: labels[id]?.label || prettify(id),
    order: labels[id]?.order ?? 500,
    count: counts.get(id)
  })).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const manifest = {
    generatedAt: new Date().toISOString(),
    counts: {
      total: items.length,
      photos: items.filter(i => i.type === 'photo').length,
      videos: items.filter(i => i.type === 'video').length
    },
    categories,
    items
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n  ✓ data/gallery.json`);
  console.log(`    ${manifest.counts.photos} photos · ${manifest.counts.videos} videos · ${categories.length} categories`);
  for (const c of categories) console.log(`      ${String(c.count).padStart(3)}  ${c.label}`);
  if (warnings.length) {
    console.log(`\n  ! ${warnings.length} notice${warnings.length > 1 ? 's' : ''}:`);
    for (const w of warnings.slice(0, 12)) console.log(`      - ${w}`);
  }
  if (!items.length) {
    console.log(`\n  Nothing found yet. Drop images into media/photos/<category>/ and run this again.`);
  }
  console.log('');
}

main();
