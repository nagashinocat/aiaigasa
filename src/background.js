// 空・街並み・夕焼け・虹(2D Canvas)
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (c1, c2, t) => c1.map((v, i) => Math.round(mix(v, c2[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

// 街灯の位置(0〜1)。雨の光のにじみにも使う
export const LAMPS = [{ x: 0.14, y: 0.6 }, { x: 0.86, y: 0.58 }];
export const GROUND = 0.78;

const COUPLE = [
  'M10 48 Q60 -6 110 48 Q100 42 92 48 Q84 42 76 48 Q68 42 60 48 Q52 42 44 48 Q36 42 28 48 Q20 42 10 48Z',
  'M59 46 h2 v40 h-2Z',
  'M36 66 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0Z',
  'M33 128 L35 90 Q36 77 44 77 Q52 77 53 90 L55 128Z',
  'M67 62 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0Z',
  'M64 128 L66 88 Q67 74 76 74 Q85 74 86 88 L88 128Z',
].join(' ');

export function createBackground(canvas) {
  const couplePath = typeof Path2D !== 'undefined' ? new Path2D(COUPLE) : null;
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, D = 1;
  let town = null;

  function buildTown() {
    const r = rng(7);
    const layers = [];
    for (const [depth, minH, maxH, step] of [[0, 0.18, 0.34, 0.09], [1, 0.1, 0.22, 0.12]]) {
      const bs = [];
      for (let x = -0.05; x < 1.05; x += step * (0.6 + r() * 0.8)) {
        const w = step * (0.7 + r() * 0.6);
        const h = minH + r() * (maxH - minH);
        const wins = [];
        for (let wy = 0.03; wy < h - 0.03; wy += 0.035)
          for (let wx = 0.015; wx < w - 0.02; wx += 0.03)
            if (r() < 0.28) wins.push([wx, wy, r()]);
        bs.push({ x, w, h, wins });
      }
      layers.push({ depth, bs });
    }
    town = layers;
  }

  function resize(w, h, dpr) {
    W = w; H = h; D = dpr;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    if (!town) buildTown();
  }

  function draw({ rain = 0.5, sunset = 0, rainbow = 0, t = 0, couple = true, sky = true, kids = false }) {
    const c = ctx;
    c.setTransform(D, 0, 0, D, 0, 0);
    const dark = Math.min(1, Math.max(0, rain));
    // 空
    const top = mixC(mixC([132, 146, 162], [70, 80, 96], dark), [236, 140, 120], sunset);
    const bot = mixC(mixC([184, 192, 200], [112, 122, 136], dark), [255, 205, 150], sunset);
    let g = c.createLinearGradient(0, 0, 0, H * GROUND);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
    // sky=false のとき空と虹は WebGL 側で描くので透明のままにする
    if (sky) { c.fillStyle = g; c.fillRect(0, 0, W, H); } else c.clearRect(0, 0, W, H);

    // 虹
    if (sky && rainbow > 0) {
      const cols = ['#ff5a5a', '#ff9a3c', '#ffe14d', '#6edc6e', '#5ab4ff', '#6a6aff', '#b06aff'];
      const cx = W * 0.5, cy = H * 0.72, R = Math.max(W, H) * 0.55, bw = R * 0.022;
      c.save();
      c.globalAlpha = 0.6 * rainbow;
      c.filter = `blur(${bw * 0.6}px)`;
      c.lineWidth = bw;
      const end = Math.PI + Math.PI * Math.min(1, rainbow * 1.15);
      cols.forEach((col, i) => {
        c.strokeStyle = col;
        c.beginPath(); c.arc(cx, cy, R - i * bw, Math.PI, end); c.stroke();
      });
      c.restore();
    }

    // 街並み
    const haze = mixC(mixC([96, 106, 120], [60, 68, 82], dark), [170, 110, 110], sunset);
    const near = mixC(mixC([58, 64, 76], [38, 43, 54], dark), [92, 62, 72], sunset);
    for (const layer of town) {
      const col = layer.depth === 0 ? haze : near;
      for (const b of layer.bs) {
        const x = b.x * W, w = b.w * W, h = b.h * H, y = H * GROUND - h;
        c.fillStyle = rgb(col); c.fillRect(x, y, w, h);
        for (const [wx, wy, k] of b.wins) {
          const a = (layer.depth ? 0.75 : 0.45) * (0.5 + 0.5 * k) * (1 - sunset * 0.5);
          c.fillStyle = `rgba(255,${210 + k * 30},${140 + k * 40},${a})`;
          c.fillRect(x + wx * W, y + wy * H, W * 0.012, H * 0.012);
        }
      }
    }

    // 地面(濡れた路面)
    g = c.createLinearGradient(0, H * GROUND, 0, H);
    g.addColorStop(0, rgb(mixC(near, [0, 0, 0], 0.2)));
    g.addColorStop(1, rgb(mixC(near, [0, 0, 0], 0.55)));
    c.fillStyle = g; c.fillRect(0, H * GROUND, W, H * (1 - GROUND));
    // 路面に映る空
    c.fillStyle = rgb(bot, 0.12 + 0.1 * (1 - dark));
    c.fillRect(0, H * GROUND, W, H * 0.02);

    // 街灯
    for (const L of LAMPS) {
      const x = L.x * W, y = L.y * H;
      c.fillStyle = rgb(near); c.fillRect(x - 2, y, 4, H * GROUND - y);
      const on = 1 - sunset * 0.6;
      const glow = c.createRadialGradient(x, y, 0, x, y, H * 0.12);
      glow.addColorStop(0, `rgba(255,220,160,${0.55 * on})`);
      glow.addColorStop(1, 'rgba(255,220,160,0)');
      c.fillStyle = glow; c.fillRect(x - H * 0.12, y - H * 0.12, H * 0.24, H * 0.24);
      c.fillStyle = `rgba(255,240,210,${0.95 * on})`;
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      // 路面の映り込み
      const ref = c.createLinearGradient(0, H * GROUND, 0, H);
      ref.addColorStop(0, `rgba(255,210,150,${0.35 * on})`); ref.addColorStop(1, 'rgba(255,210,150,0)');
      c.save(); c.filter = 'blur(6px)'; c.fillStyle = ref; c.fillRect(x - 5, H * GROUND, 10, H * (1 - GROUND)); c.restore();
    }
    // 相合傘の二人(画面下から23%の位置に立つ、幅150px)
    if (couple && couplePath) {
      const k = (150 / 120) * (kids ? 0.74 : 1);
      c.save();
      c.translate(W / 2 - 60 * k, H * 0.77 - 130 * k);
      c.scale(k, k);
      c.fillStyle = rgb(mixC([14, 17, 23], [40, 24, 30], sunset));
      c.fill(couplePath);
      c.restore();
    }
    void t;
  }

  return { resize, draw, canvas };
}
