const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

class Surface {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler, options) {
    const capture = options === true || Boolean(options?.capture);
    const list = this.listeners.get(type) || [];
    if (!list.some(item => item.handler === handler && item.capture === capture)) list.push({handler, capture});
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler, options) {
    const capture = options === true || Boolean(options?.capture);
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.handler !== handler || item.capture !== capture));
  }
  emit(type, properties = {}) {
    const event = {type, target:this, button:0, buttons:type === 'pointerup' ? 0 : 1, pointerId:1, pointerType:'mouse', isPrimary:true, clientX:10, clientY:10,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
      stopImmediatePropagation() { this.stopped = this.immediate = true; }, ...properties};
    const path = []; for (let node = event.target; node; node = node.parentNode) path.push(node);
    const dispatch = (node, capture) => {
      event.currentTarget = node;
      for (const item of [...node.listeners?.get(type) || []]) {
        if (item.capture === capture) item.handler(event);
        if (event.immediate) break;
      }
    };
    for (const node of path.toReversed()) { dispatch(node, true); if (event.stopped) return event; }
    for (const node of path) { dispatch(node, false); if (event.stopped) break; }
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((count, items) => count + items.length, 0); }
}

class TextNode {
  constructor(value, doc) { this.nodeType = 3; this.textContent = value; this.ownerDocument = doc; }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this); this.parentNode = this.parentElement = null; }
  cloneNode() { return new TextNode(this.textContent, this.ownerDocument); }
}

class Element extends Surface {
  constructor(tag, doc) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.childNodes = []; this.dataset = {}; this.attributes = new Map();
    this.className = ''; this.textContent = ''; this.disabled = this.hidden = false; this.offsetWidth = 240; this.offsetHeight = 180;
    const classes = () => new Set(this.className.split(/\s+/).filter(Boolean));
    this.classList = {
      contains:name => classes().has(name),
      add:(...names) => { this.className = [...new Set([...classes(), ...names])].join(' '); },
      remove:(...names) => { this.className = [...classes()].filter(name => !names.includes(name)).join(' '); },
      toggle:(name, force) => { const value = force ?? !classes().has(name); this.classList[value ? 'add' : 'remove'](name); return value; },
    };
    const styles = new Map();
    this.style = {setProperty:(key,value,priority='') => styles.set(key,{value,priority}),getPropertyValue:key => styles.get(key)?.value || '',getPropertyPriority:key => styles.get(key)?.priority || '',removeProperty:key => styles.delete(key)};
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  append(...nodes) { for (const node of nodes) { node.remove?.(); node.parentNode = node.parentElement = this; this.childNodes.push(node); } }
  appendChild(node) { this.append(node); return node; }
  insertBefore(node, before) { this.append(node); if (before) { this.childNodes.pop(); this.childNodes.splice(this.childNodes.indexOf(before), 0, node); } }
  replaceChildren(...nodes) { for (const node of [...this.childNodes]) node.remove(); this.append(...nodes); }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this); this.parentNode = this.parentElement = null; }
  contains(node) { return node === this || this.childNodes.some(child => child === node || child.contains?.(node)); }
  matches(selector) { return selector.split(',').some(part => { const value = part.trim(); return value.startsWith('.') ? value.slice(1).split('.').every(name => this.classList.contains(name)) : value.toUpperCase() === this.tagName; }); }
  closest(selector) { for (let node = this; node?.matches; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(...(String(value) ? [new TextNode(String(value), this.ownerDocument)] : [])); }
  cloneNode(deep = false) {
    const clone = new Element(this.tagName, this.ownerDocument); clone.className = this.className;
    clone.attributes = new Map(this.attributes); clone.dataset = {...this.dataset};
    if (deep) for (const child of this.childNodes) clone.append(child.cloneNode(true));
    return clone;
  }
  set innerHTML(value) {
    this.replaceChildren();
    for (const item of value.matchAll(/<(button|p|div)[^>]*class="([^"]+)"[^>]*>([^<]*)<\/\1>/g)) {
      const child = new Element(item[1], this.ownerDocument); child.className = item[2]; child.textContent = item[3]; this.append(child);
    }
  }
  get rows() { return this.querySelectorAll('tr'); }
  get cells() { return this.children.filter(child => child.matches('td, th')); }
  get rowIndex() { return this.closest('table').rows.indexOf(this); }
  get cellIndex() { return this.parentElement.cells.indexOf(this); }
  get colSpan() { return Number(this.getAttribute('colspan') || 1); }
  set colSpan(value) { this.setAttribute('colspan', value); }
  get rowSpan() { return Number(this.getAttribute('rowspan') || 1); }
  set rowSpan(value) { this.setAttribute('rowspan', value); }
  get isConnected() { return Boolean(this.parentNode?.isConnected); }
  getBoundingClientRect() { return this.rect || {left:0, top:0, right:300, bottom:160, width:300, height:160}; }
  focus() { this.ownerDocument.activeElement = this; }
  setPointerCapture(id) { this.pointer = id; }
  hasPointerCapture(id) { return this.pointer === id; }
  releasePointerCapture() { this.pointer = null; }
}

