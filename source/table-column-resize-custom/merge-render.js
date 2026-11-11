// Merge display preserves every original Markdown cell and its content.
function tcrMergeText(cell) {
  const widget = cell.closest('.cm-table-widget')?.cmTile?.widget;
  const native = widget?.rows?.[cell.parentElement?.rowIndex]?.[cell.cellIndex];
  if (native?.el === cell) return native.text.replace(/<br\s*\/?\s*>/gi, ' ').replace(/\s+/g, ' ').trim();
  let contents = cell;
  if (cell.querySelector('.citation-native-reference')) {
    contents = cell.cloneNode(true);
    contents.querySelectorAll('.citation-native-reference').forEach(node => node.remove());
  }
  return (contents.textContent || '').replace(/\s+/g, ' ').trim();
}
function setupTableMergeRendering(plugin, table, key) {
  plugin.settings.tableMerges ||= {};
  plugin._mergeRenderKeys ||= new Map();
  let grid, changed = [], suspended = false;
  const register = renderer => {
    let siblings = plugin._mergeRenderKeys.get(key);
    if (!siblings) plugin._mergeRenderKeys.set(key, siblings = new Set());
    siblings.add(renderer);
  };
  const unregister = renderer => {
    const siblings = plugin._mergeRenderKeys.get(key);
    siblings?.delete(renderer);
    if (!siblings?.size) plugin._mergeRenderKeys.delete(key);
  };
  const widths = ['width', 'min-width', 'max-width'];
  const capture = () => {
    grid = Array.from(table.rows, row => Array.from(row.cells));
    grid.forEach((row, r) => row.forEach((cell, c) => {
      cell.dataset.tcrMergeRow = r;
      cell.dataset.tcrMergeCol = c;
    }));
  };
  const restore = () => {
    for (const item of changed) {
      const {cell, covered, colspan, rowspan, style} = item;
      cell.classList.toggle('tcr-merge-covered', covered);
      for (const [name, value] of [['colspan', colspan], ['rowspan', rowspan]]) {
        if (value === null) cell.removeAttribute(name);
        else cell.setAttribute(name, value);
      }
      if (style) widths.forEach((name, i) => {
        const [value, priority] = style[i];
        if (value) cell.style.setProperty(name, value, priority);
        else cell.style.removeProperty(name);
      });
    }
    changed = [];
    table.classList.remove('tcr-has-merges');
  };
  const syncGrid = () => {
    const rows = Array.from(table.rows);
    if (grid.length === rows.length && rows.every((row, r) => row.cells.length === grid[r].length && Array.from(row.cells).every((cell, c) => cell === grid[r][c]))) return;
    restore();
    grid.forEach(row => row.forEach(cell => {
      delete cell.dataset.tcrMergeRow;
      delete cell.dataset.tcrMergeCol;
    }));
    capture();
  };
  const validate = ranges => {
    syncGrid();
    const accepted = [], occupied = new Set();
    for (const range of ranges || []) {
      const {r1, c1, r2, c2} = range;
      if (![r1, c1, r2, c2].every(Number.isInteger) || r1 < 0 || c1 < 0 || r2 < r1 || c2 < c1 || r2 >= grid.length || (r1 === r2 && c1 === c2)) continue;
      const cells = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push(grid[r]?.[c]);
      if (cells.some(cell => !cell)) continue;
      const group = cells[0].parentElement.parentElement;
      const text = tcrMergeText(cells[0]);
      if (cells.some(cell => cell.parentElement.parentElement !== group || tcrMergeText(cell) !== text)) continue;
      const coords = cells.map(cell => `${cell.dataset.tcrMergeRow}:${cell.dataset.tcrMergeCol}`);
      if (coords.some(coord => occupied.has(coord))) continue;
      coords.forEach(coord => occupied.add(coord));
      accepted.push({r1, c1, r2, c2, text});
    }
    return accepted;
  };
  const apply = () => {
    restore();
    if (suspended) return;
    for (const range of validate(plugin.settings.tableMerges[key])) {
      const {r1, c1, r2, c2} = range;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const cell = grid[r][c], anchor = r === r1 && c === c1;
        const item = {cell, covered: cell.classList.contains('tcr-merge-covered'), colspan: cell.getAttribute('colspan'), rowspan: cell.getAttribute('rowspan')};
        if (anchor) {
          cell.colSpan = c2 - c1 + 1;
          cell.rowSpan = r2 - r1 + 1;
          if (c2 > c1) {
            item.style = widths.map(name => [cell.style.getPropertyValue(name), cell.style.getPropertyPriority(name)]);
            widths.forEach(name => cell.style.removeProperty(name));
          }
        } else cell.classList.add('tcr-merge-covered');
        changed.push(item);
      }
    }
    table.classList.toggle('tcr-has-merges', changed.length > 0);
  };
  const cleanup = () => {
    restore();
    grid.forEach(row => row.forEach(cell => {
      delete cell.dataset.tcrMergeRow;
      delete cell.dataset.tcrMergeCol;
    }));
  };
  capture();
  const renderer = {
    get key() { return key; },
    get suspended() { return suspended; },
    get grid() { syncGrid(); return grid; },
    get ranges() { return plugin.settings.tableMerges[key] || []; },
    getGrid: () => { syncGrid(); return grid; },
    getRanges: () => plugin.settings.tableMerges[key] || [],
    apply, restore,
    withLayout(fn) { restore(); try { return fn(); } finally { apply(); } },
    setRanges(ranges) {
      const valid = validate(ranges);
      if (valid.length) plugin.settings.tableMerges[key] = valid;
      else delete plugin.settings.tableMerges[key];
      plugin.debouncedSave();
      for (const sibling of plugin._mergeRenderKeys.get(key) || []) sibling.apply();
      return valid;
    },
    suspend() { suspended = true; restore(); },
    resume() { suspended = false; apply(); },
    rebind(nextTable, nextKey = key) {
      cleanup(); unregister(renderer); table = nextTable; key = nextKey;
      capture(); register(renderer); apply();
    },
    destroy() { cleanup(); unregister(renderer); }
  };
  register(renderer);
  apply();
  return renderer;
}
