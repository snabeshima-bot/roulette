// ガラガラ抽選器: 八角形の本体を回して玉をかき混ぜ、当選色の玉を出口から出す
import { setupCanvas, shade } from './canvas.js';

const TAU = Math.PI * 2;
const SPIN_MS = 2600;
const EXIT_MS = 1400;
const MAX_BALLS = 36;

export function createGaragara(canvas) {
  let items = [];
  let balls = [];
  let angle = 0;
  let omega = 0; // 回転速度 (rad/s)
  let exitBall = null; // { color, t }
  let running = false;
  let settleUntil = 0;
  let last = 0;

  const { ctx, size } = setupCanvas(canvas, () => {
    if (!balls.length) rebuildBalls();
    draw();
  });

  function geometry() {
    const { w, h } = size;
    const R = Math.min(w * 0.29, h * 0.33);
    return { cx: w * 0.4, cy: h * 0.4, R, inner: R * 0.86, br: Math.max(6, R * 0.085) };
  }

  // 重みに応じて玉の数を配分する（各項目最低1個）
  function rebuildBalls() {
    const { inner, br } = geometry();
    balls = [];
    if (!items.length || !inner) return;
    const maxW = Math.max(...items.map((it) => it.weight));
    const per = items.map((it) => Math.max(1, Math.round((it.weight / maxW) * 4)));
    let total = per.reduce((a, b) => a + b, 0);
    while (total > MAX_BALLS) {
      const i = per.indexOf(Math.max(...per));
      if (per[i] <= 1) break;
      per[i]--;
      total--;
    }
    items.forEach((it, i) => {
      for (let k = 0; k < per[i]; k++) {
        const a = Math.PI / 2 + (Math.random() - 0.5) * 2;
        const d = Math.random() * (inner - br);
        balls.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, color: it.color });
      }
    });
    wake(1500);
  }

  function physics(dt) {
    const { inner, br, R } = geometry();
    const g = R * 9;
    const wallSpeed = omega * inner;
    for (const b of balls) {
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const d = Math.hypot(b.x, b.y);
      const lim = inner - br;
      if (d > lim) {
        const nx = b.x / d;
        const ny = b.y / d;
        b.x = nx * lim;
        b.y = ny * lim;
        const vn = b.vx * nx + b.vy * ny;
        const tx = -ny;
        const ty = nx;
        let vt = b.vx * tx + b.vy * ty;
        vt += (wallSpeed - vt) * 0.25; // 壁に引きずられる
        const vnAfter = vn > 0 ? -vn * 0.35 : vn;
        b.vx = nx * vnAfter + tx * vt;
        b.vy = ny * vnAfter + ty * vt;
      }
      b.vx *= 0.995;
      b.vy *= 0.995;
    }
    // 玉どうしの重なりを押し戻す
    const minD = br * 2;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minD) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = rel * 0.4;
            a.vx += nx * imp;
            a.vy += ny * imp;
            b.vx -= nx * imp;
            b.vy -= ny * imp;
          }
        }
      }
    }
  }

  function drawBall(x, y, r, color) {
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, shade(color, 0.35));
    grad.addColorStop(1, shade(color, -0.1));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  function octagon(cx, cy, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + Math.PI / 8 + (i * TAU) / 8;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function exitPath(t) {
    // 出口（右下）から受け皿までの道のり
    const { cx, cy, R, br } = geometry();
    const sx = cx + R * 0.72;
    const sy = cy + R * 0.72;
    const tx = cx + R * 1.55;
    const ty = cy + R * 1.28;
    if (t < 0.35) {
      const u = t / 0.35;
      return { x: sx + (tx - sx) * 0.15 * u, y: sy + (ty - sy) * 0.55 * u * u };
    }
    const u = (t - 0.35) / 0.65;
    const ease = 1 - Math.pow(1 - u, 3);
    const x0 = sx + (tx - sx) * 0.15;
    const y0 = sy + (ty - sy) * 0.55;
    const bounce = Math.abs(Math.sin(ease * Math.PI * 2)) * (1 - ease) * br * 2;
    return { x: x0 + (tx - x0) * ease, y: y0 + (ty - y0) * ease - bounce };
  }

  function draw() {
    const { w, h } = size;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const { cx, cy, R, br } = geometry();

    // 台
    ctx.fillStyle = '#8a5a3c';
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.9, cy + R * 1.35);
    ctx.lineTo(cx - R * 0.12, cy);
    ctx.lineTo(cx + R * 0.12, cy);
    ctx.lineTo(cx + R * 0.9, cy + R * 1.35);
    ctx.lineTo(cx + R * 0.72, cy + R * 1.35);
    ctx.lineTo(cx, cy + R * 0.25);
    ctx.lineTo(cx - R * 0.72, cy + R * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6b4329';
    ctx.fillRect(cx - R * 1.05, cy + R * 1.35, R * 2.1, R * 0.14);

    // 受け皿
    const trayX = cx + R * 1.55;
    const trayY = cy + R * 1.28 + br;
    ctx.fillStyle = '#c9a27a';
    ctx.beginPath();
    ctx.ellipse(trayX, trayY, R * 0.42, R * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a5a3c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 本体
    octagon(cx, cy, R, angle);
    const bodyGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    bodyGrad.addColorStop(0, '#e24a4a');
    bodyGrad.addColorStop(1, '#a8252f');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#6e1720';
    ctx.stroke();

    // 覗き窓（中の玉が見える）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.86, 0, TAU);
    ctx.fillStyle = 'rgba(255, 245, 230, 0.92)';
    ctx.fill();
    ctx.clip();
    for (const b of balls) drawBall(cx + b.x, cy + b.y, br, b.color);
    ctx.restore();

    // 本体の模様（回転がわかるように放射状の線）
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 23, 32, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = angle + Math.PI / 8 + (i * TAU) / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.restore();

    // 軸とハンドル
    const hx = cx + Math.cos(angle) * R * 0.55;
    const hy = cy + Math.sin(angle) * R * 0.55;
    ctx.strokeStyle = '#3b3b48';
    ctx.lineWidth = Math.max(5, R * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, R * 0.09, 0, TAU);
    ctx.fillStyle = '#f2c14e';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.08, 0, TAU);
    ctx.fillStyle = '#3b3b48';
    ctx.fill();

    // 出口
    ctx.fillStyle = '#3b3b48';
    ctx.beginPath();
    ctx.arc(cx + R * 0.72, cy + R * 0.72, br * 1.25, 0, TAU);
    ctx.fill();

    if (!items.length) {
      ctx.fillStyle = '#6b4329';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('玉がありません', cx, cy + 6);
    }

    if (exitBall) {
      const p = exitPath(exitBall.t);
      drawBall(p.x, p.y, br * 1.2, exitBall.color);
    }
  }

  function wake(ms) {
    settleUntil = Math.max(settleUntil, performance.now() + ms);
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    // 小さな刻みで計算して玉のすり抜けを防ぐ
    for (let i = 0; i < 3; i++) physics(dt / 3);
    angle += omega * dt;
    draw();
    if (now < settleUntil || omega !== 0) requestAnimationFrame(loop);
    else running = false;
  }

  let signature = '';
  function render(nextItems) {
    items = nextItems;
    exitBall = null;
    // 名前の編集だけなら玉は入れ替えない
    const next = items.map((it) => `${it.id}:${it.weight}`).join(',');
    if (next !== signature) {
      signature = next;
      rebuildBalls();
    }
    draw();
  }

  function play(winner) {
    exitBall = null;
    signature = ''; // 取り出した玉を次の描画で戻す
    wake(SPIN_MS + EXIT_MS + 1500);
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = (now - t0) / SPIN_MS;
        if (t < 1) {
          // 加速 → 一定 → 減速
          const speed = t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1;
          omega = speed * 9;
          requestAnimationFrame(step);
          return;
        }
        omega = 0;
        // 当選色の玉を1個取り出す
        const idx = balls.findIndex((b) => b.color === winner.color);
        if (idx >= 0) balls.splice(idx, 1);
        exitBall = { color: winner.color, t: 0 };
        const e0 = performance.now();
        const roll = (n) => {
          exitBall.t = Math.min(1, (n - e0) / EXIT_MS);
          draw();
          if (exitBall.t < 1) requestAnimationFrame(roll);
          else setTimeout(resolve, 250);
        };
        requestAnimationFrame(roll);
      };
      requestAnimationFrame(step);
    });
  }

  return { render, play };
}