function fixture({source = false} = {}) {
  const doc = new Surface(), win = new Surface(); doc.defaultView = win; doc.isConnected = true; doc.children = [];
  doc.body = new Element('body', doc); doc.body.parentNode = doc; doc.children.push(doc.body);
  doc.createElement = tag => new Element(tag, doc);
  win.innerWidth = 1200; win.innerHeight = 900; win.matchMedia = () => ({matches:true});
  win.requestAnimationFrame = fn => { fn(); return 1; }; win.cancelAnimationFrame = () => {};
  win.getSelection = () => ({removeAllRanges() {}});
  const root = new Element('div', doc); root.className = source ? 'markdown-source-view' : 'markdown-preview-view'; doc.body.append(root);
  const createTable = () => {
    const table = new Element('table', doc), body = new Element('tbody', doc); table.append(body);
    for (let r = 0; r < 2; r++) {
      const row = new Element('tr', doc); body.append(row);
      for (let c = 0; c < 3; c++) {
        const cell = new Element('td', doc); cell.textContent = c < 2 ? '相同' : '其他';
        cell.rect = {left:c * 100, top:r * 50, right:c * 100 + 100, bottom:r * 50 + 50, width:100, height:50}; row.append(cell);
      }
    }
    root.append(table); return table;
  };
  let table = createTable();
  doc.elementFromPoint = (x, y) => table.rows[Math.floor(y / 50)]?.cells[Math.floor(x / 100)] || doc.body;
  const toolbar = new Element('div', doc), font = new Element('button', doc); font.className = 'tcr-font-button'; toolbar.append(font); root.append(toolbar);
  let saved = 0;
  const plugin = {settings:{tableMerges:{}},debouncedSave() { saved++; }};
  const context = vm.createContext({console,import_obsidian2:{setIcon() {}},tcrMergeIdentity:(_plugin, current) => current.mergeKey || 'fixture.md::header::table:0'});
  for (const file of ['mobile-controls.js', 'merge-gesture.js', 'merge-render.js', 'merge-control.js']) {
    const path = join(__dirname, '..', file);
    vm.runInContext(readFileSync(path, 'utf8'), context);
  }
  const control = context.setupTableMerge(plugin, table, 'fixture.md::header', toolbar);
  const menu = () => doc.body.querySelector('.tcr-merge-menu');
  const button = () => menu().querySelector('.tcr-merge-apply');
  const selected = () => table.rows.flatMap(row => row.cells).filter(cell => cell.classList.contains('tcr-merge-selected'));
  const cell = (r, c) => table.rows[r].cells[c];
  const point = (type, r, c, props = {}) => { const target = cell(r,c); return target.emit(type,{clientX:c*100+20,clientY:r*50+20,...props}); };
  const tap = (r,c,props) => { point('pointerdown',r,c,props); point('pointerup',r,c,props); };
  const open = (explicit = false) => { control.button.emit('click'); if (explicit) menu().querySelector('.tcr-merge-pick').emit('click'); };
  return {doc,win,plugin,control,menu,button,selected,cell,point,tap,open,saved:() => saved,
    get table() { return table; },
    replace(key) { const old = table; table = createTable(); table.mergeKey = key; old.remove(); control.rebind(table); return old; },
  };
}

test('a tall table keeps its merge menu above the trigger when upper space is available', () => {
  const f = fixture();
  f.control.button.rect = {left:849, top:404, right:875, bottom:424, width:26, height:20};
  f.table.rect = {left:176, top:442, right:941, bottom:1600, width:765, height:1158};
  f.open();
  assert.equal(parseFloat(f.menu().style.top) + f.menu().offsetHeight, 398);
  assert.equal(parseFloat(f.menu().style.left), 635);
});

