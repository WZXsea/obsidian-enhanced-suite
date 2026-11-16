const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

function fixture() {
  const context = vm.createContext({console});
  vm.runInContext(readFileSync(join(__dirname, '../merge-gesture.js'), 'utf8'), context);
  const calls = [];
  let enabled = true;
  const record = kind => (point, event) => calls.push({kind, row:point.r, col:point.c, type:event.type});
  const gesture = context.tcrMergePointerSelection({enabled:() => enabled,pointAt:event => event.point,
    start:record('start'),extend:record('extend'),tap:record('tap')});
  const event = (type, point = {r:0,c:0}, properties = {}) => {
    const value = {type,point,button:0,buttons:type === 'pointerup' ? 0 : 1,pointerId:1,pointerType:'mouse',isPrimary:true,
      clientX:point?.c * 100 + 10 || 10,clientY:point?.r * 50 + 10 || 10,
      preventDefault() { this.defaultPrevented = true; },stopImmediatePropagation() { this.stopped = true; }, ...properties};
    gesture.handle(value); return value;
  };
  return {calls,event,gesture,disable:() => { enabled = false; }};
}

test('mouse selection follows the press and flushes the final release cell', () => {
  const f = fixture();
  const down = f.event('pointerdown',{r:0,c:0});
  f.event('pointermove',{r:0,c:1}); f.event('pointerup',{r:1,c:1});
  assert.equal(down.defaultPrevented, true); assert.equal(down.stopped, true);
  assert.deepEqual(f.calls, [
    {kind:'start',row:0,col:0,type:'pointerdown'},
    {kind:'extend',row:0,col:1,type:'pointermove'},
    {kind:'extend',row:1,col:1,type:'pointerup'},
  ]);
});

test('two mouse clicks reach the controller as two endpoints without a drag', () => {
  const f = fixture();
  f.event('pointerdown',{r:0,c:0}); f.event('pointerup',{r:0,c:0});
  f.event('pointerdown',{r:1,c:1}); f.event('pointerup',{r:1,c:1});
  assert.deepEqual(f.calls.map(({kind,row,col}) => ({kind,row,col})), [
    {kind:'start',row:0,col:0},{kind:'start',row:1,col:1},
  ]);
});

test('touch selection waits for a completed tap and leaves default scrolling available', () => {
  const f = fixture(), touch = {pointerType:'touch'};
  const down = f.event('pointerdown',{r:0,c:0},touch); assert.deepEqual(f.calls, []);
  f.event('pointerup',{r:0,c:0},touch);
  assert.equal(Boolean(down.defaultPrevented), false);
  assert.deepEqual(f.calls, [{kind:'tap',row:0,col:0,type:'pointerup'}]);
  f.event('pointerdown',{r:0,c:0},touch);
  const move = f.event('pointermove',{r:1,c:0},touch); f.event('pointerup',{r:1,c:0},touch);
  assert.equal(Boolean(move.defaultPrevented), false);
  assert.equal(f.calls.length, 1);
});

test('a second touch cancels the pending first-finger endpoint', () => {
  const f = fixture();
  f.event('pointerdown',{r:0,c:0},{pointerType:'touch'});
  f.event('pointerdown',{r:0,c:1},{pointerType:'touch',pointerId:2,isPrimary:false});
  f.event('pointerup',{r:0,c:1},{pointerType:'touch',pointerId:2,isPrimary:false});
  f.event('pointerup',{r:0,c:0},{pointerType:'touch'});
  assert.deepEqual(f.calls, []);
  f.event('pointerdown',{r:1,c:1},{pointerType:'touch'}); f.event('pointerup',{r:1,c:1},{pointerType:'touch'});
  assert.deepEqual(f.calls, [{kind:'tap',row:1,col:1,type:'pointerup'}]);
});

test('cancellation and rebind reset discard in-flight moves without committing another endpoint', () => {
  for (const end of ['pointercancel','reset']) {
    const f = fixture(); f.event('pointerdown',{r:0,c:0});
    if (end === 'reset') f.gesture.reset(); else f.event('pointercancel',{r:0,c:0});
    f.event('pointermove',{r:1,c:1}); f.event('pointerup',{r:1,c:1});
    assert.deepEqual(f.calls, [{kind:'start',row:0,col:0,type:'pointerdown'}]);
  }
});

test('inactive selection, secondary mouse buttons and foreign pointer updates do not alter the range', () => {
  const inactive = fixture(); inactive.disable();
  const event = inactive.event('pointerdown',{r:0,c:0});
  assert.deepEqual(inactive.calls, []); assert.equal(Boolean(event.defaultPrevented), false);
  const f = fixture(); f.event('pointerdown',{r:0,c:0},{button:2});
  assert.deepEqual(f.calls, []);
  f.event('pointerdown',{r:0,c:0});
  f.event('pointermove',{r:1,c:1},{pointerId:2}); f.event('pointerup',{r:1,c:1},{pointerId:2});
  assert.deepEqual(f.calls, [{kind:'start',row:0,col:0,type:'pointerdown'}]);
  f.event('pointerup',{r:1,c:1}); assert.equal(f.calls.at(-1).kind, 'extend');
});
