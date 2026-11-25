import { SAVE_PREFIX } from '../config';

/**
 * The ONLY module allowed to touch browser storage (scripts/validate-data.ts checks this).
 * Every key is forced under the "element118." prefix, so saves from other games on the
 * same github.io origin (for example Rain) are never read, written or deleted.
 */
function fullKey(name: string): string {
  if (!name || name.includes(' ')) throw new Error(`bad storage key: ${name}`);
  return SAVE_PREFIX + name;
}

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get(name: string): string | null {
    try {
      return ls()?.getItem(fullKey(name)) ?? null;
    } catch {
      return null;
    }
  },
  set(name: string, value: string): boolean {
    try {
      const s = ls();
      if (!s) return false;
      s.setItem(fullKey(name), value);
      return true;
    } catch {
      return false;
    }
  },
  remove(name: string): void {
    try {
      ls()?.removeItem(fullKey(name));
    } catch {
      /* ignore */
    }
  },
  /** Removes only keys that start with "element118.". Never calls clear(). */
  removeAllOwnKeys(): number {
    const s = ls();
    if (!s) return 0;
    const own: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(SAVE_PREFIX)) own.push(k);
    }
    own.forEach((k) => s.removeItem(k));
    return own.length;
  },
};