test('a merge trigger near the visual viewport top opens directly below it', () => {
  const f = fixture();
  f.win.visualViewport = {offsetLeft:12, offsetTop:40, width:360, height:500,addEventListener(){},removeEventListener(){}};
  f.control.button.rect = {left:290, top:60, right:316, bottom:84, width:26, height:24};
  f.table.rect = {left:50, top:100, right:350, bottom:1200, width:300, height:1100};
  f.open();
  assert.equal(parseFloat(f.menu().style.top), 90);
  assert.equal(parseFloat(f.menu().style.left), 76);
});

test('selection status height changes retain the menu gap to its trigger', () => {
  const f = fixture();
  f.control.button.rect = {left:849, top:404, right:875, bottom:424, width:26, height:20};
  f.open(); f.menu().offsetHeight = 220; f.tap(0,0);
  assert.equal(parseFloat(f.menu().style.top) + f.menu().offsetHeight, 398);
});

test('opening the merge menu immediately enables cell selection', () => {
  const f = fixture(); f.open();
  assert.equal(f.table.classList.contains('tcr-merge-picking'), true);
  assert.equal(f.control.renderer.suspended, true); assert.equal(f.button().disabled, true);
  f.tap(0,0); f.tap(1,1);
  assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
});

test('two endpoint clicks select and merge the same-content rectangle through the real controller', () => {
  const f = fixture(); f.open(true); f.tap(0,0);
  assert.equal(f.selected().length, 1); assert.equal(f.button().disabled, true);
  f.tap(1,1); assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
  f.button().emit('click');
  assert.equal(f.cell(0,0).colSpan, 2); assert.equal(f.cell(0,0).rowSpan, 2);
  assert.equal(f.cell(1,1).classList.contains('tcr-merge-covered'), true);
  assert.deepEqual(f.table.rows.map(row => row.cells.map(cell => cell.textContent)), [['相同','相同','其他'],['相同','相同','其他']]);
  assert.equal(f.saved(), 1);
});

test('a mouse drag previews and commits the rectangle on release', () => {
  const f = fixture(); f.open(true);
  f.point('pointerdown',0,0); f.point('pointermove',0,1); f.point('pointermove',1,1); f.point('pointerup',1,1);
  assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
  f.button().emit('click'); assert.equal(f.cell(0,0).rowSpan, 2); assert.equal(f.saved(), 1);
});

test('replacing a live table retains the first endpoint and binds selection to the replacement', () => {
  const f = fixture(); f.open(true); f.tap(0,0); const old = f.replace();
  assert.equal(old.listenerCount(), 0); assert.equal(f.table.classList.contains('tcr-merge-picking'), true);
  f.tap(1,1); assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
});

test('reusing a controller for a different table clears its previous endpoints while retaining selection mode', () => {
  for (const completed of [false,true]) {
    const f = fixture(); f.open(true); f.tap(0,0); if (completed) f.tap(1,1);
    f.replace('fixture.md::header::table:1');
    assert.equal(f.table.classList.contains('tcr-merge-picking'), true);
    assert.equal(f.selected().length, 0); assert.equal(f.button().disabled, true);
    f.tap(1,1); assert.equal(f.selected().length, 1); assert.equal(f.button().disabled, true);
    f.tap(0,0); assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
    f.button().emit('click');
    assert.deepEqual(Object.keys(f.plugin.settings.tableMerges), ['fixture.md::header::table:1']);
  }
});

test('closing and destroying during selection clear highlights, selection listeners and suspended layout', () => {
  for (const action of ['escape','destroy']) {
    const f = fixture(); f.open(true); f.point('pointerdown',0,0); f.point('pointermove',1,1);
    if (action === 'escape') f.doc.emit('keydown',{key:'Escape'}); else f.control.destroy();
    assert.equal(f.menu(), null); assert.equal(f.selected().length, 0); assert.equal(f.table.classList.contains('tcr-merge-picking'), false);
    assert.equal(f.control.renderer.suspended, false); assert.equal(f.doc.listenerCount(), 0); assert.equal(f.win.listenerCount(), 0);
    assert.equal(f.saved(), 0);
  }
});

test('a different-content rectangle stays in selection mode with merge disabled', () => {
  const f = fixture(); f.open(true); f.tap(0,0); f.tap(1,2);
  assert.equal(f.button().disabled, true); assert.equal(f.table.classList.contains('tcr-merge-picking'), true);
  assert.equal(f.saved(), 0); assert.deepEqual(Object.keys(f.plugin.settings.tableMerges), []);
});

