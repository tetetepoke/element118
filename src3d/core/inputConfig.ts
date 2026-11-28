// Input settings. Change values here (or override some of them per player via loadInputSettings).
// Game code never sees keys, touches or button numbers — only the Actions below.

export type ActionName =
  | 'Jump' | 'Interact' | 'Bond' | 'Break' | 'Form' // Form = keyboard Q: BOND or BREAK, whichever fits
  | 'Scan' | 'Menu' | 'Map' | 'Run'
  | 'ToolPrev' | 'ToolNext' // L / R: switch tools (and abilities later)
  | 'ActionL' | 'ActionR' // ZL / ZR: reserved for future actions
  | 'StickL' | 'StickR'; // stick clicks: reserved

/** physical places on a gamepad (not labels — labels differ between makers) */
export type PadControl =
  | 'faceBottom' | 'faceRight' | 'faceLeft' | 'faceTop'
  | 'L' | 'R' | 'ZL' | 'ZR' | 'Minus' | 'Plus' | 'L3' | 'R3' | 'Up' | 'Down' | 'Left' | 'Right' | 'Home';

export const INPUT_CONFIG = {
  deadZone: {
    move: 0.2, // gamepad left stick
    camera: 0.18, // gamepad right stick
    touchMove: 0.12, // fraction of the touch stick radius
    touchCamera: 0.12,
  },
  sensitivity: {
    mouse: 0.0034, // radians per pixel dragged
    touch: 3.0, // radians per second with the right touch stick fully pushed
    gamepad: 3.2, // radians per second with the right stick fully pushed
  },
  pitchScale: 0.75, // vertical camera speed relative to horizontal
  invertY: false,
  runThreshold: 0.9, // stick pushed this far = run
  touchStickRadius: 60, // px
  pointerLock: false, // desktop: drag to look (true = click to capture the mouse)

  keyboard: {
    Jump: ['Space'],
    Interact: ['KeyE', 'Enter', 'KeyJ'],
    Form: ['KeyQ'],
    Scan: ['KeyR', 'KeyF'],
    Menu: ['KeyB', 'KeyI'],
    Map: ['KeyC', 'Tab'],
    Run: ['ShiftLeft', 'ShiftRight'],
    ToolPrev: ['KeyZ'],
    ToolNext: ['KeyX'],
    ActionR: ['KeyG'],
  } as Partial<Record<ActionName, string[]>>,
  moveKeys: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },

  /** Nintendo-style layout by position: A (right) = interact, B (bottom) = jump, X (top) = BOND, Y (left) = BREAK */
  gamepad: {
    Interact: ['faceRight'],
    Jump: ['faceBottom'],
    Bond: ['faceTop'],
    Break: ['faceLeft'],
    ToolPrev: ['L'],
    ToolNext: ['R'],
    ActionL: ['ZL'],
    ActionR: ['ZR'],
    Menu: ['Plus'],
    Map: ['Minus'],
    StickL: ['L3'],
    StickR: ['R3'],
  } as Partial<Record<ActionName, PadControl[]>>,

  /** W3C "standard" gamepad mapping: button index of each physical place */
  standardButtons: {
    faceBottom: 0, faceRight: 1, faceLeft: 2, faceTop: 3, L: 4, R: 5, ZL: 6, ZR: 7,
    Minus: 8, Plus: 9, L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15, Home: 16,
  } as Record<PadControl, number>,
  standardAxes: { lx: 0, ly: 1, rx: 2, ry: 3 },

  /** what is printed on each physical place, per maker (only for on-screen hints) */
  labels: {
    nintendo: { faceBottom: 'B', faceRight: 'A', faceLeft: 'Y', faceTop: 'X', L: 'L', R: 'R', ZL: 'ZL', ZR: 'ZR', Minus: '−', Plus: '＋' },
    xbox: { faceBottom: 'A', faceRight: 'B', faceLeft: 'X', faceTop: 'Y', L: 'LB', R: 'RB', ZL: 'LT', ZR: 'RT', Minus: 'View', Plus: 'Menu' },
    playstation: { faceBottom: '×', faceRight: '○', faceLeft: '□', faceTop: '△', L: 'L1', R: 'R1', ZL: 'L2', ZR: 'R2', Minus: 'Create', Plus: 'Options' },
  } as Record<'nintendo' | 'xbox' | 'playstation', Partial<Record<PadControl, string>>>,
};

/** settings a player may change in the game (stored per game, under that game's own key) */
export interface PlayerInputSettings {
  mouse: number; // multipliers (1 = default)
  touch: number;
  gamepad: number;
  invertY: boolean;
}
export const defaultPlayerSettings = (): PlayerInputSettings => ({ mouse: 1, touch: 1, gamepad: 1, invertY: INPUT_CONFIG.invertY });
