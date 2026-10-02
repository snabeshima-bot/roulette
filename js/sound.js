// 効果音: Web Audio API で合成する（音声ファイルは使わない）
const STORAGE_KEY = 'roulette:sound';

let ctx = null;
let master = null;
let enabled = readSetting();

function readSetting() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(on) {
  enabled = Boolean(on);
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // 保存できなくても動作は続ける
  }
}

// ブラウザの制限で、音はユーザー操作のあとにしか鳴らせない
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function ready() {
  return enabled && ctx && ctx.state === 'running';
}

let noiseBuffer = null;
function noise() {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function envelope(node, t, peak, attack, decay) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// 木を打つような短い音
function knock(t, freq, peak, decay = 0.05) {
  const src = noise();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 4;
  const g = ctx.createGain();
  envelope(g, t, peak, 0.002, decay);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, decay + 0.05);
}

function tone(t, freq, { type = 'sine', peak = 0.3, attack = 0.005, decay = 0.4 } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  envelope(g, t, peak, attack, decay);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  return osc;
}

// ルーレットの針が扇の境目を越えたときの「カチッ」
export function tick() {
  if (!ready()) return;
  const t = ctx.currentTime;
  knock(t, 2600, 0.5, 0.03);
  tone(t, 1900, { type: 'triangle', peak: 0.08, decay: 0.03 });
}

// ガラガラ・ガサガサ。止めるための関数を返す
export function rattle({ low = 900, high = 1800, gap = [35, 85], peak = 0.25 } = {}) {
  let stopped = false;
  let timer = 0;
  const loop = () => {
    if (stopped) return;
    if (ready()) knock(ctx.currentTime, low + Math.random() * (high - low), peak * (0.5 + Math.random() * 0.5), 0.04);
    timer = setTimeout(loop, gap[0] + Math.random() * (gap[1] - gap[0]));
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// 太鼓のドロロロ…ドン
export function drumroll(ms = 900) {
  if (!ready()) return new Promise((r) => setTimeout(r, ms * 0.6));
  const t0 = ctx.currentTime;
  const dur = ms / 1000;
  const step = 0.055;
  for (let t = 0; t < dur; t += step) {
    const p = t / dur;
    thump(t0 + t, 0.08 + p * 0.35, 0.09);
  }
  thump(t0 + dur, 0.9, 0.6, 52);
  return new Promise((r) => setTimeout(r, ms + 60));
}

function thump(t, peak, decay, base = 80) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(base * 1.8, t);
  osc.frequency.exponentialRampToValueAtTime(base, t + 0.08);
  const g = ctx.createGain();
  envelope(g, t, peak, 0.004, decay);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + decay + 0.1);
  knock(t, 400, peak * 0.3, 0.04);
}

// 鐘の「カランカラン」
export function bell() {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  [0, 0.22, 0.44, 0.66].forEach((dt, i) => {
    const f = i % 2 ? 1320 : 1180;
    // 金属らしく倍音をずらす
    [1, 2.76, 5.4, 8.93].forEach((m, k) => {
      tone(t0 + dt, f * m, { peak: 0.18 / (k + 1), decay: 0.9 - k * 0.18 });
    });
  });
}

// ファンファーレ（五音音階のアルペジオ → 和音）
export function fanfare() {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const notes = [587.3, 659.3, 784, 880, 987.8, 1174.7];
  notes.forEach((f, i) => {
    tone(t0 + i * 0.085, f, { type: 'triangle', peak: 0.22, decay: 0.25 });
  });
  const tc = t0 + notes.length * 0.085;
  [587.3, 880, 1174.7, 1568].forEach((f) => {
    const osc = tone(tc, f, { type: 'triangle', peak: 0.13, attack: 0.02, decay: 1.4 });
    // 笛のようにゆらす
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = f * 0.006;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(tc);
    lfo.stop(tc + 1.5);
  });
  knock(tc, 3000, 0.25, 0.4);
}

// 紙が開く「パサッ」
export function paper() {
  if (!ready()) return;
  knock(ctx.currentTime, 4200, 0.35, 0.12);
}

// 判子を押す「トン」
export function stamp() {
  if (!ready()) return;
  thump(ctx.currentTime, 0.5, 0.15, 110);
}
