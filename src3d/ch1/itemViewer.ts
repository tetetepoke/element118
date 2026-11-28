// One shared 3D viewer for items and elements, used by the "got it" popup, the bag preview and the codex.
// - one small WebGLRenderer (created on first use); its canvas moves into whichever box needs it
// - renders only while visible (the loop stops when hidden → no GPU/battery use)
// - models are built or loaded once and reused; bag thumbnails are baked once into images and reused
// Look priority per subject: GLB model → 2D icon → code-built placeholder 3D → text only.
import * as THREE from 'three';
import { ITEMS, ELEMENTS, type ElementSymbol, type Visual } from './game/materials';

export type Subject = { kind: 'item'; id: string } | { kind: 'element'; symbol: ElementSymbol };
const keyOf = (s: Subject) => (s.kind === 'item' ? `item:${s.id}` : `el:${s.symbol}`);

let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 0.35, 3.2);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x30283a, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2, 3, 2.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7ab8ff, 1.4);
rim.position.set(-2.5, 1, -2);
scene.add(rim);
const holder = new THREE.Group();
scene.add(holder);

const models = new Map<string, Promise<THREE.Object3D | null>>();
const thumbs = new Map<string, Promise<string | null>>();
let current: THREE.Object3D | null = null;
let disposablePreview = false;
let running = false;
let frames = 0;
let raf = 0;
let dragging = false;
let lastX = 0;
let spinVel = 0;
let host: HTMLElement | null = null;
let iconEl: HTMLImageElement | null = null;

const visualOf = (s: Subject): Visual | undefined => (s.kind === 'item' ? ITEMS[s.id]?.visual : ELEMENTS[s.symbol]?.visual);
/** which look a subject uses: GLB model → 2D icon → code-built 3D → text only */
export function displayKind(s: Subject): 'model' | 'icon' | 'proc' | 'text' {
  if (s.kind === 'element') return visualOf(s)?.model ? 'model' : 'proc';
  if (!ITEMS[s.id]) return 'text';
  const v = visualOf(s);
  if (v?.model) return 'model';
  if (v?.icon) return 'icon';
  if (v?.proc) return 'proc';
  return 'text';
}

function ensureRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const c = renderer.domElement;
  c.style.touchAction = 'none';
  c.style.display = 'block';
  c.style.width = c.style.height = '100%';
  // one finger / mouse: turn left-right; auto-spin pauses while touched
  c.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; try { c.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } e.preventDefault(); });
  c.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    holder.rotation.y += dx * 0.012;
    spinVel = dx * 0.012;
    e.preventDefault();
  });
  const up = () => { dragging = false; };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  c.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  c.addEventListener('wheel', (e) => { zoomPreview(e.deltaY > 0 ? -1 : 1); e.preventDefault(); }, { passive: false });
  return renderer;
}

// ───────── models ─────────
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

