// Independent table-font controls for Table Column Resize. No table wrappers
// are introduced, preserving the renderer's table and column-resize structure.
function setupTableFont(plugin, table, fileKey) {
  if (!table || !table.parentNode || !fileKey) return;
  plugin._fontControls ||= new Set();
  plugin._fontTables ||= new WeakMap();
  plugin._fontKeys ||= new Map();
  const existing = plugin._fontTables.get(table);
  if (existing) return existing;
  const doc = table.ownerDocument;
  const win = doc.defaultView;
  const scope = table.closest('.markdown-source-view, .markdown-preview-view');
  let siblings = plugin._fontKeys.get(fileKey);
  if (siblings) {
    for (const control of siblings) {
      if (control.doc === doc && !control.table.isConnected && control.scope === scope) {
        control.rebind(table);
        return control;
      }
    }
  } else plugin._fontKeys.set(fileKey, siblings = new Set());
  plugin.settings.tableFontSizes ||= {};
  const manager = tableFontManager(plugin, doc);
  let original, originalPriority, originalClass, originalMarker;
  const captureOriginal = () => {
    original = table.style.getPropertyValue('--tcr-font-size');
    originalPriority = table.style.getPropertyPriority('--tcr-font-size');
    originalClass = table.classList.contains('tcr-font-custom');
    originalMarker = table.getAttribute('data-tcr-font');
  };
  captureOriginal();
  table.setAttribute('data-tcr-font', '1');
  const toolbar = doc.createElement('div');
  toolbar.className = 'tcr-font-toolbar';
  toolbar.setAttribute('contenteditable', 'false');
  toolbar.innerHTML = '<button type="button" class="tcr-copy-button" title="复制表格" aria-label="复制表格"></button><button type="button" class="tcr-font-button" title="调整此表格字号" aria-haspopup="dialog" aria-expanded="false">Aa</button><span class="tcr-copy-status" role="status"></span>';
  const [copyButton, button, copyStatus] = toolbar.children;
  import_obsidian2.setIcon(copyButton, 'copy');
  table.parentNode.insertBefore(toolbar, table);
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  let menu = null;
  let slider = null;
  let output = null;
  let disposed = false;
  let detachTimer = null;
  let copyTimer = null;
  const validSize = (size) => Number.isFinite(size) && size >= 10 && size <= 40;
  const savedSize = () => {
    const size = plugin.settings.tableFontSizes[fileKey];
    return validSize(size) ? size : null;
  };
  const restoreProperty = () => {
    if (original) table.style.setProperty('--tcr-font-size', original, originalPriority);
    else table.style.removeProperty('--tcr-font-size');
    table.classList.toggle('tcr-font-custom', originalClass);
  };
  const apply = (size) => {
    if (size === null) restoreProperty();
    else {
      table.classList.add('tcr-font-custom');
      table.style.setProperty('--tcr-font-size', `${size}px`);
    }
    if (slider) {
      const current = size ?? (Math.round(parseFloat(win.getComputedStyle(table.querySelector('th, td') || table).fontSize)) || 16);
      slider.value = String(Math.max(10, Math.min(40, current)));
      slider.style.setProperty('--tcr-slider-progress', `${(Number(slider.value) - 10) / 30 * 100}%`);
      slider.setAttribute('aria-valuetext', `${current} 像素${size === null ? '，主题默认' : ''}`);
      output.value = size === null ? `默认 · ${current} px` : `${size} px`;
    }
    button.setAttribute('aria-label', `调整此表格字号，${size === null ? '主题默认' : `${size} 像素`}`);
  };
  const close = (restoreFocus = false) => {
    if (!menu) return;
    menu.remove();
    menu = slider = output = null;
    if (manager.active === control) manager.active = null;
    button.setAttribute('aria-expanded', 'false');
    if (!disposed && !table.isConnected) control.checkConnected();
    if (restoreFocus && button.isConnected) button.focus();
  };
  const setSize = (size) => {
    if (size === null) delete plugin.settings.tableFontSizes[fileKey];
    else if (validSize(size)) plugin.settings.tableFontSizes[fileKey] = size;
    else return;
    for (const control of siblings) control.apply(size);
    plugin.debouncedSave();
  };
  const positionMenu = () => {
    if (!menu || !button.isConnected || menu.classList.contains('is-dragging')) return;
    const anchor = button.getBoundingClientRect();
    tcrPositionMenu(menu, anchor, win);
  };
  const open = (keyboard = false) => {
    plugin._activeWidthMenu?.close();
    plugin._activeMergeMenu?.close();
    manager.active?.close();
    manager.bind();
    manager.active = control;
    menu = doc.createElement('div');
    menu.className = 'tcr-font-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '表格字号');
    menu.setAttribute('contenteditable', 'false');
    // The popover lives outside CodeMirror. Keep editor/table event delegates
    // from interpreting its controls as a new editor selection.
    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    menu.addEventListener('mousedown', (event) => event.stopPropagation());
    menu.addEventListener('click', (event) => event.stopPropagation());
    menu.innerHTML = '<div class="tcr-font-heading">表格字号<output class="tcr-font-value"></output></div><div class="tcr-font-slider-row"><span aria-hidden="true">A</span><input type="range" min="10" max="40" step="1" aria-label="表格字号（像素）"><span aria-hidden="true">A</span></div><button type="button" class="tcr-font-reset">恢复默认字号</button>';
    output = menu.querySelector('output');
    slider = menu.querySelector('input');
    const reset = menu.querySelector('button');
    slider.addEventListener('input', () => setSize(Number(slider.value)));
    slider.addEventListener('pointerdown', () => menu?.classList.add('is-dragging'));
    slider.addEventListener('lostpointercapture', () => menu?.classList.remove('is-dragging'));
    reset.addEventListener('click', () => setSize(null));
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && doc.activeElement === slider) {
        event.preventDefault();
        reset.focus();
      } else if (!event.shiftKey && doc.activeElement === reset) {
        event.preventDefault();
        slider.focus();
      }
    });
    doc.body.append(menu);
    button.setAttribute('aria-expanded', 'true');
    apply(savedSize());
    positionMenu();
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      menu.animate([
        { opacity: 0, transform: 'scale(0.92) translateY(-4px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' }
      ], { duration: 420, easing: 'cubic-bezier(0.22, 0.68, 0.2, 1)' });
    }
    // Mouse opening keeps the editor's selection; keyboard opening moves into
    // the dialog so arrows, Tab and Escape remain accessible.
    if (keyboard) slider.focus({ preventScroll: true });
  };
  const control = {
    table, fileKey, doc, toolbar, button, apply, close, positionMenu,
    get menu() { return menu; },
    scope,
    wasConnected: table.isConnected,
    rebind(replacement) {
      if (detachTimer !== null) win.clearTimeout(detachTimer);
      detachTimer = null;
      restoreProperty();
      if (originalMarker === null) table.removeAttribute('data-tcr-font');
      else table.setAttribute('data-tcr-font', originalMarker);
      plugin._fontTables.delete(table);
      table = replacement;
      plugin._fontTables.set(table, control);
      control.table = replacement;
      captureOriginal();
      table.setAttribute('data-tcr-font', '1');
      table.parentNode.insertBefore(toolbar, table);
      control.wasConnected = table.isConnected;
      control.scope ||= table.closest('.markdown-source-view, .markdown-preview-view');
      mergeControl.renderer.restore();
      inputControl.rebind(table);
      citations.rebind(table);
      widthControl.rebind(table);
      mergeControl.rebind(table);
      apply(savedSize());
      positionMenu();
    },
    checkConnected() {
      if (disposed) return;
      if (table.isConnected) {
        control.wasConnected = true;
        control.scope ||= table.closest('.markdown-source-view, .markdown-preview-view');
        if (detachTimer !== null) win.clearTimeout(detachTimer);
        detachTimer = null;
      } else if (control.wasConnected && detachTimer === null) {
        // Live Preview may replace the table while a range owns pointer/focus.
        // Give its next render a chance to adopt the existing dialog.
        detachTimer = win.setTimeout(() => {
          detachTimer = null;
          if (!table.isConnected) {
            const owner = plugin.app.workspace.getLeavesOfType('markdown').find(leaf => control.scope && leaf.view.containerEl.contains(control.scope));
            // A focused editor may virtualize the whole table while the dialog
            // owns the pointer. Keep its saved key usable until it is closed.
            if (menu && control.scope?.isConnected && owner?.view.file?.path === fileKey.split('::')[0]) return;
            control.destroy();
          }
        }, menu ? 1500 : 100);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      if (detachTimer !== null) win.clearTimeout(detachTimer);
      if (copyTimer !== null) win.clearTimeout(copyTimer);
      close();
      for (const remove of listeners) remove();
      mergeControl.destroy();
      citations.destroy();
      inputControl.destroy();
      widthControl.destroy();
      toolbar.remove();
      restoreProperty();
      if (originalMarker === null) table.removeAttribute('data-tcr-font');
      else table.setAttribute('data-tcr-font', originalMarker);
      plugin._fontControls.delete(control);
      plugin._fontTables.delete(table);
      siblings.delete(control);
      if (!siblings.size) plugin._fontKeys.delete(fileKey);
    }
  };
  const inputControl = setupTableInput(table);
  const citations = setupTableCitations(plugin, table, fileKey);
  const widthControl = setupTableWidth(plugin, table, fileKey, toolbar);
  control.widthControl = widthControl;
  const mergeControl = setupTableMerge(plugin, table, fileKey, toolbar);
  control.mergeControl = mergeControl;
  plugin._fontControls.add(control);
  plugin._fontTables.set(table, control);
  siblings.add(control);
  listen(toolbar, 'pointerdown', (event) => event.stopPropagation());
  listen(toolbar, 'mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  listen(copyButton, 'click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (copyButton.disabled) return;
    copyButton.disabled = true;
    try {
      await copyTableContent(plugin, table);
      if (disposed) return;
      if (copyTimer !== null) win.clearTimeout(copyTimer);
      import_obsidian2.setIcon(copyButton, 'check');
      copyButton.classList.add('is-copied');
      copyButton.title = '已复制表格';
      copyStatus.textContent = '已复制表格';
      copyTimer = win.setTimeout(() => {
        copyTimer = null;
        import_obsidian2.setIcon(copyButton, 'copy');
        copyButton.classList.remove('is-copied');
        copyButton.title = '复制表格';
        copyStatus.textContent = '';
      }, 1600);
    } catch (error) {
      new import_obsidian2.Notice('复制表格失败，请重新点击复制按钮');
      console.error('Table Column Resize: copy failed', error);
    } finally {
      if (!disposed) copyButton.disabled = false;
    }
  });
  listen(button, 'click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (menu) close();
    else open(event.detail === 0);
  });
  apply(savedSize());
  return control;
}

