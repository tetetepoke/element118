// InputManager: every device (keyboard + mouse, touch, gamepad) is turned into the same common input —
// Move X/Y, Camera X/Y and Actions (Jump, Interact, Bond, Break, …). PlayerController and the camera
// only read that; adding a new device never touches game code.
//
//   Touch / Keyboard+Mouse / Gamepad  →  InputManager (this file)  →  PlayerController / Camera / game
import { INPUT_CONFIG as CFG, defaultPlayerSettings, type ActionName, type PadControl, type PlayerInputSettings } from './inputConfig';

export type InputDevice = 'touch' | 'keyboard' | 'gamepad';

export interface InputState {
  moveX: number; // -1..1 (right +), camera relative
  moveY: number; // -1..1 (forward = into the screen +)
  lookX: number; // camera yaw change this frame (radians)
  lookY: number; // camera pitch change this frame (radians, + = look up)
  run: boolean;
  // edges (true for one frame)
  jump: boolean;
  action: boolean; // Interact
  bond: boolean;
  breakForm: boolean; // Break
  form: boolean; // keyboard Q: BOND or BREAK, whichever fits
  scan: boolean;
  menu: boolean;
  codex: boolean; // Map / codex
  toolPrev: boolean;
  toolNext: boolean;
  actionL: boolean;
  actionR: boolean;
  stickL: boolean;
  stickR: boolean;
}

export const input: InputState = {
  moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false,
  jump: false, action: false, bond: false, breakForm: false, form: false, scan: false, menu: false, codex: false,
  toolPrev: false, toolNext: false, actionL: false, actionR: false, stickL: false, stickR: false,
};

const EDGE_FIELD: Record<ActionName, keyof InputState | null> = {
  Jump: 'jump', Interact: 'action', Bond: 'bond', Break: 'breakForm', Form: 'form', Scan: 'scan', Menu: 'menu', Map: 'codex',
  Run: null, ToolPrev: 'toolPrev', ToolNext: 'toolNext', ActionL: 'actionL', ActionR: 'actionR', StickL: 'stickL', StickR: 'stickR',
};
function fire(a: ActionName) {
  const f = EDGE_FIELD[a];
  if (f) (input as unknown as Record<string, boolean>)[f] = true;
}

// ── player settings (sensitivity, invert Y) ──
export const settings: PlayerInputSettings = defaultPlayerSettings();
export function applySettings(s: Partial<PlayerInputSettings>) { Object.assign(settings, s); }

// ── last input device ──
let lastDevice: InputDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window ? 'touch' : 'keyboard';
const deviceListeners: ((d: InputDevice) => void)[] = [];
const padListeners: ((id: string, connected: boolean) => void)[] = [];
export function getLastDevice() { return lastDevice; }
export function onDeviceChange(fn: (d: InputDevice) => void) { deviceListeners.push(fn); fn(lastDevice); }
export function onGamepad(fn: (id: string, connected: boolean) => void) { padListeners.push(fn); }
function useDevice(d: InputDevice) {
  if (d === lastDevice) return;
  lastDevice = d;
  for (const f of deviceListeners) f(d);
}

export function endFrame() {
  input.lookX = input.lookY = 0;
  for (const f of Object.values(EDGE_FIELD)) if (f) (input as unknown as Record<string, boolean>)[f] = false;
}

// ── keyboard + mouse ──
const keys = new Set<string>();
let mouseDX = 0, mouseDY = 0;
export function initKeyboardMouse(canvas: HTMLCanvasElement) {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.repeat) return;
    useDevice('keyboard');
    for (const [a, codes] of Object.entries(CFG.keyboard)) if (codes?.includes(e.code)) fire(a as ActionName);
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  let dragging = false;
  canvas.addEventListener('mousedown', (e) => {
    if ((e as MouseEvent).sourceCapabilities?.firesTouchEvents) return;
    dragging = true;
    if (CFG.pointerLock && !matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas || dragging) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
      useDevice('keyboard');
    }
  });
}
declare global { interface MouseEvent { sourceCapabilities?: { firesTouchEvents: boolean } } }

