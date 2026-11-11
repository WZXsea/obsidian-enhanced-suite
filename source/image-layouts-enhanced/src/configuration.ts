import { normalizeOptions } from './model';
import { DEFAULT_OPTIONS, type GalleryGroup, type GalleryOptions } from './types';

/** Note paths keep copied groups with the same short ID independent. */
export type GroupSettings = Record<string, Partial<GalleryOptions>>;

export function groupKey(path: string, id: string): string {
  return JSON.stringify([path, id]);
}

/** Read source overrides before applying persisted details and schema defaults. */
export function getEffectiveOptions(group: GalleryGroup, path: string, settings: GroupSettings): GalleryOptions {
  if (group.kind === 'fence') return group.options;
  const firstLine = group.raw.split(/\r?\n/, 1)[0];
  const marker = /^ {0,3}<!--[ \t]*image-layouts:[ \t]*(.*?)[ \t]*-->[ \t]*$/.exec(firstLine);
  if (!marker) return group.options;
  try {
    const raw: unknown = JSON.parse(marker[1]);
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return group.options;
    return normalizeOptions(raw, settings[groupKey(path, group.options.id)] ?? {});
  } catch {
    // Parsed groups normally guarantee a valid marker; retain their options on stale input.
    return group.options;
  }
}

/** Only actual detailed overrides are persisted; source owns identity and layout. */
export function getStoredOptions(options: GalleryOptions): Partial<GalleryOptions> {
  const canonical = normalizeOptions(options);
  return Object.fromEntries(Object.entries(canonical).filter(([key, value]) =>
    key !== 'id' && key !== 'layout' &&
    JSON.stringify(value) !== JSON.stringify(DEFAULT_OPTIONS[key as keyof GalleryOptions]),
  )) as Partial<GalleryOptions>;
}

/** Vault rename moves a note or a folder's descendants, preserving unrelated records. */
export function renameGroupSettings(settings: GroupSettings, oldPath: string, newPath: string): GroupSettings {
  const renamed = { ...settings };
  if (oldPath === newPath) return renamed;
  const moves: Array<{ oldKey: string; newKey: string; value: Partial<GalleryOptions> }> = [];
  for (const [key, value] of Object.entries(settings)) {
    try {
      const parts: unknown = JSON.parse(key);
      if (!Array.isArray(parts) || parts.length !== 2 ||
        typeof parts[0] !== 'string' || typeof parts[1] !== 'string' ||
        (parts[0] !== oldPath && !parts[0].startsWith(oldPath + '/'))) continue;
      const path = newPath + parts[0].slice(oldPath.length);
      moves.push({ oldKey: key, newKey: groupKey(path, parts[1]), value });
    } catch {
      // Other plugin-data keys remain byte-for-byte named as stored.
    }
  }
  // Resolve from the original snapshot before writing destination keys.
  for (const move of moves) delete renamed[move.oldKey];
  for (const move of moves) renamed[move.newKey] = move.value;
  return renamed;
}
