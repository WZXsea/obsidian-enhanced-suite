import esbuild from '../node_modules/esbuild/lib/main.js';
await esbuild.build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian'],format:'cjs',target:'es2018',outfile:'main.js',logLevel:'info'});
