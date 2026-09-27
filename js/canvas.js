// 高解像度ディスプレイ対応のキャンバス。表示サイズが変わったら onResize を呼ぶ。
export function setupCanvas(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size.w = rect.width;
    size.h = rect.height;
    onResize();
  };
  new ResizeObserver(resize).observe(canvas);
  return { ctx, size };
}

export function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 0xff), b = f(n & 0xff);
  return `rgb(${r}, ${g}, ${b})`;
}
