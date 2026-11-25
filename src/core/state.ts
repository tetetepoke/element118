import Phaser from 'phaser';
import { SaveData, newGame, saveGame } from './save';

/** Global event bus shared by all scenes. */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  DISCOVER_ELEMENT: 'discover-element',
  DISCOVER_SUBSTANCE: 'discover-substance',
  DISCOVER_REACTION: 'discover-reaction',
  INVENTORY: 'inventory',
  HP: 'hp',
  SAY: 'say',
  TOAST: 'toast',
  SAVED: 'saved',
  UI_MODE: 'ui-mode',
  OPEN_BOND: 'open-bond',
  OPEN_CODEX: 'open-codex',
  OPEN_MENU: 'open-menu',
} as const;

export const MAX_ATOMS = 9;

class GameState {
  data: SaveData = newGame();

  reset(d?: SaveData) {
    this.data = d ?? newGame();
  }

  flag(name: string): boolean {
    return !!this.data.flags[name];
  }
  setFlag(name: string, v: boolean | number = true) {
    this.data.flags[name] = v;
  }

  atoms(sym: string): number {
    return this.data.atoms[sym] ?? 0;
  }
  addAtom(sym: string, n = 1): boolean {
    const cur = this.atoms(sym);
    if (cur >= MAX_ATOMS) return false;
    this.data.atoms[sym] = Math.min(MAX_ATOMS, cur + n);
    bus.emit(EV.INVENTORY);
    return true;
  }
  takeAtoms(list: string[]): boolean {
    const need: Record<string, number> = {};
    list.forEach((s) => (need[s] = (need[s] ?? 0) + 1));
    for (const [s, n] of Object.entries(need)) if (this.atoms(s) < n) return false;
    for (const [s, n] of Object.entries(need)) this.data.atoms[s] = this.atoms(s) - n;
    bus.emit(EV.INVENTORY);
    return true;
  }

  count(id: string): number {
    return this.data.substances[id] ?? 0;
  }
  addSubstance(id: string, n = 1) {
    this.data.substances[id] = this.count(id) + n;
    bus.emit(EV.INVENTORY);
  }
  useSubstance(id: string): boolean {
    if (this.count(id) <= 0) return false;
    this.data.substances[id] = this.count(id) - 1;
    if (this.data.equipped === id && this.count(id) === 0) {
      /* keep equipped so the button shows "0"; player can make more */
    }
    bus.emit(EV.INVENTORY);
    return true;
  }

  knows(kind: 'elements' | 'substances' | 'reactions' | 'bondKinds', id: string): boolean {
    return this.data.discovered[kind].includes(id);
  }
  /** Returns true when this is a new discovery. */
  discover(kind: 'elements' | 'substances' | 'reactions' | 'bondKinds', id: string): boolean {
    if (this.knows(kind, id)) return false;
    this.data.discovered[kind].push(id);
    return true;
  }

  hasParty(id: string) {
    return this.data.party.includes(id);
  }
  joinParty(id: string) {
    if (!this.hasParty(id)) this.data.party.push(id);
    const a = this.data.activeParty;
    if (!a.includes(id) && a.length < 2) a.push(id);
  }
  /** Travelling with Carbon now (max 2 of the recruited). */
  isActive(id: string) {
    return this.data.activeParty.includes(id);
  }
  setActiveParty(ids: string[]) {
    this.data.activeParty = ids.filter((id) => this.hasParty(id)).slice(0, 2);
  }
  addMarker(m: { id: string; x: number; y: number; label: string }) {
    if (this.data.markers.some((x) => x.id === m.id && x.stage === this.data.stage)) return false;
    this.data.markers.push({ ...m, stage: this.data.stage });
    return true;
  }
  /** Scene key of the current stage. */
  get worldKey() {
    return this.data.stage >= 2 ? 'Valley' : 'World';
  }

  save(): boolean {
    const ok = saveGame(this.data);
    bus.emit(EV.SAVED, ok);
    return ok;
  }
}

export const game = new GameState();

/** Input state written by the UI scene (touch + keyboard), read by the World scene. */
export const input = {
  moveX: 0,
  moveY: 0,
  attack: false, // edge-triggered: consumer clears
  dodge: false,
  guard: false, // held
  guardPressedAt: 0,
  element: false,
  bond: false,
  menu: false,
  codex: false,
  form: false, // BOND/BREAK the CHARACTER BOND form
  swap: false, // switch control between Carbon and the split partner
  clearEdges() {
    this.attack = this.dodge = this.element = this.bond = this.menu = this.codex = this.form = this.swap = false;
  },
};

export const ui = {
  /** True while a dialogue box, panel or ceremony owns the input. */
  locked: false,
  /** Label for the A button ("攻撃" or "調べる"). */
  aLabel: '攻撃',
  /** Label of the FORM button ('' = hidden): 'C＋Si' (BOND) or 'BREAK'. */
  formLabel: '',
  /** Show the 交代 (switch control) button. */
  swapVisible: false,
};
