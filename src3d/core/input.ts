// One input state, filled by several sources: keyboard + mouse, touch (left stick / right swipe / buttons),
// and gamepads. The game only reads InputState, so new devices plug in here.
export interface InputState {
  moveX: number; // -1..1 (right +)
  moveY: number; // -1..1 (forward +)
  lookX: number; // accumulated yaw delta this frame (radians)
  lookY: number; // pitch delta
  run: boolean;
  jump: boolean; // edge
  action: boolean; // edge: interact / BOND / HARD BREAK
  breakForm: boolean; // edge: BREAK
  codex: boolean; // edge
}

export const input: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false };

const keys = new Set<string>();
let touchMove = { x: 0, y: 0, active: false };
let gamepadIndex: number | null = null;

export function endFrame() {
  input.lookX = input.lookY = 0;
  input.jump = input.action = input.breakForm = input.codex = false;
}

export function initKeyboardMouse(canvas: HTMLCanvasElement) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyE' || e.code === 'KeyJ' || e.code === 'Enter') input.action = true;
    if (e.code === 'KeyQ') input.breakForm = true;
    if (e.code === 'KeyC' || e.code === 'Tab') { input.codex = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  // mouse: pointer lock on click (desktop); dragging also works without the lock
  let dragging = false;
  canvas.addEventListener('mousedown', () => {
    dragging = true;
    if (!matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas || dragging) {
      input.lookX -= e.movementX * 0.0035;
      input.lookY -= e.movementY * 0.0028;
    }
  });
}

/** Called every frame: combine keyboard, touch stick and gamepad. */
export function pollInput() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (touchMove.active) {
    x = touchMove.x;
    y = touchMove.y;
    run = run || Math.hypot(x, y) > 0.92;
  }
  // gamepad (standard mapping)
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepadIndex !== null ? pads[gamepadIndex] : Array.from(pads).find((p) => p) ?? null;
  if (gp) {
    gamepadIndex = gp.index;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    const gx = dz(gp.axes[0] ?? 0), gy = dz(gp.axes[1] ?? 0);
    if (gx || gy) { x = gx; y = -gy; }
    input.lookX -= dz(gp.axes[2] ?? 0) * 0.05;
    input.lookY -= dz(gp.axes[3] ?? 0) * 0.04;
    run = run || !!gp.buttons[7]?.pressed || !!gp.buttons[10]?.pressed || Math.hypot(gx, gy) > 0.95;
    edgeButton(gp, 0, () => (input.jump = true));
    edgeButton(gp, 2, () => (input.action = true));
    edgeButton(gp, 1, () => (input.breakForm = true));
    edgeButton(gp, 9, () => (input.codex = true));
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  input.moveX = x;
  input.moveY = y;
  input.run = run;
}

const padPrev = new Map<number, boolean>();
function edgeButton(gp: Gamepad, i: number, fn: () => void) {
  const now = !!gp.buttons[i]?.pressed;
  if (now && !padPrev.get(i)) fn();
  padPrev.set(i, now);
}

// ── touch: left half = floating stick, right half = swipe to look, buttons are DOM elements ──
export function initTouch(root: HTMLElement, stickBase: HTMLElement, stickKnob: HTMLElement) {
  let moveId: number | null = null, lookId: number | null = null;
  let ox = 0, oy = 0, lx = 0, ly = 0;
  const R = 60;
  root.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if ((t.target as HTMLElement).closest('.btn')) continue;
      if (t.clientX < window.innerWidth * 0.45 && moveId === null) {
        moveId = t.identifier;
        ox = t.clientX; oy = t.clientY;
        stickBase.style.display = stickKnob.style.display = 'block';
        stickBase.style.transform = `translate(${ox - 70}px, ${oy - 70}px)`;
        stickKnob.style.transform = `translate(${ox - 30}px, ${oy - 30}px)`;
        touchMove = { x: 0, y: 0, active: true };
      } else if (lookId === null) {
        lookId = t.identifier;
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  root.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveId) {
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        touchMove = { x: dx / R, y: -dy / R, active: true };
        stickKnob.style.transform = `translate(${ox + dx - 30}px, ${oy + dy - 30}px)`;
      } else if (t.identifier === lookId) {
        input.lookX -= (t.clientX - lx) * 0.0075;
        input.lookY -= (t.clientY - ly) * 0.006;
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveId) {
        moveId = null;
        touchMove = { x: 0, y: 0, active: false };
        stickBase.style.display = stickKnob.style.display = 'none';
      }
      if (t.identifier === lookId) lookId = null;
    }
  };
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);
}

/** Wire a DOM button to an input edge (works for touch and mouse). */
export function bindButton(el: HTMLElement, fn: () => void) {
  const press = (e: Event) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); fn(); };
  const up = () => el.classList.remove('down');
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('mousedown', press);
  el.addEventListener('touchend', up);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}
