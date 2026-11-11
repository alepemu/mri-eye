#!/usr/bin/env node
// Import a hospital CD / Idonia export into footage/<group>/<exam>/<NN_SeriesDescription>/*.dcm.
// Only DICOM files with pixel data are kept; bundled viewers, DICOMDIR, dose/structured
// reports, autorun etc. are ignored.
//
// Usage: node scripts/import-cd.mjs <cd-folder> [--out footage] [--name <group>/<exam>] [--move]
//   --name  defaults to the study date and an exam label from the modality, e.g. 2026-04-15/MRI;
//           override it with any names, e.g. "2026-08-26 (MR Arthro)/MR arthrography"
//   --move  delete the source folder after a verified import (in-place re-imports do this too)

import fs from 'node:fs';
import path from 'node:path';

const LONG_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT', 'SV', 'UV']);
const WANT = {
  '00080018': 'SOPInstanceUID',
  '00080020': 'StudyDate',
  '00080060': 'Modality',
  '0008103e': 'SeriesDescription',
  '0020000e': 'SeriesInstanceUID',
  '00200011': 'SeriesNumber',
};
const IMPLICIT_LE = '1.2.840.10008.1.2';

// Minimal little-endian DICOM header reader: returns the top-level tags in WANT (plus
// hasPixelData), stepping over sequences (defined or undefined length) and stopping at pixel data.
export function readHeader(buf) {
  if (buf.length < 132 || buf.toString('latin1', 128, 132) !== 'DICM') return null;
  const out = {};
  let implicit = false;

  function walk(pos, end, depth) {
    while (pos + 8 <= end) {
      const g = buf.readUInt16LE(pos);
      const e = buf.readUInt16LE(pos + 2);
      if (g === 0xfffe) {
        const len = buf.readUInt32LE(pos + 4);
        pos += 8;
        if (e === 0xe00d || e === 0xe0dd) return pos; // item / sequence delimiter
        if (len === 0xffffffff) pos = walk(pos, end, depth + 1);
        else pos += len;
        continue;
      }
      // top-level pixel data only; icon images inside sequences don't count
      if (g === 0x7fe0 && e === 0x0010 && depth === 0) {
        out.hasPixelData = true;
        return end;
      }
      let len, hdr;
      if (g === 0x0002 || !implicit) {
        const vr = buf.toString('latin1', pos + 4, pos + 6);
        if (LONG_VRS.has(vr)) { len = buf.readUInt32LE(pos + 8); hdr = 12; }
        else { len = buf.readUInt16LE(pos + 6); hdr = 8; }
      } else {
        len = buf.readUInt32LE(pos + 4); hdr = 8;
      }
      pos += hdr;
      if (len === 0xffffffff) { pos = walk(pos, end, depth + 1); continue; }
      if (depth === 0) {
        const key = g.toString(16).padStart(4, '0') + e.toString(16).padStart(4, '0');
        const value = () => buf.toString('latin1', pos, pos + len).replace(/\0/g, '').trim();
        if (WANT[key]) out[WANT[key]] = value();
        if (key === '00020010') implicit = value() === IMPLICIT_LE;
      }
      pos += len;
    }
    return pos;
  }

  walk(132, buf.length, 0);
  return out;
}

function hasDicmMagic(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(4);
    return fs.readSync(fd, b, 0, 4, 128) === 4 && b.toString('latin1') === 'DICM';
  } finally {
    fs.closeSync(fd);
  }
}

function* walkFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(p);
    else if (entry.isFile()) yield p;
  }
}

const sanitize = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const EXAM_LABELS = { MR: 'MRI', DX: 'XRAY', CR: 'XRAY', XA: 'Fluoroscopy', RF: 'Fluoroscopy', CT: 'CT', US: 'Ultrasound' };

