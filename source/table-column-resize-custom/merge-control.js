// Selection lives outside Markdown; only the saved display ranges are changed.
function setupTableMerge(plugin, table, fileKey, toolbar) {
  const doc = table.ownerDocument, win = doc.defaultView;
  const renderer = setupTableMergeRendering(plugin, table, tcrMergeIdentity(plugin, table, fileKey));
  plugin._mergeTables ||= new WeakMap();
  plugin._mergeTables.set(table, renderer);
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'tcr-copy-button tcr-merge-button';
  button.title = '合并单元格显示';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  import_obsidian2.setIcon(button, 'combine');
  toolbar.insertBefore(button, toolbar.querySelector('.tcr-font-button'));
  let menu = null, picking = false, editing = false, first = null, selection = null;
  let status, mergeButton, pickButton, editButton, returnFrame = 0;
  const setEditing = value => {
    editing = value;
    if (returnFrame) { win.cancelAnimationFrame(returnFrame); returnFrame = 0; }
    table.classList.toggle('tcr-merge-editing', value);
    if (value) doc.addEventListener('pointerdown', leaveEditing, true);
    else doc.removeEventListener('pointerdown', leaveEditing, true);
  };
  const leaveEditing = event => {
    if (table.contains(event.target) || toolbar.contains(event.target) || event.target.closest?.('.tcr-font-menu, .menu, .citation-badge-popover')) return;
    setEditing(false);
    // Let the editor finish moving focus before restoring the display spans.
    returnFrame = win.requestAnimationFrame(() => {
      returnFrame = 0;
      renderer.resume();
      update();
    });
  };
  let unhookContext = () => {};
  const nativeSelection = () => {
    const widget = table.closest('.cm-table-widget')?.cmTile?.widget;
    if (!widget?.selectedCells?.length) return null;
    const bounds = widget.getSelectionBounds();
    return bounds ? {r1: bounds.minRow, c1: bounds.minCol, r2: bounds.maxRow, c2: bounds.maxCol} : null;
  };
  const validSelection = range => {
    if (!range || range.r1 === range.r2 && range.c1 === range.c2) return false;
    const firstCell = renderer.grid[range.r1]?.[range.c1];
    if (!firstCell) return false;
    const text = tcrMergeText(firstCell), group = firstCell.parentElement.parentElement;
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) {
      const cell = renderer.grid[r]?.[c];
      if (!cell || cell.parentElement.parentElement !== group || tcrMergeText(cell) !== text) return false;
    }
    return true;
  };
  const mergeRange = range => {
    if (!validSelection(range)) return;
    const overlaps = other => range.r1 <= other.r2 && range.r2 >= other.r1 && range.c1 <= other.c2 && range.c2 >= other.c1;
    renderer.setRanges([...renderer.ranges.filter(other => !overlaps(other)), range]);
    setEditing(false);
    table.classList.remove('tcr-merge-editing');
    table.closest('.cm-table-widget')?.cmTile?.widget?.deselectCells();
    endSelection();
    renderer.resume();
    update('已合并显示，原文保留各单元格内容。');
  };
  const hookContext = () => {
    const widget = table.closest('.cm-table-widget')?.cmTile?.widget;
    if (!widget?.onContextMenu) return;
    const original = widget.onContextMenu, owned = Object.hasOwn(widget, 'onContextMenu');
    const patched = function(cell, menu) {
      original.call(this, cell, menu);
      const range = nativeSelection();
      if (!range) return;
      const valid = validSelection(range);
      menu.addItem(item => item.setSection('table').setIcon('combine')
        .setTitle(valid ? '合并显示' : '合并显示（请选择内容相同的矩形区域）')
        .setDisabled(!valid).onClick(() => mergeRange(range)));
    };
    widget.onContextMenu = patched;
    unhookContext = () => {
      if (widget.onContextMenu !== patched) return;
      if (owned) widget.onContextMenu = original;
      else delete widget.onContextMenu;
    };
  };
  const clearSelection = () => {
    for (const row of renderer.grid) for (const cell of row) cell.classList.remove('tcr-merge-selected');
    first = selection = null;
  };
  const update = (message) => {
    if (!menu) return;
    status.textContent = message || (editing ? '原表编辑中，内容修改后可返回合并显示。' : `${renderer.ranges.length} 个合并区域`);
    mergeButton.disabled = !selection;
    pickButton.textContent = picking ? '重新选择区域' : '选择合并区域';
    editButton.textContent = editing ? '返回合并显示' : '编辑原表';
    menu.querySelector('.tcr-merge-clear').disabled = !renderer.ranges.length;
  };
  const endSelection = () => {
    picking = false;
    table.classList.remove('tcr-merge-picking');
    menu?.classList.remove('is-picking');
    clearSelection();
    if (!editing) renderer.resume();
  };
  const close = () => {
    if (!menu) return;
    endSelection();
    menu.remove();
    menu = null;
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('keydown', keydown, true);
    win.removeEventListener('resize', position);
    win.visualViewport?.removeEventListener('resize', position);
    win.visualViewport?.removeEventListener('scroll', position);
    doc.removeEventListener('scroll', position, true);
    button.setAttribute('aria-expanded', 'false');
    if (plugin._activeMergeMenu === control) plugin._activeMergeMenu = null;
  };
  const outside = event => {
    if (menu?.contains(event.target) || button.contains(event.target) || (picking && table.contains(event.target))) return;
    close();
  };
  const keydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      button.focus({ preventScroll: true });
    }
  };
  const position = () => {
    if (!menu) return;
    const rect = button.getBoundingClientRect();
    if (picking) {
      const bounds = table.getBoundingClientRect(), width = menu.offsetWidth;
      const right = bounds.right + 8, left = bounds.left - width - 8;
      tcrPositionMenu(menu, rect, win, {
        left: right + width <= win.innerWidth - 8 ? right : left >= 8 ? left : rect.right - width,
        top: bounds.bottom + 8
      });
    } else tcrPositionMenu(menu, rect, win);
  };
  const select = event => {
    if (!picking && event.target.closest('.tcr-handle, a, button, input, textarea, select, [role=button], .citation-badge, .footnote-ref')) return;
    const cell = event.target.closest('td, th');
    if (!picking) {
      if (cell && cell.closest('table') === table && table.classList.contains('tcr-has-merges') && !editing && table.closest('.markdown-source-view')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setEditing(true);
        const row = cell.parentElement.rowIndex, col = cell.cellIndex;
        renderer.suspend();
        const widget = table.closest('.cm-table-widget')?.cmTile?.widget;
        widget?.setCellFocus(row, col, cm => cm.state.selection.constructor.single(cm.posAtCoords({x: event.clientX, y: event.clientY}) ?? cm.state.doc.length));
        update('原表已展开，当前单元格可直接编辑或粘贴。');
      }
      return;
    }
    if (!cell || cell.closest('table') !== table) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    let point;
    renderer.grid.some((row, r) => {
      const c = row.indexOf(cell);
      if (c < 0) return false;
      point = { r, c };
      return true;
    });
    if (!point) return;
    if (!first || selection) {
      clearSelection();
      first = point;
      cell.classList.add('tcr-merge-selected');
      update('已选择起点，请点击区域的终点单元格。');
      return;
    }
    const range = { r1: Math.min(first.r, point.r), c1: Math.min(first.c, point.c), r2: Math.max(first.r, point.r), c2: Math.max(first.c, point.c) };
    const cells = [];
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) cells.push(renderer.grid[r]?.[c]);
    const text = tcrMergeText(cell);
    if (cells.length < 2 || cells.some(item => !item || item.parentElement.parentElement !== cell.parentElement.parentElement || tcrMergeText(item) !== text)) {
      update('请选择同一表头或正文区域内，内容相同的相邻单元格。');
      return;
    }
    for (const row of renderer.grid) for (const item of row) item.classList.remove('tcr-merge-selected');
    cells.forEach(item => item.classList.add('tcr-merge-selected'));
    selection = range;
    update(`已选择 ${range.r2 - range.r1 + 1} 行 × ${range.c2 - range.c1 + 1} 列，可合并显示。`);
  };
  const open = () => {
    const selected = nativeSelection();
    for (const manager of plugin._fontManagers?.values() || []) manager.active?.close();
    plugin._activeWidthMenu?.close();
    plugin._activeMergeMenu?.close();
    plugin._activeMergeMenu = control;
    menu = doc.createElement('div');
    menu.className = 'tcr-font-menu tcr-merge-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '合并单元格显示');
    menu.setAttribute('contenteditable', 'false');
    menu.innerHTML = '<div class="tcr-font-heading">合并显示</div><p class="tcr-merge-help">选择起点和终点，将内容相同的相邻单元格融合显示。原文保留各格内容。</p><p class="tcr-merge-status" role="status"></p><button type="button" class="tcr-font-reset tcr-merge-pick">选择合并区域</button><button type="button" class="tcr-font-reset tcr-merge-apply">合并显示</button><button type="button" class="tcr-font-reset tcr-merge-edit">编辑原表</button><button type="button" class="tcr-font-reset tcr-merge-clear">取消全部合并</button>';
    status = menu.querySelector('.tcr-merge-status');
    pickButton = menu.querySelector('.tcr-merge-pick');
    mergeButton = menu.querySelector('.tcr-merge-apply');
    editButton = menu.querySelector('.tcr-merge-edit');
    editButton.hidden = !table.closest('.markdown-source-view');
    pickButton.addEventListener('click', () => {
      clearSelection();
      picking = true;
      menu.classList.add('is-picking');
      renderer.suspend();
      table.classList.add('tcr-merge-picking');
      update('请点击区域的起点单元格。');
      position();
    });
    mergeButton.addEventListener('click', () => {
      if (!selection) return;
      mergeRange(selection);
    });
    editButton.addEventListener('click', () => {
      setEditing(!editing);
      endSelection();
      table.classList.toggle('tcr-merge-editing', editing);
      if (editing) renderer.suspend();
      else renderer.resume();
      update();
    });
    menu.querySelector('.tcr-merge-clear').addEventListener('click', () => {
      renderer.setRanges([]);
      endSelection();
      update('已恢复独立单元格显示。');
    });
    for (const type of ['pointerdown', 'mousedown', 'click']) menu.addEventListener(type, event => event.stopPropagation());
    doc.body.append(menu);
    button.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('keydown', keydown, true);
    win.addEventListener('resize', position);
    win.visualViewport?.addEventListener('resize', position);
    win.visualViewport?.addEventListener('scroll', position);
    doc.addEventListener('scroll', position, true);
    if (selected) {
      renderer.suspend();
      if (validSelection(selected)) {
        selection = selected;
        for (let r = selected.r1; r <= selected.r2; r++) for (let c = selected.c1; c <= selected.c2; c++) renderer.grid[r][c].classList.add('tcr-merge-selected');
        pickButton.hidden = true;
        update(`已读取选区：${selected.r2 - selected.r1 + 1} 行 × ${selected.c2 - selected.c1 + 1} 列，可直接合并显示。`);
      } else update('已读取选区，请选择内容相同的矩形区域进行合并。');
    } else update('先在表格中选中待合并的格子，或在此选择区域。');
    position();
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) menu.animate([
      { opacity: 0, transform: 'scale(0.92) translateY(-4px)' },
      { opacity: 1, transform: 'scale(1) translateY(0)' }
    ], { duration: 420, easing: 'cubic-bezier(0.22, 0.68, 0.2, 1)' });
  };
  const click = event => {
    event.preventDefault();
    event.stopPropagation();
    if (menu) close();
    else open();
  };
  button.addEventListener('click', click);
  const gesture = tcrTapSelection(select);
  const tableEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
  const bindSelection = target => { for (const type of tableEvents) target.addEventListener(type, gesture, true); };
  const unbindSelection = target => { for (const type of tableEvents) target.removeEventListener(type, gesture, true); };
  bindSelection(table);
  const control = {
    button, renderer, close,
    rebind(nextTable) {
      unhookContext();
      endSelection();
      table.classList.remove('tcr-merge-editing');
      unbindSelection(table);
      plugin._mergeTables.delete(table);
      table = nextTable;
      renderer.rebind(nextTable, tcrMergeIdentity(plugin, nextTable, fileKey));
      plugin._mergeTables.set(nextTable, renderer);
      bindSelection(table);
      table.classList.toggle('tcr-merge-editing', editing);
      if (editing) renderer.suspend();
      hookContext();
      update();
      position();
    },
    destroy() {
      setEditing(false);
      unhookContext();
      close();
      table.classList.remove('tcr-merge-editing');
      unbindSelection(table);
      button.removeEventListener('click', click);
      button.remove();
      plugin._mergeTables.delete(table);
      renderer.destroy();
    }
  };
  hookContext();
  return control;
}
