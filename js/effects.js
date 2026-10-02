// 結果発表の紙吹雪（紅・白・金と桜の花びら）
const COLORS = ['#c9171e', '#f4efe4', '#d4a640', '#e8c766', '#e83a3a', '#f2b8c6'];

export function startConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const pieces = [];
  const spawn = (count, burst) => {
    for (let i = 0; i < count; i++) {
      const petal = Math.random() < 0.25;
      pieces.push({
        x: burst ? w / 2 + (Math.random() - 0.5) * 80 : Math.random() * w,
        y: burst ? h * 0.42 : -20 - Math.random() * h * 0.3,
        vx: burst ? (Math.random() - 0.5) * 900 : (Math.random() - 0.5) * 40,
        vy: burst ? -300 - Math.random() * 500 : 40 + Math.random() * 60,
        size: petal ? 7 + Math.random() * 5 : 6 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        sway: Math.random() * Math.PI * 2,
        color: petal ? '#f6c1cf' : COLORS[(Math.random() * COLORS.length) | 0],
        petal,
      });
    }
  };
  spawn(140, true);
  spawn(80, false);

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (now - t0 < 2500 && Math.random() < 0.5) spawn(2, false);
    ctx.clearRect(0, 0, w, h);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.vy += 520 * dt;
      p.vx *= 0.985;
      p.vy = Math.min(p.vy, p.petal ? 70 : 140);
      p.sway += dt * 3;
      p.x += (p.vx + Math.sin(p.sway) * 30) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > h + 30) {
        pieces.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.petal) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 回転して見えるよう、幅を揺らす
        ctx.scale(Math.cos(p.sway * 2), 1);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (pieces.length) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    ctx.clearRect(0, 0, w, h);
  };
}
