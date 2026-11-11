import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian','@codemirror/state','@codemirror/view'],format:'cjs',target:'es2022',outfile:'main.js',logLevel:'info'});
const sheets=['base','popover','group-picker','layout-picker','gallery-stage','reference-editor','gallery-configuration','image-presentation','image-resize'];
const css=await Promise.all(sheets.map(name=>readFile(`src/${name}.css`,'utf8')));
await writeFile('styles.css',css.join('\n'));
