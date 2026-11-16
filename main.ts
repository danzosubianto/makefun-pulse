// Pulse — hand-in program for makefun-frontend-01 (Node 22, stdlib only).
//
// The entry itself is the static frontend in app/: plain HTML, ES modules and
// CSS with no build step, reading make.fun's public API from the browser.
// This program's whole job is the hand-in: copy app/ and screenshots/ from
// beside this file into the output directory, then write dossier.json there
// with the vendored make.fun library, which summarises the app for the judge
// (screenshots, the first load's files and bytes, and the source outline).
//
// The caps passed to buildDossier are the scorer's own limits, so a clean run
// here means the entry is inside every gate: at most 3 screenshots of at most
// 256 KiB each, at most 993 files and directories in app/, at most 16 MiB of
// app files. vendor/makefun-frontend.ts must stay byte-for-byte the kit's
// library — the scorer requires dossier.json to be exactly what its own copy
// of the library writes.
//
// Run locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });

const shotsDir = join(here, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