// ── touch: left = move stick, right = camera stick (both at once, multi-touch) ──
const touchMove = { x: 0, y: 0, active: false };
const touchCam = { x: 0, y: 0, active: false };
interface StickEls { base: HTMLElement; knob: HTMLElement }
export function initTouch(root: HTMLElement, stickBase: HTMLElement, stickKnob: HTMLElement, camBase?: HTMLElement, camKnob?: HTMLElement) {
  const R = CFG.touchStickRadius;
  const sticks: Record<'move' | 'cam', { id: number | null; ox: number; oy: number; els?: StickEls; out: typeof touchMove }> = {
    move: { id: null, ox: 0, oy: 0, els: { base: stickBase, knob: stickKnob }, out: touchMove },
    cam: { id: null, ox: 0, oy: 0, els: camBase && camKnob ? { base: camBase, knob: camKnob } : undefined, out: touchCam },
  };
  const show = (s: typeof sticks.move, x: number, y: number) => {
    if (!s.els) return;
    s.els.base.style.display = s.els.knob.style.display = 'block';
    s.els.base.style.transform = `translate(${s.ox - 70}px, ${s.oy - 70}px)`;
    s.els.knob.style.transform = `translate(${x - 30}px, ${y - 30}px)`;
  };
  root.addEventListener('touchstart', (e) => {
    useDevice('touch');
    for (const t of Array.from(e.changedTouches)) {
      if ((t.target as HTMLElement).closest?.('.btn')) continue;
      const s = t.clientX < window.innerWidth * 0.5 ? sticks.move : sticks.cam;
      if (s.id !== null) continue;
      s.id = t.identifier;
      s.ox = t.clientX;
      s.oy = t.clientY;
      s.out.x = s.out.y = 0;
      s.out.active = true;
      show(s, t.clientX, t.clientY);
    }
    e.preventDefault();
  }, { passive: false });
  root.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      for (const s of [sticks.move, sticks.cam]) {
        if (t.identifier !== s.id) continue;
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        s.out.x = dx / R;
        s.out.y = -dy / R;
        show(s, s.ox + dx, s.oy + dy);
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      for (const s of [sticks.move, sticks.cam]) {
        if (t.identifier !== s.id) continue;
        s.id = null;
        s.out.x = s.out.y = 0;
        s.out.active = false; // the camera keeps the angle it reached
        if (s.els) s.els.base.style.display = s.els.knob.style.display = 'none';
      }
    }
  };
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);
}

/** Wire an on-screen button to an Action (touch and mouse). */
export function bindButton(el: HTMLElement, fn: () => void) {
  const press = (e: Event) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); if (e.type === 'touchstart') useDevice('touch'); fn(); };
  const up = () => el.classList.remove('down');
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('mousedown', press);
  el.addEventListener('touchend', up);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}
export function bindAction(el: HTMLElement, a: ActionName) { bindButton(el, () => fire(a)); }

// ── gamepad (Web Gamepad API, any maker) ──
export type PadStyle = 'nintendo' | 'xbox' | 'playstation';
let padIndex: number | null = null;
let padStyle: PadStyle = 'xbox';
const padPrev = new Map<PadControl, boolean>();
const known = new Set<string>();
export function getPadStyle() { return padStyle; }
function styleOf(id: string): PadStyle {
  const s = id.toLowerCase();
  if (/nintendo|pro controller|joy-con|057e/.test(s)) return 'nintendo';
  if (/playstation|dualsense|dualshock|054c|wireless controller/.test(s)) return 'playstation';
  return 'xbox';
}
window.addEventListener('gamepadconnected', (e) => noticePad((e as GamepadEvent).gamepad));
window.addEventListener('gamepaddisconnected', (e) => {
  const g = (e as GamepadEvent).gamepad;
  known.delete(g.id + g.index);
  if (padIndex === g.index) padIndex = null;
  for (const f of padListeners) f(g.id, false);
});
function noticePad(g: Gamepad) {
  const key = g.id + g.index;
  if (known.has(key)) return;
  known.add(key);
  padIndex = g.index;
  padStyle = styleOf(g.id);
  for (const f of padListeners) f(g.id, true);
}
/** label printed on the button for an action, for on-screen hints */
export function padLabel(a: ActionName) {
  const c = CFG.gamepad[a]?.[0];
  return c ? CFG.labels[padStyle][c] ?? c : '';
}

