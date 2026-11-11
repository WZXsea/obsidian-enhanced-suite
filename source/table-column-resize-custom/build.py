from pathlib import Path
import json
import subprocess
root = Path(__file__).resolve().parent
js = (root / 'upstream/main.js').read_text()
def replace_once(old, new):
    global js
    if js.count(old) != 1:
        raise RuntimeError(f'Unexpected upstream structure: {old[:70]}')
    js = js.replace(old, new, 1)
replace_once('    await this.loadSettings();', '    await this.loadSettings();\n    this.getTableCopyContent = table => getTableCopyContent(this, table);')
replace_once('  if (table.hasAttribute("data-tcr"))\n    return;', '''  if (table.hasAttribute("data-tcr")) {
    const existingHeader = table.querySelector("thead tr") ?? table.querySelector("tr");
    if (existingHeader) setupTableFont(plugin, table, `${filePath}::${tableFingerprint(existingHeader.querySelectorAll("th, td"))}`);
    return;
  }''')
replace_once('"table:not([data-tcr])"', '"table"')
replace_once('        setupTableResize(plugin, table, filePath);', '''        if (plugin._fontTables?.has(table)) return;
        const previous = table.previousElementSibling;
        if (previous?.classList.contains("tcr-font-toolbar")) previous.remove();
        table.querySelectorAll(".tcr-handle").forEach(handle => handle.remove());
        table.removeAttribute("data-tcr");
        table.removeAttribute("data-tcr-font");
        setupTableResize(plugin, table, filePath);''')
replace_once('    attachDragBehavior(plugin, handle, cols, headerCells, i, fileKey, colCount, applyWidth);\n  }\n}', '    attachDragBehavior(plugin, handle, cols, headerCells, i, fileKey, colCount, applyWidth);\n  }\n  setupTableFont(plugin, table, fileKey);\n}')
replace_once('    document.body.classList.remove("tcr-resizing");\n  }\n  async loadSettings()', '    cleanupTableFonts(this);\n    document.body.classList.remove("tcr-resizing");\n  }\n  async loadSettings()')
replace_once('      columnWidths: (_a = data == null ? void 0 : data.columnWidths) != null ? _a : {},', '''      columnWidths: (_a = data == null ? void 0 : data.columnWidths) != null ? _a : {},
      tableMerges: data?.tableMerges ?? {},
      tableWidths: data?.tableWidths ?? {},
      tableColumnRatios: data?.tableColumnRatios ?? {},
      tableAlignments: data?.tableAlignments ?? {},
      tableFontSizes: Object.fromEntries(Object.entries(data?.tableFontSizes ?? {}).filter(([key, size]) => typeof size === "number" && Number.isFinite(size) && size >= 10 && size <= 40)),''')
replace_once('      const filePath = (_b = (_a = plugin.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : "_unknown";', '''      const owner = plugin.app.workspace.getLeavesOfType("markdown").find(leaf => leaf.view.containerEl.contains(this.view.dom));
      const filePath = owner?.view.file?.path ?? plugin.app.workspace.getActiveFile()?.path ?? "_unknown";''')
