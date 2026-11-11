import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.ts'], bundle: true,
  external: ['obsidian', '@codemirror/*', '@lezer/*', 'electron'],
  format: 'cjs', target: 'es2018', logLevel: 'info', outfile: 'main.js'
});
