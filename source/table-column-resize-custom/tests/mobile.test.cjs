const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const {join} = require('node:path');
const context = vm.createContext({console});
vm.runInContext(readFileSync(join(__dirname, '../mobile-controls.js'), 'utf8'), context);
class Surface {
  constructor() { this.events = new Map(); this.classList = new Set(); this.classList.remove = this.classList.delete; }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
  removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
  emit(type, props = {}) { for (const fn of [...this.events.get(type) || []]) fn({type, button:0, isPrimary:true, pointerId:1, pointerType:'touch', clientX:100, clientY:20, preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}, ...props}); }
}
function fixture() {
  const doc = new Surface(), win = new Surface(), handle = new Surface();
  doc.defaultView = win; doc.body = new Surface(); handle.ownerDocument = doc; handle.closest = () => null;
  let saved = 0, id = 0;
  const frames = new Map();
  win.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  win.cancelAnimationFrame = id => frames.delete(id);
  handle.setPointerCapture = id => { handle.capture = id; };
  handle.hasPointerCapture = id => handle.capture === id;
  handle.releasePointerCapture = () => { handle.capture = null; };
  const cols = [{style:{width:'100px'}}, {style:{width:'150px'}}];
  const cells = cols.map(col => ({getBoundingClientRect:()=>({width:parseFloat(col.style.width)})}));
  const plugin = {settings:{minColumnWidth:50, columnWidths:{}}, debouncedSave:()=>saved++};
  const apply = (index, width) => { cols[index].style.width = `${width}px`; };
  context.attachDragBehavior(plugin, handle, cols, cells, 0, 'note::header', 2, apply);
  return {doc, win, handle, cols, plugin, saved:()=>saved};
}
test('Android column resize isolates primary pointer and commits last frame on cancellation', () => {
  const f = fixture();
  f.handle.emit('pointerdown');
  assert.equal(f.handle.capture, 1);
  f.doc.emit('pointermove', {pointerId:2, clientX:300});
  f.doc.emit('pointerup', {pointerId:2});
  assert.equal(f.saved(), 0);
  f.doc.emit('pointermove', {clientX:130});
  f.doc.emit('pointercancel');
  assert.equal(f.cols[0].style.width, '130px');
  assert.equal(f.plugin.settings.columnWidths['note::header::0'], 130);
  assert.equal(f.saved(), 1);
  assert.equal(f.doc.body.classList.has('tcr-resizing'), false);
  assert.equal(f.doc.events.get('pointermove').size, 0);
  assert.equal(f.plugin._tableDragCleanup.size, 0);
});
test('secondary touch is ignored and lost capture commits and clears drag', () => {
  const f = fixture();
  f.handle.emit('pointerdown', {isPrimary:false});
  assert.equal(f.handle.capture, undefined);
  f.handle.emit('pointerdown');
  f.doc.emit('pointermove', {clientX:20});
  f.handle.emit('lostpointercapture');
  assert.equal(f.cols[0].style.width, '50px');
  assert.equal(f.saved(), 1);
});
test('focus loss and plugin cleanup each remove drag listeners and flush pending width', () => {
  for (const ending of ['blur', 'unload']) {
    const f = fixture(); f.handle.emit('pointerdown'); f.doc.emit('pointermove', {clientX:140});
    if (ending === 'blur') f.win.emit('blur', {pointerId:undefined});
    else for (const finish of f.plugin._tableDragCleanup) finish();
    assert.equal(f.cols[0].style.width, '140px');
    assert.equal(f.doc.events.get('pointerup').size, 0);
    assert.equal(f.win.events.get('blur').size, 0);
    assert.equal(f.saved(), 1);
  }
});
test('popover clamping accounts for Android keyboard visual viewport offset and height', () => {
  const menu = {style:{}, offsetWidth:244, offsetHeight:180};
  const win = {innerWidth:400, innerHeight:800, visualViewport:{offsetLeft:12, offsetTop:40, width:360, height:280}};
  context.tcrPositionMenu(menu, {left:330, right:370, top:280, bottom:320, width:40}, win);
  assert.equal(menu.style.left, '120px');
  assert.equal(menu.style.top, '94px');
  assert.equal(menu.style.maxHeight, '264px');
  assert.equal(menu.style.maxWidth, '344px');
});
test('touch cell merge selection accepts taps and preserves scrolling and cancelled gestures', () => {
  const chosen = [], cell = {}, target = {closest:()=>cell};
  const select = context.tcrTapSelection(event => chosen.push(event.type));
  const event = (type, patch = {}) => select({type, pointerId:1, isPrimary:true, pointerType:'touch', clientX:10, clientY:20, target, ...patch});
  event('pointerdown'); assert.equal(chosen.length, 0);
  event('pointerup'); assert.deepEqual(chosen, ['pointerup']);
  event('pointerdown'); event('pointermove', {clientY:60}); event('pointerup');
  event('pointerdown'); event('pointercancel'); event('pointerup');
  assert.equal(chosen.length, 1);
  event('pointerdown', {pointerType:'mouse'}); assert.deepEqual(chosen, ['pointerup', 'pointerdown']);
});

