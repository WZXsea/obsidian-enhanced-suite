function tcrMergeIdentity(plugin, table, fileKey) {
  const path = fileKey.split('::')[0];
  const owner = plugin.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
    .find(view => view.containerEl.contains(table)) || plugin.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find(view => view.file?.path === path);
  if (!owner) return fileKey;
  const widget = table.closest('.cm-table-widget');
  const doc = owner.editor?.cm?.state?.doc;
  plugin._mergeSourceIndexes ||= new WeakMap();
  let cache = plugin._mergeSourceIndexes.get(owner);
  const source = widget && doc ? (cache?.doc === doc ? cache.source : doc.toString()) : owner.data;
  if (typeof source !== 'string') return fileKey;
  if (!cache || cache.source !== source) {
    cache = {source, doc: widget ? doc : null, blocks: tcrCopyTableBlocks(source)};
    plugin._mergeSourceIndexes.set(owner, cache);
  }
  let line;
  if (widget && doc) {
    try { line = doc.lineAt(owner.editor.cm.posAtDOM(widget)).number - 1; } catch (_) { return fileKey; }
  } else {
    const info = owner.previewMode?.renderer?.getSectionInfo(table);
    line = info?.lineStart ?? Number(table.dataset.tcrSourceLine);
  }
  const index = cache.blocks.findIndex(block => block.end >= line && block.start <= line + 2);
  return index < 0 ? fileKey : `${fileKey}::table:${index + Number(table.dataset.tcrSectionOrdinal || 0)}`;
}
function tcrWithMergeLayout(plugin, table, update) {
  const renderer = plugin._mergeTables?.get(table);
  return renderer ? renderer.withLayout(update) : update();
}
