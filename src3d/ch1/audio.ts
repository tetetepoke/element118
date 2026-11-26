// Placeholder sound: everything is synthesized with WebAudio (no files). Starts on the first tap.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { stop(): void } | null = null;

export function startAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function noise(sec: number) {
  const b = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * sec), ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx!.createBufferSource();
  s.buffer = b;
  return s;
}
function env(g: GainNode, a: number, peak: number, d: number) {
  const t = ctx!.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

export const sfx = {
  drip() {
    if (!ctx || !master) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(1400 + Math.random() * 600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.12);
    env(g, 0.003, 0.25, 0.2);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + 0.3);
  },
  clank(pitch = 1) {
    if (!ctx || !master) return;
    for (const f of [180, 427, 913, 1530]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f * pitch * (0.97 + Math.random() * 0.06);
      env(g, 0.002, 0.12, 0.6 + Math.random() * 0.5);
      o.connect(g).connect(master);
      o.start(); o.stop(ctx.currentTime + 1.3);
    }
    const n = noise(0.08), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2000;
    env(g, 0.001, 0.3, 0.08);
    n.connect(bp).connect(g).connect(master);
    n.start();
  },
  rumble(sec = 1.5) {
    if (!ctx || !master) return;
    const n = noise(sec), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180;
    env(g, 0.1, 0.8, sec);
    n.connect(lp).connect(g).connect(master);
    n.start();
  },
  crunch() {
    if (!ctx || !master) return;
    const n = noise(0.25), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    env(g, 0.002, 0.6, 0.25);
    n.connect(bp).connect(g).connect(master);
    n.start();
  },
  pick() {
    if (!ctx || !master) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.setValueAtTime(990, ctx.currentTime + 0.07);
    env(g, 0.005, 0.18, 0.18);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + 0.3);
  },
  chime(up = true) {
    if (!ctx || !master) return;
    const notes = up ? [523, 659, 784, 1047] : [1047, 784, 659, 523];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(master!);
      o.start(t); o.stop(t + 1);
    });
  },
  scan() {
    if (!ctx || !master) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.35);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    env(g, 0.01, 0.07, 0.4);
    o.connect(lp).connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + 0.5);
  },
  /** low cave hum that never stops */
  ambience(on: boolean) {
    if (!ctx || !master) return;
    if (!on) { hum?.stop(); hum = null; return; }
    if (hum) return;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const os = [55, 82.5, 110.3].map((f) => { const o = ctx!.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; });
    g.connect(master);
    hum = { stop: () => os.forEach((o) => o.stop()) };
  },
};
