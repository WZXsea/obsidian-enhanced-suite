import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../../node_modules/esbuild/lib/main.js';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'citation-mobile-'));
try {
  const output = path.join(temporary, 'mobile.mjs');
  await build({ entryPoints: ['src/mobile.ts'], bundle: true, platform: 'node', format: 'esm', outfile: output, logLevel: 'silent' });
  const { popupPlacement: place, TouchTap } = await import(pathToFileURL(output).href);
  const anchor = { left: 300, top: 500, bottom: 520, width: 24 };
  const cases = [
    ['portrait', { left: 0, top: 0, width: 360, height: 740 }, false],
    ['keyboard', { left: 0, top: 0, width: 360, height: 280 }, true],
    ['panned keyboard', { left: 14, top: 210, width: 320, height: 250 }, true],
    ['landscape', { left: 0, top: 0, width: 740, height: 300 }, false],
    ['very narrow', { left: 0, top: 0, width: 180, height: 200 }, true],
    ['tiny visual viewport', { left: 0, top: 0, width: 24, height: 20 }, true],
  ];
  for (const [name, viewport, editing] of cases) {
    const result = place(viewport, anchor, 1000, editing);
    assert.ok(result.left >= viewport.left, name);
    assert.ok(result.top >= viewport.top, name);
    assert.ok(result.left + result.width <= viewport.left + viewport.width, name);
    assert.ok(result.top + result.maxHeight <= viewport.top + viewport.height, name);
    console.log(`PASS Visible viewport contains ${name} popup`);
  }
  const tap = new TouchTap();
  tap.begin(1, 100, 100); tap.move(1, 104, 104);
  assert.equal(tap.suppressed, false);
  tap.move(1, 100, 120); tap.move(1, 100, 100);
  assert.equal(tap.suppressed, true, 'scroll remains a drag even if pointer returns');
  tap.end(1); tap.begin(2, 100, 100); tap.move(3, 100, 200);
  assert.equal(tap.suppressed, false, 'other pointer has independent movement');
  tap.cancel(); assert.equal(tap.suppressed, true);
  tap.begin(4, 10, 10); assert.equal(tap.suppressed, false, 'next tap recovers');
  tap.end(4); tap.begin(5, 10, 10); tap.begin(6, 10, 10);
  assert.equal(tap.suppressed, true, 'second finger suppresses the whole gesture');
  tap.end(5); tap.end(6); tap.begin(7, 10, 10);
  assert.equal(tap.suppressed, false, 'single-finger tap recovers after both fingers lift');
  tap.move(7, 10, 80); tap.begin(7, 10, 10);
  assert.equal(tap.suppressed, false, 'reused pointer recovers after an outside release');
  console.log('PASS Touch tap, scroll, cancellation, pointer identity, multiple fingers and recovery');
} finally { await rm(temporary, { recursive: true, force: true }); }
