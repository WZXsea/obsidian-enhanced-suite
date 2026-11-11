import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
await build({entryPoints:['tests/all.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test.mjs'});
const result=spawnSync(process.execPath,['--test','.test.mjs'],{stdio:'inherit'});
rmSync('.test.mjs'); process.exitCode=result.status??1;
