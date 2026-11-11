// Column drag handlers use the owning document and a single primary pointer.
// Pointer capture plus touch-action:none keeps Android scrolling from cancelling
// a deliberate resize. Cancel, focus loss and plugin unload commit the last frame.
function attachDragBehavior(plugin, handle, cols, headerCells, colIndex, fileKey, colCount, applyWidth) {
  const doc = handle.ownerDocument, win = doc.defaultView;
  let drag = null, frame = 0, pendingWidth = 0;
  const flush = () => { frame = 0; applyWidth(colIndex, pendingWidth); };
  const finish = event => {
    if (!drag || event?.pointerId !== undefined && event.pointerId !== drag.id) return;
    const previous = drag;
    drag = null;
    if (frame) { win.cancelAnimationFrame(frame); flush(); }
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', finish, true);
    doc.removeEventListener('pointercancel', finish, true);
    handle.removeEventListener('lostpointercapture', finish);
    win.removeEventListener('blur', finish);
    handle.classList.remove('tcr-dragging');
    doc.body.classList.remove('tcr-resizing');
    if (handle.hasPointerCapture?.(previous.id)) handle.releasePointerCapture(previous.id);
    for (let i = 0; i < colCount; i++) {
      const width = parseFloat(cols[i].style.width.endsWith('%') ? headerCells[i].getBoundingClientRect().width : cols[i].style.width);
      if (Number.isFinite(width)) plugin.settings.columnWidths[`${fileKey}::${i}`] = Math.round(width);
    }
    if (plugin.settings.tableColumnRatios?.[fileKey]) {
      const values = Array.from(cols, col => parseFloat(col.style.width));
      const total = values.reduce((sum, value) => sum + value, 0);
      if (total > 0 && values.every(value => Number.isFinite(value) && value > 0)) {
        plugin.settings.tableColumnRatios[fileKey] = values.map(value => value / total);
        for (const control of plugin._widthKeys?.get(fileKey) || []) control.apply(plugin.settings.tableWidths[fileKey] ?? null);
      }
    }
    previous.mergeRenderer?.apply();
    plugin._tableDragCleanup?.delete(finish);
    plugin.debouncedSave();
  };
  const move = event => {
    if (event.pointerId !== drag?.id) return;
    event.preventDefault();
    pendingWidth = Math.max(plugin.settings.minColumnWidth, drag.width + event.clientX - drag.x);
    if (!frame) frame = win.requestAnimationFrame(flush);
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || drag) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const mergeRenderer = plugin._mergeTables?.get(handle.closest('table'));
    mergeRenderer?.restore();
    const measured = Array.from(headerCells, cell => cell.getBoundingClientRect().width);
    // Percentage columns already preserve their exact layout; rewriting each
    // adjacent pair here would redistribute short fitted columns before a drag.
    if (!handle.closest('table')?.classList.contains('tcr-width-custom')) {
      measured.forEach((width, index) => { if (width > 0) applyWidth(index, width); });
    }
    drag = {id: event.pointerId, x: event.clientX, width: headerCells[colIndex].getBoundingClientRect().width, mergeRenderer};
    plugin._tableDragCleanup ||= new Set();
    plugin._tableDragCleanup.add(finish);
    handle.classList.add('tcr-dragging'); doc.body.classList.add('tcr-resizing');
    doc.addEventListener('pointermove', move, {capture: true, passive: false});
    doc.addEventListener('pointerup', finish, true);
    doc.addEventListener('pointercancel', finish, true);
    handle.addEventListener('lostpointercapture', finish);
    win.addEventListener('blur', finish);
    try { handle.setPointerCapture?.(event.pointerId); } catch (_) { /* The owning document also tracks detached handles. */ }
  }, true);
  handle.addEventListener('mousedown', event => event.stopPropagation(), true);
}

// Android's keyboard and split-screen resize the visual viewport independently
// from innerHeight. All popovers clamp to its visible, scrollable bounds.
function tcrPositionMenu(menu, anchor, win, preferred) {
  const viewport = win.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 8, top = (viewport?.offsetTop || 0) + 8;
  const right = left + (viewport?.width || win.innerWidth) - 16;
  const bottom = top + (viewport?.height || win.innerHeight) - 16;
  menu.style.maxWidth = `${Math.max(0, right - left)}px`;
  menu.style.maxHeight = `${Math.max(0, bottom - top)}px`;
  const width = menu.offsetWidth, height = menu.offsetHeight;
  const x = preferred?.left ?? anchor.right - width;
  const y = preferred?.top ?? (anchor.bottom + height + 6 > bottom ? anchor.top - height - 6 : anchor.bottom + 6);
  menu.style.left = `${Math.max(left, Math.min(x, right - width))}px`;
  menu.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`;
  menu.style.transformOrigin = `${Math.max(0, Math.min(width, anchor.left + anchor.width / 2 - parseFloat(menu.style.left)))}px ${anchor.top < parseFloat(menu.style.top) ? '0%' : '100%'}`;
}

// Touch cell actions follow a completed tap, preserving native table/page pans.
// Mouse presses keep their established immediate selection behavior.
function tcrTapSelection(select) {
  let touch = null;
  return event => {
    if (event.type === 'pointerdown') {
      if (event.pointerType !== 'touch') { select(event); return; }
      if (event.isPrimary === false) { touch = null; return; }
      touch = {id: event.pointerId, x: event.clientX, y: event.clientY, cell: event.target.closest?.('td, th')};
    } else if (touch && event.pointerId === touch.id) {
      if (event.type === 'pointercancel' || Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) touch = null;
      else if (event.type === 'pointerup') {
        const sameCell = touch.cell && touch.cell === event.target.closest?.('td, th');
        touch = null;
        if (sameCell) select(event);
      }
    }
  };
}