// One document router replaces nine global listeners per rendered table.
function tableFontManager(plugin, doc) {
  plugin._fontManagers ||= new Map();
  if (plugin._fontManagers.has(doc)) return plugin._fontManagers.get(doc);
  const win = doc.defaultView;
  const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchmove', 'resize', 'pointerup', 'pointercancel', 'blur'];
  const pending = new Set();
  let frame = 0;
  const route = (event) => {
    const control = manager.active;
    if (!control) return;
    const menu = control.menu;
    switch (event.type) {
      case 'keydown':
        if (event.key === 'Escape') { event.preventDefault(); control.close(true); }
        break;
      case 'scroll':
        if (!menu.contains(event.target)) control.positionMenu();
        break;
      case 'pointerup': case 'pointercancel': case 'blur':
        menu.classList.remove('is-dragging');
        break;
      case 'resize': control.positionMenu(); break;
      default:
        if (!menu.contains(event.target) && (event.type !== 'pointerdown' || !control.button.contains(event.target)) &&
            (event.type !== 'touchmove' || !menu.classList.contains('is-dragging'))) control.close();
    }
  };
  const target = (type) => type === 'resize' || type === 'blur' ? win : doc;
  const options = (type) => type === 'scroll' ? true : type === 'wheel' || type === 'touchmove' ? {passive: true} : false;
  const observer = new win.MutationObserver((records) => {
    // Only added/removed font tables can change connectivity. Menu animation,
    // editor cursors and unrelated document updates do not scan all controls.
    const collect = (node) => {
      if (node.nodeType !== 1) return;
      const own = plugin._fontTables.get(node);
      if (own) pending.add(own);
      for (const table of node.querySelectorAll('[data-tcr-font]')) {
        const control = plugin._fontTables.get(table);
        if (control) pending.add(control);
      }
    };
    for (const record of records) {
      for (const node of record.addedNodes) collect(node);
      for (const node of record.removedNodes) collect(node);
    }
    if (pending.size && !frame) frame = win.requestAnimationFrame(() => {
      frame = 0;
      for (const control of pending) control.checkConnected();
      pending.clear();
    });
  });
  observer.observe(doc.body, {childList: true, subtree: true});
  const manager = {
    active: null, listenerCount: 0,
    bind() {
      if (manager.listenerCount) return;
      for (const type of events) target(type).addEventListener(type, route, options(type));
      win.visualViewport?.addEventListener('resize', route);
      win.visualViewport?.addEventListener('scroll', route);
      manager.listenerCount = events.length;
    },
    destroy() {
      observer.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      pending.clear();
      if (manager.listenerCount) for (const type of events) target(type).removeEventListener(type, route, options(type));
      win.visualViewport?.removeEventListener('resize', route);
      win.visualViewport?.removeEventListener('scroll', route);
      manager.listenerCount = 0;
    }
  };
  plugin._fontManagers.set(doc, manager);
  return manager;
}

function cleanupTableFonts(plugin) {
  for (const finish of plugin._tableDragCleanup || []) finish();
  plugin._tableDragCleanup?.clear();
  for (const manager of plugin._fontManagers?.values() || []) manager.destroy();
  plugin._fontManagers?.clear();
  for (const control of plugin._fontControls || []) control.destroy();
  plugin._fontKeys?.clear();
}