/** code-built placeholder models (swap for GLB by setting `model` on the item) */
function procModel(s: Subject): THREE.Object3D {
  const g = new THREE.Group();
  if (s.kind === 'element') return elementModel(s.symbol);
  const it = ITEMS[s.id];
  const kind = it.visual?.proc ?? 'stone';
  if (kind === 'quartz' || kind === 'crystal') {
    // a small cluster of hexagonal crystals with pointed tips, slightly see-through
    const mat = std({ color: kind === 'crystal' ? 0xbfe0ff : 0xeaf4ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.72, emissive: 0x2a4a7a, emissiveIntensity: 0.35 });
    const parts: [number, number, number, number, number][] = [[0, 0, 0, 1, 0], [0.24, -0.08, 0.1, 0.7, -0.5], [-0.22, -0.1, -0.06, 0.62, 0.55], [0.06, -0.14, -0.22, 0.5, 0.3]];
    for (const [x, y, z, h, tilt] of parts) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, h, 6), mat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.26, 6), mat);
      tip.position.y = h / 2 + 0.13;
      const c = new THREE.Group();
      c.add(body, tip);
      c.position.set(x, y + h / 2 - 0.5, z);
      c.rotation.set(tilt * 0.4, 0, tilt);
      g.add(c);
    }
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), std({ color: 0x8a8278, roughness: 0.9, flatShading: true }));
    base.scale.set(1.3, 0.45, 1.1);
    base.position.y = -0.55;
    g.add(base);
  } else if (kind === 'ore') {
    // an irregular, dark, metallic lump with a rusty tint (hematite)
    const geo = new THREE.IcosahedronGeometry(0.55, 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 7.1) * Math.cos(v.y * 6.3) * Math.sin(v.z * 5.7);
      v.multiplyScalar(0.82 + 0.22 * n + 0.08 * Math.sin(v.x * 17 + v.z * 11));
      p.setXYZ(i, v.x, v.y * 0.8, v.z);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, std({ color: 0x5a4a46, roughness: 0.35, metalness: 0.7, emissive: 0x3a1008, emissiveIntensity: 0.55, flatShading: true })));
  } else {
    // simple shapes from the item's shape numbers (stick / pipe / stone / heavy / blade / fiber / stem)
    const col = it.color;
    let m: THREE.Mesh;
    if (it.length > 0.8) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8), std({ color: col, roughness: 0.8, metalness: it.mat === 'scrap_metal' ? 0.6 : 0 }));
      m.rotation.z = 0.9;
    } else if (it.binding) {
      m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.05, 64, 6), std({ color: col, roughness: 0.9 }));
    } else if (it.edge > 0.6) {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.9), std({ color: col, roughness: 0.35, metalness: 0.7 }));
      m.rotation.set(0.3, 0.6, 0.2);
    } else {
      m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + it.mass * 0.12, 0), std({ color: col, roughness: 0.85, flatShading: true }));
      if (it.point > 0.5) m.scale.set(0.7, 1.5, 0.7);
    }
    g.add(m);
  }
  return g;
}

/** a game image of an element: glowing core with its symbol, and orbit-like rings (not a real atom picture) */
function elementModel(sym: ElementSymbol): THREE.Object3D {
  const e = ELEMENTS[sym];
  const g = new THREE.Group();
  const color = new THREE.Color(e.color);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), std({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 }));
  g.add(core);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff';
  c.font = 'bold 64px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(10,20,40,0.85)';
  c.lineWidth = 8;
  c.strokeText(sym, 64, 60);
  c.fillText(sym, 64, 60);
  c.font = 'bold 22px sans-serif';
  c.lineWidth = 5;
  c.strokeText(String(e.z), 64, 104);
  c.fillText(String(e.z), 64, 104);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  label.scale.set(0.8, 0.8, 1);
  label.renderOrder = 2;
  g.add(label);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.012, 6, 64), ringMat);
    r.rotation.set(Math.PI / 2 + (i - 1) * 0.9, i * 1.1, 0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.x = 0.78;
    r.add(dot);
    r.userData.spin = 0.6 + i * 0.35;
    g.add(r);
  }
  g.userData.element = true;
  return g;
}

function loadModel(s: Subject): Promise<THREE.Object3D | null> {
  const k = keyOf(s);
  let p = models.get(k);
  if (p) return p;
  const url = visualOf(s)?.model;
  p = (async () => {
    if (url) {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const gltf = await new GLTFLoader().loadAsync(url);
        return fit(gltf.scene);
      } catch { /* fall through to the next look */ }
    }
    if (s.kind === 'item' && !ITEMS[s.id]) return null;
    return fit(procModel(s));
  })();
  models.set(k, p);
  return p;
}
/** centre the model and scale it to about 1.4 units */
function fit(o: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const centre = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  o.position.sub(centre);
  wrap.add(o);
  wrap.scale.setScalar(2.2 / size);
  return wrap;
}

/** does this subject have a 3D look (GLB or code-built)? */
export function has3D(s: Subject) {
  const k = displayKind(s);
  return k === 'model' || k === 'proc';
}
/** a 2D icon path, if one is set */
export function iconOf(s: Subject) {
  return visualOf(s)?.icon ?? null;
}

// ───────── live view ─────────
function loop() {
  if (!running || !renderer || !host) return;
  raf = requestAnimationFrame(loop);
  const w = host.clientWidth, h = host.clientHeight;
  if (w && h && (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio()))) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (!dragging) {
    spinVel *= 0.92;
    holder.rotation.y += Math.abs(spinVel) > 0.002 ? spinVel : 0.008; // slow turn when left alone
  }
  if (current?.userData.element || current?.children[0]?.userData.element) {
    current.traverse((o) => { if (o.userData.spin) o.rotation.z += 0.01 * o.userData.spin; });
  }
  frames++;
  renderer.render(scene, camera);
}

