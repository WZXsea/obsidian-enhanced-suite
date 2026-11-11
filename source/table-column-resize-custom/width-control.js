// Whole-table sizing shares the existing toolbar and saved table identity.
function setupTableWidth(plugin, table, fileKey, toolbar) {
  const doc = table.ownerDocument, win = doc.defaultView;
  plugin.settings.tableWidths ||= {};
  plugin.settings.tableAlignments ||= {};
  plugin.settings.tableColumnRatios ||= {};
  plugin._widthKeys ||= new Map();
  let siblings = plugin._widthKeys.get(fileKey);
  if (!siblings) plugin._widthKeys.set(fileKey, siblings = new Set());
  const button = doc.createElement('button');
  button.className = 'tcr-copy-button tcr-width-button';
  button.type = 'button';
  button.title = '调整表格宽度';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  import_obsidian2.setIcon(button, 'move-horizontal');
  toolbar.insertBefore(button, toolbar.querySelector('.tcr-font-button'));
  const fitButton = doc.createElement('button');
  fitButton.className = 'tcr-copy-button tcr-auto-fit-button';
  fitButton.type = 'button';
  fitButton.title = '一键紧凑排版：按内容调整列宽和整体宽度';
  fitButton.setAttribute('aria-label', fitButton.title);
  import_obsidian2.setIcon(fitButton, 'minimize-2');
  toolbar.insertBefore(fitButton, button);
  const handle = doc.createElement('div');
  handle.className = 'tcr-width-handle';
  handle.title = '拖动调整表格整体宽度';
  handle.setAttribute('aria-hidden', 'true');
  toolbar.append(handle);
  let menu = null, slider, output, alignButtons, frame = 0, pending, drag = null, disposed = false;
  let original, columns, host, originalHost;
  const properties = ['width', 'min-width', 'max-width'];
  const capture = () => {
    host = table.parentElement.closest('.table-wrapper');
    originalHost = host?.classList.contains('tcr-width-host');
    original = {
      width: table.style.getPropertyValue('--tcr-table-width'),
      priority: table.style.getPropertyPriority('--tcr-table-width'),
      custom: table.classList.contains('tcr-width-custom')
    };
    const header = table.querySelector('thead tr') || table.querySelector('tr');
    columns = [...table.querySelectorAll('col'), ...header?.children || []].map(el => ({
      el, values: properties.map(name => [el.style.getPropertyValue(name), el.style.getPropertyPriority(name)])
    }));
  };
  capture();
  const saved = () => plugin.settings.tableWidths[fileKey] ?? null;
  const alignment = () => plugin.settings.tableAlignments[fileKey] || 'center';
  const applyAlignment = (custom) => {
    const value = alignment();
    if (custom) toolbar.dataset.tcrAlignment = value;
    else delete toolbar.dataset.tcrAlignment;
    for (const el of [table, toolbar]) {
      if (custom) {
        el.style.setProperty('--tcr-width-margin-start', value === 'left' ? '0px' : 'auto');
        el.style.setProperty('--tcr-width-margin-end', value === 'right' ? '0px' : 'auto');
      } else {
        el.style.removeProperty('--tcr-width-margin-start');
        el.style.removeProperty('--tcr-width-margin-end');
      }
    }
    for (const button of alignButtons || []) button.setAttribute('aria-pressed', String(button.dataset.alignment === value));
  };
  const headers = () => Array.from((table.querySelector('thead tr') || table.querySelector('tr'))?.children || []);
  const restore = (useSaved = true) => {
    if (original.width) table.style.setProperty('--tcr-table-width', original.width, original.priority);
    else table.style.removeProperty('--tcr-table-width');
    table.classList.toggle('tcr-width-custom', original.custom);
    toolbar.style.removeProperty('--tcr-table-width');
    toolbar.classList.remove('tcr-width-custom');
    host?.classList.toggle('tcr-width-host', originalHost);
    applyAlignment(false);
    table.classList.remove('tcr-content-fit');
    const cells = headers(), cols = Array.from(table.querySelectorAll('col'));
    for (const item of columns) {
      const index = item.el.tagName === 'COL' ? cols.indexOf(item.el) : cells.indexOf(item.el);
      const width = useSaved && plugin.settings.columnWidths?.[`${fileKey}::${index}`];
      properties.forEach((name, i) => {
        if (width && (item.el.tagName !== 'COL' || name === 'width')) item.el.style.setProperty(name, `${width}px`, 'important');
        else if (item.values[i][0]) item.el.style.setProperty(name, ...item.values[i]);
        else item.el.style.removeProperty(name);
      });
    }
  };
  const normalize = () => {
    const cells = headers(), cols = Array.from(table.querySelectorAll('col'));
    const ratios = plugin.settings.tableColumnRatios[fileKey];
    const useRatios = Array.isArray(ratios) && ratios.length === cells.length && ratios.every(size => Number.isFinite(size) && size > 0);
    table.classList.toggle('tcr-content-fit', useRatios);
    if (!useRatios && table.classList.contains('tcr-width-custom') && cells.every(cell => cell.style.width.endsWith('%'))) return;
    const sizes = useRatios ? ratios : cells.map((cell, index) => cell.getBoundingClientRect().width || plugin.settings.columnWidths?.[`${fileKey}::${index}`] || 1);
    const total = sizes.reduce((a, b) => a + b, 0);
    if (!total) return;
    cells.forEach((cell, index) => {
      const value = `${sizes[index] / total * 100}%`;
      for (const el of [cell, cols[index]]) if (el) {
        el.style.setProperty('width', value, 'important');
        if (el.tagName === 'COL') {
          el.style.removeProperty('min-width');
          el.style.removeProperty('max-width');
        }
        if (el === cell) {
          el.style.setProperty('min-width', '0', 'important');
          el.style.setProperty('max-width', value, 'important');
        }
      }
    });
  };
  const apply = (value) => tcrWithMergeLayout(plugin, table, () => {
    if (value === null) restore();
    else {
      // Measure proportions before changing the table width.
      normalize();
      host?.classList.add('tcr-width-host');
      table.classList.add('tcr-width-custom');
      toolbar.classList.add('tcr-width-custom');
      table.style.setProperty('--tcr-table-width', `${value}%`);
      toolbar.style.setProperty('--tcr-table-width', `${value}%`);
      applyAlignment(true);
    }
    if (slider) {
      slider.value = String(value ?? 100);
      slider.style.setProperty('--tcr-slider-progress', `${((value ?? 100) - 1) / 99 * 100}%`);
      output.value = value === null ? '主题默认' : `${Math.round(value * 10) / 10}%`;
    }
  });
  const setWidth = (value) => {
    if (value === null) {
      delete plugin.settings.tableWidths[fileKey];
      delete plugin.settings.tableColumnRatios[fileKey];
    }
    else plugin.settings.tableWidths[fileKey] = value;
    for (const control of siblings) control.apply(value);
  };
  const setAlignment = value => {
    plugin.settings.tableAlignments[fileKey] = value;
    for (const control of siblings) control.apply(saved());
    plugin.debouncedSave();
  };
  const flush = () => { frame = 0; setWidth(pending); };
  const schedule = value => {
    pending = Math.round(Math.max(1, Math.min(100, value)));
    if (!frame) frame = win.requestAnimationFrame(flush);
  };
  const finishFrame = () => { if (frame) { win.cancelAnimationFrame(frame); flush(); } };
  const position = () => {
    if (!menu || menu.classList.contains('is-dragging')) return;
    tcrPositionMenu(menu, button.getBoundingClientRect(), win);
  };
  const route = event => {
    if (event.type === 'keydown') {
      if (event.key === 'Escape') { event.preventDefault(); close(); button.focus(); }
    } else if (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'blur') {
      menu?.classList.remove('is-dragging');
      finishFrame();
      plugin.debouncedSave();
    } else if (event.type === 'pointerdown') {
      if (!menu.contains(event.target) && !button.contains(event.target)) close();
    } else position();
  };
  const events = ['pointerdown', 'keydown', 'scroll', 'pointerup', 'pointercancel'];
  const close = () => {
    if (!menu) return;
    finishFrame();
    plugin.debouncedSave();
    menu.remove();
    menu = slider = output = alignButtons = null;
    button.setAttribute('aria-expanded', 'false');
    for (const type of events) doc.removeEventListener(type, route, true);
    win.removeEventListener('resize', route);
    win.removeEventListener('blur', route);
    win.visualViewport?.removeEventListener('resize', route);
    win.visualViewport?.removeEventListener('scroll', route);
    if (plugin._activeWidthMenu === control) plugin._activeWidthMenu = null;
  };
  const open = keyboard => {
    plugin._activeMergeMenu?.close();
    plugin._activeWidthMenu?.close();
    for (const manager of plugin._fontManagers?.values() || []) manager.active?.close();
    plugin._activeWidthMenu = control;
    menu = doc.createElement('div');
    menu.className = 'tcr-font-menu tcr-width-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '表格宽度');
    menu.setAttribute('contenteditable', 'false');
    menu.innerHTML = '<div class="tcr-font-heading">表格宽度<output class="tcr-font-value"></output></div><div class="tcr-font-slider-row"><span>窄</span><input type="range" min="1" max="100" step="1" aria-label="表格宽度百分比"><span>宽</span></div><div class="tcr-width-alignment" role="group" aria-label="表格对齐"><button type="button" data-alignment="left" aria-pressed="false">居左</button><button type="button" data-alignment="center" aria-pressed="true">居中</button><button type="button" data-alignment="right" aria-pressed="false">居右</button></div><button type="button" class="tcr-font-reset">恢复默认宽度</button>';
    slider = menu.querySelector('input'); output = menu.querySelector('output');
    alignButtons = Array.from(menu.querySelectorAll('[data-alignment]'));
    for (const button of alignButtons) button.addEventListener('click', () => setAlignment(button.dataset.alignment));
    for (const type of ['pointerdown', 'mousedown', 'click']) menu.addEventListener(type, event => event.stopPropagation());
    slider.addEventListener('input', () => schedule(Number(slider.value)));
    slider.addEventListener('change', () => { finishFrame(); plugin.debouncedSave(); });
    slider.addEventListener('pointerdown', () => menu.classList.add('is-dragging'));
    menu.querySelector('.tcr-font-reset').addEventListener('click', () => { finishFrame(); setWidth(null); plugin.debouncedSave(); });
    doc.body.append(menu);
    button.setAttribute('aria-expanded', 'true');
    apply(saved()); position();
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) menu.animate([
      {opacity: 0, transform: 'scale(0.92) translateY(-4px)'},
      {opacity: 1, transform: 'scale(1) translateY(0)'}
    ], {duration: 420, easing: 'cubic-bezier(0.22, 0.68, 0.2, 1)'});
    for (const type of events) doc.addEventListener(type, route, true);
    win.addEventListener('resize', route); win.addEventListener('blur', route);
    win.visualViewport?.addEventListener('resize', route);
    win.visualViewport?.addEventListener('scroll', route);
    if (keyboard) slider.focus({preventScroll: true});
  };
  const autoFit = () => {
    finishFrame();
    // The unmerged grid exposes every source column for measurement.
    const layout = tcrWithMergeLayout(plugin, table, () => {
      const parent = toolbar.parentElement;
      const style = win.getComputedStyle(parent);
      const available = parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      return tcrMeasureAutoFit(table, available, plugin.settings.minColumnWidth);
    });
    if (!layout?.widths.length || !(layout.total > 0)) return;
    plugin.settings.tableColumnRatios[fileKey] = layout.widths.map(width => width / layout.total);
    setWidth(Math.max(1, Math.min(100, layout.widthPercent)));
    plugin.debouncedSave();
    const status = toolbar.querySelector('.tcr-copy-status');
    if (status) status.textContent = '已按内容调整列宽和整体宽度';
    position();
  };
  const fitClick = event => {
    event.preventDefault(); event.stopPropagation();
    autoFit();
  };
  fitButton.addEventListener('click', fitClick);
  const click = event => { event.preventDefault(); event.stopPropagation(); menu ? close() : open(event.detail === 0); };
  button.addEventListener('click', click);
  const move = event => {
    if (event.pointerId !== drag?.id) return;
    event.preventDefault();
    schedule((drag.width + (event.clientX - drag.x) * drag.factor) / drag.available * 100);
  };
  const stop = event => {
    if (!drag || event?.pointerId !== undefined && event.pointerId !== drag.id) return;
    const id = drag.id;
    finishFrame();
    drag = null;
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', stop, true);
    doc.removeEventListener('pointercancel', stop, true);
    win.removeEventListener('blur', stop);
    handle.removeEventListener('lostpointercapture', stop);
    if (handle.hasPointerCapture?.(id)) handle.releasePointerCapture(id);
    handle.classList.remove('is-dragging');
    plugin.debouncedSave();
  };
  const start = event => {
    if (event.button !== 0 || event.isPrimary === false || drag) return;
    event.preventDefault(); event.stopPropagation();
    close();
    const parent = toolbar.parentElement, rect = table.getBoundingClientRect();
    const style = win.getComputedStyle(parent);
    const available = parent.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    if (!available) return;
    drag = {id: event.pointerId, x: event.clientX, width: rect.width, available, factor: alignment() === 'center' ? 2 : alignment() === 'right' ? -1 : 1};
    handle.classList.add('is-dragging');
    doc.addEventListener('pointermove', move, {capture: true, passive: false});
    doc.addEventListener('pointerup', stop, true);
    doc.addEventListener('pointercancel', stop, true);
    win.addEventListener('blur', stop);
    handle.addEventListener('lostpointercapture', stop);
    try { handle.setPointerCapture?.(event.pointerId); } catch (_) { /* Document events retain drag tracking. */ }
  };
  handle.addEventListener('pointerdown', start);
  const control = {
    apply, close, button, handle, fitButton, autoFit,
    get menu() { return menu; },
    rebind(replacement) {
      restore(); table = replacement; capture(); apply(saved()); position();
    },
    destroy() {
      if (disposed) return;
      disposed = true; stop(); close(); restore();
      button.removeEventListener('click', click); handle.removeEventListener('pointerdown', start);
      fitButton.removeEventListener('click', fitClick);
      table.classList.remove('tcr-content-fit');
      button.remove(); fitButton.remove(); handle.remove(); siblings.delete(control);
      if (!siblings.size) plugin._widthKeys.delete(fileKey);
    }
  };
  siblings.add(control); apply(saved());
  return control;
}