// "<YYYY-MM-DD>/<exam>" from the study date and the most common modality among the images
function defaultName(headers) {
  const count = (key) => {
    const n = new Map();
    for (const h of headers) if (h[key]) n.set(h[key], (n.get(h[key]) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  };
  const [date] = count('StudyDate');
  const modalities = count('Modality');
  if (modalities.length > 1) console.warn(`  mixed modalities ${modalities.join(', ')}; naming after ${modalities[0]}`);
  const day = /^\d{8}$/.test(date ?? '') ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : 'undated';
  const exam = EXAM_LABELS[modalities[0]] ?? (modalities[0] || 'Study');
  return `${day}/${exam}`;
}

function parseArgs(argv) {
  const args = { out: 'footage', move: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--name') args.name = argv[++i];
    else if (argv[i] === '--move') args.move = true;
    else rest.push(argv[i]);
  }
  if (rest.length !== 1) {
    console.error('Usage: node scripts/import-cd.mjs <cd-folder> [--out footage] [--name <group>/<exam>] [--move]');
    process.exit(1);
  }
  args.src = path.resolve(rest[0]);
  return args;
}

function main() {
  const { src, out, name: nameArg, move } = parseArgs(process.argv.slice(2));

  // Collect images grouped by series.
  const series = new Map();
  const headers = [];
  const seen = new Set();
  let scanned = 0;
  for (const file of walkFiles(src)) {
    scanned++;
    if (!hasDicmMagic(file)) continue;
    const h = readHeader(fs.readFileSync(file));
    if (!h?.hasPixelData) continue; // DICOMDIR, structured/dose reports, etc.
    if (h.SOPInstanceUID && seen.has(h.SOPInstanceUID)) continue;
    seen.add(h.SOPInstanceUID);
    headers.push(h);
    const key = h.SeriesInstanceUID || path.dirname(file);
    if (!series.has(key)) series.set(key, { header: h, files: [] });
    series.get(key).files.push(file);
  }
  if (series.size === 0) throw new Error(`No DICOM images found in ${src}`);

  const name = nameArg ?? defaultName(headers);
  const target = path.resolve(out, name);
  const inPlace = target === src;
  const removeSource = move || inPlace;
  if (fs.existsSync(target) && !inPlace) throw new Error(`Target already exists: ${target} (pick another --name)`);
  if (removeSource && target.startsWith(src + path.sep)) {
    throw new Error(`Target ${target} is inside the source folder, which --move would delete`);
  }
  // staging sits next to the target so the final step is a same-folder rename
  const staging = path.join(path.dirname(target), `.${path.basename(target)}.importing`);
  fs.rmSync(staging, { recursive: true, force: true });

  // Copy into staging as NN_Description/, ordered by series number.
  const ordered = [...series.values()].sort(
    (a, b) => (Number(a.header.SeriesNumber) || 0) - (Number(b.header.SeriesNumber) || 0),
  );
  let copied = 0;
  ordered.forEach((s, i) => {
    const label = sanitize(s.header.SeriesDescription || '') || sanitize(s.header.Modality || '') || 'series';
    const dir = path.join(staging, `${String(i + 1).padStart(2, '0')}_${label}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of s.files) {
      // CDs often use extensionless names ("00000001"); the viewer lists *.dcm only
      const base = path.basename(file);
      const fileName = base.toLowerCase().endsWith('.dcm') ? base : `${base}.dcm`;
      let dest = path.join(dir, fileName);
      if (fs.existsSync(dest)) dest = path.join(dir, `${copied}_${fileName}`);
      fs.copyFileSync(file, dest);
      if (fs.statSync(dest).size !== fs.statSync(file).size) throw new Error(`Size mismatch copying ${file}`);
      copied++;
    }
    console.log(`  ${path.basename(dir)}  (${s.files.length} images)`);
  });

  const total = ordered.reduce((n, s) => n + s.files.length, 0);
  if (copied !== total) throw new Error(`Copied ${copied} of ${total} images; source left untouched`);
  console.log(`${name}: ${total} images in ${ordered.length} series (scanned ${scanned} files)`);

  if (removeSource) fs.rmSync(src, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 });
  renameWithRetry(staging, target);
  console.log(`-> ${target}${removeSource ? ' (source removed)' : ''}`);
}

// Windows refuses renames while a folder is still being deleted or is watched/open elsewhere
// (Explorer, a dev server watcher), so retry for a few seconds before giving up.
function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return fs.renameSync(from, to);
    } catch (err) {
      if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
      if (attempt === 15) {
        throw new Error(`Could not rename ${from} -> ${to} (${err.code}); the images are safe in ${from}. ` +
          'Close anything that has the folder open and rename it by hand.');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
  }
}

main();