test('one filled cell can expand into empty neighbors while clearing restores every original cell', () => {
  const f = fixture();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) f.cell(r,c).textContent = '';
  f.cell(0,0).textContent = '已有内容';
  const original = f.table.rows.map(row => row.cells.map(cell => cell.textContent));
  f.open(true); f.tap(0,0); f.tap(1,1); assert.equal(f.button().disabled, false);
  f.button().emit('click'); assert.equal(f.cell(0,0).colSpan, 2); assert.equal(f.cell(0,0).rowSpan, 2);
  assert.equal(f.cell(0,0).textContent, '已有内容');
  f.menu().querySelector('.tcr-merge-clear').emit('click');
  assert.deepEqual(f.table.rows.map(row => row.cells.map(cell => cell.textContent)), original);
  assert.equal(f.cell(0,0).colSpan, 1); assert.equal(f.cell(0,0).rowSpan, 1);
});

test('content away from the anchor remains visible after merge and returns to its original cell for editing', () => {
  const f = fixture({source:true});
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) f.cell(r,c).textContent = '';
  f.cell(1,1).textContent = '末格内容';
  const original = f.table.rows.map(row => row.cells.map(cell => cell.textContent));
  f.open(true); f.tap(0,0); f.tap(1,1); assert.equal(f.button().disabled, false); f.button().emit('click');
  assert.equal(f.cell(0,0).textContent.trim(), '末格内容');
  f.menu().querySelector('.tcr-merge-edit').emit('click');
  assert.deepEqual(f.table.rows.map(row => row.cells.map(cell => cell.textContent)), original);
  assert.equal(f.cell(0,0).rowSpan, 1); assert.equal(f.cell(1,1).classList.contains('tcr-merge-covered'), false);
  f.menu().querySelector('.tcr-merge-edit').emit('click');
  assert.equal(f.cell(0,0).rowSpan, 2); assert.equal(f.cell(0,0).textContent.trim(), '末格内容');
  f.menu().querySelector('.tcr-merge-clear').emit('click');
  assert.deepEqual(f.table.rows.map(row => row.cells.map(cell => cell.textContent)), original);
  assert.equal(f.cell(0,0).colSpan, 1); assert.equal(f.cell(0,0).rowSpan, 1);
});

test('an all-empty rectangle remains mergeable', () => {
  const f = fixture();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) f.cell(r,c).textContent = '';
  f.open(true); f.tap(0,0); f.tap(1,1); assert.equal(f.button().disabled, false); f.button().emit('click');
  assert.equal(f.cell(0,0).colSpan, 2); assert.equal(f.cell(0,0).rowSpan, 2); assert.equal(f.cell(0,0).textContent, '');
});

test('non-anchor rich content retains its nodes and click behavior across merge and restore', () => {
  const f = fixture();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) f.cell(r,c).textContent = '';
  const link = new Element('a', f.doc); link.textContent = '来源链接'; let clicks = 0;
  link.addEventListener('click', () => clicks++); f.cell(1,1).append(link);
  f.open(true); f.tap(0,0); f.tap(1,1); f.button().emit('click');
  assert.equal(f.cell(0,0).querySelector('a'), link); link.emit('click'); assert.equal(clicks, 1);
  f.menu().querySelector('.tcr-merge-clear').emit('click');
  assert.equal(f.cell(0,0).textContent, ''); assert.equal(f.cell(1,1).querySelector('a'), link);
  link.emit('click'); assert.equal(clicks, 2); assert.equal(f.cell(1,1).textContent, '来源链接');
});

test('touch scrolling and a second finger leave merge ranges unselected', () => {
  const f = fixture(); f.open(true);
  f.point('pointerdown',0,0,{pointerType:'touch'}); f.point('pointermove',1,0,{pointerType:'touch'}); f.point('pointerup',1,0,{pointerType:'touch'});
  assert.equal(f.selected().length, 0);
  f.point('pointerdown',0,0,{pointerType:'touch'}); f.point('pointerdown',0,1,{pointerType:'touch',pointerId:2,isPrimary:false});
  f.point('pointerup',0,1,{pointerType:'touch',pointerId:2,isPrimary:false}); f.point('pointerup',0,0,{pointerType:'touch'});
  assert.equal(f.selected().length, 0); assert.equal(f.button().disabled, true); assert.equal(f.saved(), 0);
  f.tap(0,0,{pointerType:'touch'}); f.tap(1,1,{pointerType:'touch'});
  assert.equal(f.selected().length, 4); assert.equal(f.button().disabled, false);
});
