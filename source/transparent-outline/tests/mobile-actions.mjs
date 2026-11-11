import {build} from '../../node_modules/esbuild/lib/main.js';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const output=await build({entryPoints:[fileURLToPath(new URL('../src/mobile-actions.ts',import.meta.url))],bundle:true,format:'cjs',write:false});
const module={exports:{}};runInNewContext(output.outputFiles[0].text,{module,exports:module.exports});
const {mobileQuickActions,runMobileQuickAction,mobileKeyboardVisible,mobileQuickBarBottom,outlineDepth}=module.exports;
test('the directory entry remains available when related plugins are absent',()=>{
 assert.deepEqual([...mobileQuickActions(false,false)],['outline']);
 assert.deepEqual([...mobileQuickActions(true,false)],['search','outline']);
 assert.deepEqual([...mobileQuickActions(false,true)],['images','outline']);
 assert.deepEqual([...mobileQuickActions(true,true)],['search','images','outline']);
});
test('search uses the explicit mobile entry, with a compatible CMDK fallback',()=>{
 const seen=[];assert.equal(runMobileQuickAction('search',id=>{seen.push(id);return id.endsWith('cmdk-search');},()=>assert.fail('directory')),true);
 assert.deepEqual(seen,['float-search:open-mobile-search','float-search:open-cmdk-search']);
 seen.length=0;assert.equal(runMobileQuickAction('search',id=>{seen.push(id);return true;},()=>{}),true);
 assert.deepEqual(seen,['float-search:open-mobile-search']);
});
test('image and directory entries invoke exactly their associated action',()=>{
 const seen=[];let toggles=0;
 assert.equal(runMobileQuickAction('images',id=>{seen.push(id);return true;},()=>toggles++),true);
 assert.equal(runMobileQuickAction('outline',()=>assert.fail('command'),()=>toggles++),true);
 assert.deepEqual(seen,['obsidian-image-toolkit:open']);assert.equal(toggles,1);
});
test('keyboard-height viewports hide the quickbar while full-height layouts retain it',()=>{
 assert.equal(mobileKeyboardVisible(915,915),false);assert.equal(mobileKeyboardVisible(915,420),true);
 assert.equal(mobileKeyboardVisible(640,550),false);assert.equal(mobileKeyboardVisible(0,300),false);
});
test('mobile starts at two heading levels while retaining independent desktop depth',()=>{
 assert.equal(outlineDepth(1,undefined,true),2);assert.equal(outlineDepth(1,undefined,false),1);
 assert.equal(outlineDepth(1,4,true),4);assert.equal(outlineDepth(1,4,false),1);
 assert.equal(outlineDepth(6,1,true),1);assert.equal(outlineDepth(6,1,false),6);
});
test('quickbar clears visible native bottom bars and retains a raised fallback',()=>{
 assert.equal(mobileQuickBarBottom(915,915,[]),96);
 const raised={top:810,bottom:895,width:360,height:85};
 const bottom=mobileQuickBarBottom(915,915,[raised]);
 assert.ok(915-bottom<=raised.top-8);assert.equal(bottom,113);
 assert.equal(mobileQuickBarBottom(915,915,[{top:0,bottom:0,width:0,height:0}]),96);
 assert.equal(mobileQuickBarBottom(915,915,[{top:930,bottom:980,width:360,height:50}]),96);
 assert.equal(mobileQuickBarBottom(915,915,[{top:300,bottom:350,width:360,height:50}]),96);
 assert.equal(mobileQuickBarBottom(915,700,[]),223);
});
