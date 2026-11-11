const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const {join} = require('node:path');
const context = vm.createContext({console});
vm.runInContext(readFileSync(join(__dirname, '../auto-fit.js'), 'utf8'), context);
const fit = (...args) => Array.from(context.tcrFitColumnWidths(...args));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
test('short tables keep measured widths and leave no distributed blank space', () => {
  assert.deepEqual(fit([40, 70, 130], [40, 50, 50], 800), [40, 70, 130]);
});
test('long text absorbs compression while short ID columns keep their content widths', () => {
  const result = fit([45, 1000, 300], [45, 50, 50], 600);
  near(result[0], 45); near(result[1], 277.5); near(result[2], 277.5);
  near(result.reduce((a, b) => a + b), 600);
});
test('minimum widths for wide content are respected when the viewport permits', () => {
  const result = fit([40, 500, 800], [40, 300, 50], 550);
  near(result[0], 40); near(result[1], 300); near(result[2], 210);
});
test('many columns scale their minimums into a narrow viewport', () => {
  const result = fit([100, 100, 100, 100], [50, 50, 50, 50], 120);
  result.forEach(value => near(value, 30));
});
test('zero budgets, missing columns, invalid values and fractional widths remain finite', () => {
  assert.deepEqual(fit([], [], 400), []);
  assert.deepEqual(fit([100, 200], [40, 50], 0), [0, 0]);
  assert.deepEqual(fit([NaN, Infinity, -5, 20], [], 400), [0, 0, 0, 20]);
  assert.deepEqual(fit([10, 20], [20, 30], Infinity), [0, 0]);
  const result = fit([45.5, 100.25], [10, 10], 100.75);
  near(result[0], 45.5); near(result[1], 55.25);
});
test('water filling is invariant to column order and never expands short columns', () => {
  const input = [24, 56, 130, 370, 900], minimums = [24, 40, 50, 50, 50];
  const forward = fit(input, minimums, 700);
  const reversed = fit(input.toReversed(), minimums.toReversed(), 700).toReversed();
  forward.forEach((value, index) => { near(value, reversed[index]); assert.ok(value <= input[index]); });
  near(forward.reduce((a, b) => a + b), 700);
});
test('empty and invisible table budgets skip cloning', () => {
  const table = {ownerDocument:{defaultView:{}}, rows:[]};
  assert.deepEqual(JSON.parse(JSON.stringify(context.tcrMeasureAutoFit(table, 800))), {widths:[], total:0, widthPercent:0});
  table.rows = [{cells:[{colSpan:1}]}];
  assert.equal(context.tcrMeasureAutoFit(table, 0).total, 0);
});

test('measurement cleanup preserves visible citation buttons and removes editor duplicates', () => {
  class Node {
    constructor(tag, classes = [], id = null) { this.tag = tag; this.classes = classes; this.id = id; this.removed = false; }
    matches(selector) {
      if (selector === '[id]') return this.id !== null;
      return selector.startsWith('.') ? this.classes.includes(selector.slice(1)) : this.tag === selector;
    }
    remove() { this.removed = true; }
    removeAttribute(name) { if (name === 'id') this.id = null; }
  }
  const citation = new Node('button', ['citation-badge-button'], 'citation-1');
  const customVisibleButton = new Node('button', ['inline-content-button']);
  const hiddenCitation = new Node('span', ['citation-native-reference']);
  const editorCopy = new Node('div', ['table-cell-input']);
  const handle = new Node('div', ['tcr-handle']);
  const source = [citation, customVisibleButton, hiddenCitation, editorCopy, handle];
  const clone = {querySelectorAll: selector => source.filter(node => !node.removed && selector.split(',').some(part => node.matches(part.trim())))};
  context.tcrCleanAutoFitClone(clone);
  assert.equal(citation.removed, false);
  assert.equal(customVisibleButton.removed, false);
  assert.equal(citation.id, null);
  for (const removed of [hiddenCitation, editorCopy, handle]) assert.equal(removed.removed, true);
});

test('active cell measurements use current editor lines and retain explicit line breaks', () => {
  const contents = {textContent:'old readonly text', querySelectorAll: () => [{textContent:'正在编辑的新文字'}, {textContent:'第二行'}]};
  const editor = {querySelector: () => contents};
  const cell = {querySelector: selector => selector === '.cm-editor' ? editor : null};
  assert.equal(context.tcrAutoFitEditingText(cell), '正在编辑的新文字\n第二行');
  contents.querySelectorAll = () => [];
  contents.textContent = '';
  assert.equal(context.tcrAutoFitEditingText(cell), '');
  assert.equal(context.tcrAutoFitEditingText({querySelector:()=>null}), null);
});
