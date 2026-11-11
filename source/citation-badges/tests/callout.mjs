import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../../node_modules/esbuild/lib/main.js';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'citation-callout-'));
try {
  const output = path.join(temporary, 'callout.mjs');
  await build({ stdin: { contents: 'export { prepareCallout } from "./src/callout"; export { buildDocumentModel } from "./src/model";', resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, outfile: output, bundle: true, platform: 'node', format: 'esm' });
  const { prepareCallout, buildDocumentModel } = await import(pathToFileURL(output).href);
  const callout = '> [!note]+ 标题[^b]\n> 中文🧬[^a][^b]，重复[^a]\n>\n> > [!tip] 内层\n> > 内层[^c]\n> `[^a]` 与 \\[^b]\n> - [ ] 任务[^b]\n> [官网](https://example.org)\n> 未定义[^missing]';
  const source = `前文[^a][^b]\n\n${callout}\n\n[^a]: Alpha\n[^b]: Beta\n[^c]: Gamma`;
  const model = buildDocumentModel(source);
  const from = source.indexOf(callout), to = from + callout.length;
  const prepared = prepareCallout(model, from, to);
  assert.deepEqual(prepared.clusters.map(cluster => cluster.label), ['2', '1,2', '1', '3', '2']);
  assert.equal(prepared.clusters[0].members[0].occurrence, 1);
  assert.equal((prepared.source.match(/data-citation-callout=/g) ?? []).length, 5);
  let restored = prepared.source.replace(/<span data-citation-callout="(\d+)"><\/span>/g, (_, index) => {
    const cluster = prepared.clusters[Number(index)];
    return source.slice(cluster.from, cluster.to);
  });
  assert.equal(restored, callout);
  assert.ok(prepared.source.includes('`[^a]` 与 \\[^b]'));
  assert.ok(prepared.source.includes('未定义[^missing]'));
  assert.ok(prepared.source.includes('- [ ] 任务'));
  assert.ok(prepared.source.includes('[官网](https://example.org)'));
  assert.deepEqual(prepareCallout(model, 0, 0), { source: '', clusters: [] });
  console.log('PASS Callout global numbering, repeated occurrences, nested content and exact source preservation');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