replace_once('  tables.forEach((table) => {\n    setupTableResize(plugin, table, ctx.sourcePath);', '  tables.forEach((table, ordinal) => {\n    const info = ctx.getSectionInfo(el);\n    if (info) table.dataset.tcrSourceLine = String(info.lineStart);\n    table.dataset.tcrSectionOrdinal = String(ordinal);\n    setupTableResize(plugin, table, ctx.sourcePath);')
# Replace only the upstream drag handler. Keep upstream files available verbatim.
start = js.index('function attachDragBehavior(')
end = js.index('// src/reading-view.ts', start)
js = js[:start] + (root / 'mobile-controls.js').read_text() + '\n\n' + js[end:]
replace_once('    cols[i].style.setProperty("width", `${widthPx}px`, "important");', '    if (table.classList.contains("tcr-width-custom") && colCount > 1) {\n      const total = table.getBoundingClientRect().width;\n      const other = i === colCount - 1 ? i - 1 : i + 1;\n      const pair = headerCells[i].getBoundingClientRect().width + headerCells[other].getBoundingClientRect().width;\n      const min = Math.min(table.classList.contains("tcr-content-fit") ? Math.min(24, plugin.settings.minColumnWidth) : plugin.settings.minColumnWidth, pair / 2);\n      const current = Math.max(min, Math.min(pair - min, widthPx));\n      for (const [index, px] of [[i, current], [other, pair - current]]) {\n        const percent = `${px / total * 100}%`;\n        cols[index].style.setProperty("width", percent, "important");\n        headerCells[index].style.setProperty("width", percent, "important");\n        headerCells[index].style.setProperty("min-width", "0", "important");\n        headerCells[index].style.setProperty("max-width", percent, "important");\n      }\n      return;\n    }\n    const width = table.classList.contains("tcr-width-custom") ? "100%" : `${widthPx}px`;\n    cols[i].style.setProperty("width", width, "important");')
for prop in ['width', 'min-width', 'max-width']:
    replace_once(f'    headerCells[i].style.setProperty("{prop}", `${{widthPx}}px`, "important");', f'    headerCells[i].style.setProperty("{prop}", '+('table.classList.contains("tcr-width-custom") ? "0" : width' if prop == 'min-width' else 'width')+', "important");')
# DOM instrumentation runs once per frame and only for editor/table changes.
replace_once('      this.observer = new MutationObserver(() => {\n        this.instrumentTables();\n      });', "      this.frame = 0;\n      this.observer = new MutationObserver(records => {\n        if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches('table') || node.querySelector('table'))))) this.scheduleTables();\n      });")
replace_once('      this.instrumentTables();\n    }\n    update()', '      this.scheduleTables();\n    }\n    update()')
replace_once('    update() {\n      this.instrumentTables();\n    }\n    instrumentTables() {', '    update(update) {\n      if (update.docChanged || update.viewportChanged) this.scheduleTables();\n    }\n    scheduleTables() {\n      if (!this.frame) this.frame = this.view.dom.ownerDocument.defaultView.requestAnimationFrame(() => {\n        this.frame = 0;\n        this.instrumentTables();\n      });\n    }\n    instrumentTables() {')
replace_once('    destroy() {\n      this.observer.disconnect();\n    }', '    destroy() {\n      this.observer.disconnect();\n      if (this.frame) this.view.dom.ownerDocument.defaultView.cancelAnimationFrame(this.frame);\n    }')
js += '\n// Table clipboard support\n' + (root / 'copy-table.js').read_text()
# The original fingerprint is computed before any control is injected.
for filename in ['merge-identity.js', 'merge-render.js', 'merge-control.js', 'citation-control.js', 'input-control.js']:
    js += '\n' + (root / filename).read_text()
js += '\n// Content-aware column sizing\n' + (root / 'auto-fit.js').read_text()
js += '\n// Whole-table width customization\n' + (root / 'width-control.js').read_text()
js += '\n// Local font-size customization\n' + (root / 'font-control.js').read_text()
(root / 'main.dev.js').write_text(js)
css = (root / 'upstream/styles.css').read_text() + '\n' + (root / 'font-control.css').read_text() + '\n' + (root / 'width-control.css').read_text() + '\n' + (root / 'merge-control.css').read_text()
(root / 'styles.dev.css').write_text(css)
esbuild = root.parent / 'node_modules/.bin/esbuild'
for text, loader, filename in [(js, 'js', 'main.js'), (css, 'css', 'styles.css')]:
    args = [str(esbuild), f'--loader={loader}', '--minify']
    if loader == 'js': args += ['--format=cjs', '--target=es2020']
    result = subprocess.run(args, input=text, text=True, capture_output=True, check=True)
    (root / filename).write_text(result.stdout)
manifest = json.loads((root / 'upstream/manifest.json').read_text())
manifest['version'] = '1.0.4'
manifest['isDesktopOnly'] = False
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Built local Table Column Resize 1.0.4 with content-aware sizing')
