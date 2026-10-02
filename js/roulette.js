// ルーレット: 重みに比例した扇形のホイールを回し、決めておいた当選項目で止める
import { setupCanvas, ellipsize } from './canvas.js';
import { totalWeight } from './items.js';
import * as sound from './sound.js';

const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2; // 針は真上
const SPIN_MS = 5200;
const MINCHO = '"Shippori Mincho B1", "Yu Mincho", "Hiragino Mincho ProN", serif';

export function createRoulette(canvas) {
  let items = [];
  let segs = [];
  let rotation = 0;
  let spin = null; // { from, to, t0, resolve }
  let flick = 0; // 針のはじかれ角度
  let flickVel = 0;
  let lastSeg = -1;
  let last = performance.now();
  const { ctx, size } = setupCanvas(canvas, () => draw(performance.now()));

  function buildSegments() {
    const total = totalWeight(items);
    let start = 0;
    segs = items.map((it) => {
      const span = (it.weight / total) * TAU;
      const seg = { item: it, start, end: start + span };
      start += span;
      return seg;
    });
  }

  function segmentAtPointer() {
    const a = (((POINTER_ANGLE - rotation) % TAU) + TAU) % TAU;
    return segs.findIndex((s) => a >= s.start && a < s.end);
  }

  function goldGradient(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#7a5518');
    g.addColorStop(0.25, '#f6e3a1');
    g.addColorStop(0.5, '#b8862b');
    g.addColorStop(0.75, '#f3d98a');
    g.addColorStop(1, '#8a6420');
    return g;
  }

  function draw(now) {
    const { w, h } = size;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2 + 14;
    const r = Math.min(w, h - 28) / 2 - 30;
    if (r <= 20) return;

    // 床に落ちる影
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 24, 0, TAU);
    ctx.fillStyle = '#3b2412';
    ctx.fill();
    ctx.restore();

    // 金の外枠
    ctx.beginPath();
    ctx.arc(cx, cy, r + 22, 0, TAU);
    ctx.fillStyle = goldGradient(cx - r, cy - r, cx + r, cy + r);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, TAU);
    ctx.fillStyle = '#2a1708';
    ctx.fill();

    // 電飾
    const lamps = Math.max(16, Math.round((TAU * (r + 11)) / 40));
    const phase = spin ? Math.floor(now / 70) : Math.floor(now / 650);
    for (let i = 0; i < lamps; i++) {
      const a = (i / lamps) * TAU;
      const lx = cx + Math.cos(a) * (r + 12);
      const ly = cy + Math.sin(a) * (r + 12);
      const on = spin ? (i + phase) % 3 === 0 : (i + phase) % 2 === 0;
      if (on) {
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 11);
        glow.addColorStop(0, 'rgba(255,248,220,1)');
        glow.addColorStop(0.35, 'rgba(255,214,110,0.95)');
        glow.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lx, ly, 11, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#6b4a1a';
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, TAU);
        ctx.fill();
      }
    }

    if (!segs.length) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = '#3a2a20';
      ctx.fill();
      ctx.fillStyle = '#f4efe4';
      ctx.font = `600 18px ${MINCHO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('項目がありません', cx, cy);
    } else {
      const fontSize = Math.max(13, Math.min(24, r / 8));
      for (const seg of segs) {
        const a0 = seg.start + rotation;
        const a1 = seg.end + rotation;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a1);
        ctx.closePath();
        ctx.fillStyle = seg.item.color;
        ctx.fill();
      }

      // 和紙のような明暗
      const shade = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      shade.addColorStop(0, 'rgba(255,255,255,0)');
      shade.addColorStop(0.6, 'rgba(255,250,235,0.10)');
      shade.addColorStop(0.92, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = shade;
      ctx.fill();

      if (segs.length > 1) {
        ctx.strokeStyle = 'rgba(243,217,138,0.95)';
        ctx.lineWidth = 2;
        for (const seg of segs) {
          const a = seg.start + rotation;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.stroke();
        }
      }

      for (const seg of segs) {
        const span = seg.end - seg.start;
        if (span * r * 0.6 < fontSize * 0.9) continue; // 狭すぎる扇には書かない
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(seg.start + rotation + span / 2);
        ctx.font = `800 ${fontSize}px ${MINCHO}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const label = ellipsize(ctx, seg.item.name, r * 0.62);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(40,12,0,0.55)';
        ctx.strokeText(label, r - 18, 0);
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(label, r - 18, 0);
        ctx.restore();
      }
    }

    // 中心の「福」メダル
    const hubR = Math.max(20, r * 0.17);
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, TAU);
    ctx.fillStyle = goldGradient(cx - hubR, cy - hubR, cx + hubR, cy + hubR);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5a3c10';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 0.74, 0, TAU);
    ctx.fillStyle = '#b7282e';
    ctx.fill();
    ctx.fillStyle = '#f6e3a1';
    ctx.font = `800 ${hubR * 0.95}px ${MINCHO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('福', cx, cy + hubR * 0.04);

    // 針（金と朱の旗）
    ctx.save();
    ctx.translate(cx, cy - r - 24);
    ctx.rotate(flick);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(16, -6);
    ctx.lineTo(3, 40);
    ctx.lineTo(-3, 40);
    ctx.closePath();
    ctx.fillStyle = goldGradient(-16, 0, 16, 0);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#5a3c10';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 6, 6.5, 0, TAU);
    ctx.fillStyle = '#c9171e';
    ctx.fill();
    ctx.strokeStyle = '#f6e3a1';
    ctx.stroke();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (spin) {
      const t = Math.min(1, (now - spin.t0) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      rotation = spin.from + (spin.to - spin.from) * eased;
      const idx = segmentAtPointer();
      if (idx !== lastSeg) {
        lastSeg = idx;
        sound.tick();
        flick = -0.42;
        flickVel = 0;
      }
      if (t >= 1) {
        rotation = spin.to % TAU;
        const done = spin.resolve;
        spin = null;
        done();
      }
    }
    // 針をばねのように元に戻す
    flickVel += (-flick * 220 - flickVel * 18) * dt;
    flick += flickVel * dt;

    if (canvas.offsetParent !== null) draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  document.fonts?.ready.then(() => draw(performance.now()));

  function render(nextItems) {
    items = nextItems;
    buildSegments();
    lastSeg = segmentAtPointer();
  }

  function play(winner) {
    const seg = segs.find((s) => s.item.id === winner.id);
    // 扇の端で止まらないよう、内側 70% の範囲からランダムに止める位置を選ぶ
    const margin = (seg.end - seg.start) * 0.15;
    const target = seg.start + margin + Math.random() * (seg.end - seg.start - margin * 2);
    const current = ((rotation % TAU) + TAU) % TAU;
    const delta = (((POINTER_ANGLE - target - current) % TAU) + TAU) % TAU;
    const from = rotation;
    const to = rotation + delta + TAU * (6 + Math.floor(Math.random() * 3));
    return new Promise((resolve) => {
      spin = { from, to, t0: performance.now(), resolve };
    });
  }

  return { render, play };
}
