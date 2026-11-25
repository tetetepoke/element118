// Tiny WebAudio synth: all sound effects are generated, so no audio files are needed yet.
// iPhone only allows audio after a user tap, so unlock() is called from the title screen.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    // play a silent buffer (iOS unlock)
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(master!);
    s.start(0);
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3, when = 0, slideTo?: number) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, when = 0, lowpass = 2000) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export type Sfx =
  | 'ui' | 'step' | 'swing' | 'hit' | 'hurt' | 'block' | 'perfect' | 'pickup' | 'discover'
  | 'bondTry' | 'fail' | 'snap' | 'bigchime' | 'water' | 'steam' | 'fire' | 'rise' | 'save' | 'defeat' | 'talk';

export function sfx(name: Sfx) {
  switch (name) {
    case 'ui': tone(880, 0.06, 'square', 0.12); break;
    case 'talk': tone(520 + Math.random() * 80, 0.03, 'square', 0.05); break;
    case 'step': noise(0.04, 0.04, 0, 900); break;
    case 'swing': noise(0.09, 0.12, 0, 3000); tone(300, 0.08, 'triangle', 0.08, 0, 160); break;
    case 'hit': tone(180, 0.1, 'square', 0.2, 0, 90); noise(0.06, 0.15); break;
    case 'hurt': tone(220, 0.25, 'sawtooth', 0.2, 0, 70); break;
    case 'block': tone(660, 0.08, 'square', 0.15); break;
    case 'perfect': tone(988, 0.08, 'square', 0.18); tone(1319, 0.14, 'square', 0.18, 0.06); break;
    case 'pickup': tone(988, 0.07, 'square', 0.15); tone(1480, 0.12, 'square', 0.15, 0.06); break;
    case 'discover': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, i * 0.09)); break;
    case 'bondTry': tone(440, 0.12, 'triangle', 0.18, 0, 660); break;
    case 'fail': tone(330, 0.12, 'square', 0.15); tone(247, 0.2, 'square', 0.15, 0.11); break;
    case 'snap': tone(1200, 0.05, 'square', 0.2); noise(0.03, 0.15, 0, 6000); break;
    case 'bigchime':
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.5, 'triangle', 0.22, i * 0.11));
      [262, 392].forEach((f) => tone(f, 1.4, 'sine', 0.18, 0.1));
      break;
    case 'water': noise(0.3, 0.18, 0, 1500); tone(600, 0.2, 'sine', 0.1, 0, 300); break;
    case 'steam': noise(0.8, 0.22, 0, 5000); break;
    case 'fire': noise(0.5, 0.2, 0, 800); break;
    case 'rise': tone(200, 1.2, 'triangle', 0.15, 0, 600); break;
    case 'save': tone(784, 0.1, 'triangle', 0.18); tone(1175, 0.2, 'triangle', 0.18, 0.08); break;
    case 'defeat': tone(600, 0.06, 'square', 0.15); tone(900, 0.06, 'square', 0.15, 0.05); noise(0.15, 0.12, 0.05, 4000); break;
  }
}
