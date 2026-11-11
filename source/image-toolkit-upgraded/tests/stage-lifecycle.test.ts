import test from 'node:test';
import assert from 'node:assert/strict';
import {StageRegistry,isStageRootMounted,canReuseStageRender,pickStageSource,PaneTimers} from '../src/stage-lifecycle';
import {extractImages} from '../src/images';

function pane(path:string,focused:boolean,body='![[native.png]]\n\n图注\n![B](https://host/b.png)\n'){
  return {path,body,containerEl:{ownerDocument:{hasFocus:()=>focused}}};
}

test('opening and closing a background fixture retains the user pane navigation and native image order',()=>{
  const user=pane('User.md',true),qa=pane('Fixture.md',false);
  const created:Array<{close():void;closed:boolean;references:ReturnType<typeof extractImages>}> = [];
  const stages=new StageRegistry<typeof user,typeof created[number]>(source=>{
    const stage={closed:false,references:extractImages(source.body),close(){this.closed=true;}};created.push(stage);return stage;
  });
  const original=stages.reconcile([user]).get(user)!;
  stages.reconcile([user,qa]);assert.equal(stages.get(user),original);assert.equal(original.closed,false);
  assert.deepEqual(original.references.map(image=>image.target),['native.png','https://host/b.png']);
  const fixture=stages.get(qa)!;stages.reconcile([user]);
  assert.equal(fixture.closed,true);assert.equal(stages.get(user),original);assert.equal(original.closed,false);
  stages.close();assert.equal(original.closed,true);assert.equal([...stages.values()].length,0);
});

test('a detached old pane is removed before an unchanged replacement note acquires a live stage',()=>{
  const old=pane('Same.md',true),replacement=pane('Same.md',true);let closed=0;
  const stages=new StageRegistry<typeof old,{close():void}>(()=>({close(){closed++;}}));
  const previous=stages.reconcile([old]).get(old);const current=stages.reconcile([replacement]).get(replacement);
  assert.notEqual(previous,current);assert.equal(stages.get(old),undefined);assert.equal(closed,1);
  stages.close();assert.equal(closed,2);
});

test('a background window file-open cannot replace the source from the focused user document',()=>{
  const user=pane('User.md',true),background=pane('QA.md',false);
  assert.equal(pickStageSource([user,background],background,background,user),user);
  const other=pane('Other split.md',true);
  assert.equal(pickStageSource([user,other,background],other,background,user),other);
});

test('source selection excludes removed panes and follows the active pane when no document is focused',()=>{
  const old=pane('Removed.md',true),main=pane('Main.md',false),popout=pane('Popout.md',false);
  assert.equal(pickStageSource([main,popout],popout,popout,old),popout);
  assert.equal(pickStageSource([main],old,old,old),main);
  assert.equal(pickStageSource([],old,old,old),null);
});

test('matching content can reuse only a connected stage mounted in its own pane',()=>{
  const container={isConnected:true} as HTMLElement,other={isConnected:true} as HTMLElement;
  const root={isConnected:true,parentElement:container} as HTMLElement;
  assert.equal(isStageRootMounted(root,container),true);
  assert.equal(isStageRootMounted({...root,isConnected:false} as HTMLElement,container),false);
  assert.equal(isStageRootMounted(root,other),false);
  assert.equal(isStageRootMounted(root,{isConnected:false} as HTMLElement),false);
  assert.equal(isStageRootMounted(null,container),false);
});

test('frontmatter-only empty rendering can reuse a null root without confusing it with an unrendered stage',()=>{
  const source='---\ntitle: Learning draft\nfigures:\n  - image: ![[figure.png]]\n---\n正文。\n';
  assert.equal(extractImages(source).length,0);
  const container={isConnected:true} as HTMLElement;
  assert.equal(canReuseStageRender(null,container,false),false);
  for(let refresh=0;refresh<50;refresh++)assert.equal(canReuseStageRender(null,container,true),true);
  assert.equal(canReuseStageRender(null,{isConnected:false} as HTMLElement,true),false);
});

test('adding native images clears empty state and a detached image-bearing root always requires recovery',()=>{
  const container={isConnected:true} as HTMLElement;
  const references=extractImages('---\nfigures: []\n---\n![[native.png]]\n');assert.equal(references.length,1);
  const renderedEmpty=references.length===0;
  assert.equal(canReuseStageRender(null,container,renderedEmpty),false);
  const detached={isConnected:false,parentElement:container} as HTMLElement;
  assert.equal(canReuseStageRender(detached,container,false),false);
  assert.equal(canReuseStageRender(detached,container,true),false);
  const mounted={isConnected:true,parentElement:container} as HTMLElement;
  assert.equal(canReuseStageRender(mounted,container,false),true);
});

function ownerWindow(){
  let sequence=0;const pending=new Map<number,()=>void>(),cancelled:number[]=[];
  return {pending,cancelled,setTimeout(callback:()=>void){const id=++sequence;pending.set(id,callback);return id;},clearTimeout(id:number){cancelled.push(id);pending.delete(id);},fire(){for(const [id,callback]of [...pending]){pending.delete(id);callback();}}};
}

test('hover timers fire and cancel in their owning popout, retaining another window with identical IDs',()=>{
  const main=ownerWindow(),popout=ownerWindow();const mainTimers=new PaneTimers(main as unknown as Window),popoutTimers=new PaneTimers(popout as unknown as Window);
  let mainRevealed=false,popoutRevealed=false;
  mainTimers.schedule('edge',()=>mainRevealed=true,120);popoutTimers.schedule('edge',()=>popoutRevealed=true,120);
  popoutTimers.clear();assert.deepEqual(popout.cancelled,[1]);assert.equal(main.pending.size,1);
  main.fire();assert.equal(mainRevealed,true);assert.equal(popoutRevealed,false);assert.equal(mainTimers.has('edge'),false);
});

test('reentering a hotzone replaces pending reveal and stage cleanup leaves no hover callback',()=>{
  const win=ownerWindow(),timers=new PaneTimers(win as unknown as Window);let revealed=0;
  timers.schedule('edge',()=>revealed++,120);timers.schedule('edge',()=>revealed++,120);
  assert.equal(win.pending.size,1);assert.deepEqual(win.cancelled,[1]);win.fire();assert.equal(revealed,1);
  timers.schedule('dismiss',()=>revealed--,180);timers.schedule('edge',()=>revealed++,120);timers.clear();win.fire();
  assert.equal(revealed,1);assert.equal(win.pending.size,0);assert.equal(timers.has('dismiss'),false);
});
