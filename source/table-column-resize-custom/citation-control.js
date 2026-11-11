// Restore document-level citation badges in native Live Preview table cells.
function setupTableCitations(plugin, table, fileKey) {
  let widget, originalRender, wrappedRender, disposed = false;
  const records = new Map();
  const release = (cell, restore = false) => {
    const record = records.get(cell);
    if (!record) return;
    records.delete(cell);
    record.badges.forEach(badge => record.bridge.disposeBadge(badge));
    plugin.removeChild(record.component);
    if (restore && record.host === cell.contentEl && record.host.firstChild === record.first) {
      record.host.replaceChildren(...record.original);
    }
  };
  const refreshCell = async cell => {
    const bridge = plugin.app.plugins.plugins['citation-badges'];
    const cm = widget?.editor.cm;
    if (disposed || !bridge?.model || !cm || !cell.contentEl?.isConnected) return;
    const host = cell.contentEl;
    // The native embedded editor owns its active cell until editing finishes.
    if (host.style.display === 'none' || host.querySelector('.cm-editor')) return;
    const text = cell.text;
    if (!text.includes('[^') && !text.includes('^[')) { release(cell, true); return; }
    const { textStart, textEnd } = cell.getAbsoluteOffsets();
    const path = widget.editor.path;
    const model = bridge.model(cm.state.doc.toString(), path);
    const clusters = model.clusters.filter(cluster => cluster.from >= textStart && cluster.to <= textEnd);
    const signature = textStart + ':' + clusters.map(cluster => cluster.from + ':' + cluster.label).join(',') + ':' + text;
    const previous = records.get(cell);
    if (previous?.signature === signature && host.firstChild === previous.first) return;
    release(cell, true);
    if (!clusters.length) return;
    const component = plugin.addChild(new import_obsidian2.Component());
    const record = { bridge, component, host, signature, badges: [], original: [...host.childNodes], first: null };
    records.set(cell, record);
    let markdown = '', offset = 0;
    clusters.forEach((cluster, index) => {
      markdown += text.slice(offset, cluster.from - textStart) + `<span data-tcr-citation="${index}"></span>`;
      offset = cluster.to - textStart;
    });
    markdown += text.slice(offset);
    const rendered = host.ownerDocument.createElement('div');
    try {
      await import_obsidian2.MarkdownRenderer.render(plugin.app, markdown, rendered, path, component);
      if (disposed || records.get(cell) !== record || cell.text !== text || cell.contentEl !== host || !host.isConnected || host.querySelector('.cm-editor')) {
        if (records.get(cell) === record) release(cell);
        return;
      }
      rendered.querySelectorAll('[data-tcr-citation]').forEach(marker => {
        const badge = bridge.createBadge(clusters[Number(marker.dataset.tcrCitation)], path, cm);
        badge.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
        record.badges.push(badge);
        marker.replaceWith(badge);
      });
      const contents = rendered.children.length === 1 && rendered.firstElementChild.tagName === 'P'
        ? rendered.firstElementChild : rendered;
      host.replaceChildren(...contents.childNodes);
      record.first = host.firstChild;
      plugin._mergeTables?.get(table)?.apply();
    } catch (_) {
      if (records.get(cell) === record) release(cell);
    }
  };
  const detach = () => {
    if (widget && widget.rerenderCell === wrappedRender) widget.rerenderCell = originalRender;
    for (const cell of records.keys()) release(cell, true);
    widget = null;
  };
  const refresh = () => {
    if (!widget || disposed) return;
    const cells = widget.rows.flat();
    for (const cell of records.keys()) if (!cells.includes(cell)) release(cell);
    for (const cell of cells) void refreshCell(cell);
  };
  const rebind = next => {
    detach();
    table = next;
    widget = table.closest('.cm-table-widget')?.cmTile?.widget;
    if (!widget) return;
    originalRender = widget.rerenderCell;
    wrappedRender = function(cell) {
      if (cell.dirty) release(cell);
      const result = originalRender.call(this, cell);
      void refreshCell(cell);
      return result;
    };
    widget.rerenderCell = wrappedRender;
    refresh();
  };
  rebind(table);
  return { refresh, rebind, destroy() { disposed = true; detach(); } };
}
