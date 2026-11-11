import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { build } from '../../node_modules/esbuild/lib/main.js';
const require = createRequire(import.meta.url);
const runtime = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.CITATION_PLAYWRIGHT_PATH ?? runtime); }
const chrome = process.env.CITATION_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let executablePath;
try { await access(chrome); executablePath = chrome; } catch { /* Use Playwright's installed Chromium. */ }
const bundle = await build({ entryPoints: ['src/popup-editor.ts'], bundle: true, format: 'iife', globalName: 'CitationPopup',
  write: false, platform: 'browser', plugins: [{ name: 'mobile-public-api-fixture', setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const Component = window.TestComponent;
      export const Platform = { isMobile: true };
      export const MarkdownRenderer = { async render(app, value, root) { root.textContent = value; } };
    ` }));
    build.onResolve({ filter: /^\.\/embedded-editor$/ }, () => ({ path: 'native', namespace: 'desktop' }));
    build.onLoad({ filter: /.*/, namespace: 'desktop' }, () => ({ contents: 'export function createEmbeddedEditor() { throw new Error("Desktop editor accessed during mobile test"); }' }));
  } }], logLevel: 'silent' });
const browser = await playwright.chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await page.setContent('<div id="rows"></div>');
  await page.evaluate(() => {
    HTMLElement.prototype.createDiv = function(options = {}) { return this.createEl('div', options); };
    HTMLElement.prototype.createEl = function(tag, options = {}) {
      const element = this.ownerDocument.createElement(tag);
      if (options.cls) element.className = options.cls;
      if (options.text) element.textContent = options.text;
      Object.entries(options.attr ?? {}).forEach(([key, value]) => element.setAttribute(key, value));
      this.append(element); return element;
    };
    HTMLElement.prototype.empty = function() { this.replaceChildren(); };
    window.TestComponent = class {
      cleanups = []; children = [];
      register(action) { this.cleanups.push(action); }
      registerDomEvent(target, event, action, options) {
        target.addEventListener(event, action, options);
        this.register(() => target.removeEventListener(event, action, options));
      }
      addChild(child) { this.children.push(child); return child; }
      removeChild(child) { this.children = this.children.filter(value => value !== child); child.unload(); return child; }
      unload() { this.children.slice().forEach(child => this.removeChild(child)); this.cleanups.splice(0).reverse().forEach(action => action()); }
    };
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    window.saves = []; window.contents = ['来源甲', '来源乙']; window.component = new window.TestComponent();
    window.editors = []; let editing = false;
    for (let index = 0; index < 2; index++) {
      const row = document.getElementById('rows').createDiv({ cls: `row row-${index}` });
      const editor = new window.CitationPopup.PopupContentEditor(row, window.contents[index], index + 1, window.component, {
        app: {}, path: 'fixture.md', read: async () => window.contents[index], changed() {},
        requestEditing() { if (!editing) { editing = true; window.editors.forEach(editor => editor.setEditing(true)); } },
        async save(expected, draft) {
          if (window.contents[index] !== expected) throw new Error('Expected body mismatch');
          window.contents[index] = draft; window.saves.push({ index, draft }); return draft;
        }
      });
      window.editors.push(editor);
    }
  });
  const state = async () => page.evaluate(() => [...document.querySelectorAll('textarea')].map(input => ({ hidden: input.hidden, value: input.value })));
  assert.deepEqual((await state()).map(input => input.hidden), [true, true]);
  await page.locator('.row-0 .citation-mobile-edit').click();
  assert.equal((await state())[0].hidden, false);
  await page.locator('.row-0 textarea').evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '来源甲：中文组词'; input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
  });
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.saves.length), 0, 'composition remains in the draft');
  await page.locator('.row-0 textarea').evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.contents[0]), '来源甲：中文组词');
  console.log('PASS Mobile preview, edit and Chinese composition save');
  await page.locator('.row-0 .citation-mobile-edit').click();
  assert.equal((await state())[0].hidden, true);
  await page.locator('.row-0 .citation-mobile-preview').click();
  assert.equal((await state())[0].hidden, false, 'preview text reopens after global editing starts');
  await page.locator('.row-1 .citation-mobile-edit').click();
  assert.equal((await state())[1].hidden, true);
  await page.locator('.row-1 .citation-mobile-preview').click();
  await page.locator('.row-1 textarea').fill('来源乙：第二轮');
  await page.locator('.row-0 textarea').fill('来源甲：第三轮');
  await page.evaluate(() => Promise.all(window.editors.map(editor => editor.flush())));
  assert.deepEqual(await page.evaluate(() => window.contents), ['来源甲：第三轮', '来源乙：第二轮']);
  console.log('PASS Two reference rows repeatedly preview, edit and flush independent bodies');
  await page.locator('.row-0 .citation-mobile-edit').click();
  await page.locator('.row-0 .citation-mobile-preview').evaluate(preview => {
    const pointer = (type, pointerId, clientY) => preview.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, pointerType: 'touch', clientX: 40, clientY }));
    pointer('pointerdown', 1, 40); pointer('pointerdown', 2, 40);
    pointer('pointerup', 1, 40); pointer('pointerup', 2, 40);
    preview.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  assert.equal((await state())[0].hidden, true, 'multi-touch does not open the editor');
  await page.locator('.row-0 .citation-mobile-preview').evaluate(preview => {
    const pointer = (type, clientY) => preview.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: 40, clientY }));
    pointer('pointerdown', 40); pointer('pointermove', 80); pointer('pointerup', 80);
    preview.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  assert.equal((await state())[0].hidden, true, 'scroll does not open the editor');
  await page.locator('.row-0 .citation-mobile-preview').click();
  assert.equal((await state())[0].hidden, false, 'new pointer resets touch suppression');
  console.log('PASS Passive pointer handlers suppress multiple fingers and scrolling, then recover');
  await page.locator('.row-0 textarea').fill('关闭前最终正文');
  await page.evaluate(async () => { await Promise.all(window.editors.map(editor => editor.flush())); window.component.unload(); });
  assert.equal(await page.evaluate(() => window.contents[0]), '关闭前最终正文');
  assert.equal(await page.locator('.citation-mobile-input').count(), 0);
  console.log('PASS Close flush saves final input and unload releases editor DOM');
} finally { await browser.close(); }
