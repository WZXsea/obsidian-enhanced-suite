// Native table clipboard events must expose the cell editor to paste plugins.
const tcrInputEditors = new WeakMap();
function setupTableInput(table) {
  let manager;
  const detach = () => {
    if (!manager) return;
    if (--manager.users === 0) {
      manager.release();
      if (manager.editor.editTableCell === manager.wrapped) {
        if (manager.owned) manager.editor.editTableCell = manager.original;
        else delete manager.editor.editTableCell;
      }
      tcrInputEditors.delete(manager.editor);
    }
    manager = null;
  };
  const rebind = next => {
    detach();
    const editor = next.closest('.cm-table-widget')?.cmTile?.widget?.editor;
    if (!editor) return;
    manager = tcrInputEditors.get(editor);
    if (!manager) {
      let current;
      const release = () => {
        if (current && current.clipboard.info === current.info) current.clipboard.info = current.original;
        current = null;
      };
      const bind = mode => {
        if (!mode?.clipboardManager || current?.mode === mode) return;
        release();
        const clipboard = mode.clipboardManager, original = clipboard.info;
        const info = new Proxy(original, {
          get(target, property) { return property === 'editor' ? mode.editor : Reflect.get(target, property, target); }
        });
        clipboard.info = info;
        current = {mode, clipboard, original, info};
      };
      const original = editor.editTableCell;
      const wrapped = function(...args) { const mode = original.apply(this, args); bind(mode); return mode; };
      manager = {editor, original, wrapped, owned: Object.hasOwn(editor, 'editTableCell'), users: 0, release, bind};
      editor.editTableCell = wrapped;
      tcrInputEditors.set(editor, manager);
    }
    manager.users++;
    manager.bind(editor.tableCell);
  };
  rebind(table);
  return {rebind, destroy: detach};
}
