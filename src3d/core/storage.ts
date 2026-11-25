// 3D prototype storage. Its own prefix — it never reads or writes the 2D save (element118.save.*)
// or any other project's keys.
const PREFIX = 'element118.3d.';

export function load3d<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(PREFIX + key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function save3d(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / full storage: the prototype still runs */
  }
}

export function reset3d() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