/**
 * Show a subject inside `box`: the one 3D canvas moves there (or a 2D icon is shown).
 * Resolves false when there is nothing to draw (text only). `interactive`: finger / mouse turns it.
 */
export async function mount(box: HTMLElement, s: Subject, interactive = true) {
  const kind = displayKind(s);
  if (kind === 'text') return false;
  if (kind === 'icon') {
    unmount();
    iconEl = new Image();
    iconEl.src = iconOf(s)!;
    iconEl.style.cssText = 'width:100%;height:100%;object-fit:contain';
    iconEl.onerror = () => { iconEl?.remove(); void mountModel(box, s, interactive); }; // broken icon → 3D placeholder
    box.appendChild(iconEl);
    return true;
  }
  return mountModel(box, s, interactive);
}
async function mountModel(box: HTMLElement, s: Subject, interactive: boolean) {
  const m = await loadModel(s);
  if (!m || !box.isConnected) return false;
  showModel(box, m, interactive);
  return true;
}
function removeModel() {
  if (!current) return;
  holder.remove(current);
  if (disposablePreview) current.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.dispose();
    }
  });
  current = null;
  disposablePreview = false;
}

export function zoomPreview(direction: number) {
  holder.scale.setScalar(THREE.MathUtils.clamp(holder.scale.x + direction * 0.14, 0.57, 1.26));
}

export function mountPreview(box: HTMLElement, model: THREE.Object3D) {
  model.rotation.set(0, 0, -0.2);
  showModel(box, fit(model), true, true);
}

function showModel(box: HTMLElement, m: THREE.Object3D, interactive: boolean, disposable = false) {
  const r = ensureRenderer();
  iconEl?.remove();
  iconEl = null;
  removeModel();
  current = m;
  disposablePreview = disposable;
  holder.add(m);
  holder.rotation.set(0.15, 0.4, 0);
  holder.scale.setScalar(1);
  spinVel = 0;
  host = box;
  r.domElement.style.pointerEvents = interactive ? 'auto' : 'none';
  if (r.domElement.parentElement !== box) box.appendChild(r.domElement);
  if (!running) { running = true; loop(); }
}

/** stop rendering and take the canvas away (nothing is drawn while hidden) */
export function unmount() {
  removeModel();
  running = false;
  cancelAnimationFrame(raf);
  renderer?.domElement.remove();
  iconEl?.remove();
  iconEl = null;
  host = null;
  dragging = false;
}

/** a still image of a subject, made once and reused (for lists). Uses an offscreen target, not a new canvas. */
export function thumbnail(s: Subject, size = 128): Promise<string | null> {
  const k = keyOf(s);
  let p = thumbs.get(k);
  if (p) return p;
  p = (async () => {
    const icon = iconOf(s);
    if (icon && (await imageOk(icon))) return icon;
    if (!has3D(s)) return null;
    const r = ensureRenderer();
    const m = await loadModel(s);
    if (!m) return null;
    const tScene = new THREE.Scene();
    tScene.add(new THREE.HemisphereLight(0xdfeaff, 0x30283a, 1.4), key.clone(), rim.clone());
    const pivot = new THREE.Group();
    pivot.rotation.set(0.25, 0.6, 0);
    const clone = m.clone();
    pivot.add(clone);
    tScene.add(pivot);
    const cam = camera.clone();
    cam.aspect = 1;
    cam.updateProjectionMatrix();
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(tScene, cam);
    const px = new Uint8Array(size * size * 4);
    r.readRenderTargetPixels(rt, 0, 0, size, size, px);
    r.setRenderTarget(null);
    rt.dispose();
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // flip
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  })();
  thumbs.set(k, p);
  return p;
}
function imageOk(src: string) {
  return new Promise<boolean>((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
}

/** test hooks */
export const viewerStats = {
  get rendering() { return running; },
  get frames() { return frames; },
  get spin() { return holder.rotation.y; },
  get canvas() { return renderer?.domElement ?? null; },
};
