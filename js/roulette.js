// ルーレット: 重みに比例した扇形のホイールを回し、決めておいた当選項目で止める
import { setupCanvas, ellipsize } from './canvas.js';
import { totalWeight } from './items.js';

const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2; // 針は真上
const SPIN_MS = 4800;

export function createRoulette(canvas) {
  let items = [];
  let rotation = 0;
  const { ctx, size } = setupCanvas(canvas, draw);

  function segments() {
    const total = totalWeight(items);
    let start = 0;
    return items.map((it) => {
      const span = (it.weight / total) * TAU;
      const seg = { item: it, start, end: start + span };
      start += span;
      return seg;
    });
  }

  function draw() {
    const { w, h } = size;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2 + 8;
    const r = Math.min(w, h) / 2 - 24;
    if (r <= 0) return;

    // 外枠
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, TAU);
    ctx.fillStyle = '#2d2a3e';
    ctx.fill();

    if (items.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = '#d9d6e4';
      ctx.fill();
      ctx.fillStyle = '#6b6780';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('項目がありません', cx, cy);
    } else {
      const segs = segments();
      const fontSize = Math.max(12, Math.min(20, r / 9));
      for (const seg of segs) {
        const a0 = seg.start + rotation;
        const a1 = seg.end + rotation;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a1);
        ctx.closePath();
        ctx.fillStyle = seg.item.color;
        ctx.fill();
        if (segs.length > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // ラベル
        const mid = (a0 + a1) / 2;
        const span = seg.end - seg.start;
        if (span * r * 0.6 < fontSize * 0.9) continue; // 狭すぎる扇には書かない
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(mid);
        ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const label = ellipsize(ctx, seg.item.name, r * 0.68);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeText(label, r - 16, 0);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, r - 16, 0);
        ctx.restore();
      }
    }

    // 中心の軸
    if (items.length) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(14, r * 0.12), 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2d2a3e';
      ctx.stroke();
    }

    // 針
    const tipY = cy - r + 18;
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - 14, cy - r - 18);
    ctx.lineTo(cx + 14, cy - r - 18);
    ctx.closePath();
    ctx.fillStyle = '#ff3b5c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  function render(nextItems) {
    items = nextItems;
    draw();
  }

  function play(winner) {
    const seg = segments().find((s) => s.item.id === winner.id);
    // 扇の端で止まらないよう、内側 70% の範囲からランダムに止める位置を選ぶ
    const margin = (seg.end - seg.start) * 0.15;
    const target = seg.start + margin + Math.random() * (seg.end - seg.start - margin * 2);
    const current = ((rotation % TAU) + TAU) % TAU;
    const delta = (((POINTER_ANGLE - target - current) % TAU) + TAU) % TAU;
    const from = rotation;
    const to = rotation + delta + TAU * (5 + Math.floor(Math.random() * 3));

    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / SPIN_MS);
        const eased = 1 - Math.pow(1 - t, 4);
        rotation = from + (to - from) * eased;
        draw();
        if (t < 1) requestAnimationFrame(step);
        else {
          rotation = to % TAU;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  return { render, play, redraw: draw };
}