function clipboardFixture(clipboard, execResult = true) {
  let electronLoads = 0, restored = 0, removed = 0, copied = 0;
  const input = {style:{}, setAttribute(){}, focus(){}, select(){}, setSelectionRange(){}, remove(){removed++;}};
  const doc = {body:{append(){}}, activeElement:{focus(){restored++;}}, createElement:()=>input, execCommand:()=>{copied++;return execResult;}};
  const win = {navigator:{clipboard}}; doc.defaultView = win;
  const ctx = vm.createContext({console, import_obsidian2:{Platform:{isDesktop:false}}, require:()=>{electronLoads++;throw Error('desktop dependency');}});
  vm.runInContext(readFileSync(join(__dirname, '../copy-table.js'), 'utf8'), ctx);
  vm.runInContext('getTableCopyContent = async () => ({markdown:"| 表格 |",html:"<table></table>"});', ctx);
  return {ctx, table:{ownerDocument:doc}, status:()=>({electronLoads, restored, removed, copied})};
}
test('Android uses text clipboard when rich ClipboardItem API is absent', async () => {
  let text;
  const f = clipboardFixture({writeText:async value=>{text=value;}});
  await f.ctx.copyTableContent({}, f.table);
  assert.equal(text, '| 表格 |');
  assert.equal(f.status().electronLoads, 0);
  assert.equal(f.status().copied, 0);
});
test('older WebView falls back to synchronous text copy and restores focus', async () => {
  const f = clipboardFixture({writeText:async()=>{throw Error('Unavailable');}});
  await f.ctx.copyTableContent({}, f.table);
  assert.deepEqual(f.status(), {electronLoads:0, restored:1, removed:1, copied:1});
});
test('unavailable clipboard reports a retryable error after cleaning temporary input', async () => {
  const f = clipboardFixture(undefined, false);
  await assert.rejects(f.ctx.copyTableContent({}, f.table), /剪贴板/);
  assert.equal(f.status().removed, 1);
  assert.equal(f.status().restored, 1);
});

test('percentage layouts preserve short fitted columns until the first pointer move', () => {
  const f = fixture();
  const table = {classList:{contains:name=>name === 'tcr-width-custom'}};
  f.handle.closest = () => table;
  f.cols[0].style.width = '35px'; f.cols[1].style.width = '35px';
  f.handle.emit('pointerdown');
  assert.equal(f.cols[0].style.width, '35px');
  assert.equal(f.cols[1].style.width, '35px');
  f.doc.emit('pointerup');
  assert.equal(f.cols[0].style.width, '35px');
  assert.equal(f.saved(), 1);
});
