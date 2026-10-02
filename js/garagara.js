// ガラガラ抽選器: 八角形の本体を回して玉をかき混ぜ、当選色の玉を出口から出す
import { setupCanvas, shade } from './canvas.js';
import * as sound from './sound.js';

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
  let bellAt = 0; // 鐘を鳴らした時刻

  const { ctx, size } = setupCanvas(canvas, () => {
    if (!balls.length) rebuildBalls();
    draw();
  });

  function geometry() {
    const { w, h } = size;
    // 本体・台・受け皿・鐘がちょうど収まる大きさにする（横 3.3R、縦 2.55R）
    const R = Math.min(w / 3.6, h / 2.75);
    return { cx: w * 0.06 + R * 1.15, cy: h / 2 - R * 0.27, R, inner: R * 0.86, br: Math.max(6, R * 0.085) };
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

  function gold(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#7a5518');
    g.addColorStop(0.3, '#f6e3a1');
    g.addColorStop(0.55, '#b8862b');
    g.addColorStop(0.8, '#f3d98a');
    g.addColorStop(1, '#8a6420');
    return g;
  }

  function wood(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#5a3218');
    g.addColorStop(0.5, '#8a5428');
    g.addColorStop(1, '#4a2812');
    return g;
  }

  function drawBell(now) {
    const { cx, cy, R } = geometry();
    // 受け皿の真上に吊るす
    const px = cx + R * 1.55;
    const py = cy - R * 0.25;
    const postX = cx + R * 2.02;
    const floor = cy + R * 1.35;
    ctx.fillStyle = wood(postX - R * 0.05, py, postX + R * 0.05, py);
    ctx.fillRect(postX - R * 0.04, py - R * 0.06, R * 0.08, floor - py + R * 0.06);
    ctx.fillRect(px - R * 0.04, py - R * 0.06, postX - px + R * 0.08, R * 0.08);
    let swing = 0;
    if (bellAt) {
      const t = (now - bellAt) / 1000;
      swing = 0.55 * Math.sin(t * 13) * Math.exp(-t * 2.2);
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(swing);
    ctx.strokeStyle = '#c9171e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, R * 0.18);
    ctx.stroke();
    const bw = R * 0.24;
    const top = R * 0.18;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.35, top);
    ctx.quadraticCurveTo(-bw * 0.45, top + bw * 0.9, -bw, top + bw * 1.15);
    ctx.lineTo(bw, top + bw * 1.15);
    ctx.quadraticCurveTo(bw * 0.45, top + bw * 0.9, bw * 0.35, top);
    ctx.closePath();
    ctx.fillStyle = gold(-bw, 0, bw, 0);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#5a3c10';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, top + bw * 1.22, bw * 0.16, 0, TAU);
    ctx.fillStyle = '#5a3c10';
    ctx.fill();
    ctx.restore();
  }

  function draw(now = performance.now()) {
    const { w, h } = size;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const { cx, cy, R, br } = geometry();
    const floor = cy + R * 1.35;

    // 床の影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx + R * 0.3, floor + R * 0.12, R * 1.7, R * 0.12, 0, 0, TAU);
    ctx.fill();

    drawBell(now);

    // 木の台（A字の脚）
    ctx.fillStyle = wood(cx - R, cy, cx + R, cy);
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.95, floor);
    ctx.lineTo(cx - R * 0.1, cy);
    ctx.lineTo(cx + R * 0.1, cy);
    ctx.lineTo(cx + R * 0.95, floor);
    ctx.lineTo(cx + R * 0.74, floor);
    ctx.lineTo(cx, cy + R * 0.3);
    ctx.lineTo(cx - R * 0.74, floor);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = wood(cx, floor, cx, floor + R * 0.16);
    ctx.fillRect(cx - R * 1.15, floor, R * 3.3, R * 0.16);
    ctx.fillStyle = gold(cx - R, 0, cx + R, 0);
    ctx.fillRect(cx - R * 1.15, floor, R * 3.3, R * 0.03);

    // 朱塗りの受け皿
    const trayX = cx + R * 1.55;
    const trayY = cy + R * 1.28 + br;
    ctx.beginPath();
    ctx.ellipse(trayX, trayY, R * 0.44, R * 0.13, 0, 0, TAU);
    ctx.fillStyle = '#9e1b20';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = gold(trayX - R * 0.4, 0, trayX + R * 0.4, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(trayX, trayY + 2, R * 0.34, R * 0.08, 0, 0, TAU);
    ctx.fillStyle = '#6e1015';
    ctx.fill();

    // 本体（漆塗りの八角形）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    octagon(cx, cy, R, angle);
    const body = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    body.addColorStop(0, '#a4262c');
    body.addColorStop(0.45, '#6e1015');
    body.addColorStop(1, '#3a070a');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
    octagon(cx, cy, R, angle);
    ctx.lineWidth = Math.max(3, R * 0.045);
    ctx.strokeStyle = gold(cx - R, cy - R, cx + R, cy + R);
    ctx.stroke();
    // 漆のつや
    ctx.save();
    octagon(cx, cy, R, angle);
    ctx.clip();
    const gloss = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.2, cy + R * 0.2);
    gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // 角の金具
    for (let i = 0; i < 8; i++) {
      const a = angle + Math.PI / 8 + (i * TAU) / 8;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93, Math.max(2.5, R * 0.035), 0, TAU);
      ctx.fillStyle = '#e8c766';
      ctx.fill();
    }

    // 覗き窓（中の玉が見える）
    const win = R * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, win, 0, TAU);
    const glass = ctx.createRadialGradient(cx, cy - win * 0.3, win * 0.1, cx, cy, win);
    glass.addColorStop(0, '#3b2416');
    glass.addColorStop(1, '#1a0e08');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.clip();
    for (const b of balls) drawBall(cx + b.x, cy + b.y, br, b.color);
    // ガラスの反射
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(cx - win * 0.35, cy - win * 0.45, win * 0.5, win * 0.2, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, win, 0, TAU);
    ctx.lineWidth = Math.max(3, R * 0.04);
    ctx.strokeStyle = gold(cx - win, cy - win, cx + win, cy + win);
    ctx.stroke();

    // 軸とハンドル
    const hx = cx + Math.cos(angle) * R * 0.62;
    const hy = cy + Math.sin(angle) * R * 0.62;
    ctx.lineCap = 'round';
    ctx.strokeStyle = gold(cx, cy, hx, hy);
    ctx.lineWidth = Math.max(5, R * 0.065);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, R * 0.1, 0, TAU);
    ctx.fillStyle = wood(hx - R * 0.1, hy, hx + R * 0.1, hy);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2a1708';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.1, 0, TAU);
    ctx.fillStyle = gold(cx - R * 0.1, cy, cx + R * 0.1, cy);
    ctx.fill();

    // 出口
    ctx.beginPath();
    ctx.arc(cx + R * 0.72, cy + R * 0.72, br * 1.3, 0, TAU);
    ctx.fillStyle = '#120804';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e8c766';
    ctx.stroke();

    if (!items.length) {
      ctx.fillStyle = '#f4efe4';
      ctx.font = '600 16px "Shippori Mincho B1", serif';
      ctx.textAlign = 'center';
      ctx.fillText('玉がありません', cx, cy + 6);
    }

    if (exitBall) {
      const p = exitPath(exitBall.t);
      // 当たり玉は光らせる
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, br * 3.2);
      glow.addColorStop(0, 'rgba(255,230,150,0.75)');
      glow.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, br * 3.2, 0, TAU);
      ctx.fill();
      drawBall(p.x, p.y, br * 1.25, exitBall.color);
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
    draw(now);
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
    bellAt = 0;
    signature = ''; // 取り出した玉を次の描画で戻す
    wake(SPIN_MS + EXIT_MS + 2500);
    const stopRattle = sound.rattle();
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
        stopRattle();
        // 当選色の玉を1個取り出す
        const idx = balls.findIndex((b) => b.color === winner.color);
        if (idx >= 0) balls.splice(idx, 1);
        exitBall = { color: winner.color, t: 0 };
        const e0 = performance.now();
        const roll = (n) => {
          exitBall.t = Math.min(1, (n - e0) / EXIT_MS);
          if (exitBall.t < 1) requestAnimationFrame(roll);
          else {
            // 受け皿に届いたら鐘を鳴らす
            bellAt = performance.now();
            sound.bell();
            wake(2500);
            setTimeout(resolve, 900);
          }
        };
        requestAnimationFrame(roll);
      };
      requestAnimationFrame(step);
    });
  }

  return { render, play };
}
