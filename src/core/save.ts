import { storage } from './storage';

export const SAVE_VERSION = 1;
const SLOT = 'save.slot1';
const BACKUP = 'save.slot1.backup';

export interface SaveData {
  version: number;
  savedAt: string;
  playTimeSec: number;
  player: { x: number; y: number; hp: number; maxHp: number; facing: number };
  checkpoint: { x: number; y: number };
  /** Atoms carried, by element symbol (game abstraction: "元素のかけら"). */
  atoms: Record<string, number>;
  /** Substances carried, by substance id. */
  substances: Record<string, number>;
  equipped: string | null;
  discovered: {
    elements: string[];
    substances: string[];
    reactions: string[];
    /** Kinds of "合わさり方" seen so far (element_bond, covalent, ionic, mixture, reaction). */
    bondKinds: string[];
  };
  party: string[];
  flags: Record<string, boolean | number>;
  stats: { bondAttempts: number; bondFailures: number; enemiesDefeated: number };
}

export function newGame(): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    playTimeSec: 0,
    player: { x: 11 * 16 + 8, y: 87 * 16 + 8, hp: 6, maxHp: 6, facing: 2 },
    checkpoint: { x: 11 * 16 + 8, y: 87 * 16 + 8 },
    atoms: {},
    substances: {},
    equipped: null,
    discovered: { elements: [], substances: [], reactions: [], bondKinds: [] },
    party: [],
    flags: {},
    stats: { bondAttempts: 0, bondFailures: 0, enemiesDefeated: 0 },
  };
}

function isSave(v: unknown): v is SaveData {
  const d = v as SaveData;
  return !!d && typeof d === 'object' && typeof d.version === 'number' && !!d.player && !!d.discovered;
}

/** Upgrade older save formats here (1 -> 2 -> ...). */
function migrate(d: SaveData): SaveData {
  const base = newGame();
  // Fill any field added after this save was written.
  return {
    ...base,
    ...d,
    player: { ...base.player, ...d.player },
    discovered: { ...base.discovered, ...d.discovered },
    stats: { ...base.stats, ...d.stats },
    version: SAVE_VERSION,
  };
}

function parse(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return isSave(v) ? migrate(v) : null;
  } catch {
    return null;
  }
}

export function loadGame(): SaveData | null {
  return parse(storage.get(SLOT)) ?? parse(storage.get(BACKUP));
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function saveGame(d: SaveData): boolean {
  const prev = storage.get(SLOT);
  if (prev && parse(prev)) storage.set(BACKUP, prev);
  d.savedAt = new Date().toISOString();
  return storage.set(SLOT, JSON.stringify(d));
}

export function deleteSave(): void {
  storage.remove(SLOT);
  storage.remove(BACKUP);
}