const dead = (x: number, y: number, dz: number) => {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m; // rescale so the edge of the dead zone is 0
  return [x * k, y * k];
};

/** Combine all devices into `input`. Call once per frame, before the game reads input. */
export function pollInput(dt = 1 / 60) {
  let x = 0, y = 0;
  const has = (list: string[]) => list.some((k) => keys.has(k));
  if (has(CFG.moveKeys.left)) x -= 1;
  if (has(CFG.moveKeys.right)) x += 1;
  if (has(CFG.moveKeys.up)) y += 1;
  if (has(CFG.moveKeys.down)) y -= 1;
  let run = has(CFG.keyboard.Run ?? []);
  const inv = settings.invertY ? -1 : 1;
  // mouse
  if (mouseDX || mouseDY) {
    input.lookX -= mouseDX * CFG.sensitivity.mouse * settings.mouse;
    input.lookY -= mouseDY * CFG.sensitivity.mouse * CFG.pitchScale * settings.mouse * inv;
    mouseDX = mouseDY = 0;
  }
  // touch sticks
  if (touchMove.active) {
    const [tx, ty] = dead(touchMove.x, touchMove.y, CFG.deadZone.touchMove);
    x = tx; y = ty;
    run = run || Math.hypot(touchMove.x, touchMove.y) > CFG.runThreshold;
  }
  if (touchCam.active) {
    const [cx, cy] = dead(touchCam.x, touchCam.y, CFG.deadZone.touchCamera);
    const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 1.6; // fine control near the centre
    input.lookX -= curve(cx) * CFG.sensitivity.touch * settings.touch * dt;
    input.lookY += curve(cy) * CFG.sensitivity.touch * CFG.pitchScale * settings.touch * dt * inv;
  }
  // gamepad
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  let gp = padIndex !== null ? pads[padIndex] ?? null : null;
  if (!gp) gp = pads.find((p) => p && p.connected) ?? null;
  if (gp) {
    noticePad(gp);
    const A = CFG.standardAxes;
    const [gx, gy] = dead(gp.axes[A.lx] ?? 0, gp.axes[A.ly] ?? 0, CFG.deadZone.move);
    const [rx, ry] = dead(gp.axes[A.rx] ?? 0, gp.axes[A.ry] ?? 0, CFG.deadZone.camera);
    let active = !!(gx || gy || rx || ry);
    if (gx || gy) { x = gx; y = -gy; run = run || Math.hypot(gx, gy) > CFG.runThreshold; }
    if (rx || ry) {
      const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 1.5;
      input.lookX -= curve(rx) * CFG.sensitivity.gamepad * settings.gamepad * dt;
      input.lookY -= curve(ry) * CFG.sensitivity.gamepad * CFG.pitchScale * settings.gamepad * dt * inv;
    }
    for (const [a, ctrls] of Object.entries(CFG.gamepad)) {
      for (const c of ctrls ?? []) {
        const now = !!gp.buttons[CFG.standardButtons[c]]?.pressed;
        if (now && !padPrev.get(c)) { fire(a as ActionName); active = true; }
        padPrev.set(c, now);
      }
    }
    if (active) useDevice('gamepad');
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  input.moveX = x;
  input.moveY = y;
  input.run = run;
}
