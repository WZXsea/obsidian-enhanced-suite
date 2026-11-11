import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const output=await build({entryPoints:[fileURLToPath(new URL('../src/main.ts',import.meta.url))],bundle:true,format:'cjs',write:false,external:['obsidian','@codemirror/state','@codemirror/view']});
const module={exports:{}};class Base{};
runInNewContext(output.outputFiles[0].text,{module,exports:module.exports,require:id=>{
 if(id==='obsidian')return {Plugin:Base,MarkdownRenderChild:Base,PluginSettingTab:Base,Modal:Base};
 if(id==='@codemirror/view')return {WidgetType:Base};
 if(id==='@codemirror/state')return {};
 throw new Error(id);
}});
const Plugin=module.exports.default;
test('gallery navigation resolves opening source line and selects the exact repeated source offset',()=>{
 const plugin=new Plugin();
 const source='正文\n<!-- image-layouts: {"id":"test","layout":"focus"} -->\n![](https://host/a.png)\n![](https://host/b.png)\n![](https://host/a.png)\n<!-- /image-layouts -->';
 const offset=source.lastIndexOf('![]');assert.equal(plugin.getSourceImageNavigationLine(source,offset),1);
 let selected=-1;const target={},host={};
 plugin.navigationRenderers.set(host,{path:'note.md',images:[{sourceOffset:source.indexOf('![]')},{sourceOffset:source.indexOf('![]',source.indexOf('![]')+1)},{sourceOffset:offset}],renderer:{revealImage:index=>{selected=index;return target;}}});
 assert.equal(plugin.revealSourceImage('note.md',offset,{querySelectorAll:()=>[host]}),target);assert.equal(selected,2);
 assert.equal(plugin.revealSourceImage('other.md',offset,{querySelectorAll:()=>[host]}),null);assert.equal(selected,2);
 assert.equal(plugin.revealSourceImage('note.md',offset+1,{querySelectorAll:()=>[host]}),null);
});
