// 2Dの雨(WebGLが使えないとき)。背景の上に透明キャンバスで重ねる
import { GROUND } from './background.js';

const LAYERS = [
  { len: 10, width: 1, speed: 900, alpha: 0.25, share: 0.5 },
  { len: 18, width: 1.3, speed: 1300, alpha: 0.35, share: 0.33 },
  { len: 34, width: 2.2, speed: 1900, alpha: 0.45, share: 0.17 },
];
const MAX = 600, SLANT = 0.12;

export function createRain2D(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, D = 1;
  const drops = [], ripples = [];

  const spawn = (layer, y) => ({ layer, x: Math.random() * (W + H * SLANT) - H * SLANT, y: y ?? -Math.random() * H * 0.2 });

  function resize(w, h, dpr) {
    W = w; H = h; D = dpr;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }

  function draw(rain, dt) {
    dt = Math.min(dt, 0.1);
    const want = Math.round(MAX * rain * rain * 1.2 + 20 * rain);
    while (drops.length < want) {
      const r = Math.random(); let i = 0, acc = 0;
      while (i < LAYERS.length - 1 && r > (acc += LAYERS[i].share)) i++;
      drops.push(spawn(i, Math.random() * H));
    }
    if (drops.length > want) drops.length = want;

    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const L of LAYERS) {
      ctx.strokeStyle = `rgba(220,230,245,${L.alpha})`;
      ctx.lineWidth = L.width;
      ctx.beginPath();
      for (const d of drops) {
        if (LAYERS[d.layer] !== L) continue;
        const dy = L.speed * dt;
        d.y += dy; d.x += dy * SLANT;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - L.len * SLANT, d.y - L.len);
        const ground = H * GROUND + (d.layer * 0.06 + Math.random() * 0.02) * H;
        if (d.y > ground) {
          if (d.layer > 0 && ripples.length < 80) ripples.push({ x: d.x, y: d.y, r: 1, a: 0.5 });
          Object.assign(d, spawn(d.layer));
        }
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = ripples[i];
      p.r += 40 * dt; p.a -= 1.2 * dt;
      if (p.a <= 0) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(220,230,245,${p.a})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  return { resize, draw, dispose() { ctx.clearRect(0, 0, canvas.width, canvas.height); }, kind: '2d' };
}
