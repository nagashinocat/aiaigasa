// 水玉が1文字ずつタイトルを書いていく、その段取り
// letters: [{ ch, x0, x1 }](左から順、x は横の位置)
export function buildPlan(letters, { perPx = 0.0042, minLetter = 0.16, gap = 0.09, space = 0.06 } = {}) {
  const segments = [];
  let t = 0;
  for (const l of letters) {
    const w = Math.max(0, l.x1 - l.x0);
    const isSpace = /\s/.test(l.ch);
    const d = isSpace ? space : Math.max(minLetter, w * perPx * 3.2);
    segments.push({ ch: l.ch, x0: l.x0, x1: l.x1, t0: t, t1: t + d, space: isSpace });
    t += d + (isSpace ? 0 : gap);
  }
  return { segments, total: segments.length ? segments[segments.length - 1].t1 : 0 };
}

// t 秒のときのペン先:x(書けたところまで)、何文字目か、書いている最中か
export function penAt(plan, t) {
  const segs = plan.segments;
  if (!segs.length) return { x: 0, index: -1, writing: false, done: true };
  if (t <= segs[0].t0) return { x: segs[0].x0, index: 0, writing: false, done: false };
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t < s.t0) return { x: segs[i - 1].x1, index: i - 1, writing: false, done: false }; // 文字と文字の間で一休み
    if (t <= s.t1) {
      const k = (t - s.t0) / (s.t1 - s.t0);
      const e = k * k * (3 - 2 * k); // ゆっくり書き始めて、ゆっくり書き終える
      return { x: s.x0 + (s.x1 - s.x0) * e, index: i, writing: !s.space, done: false };
    }
  }
  return { x: segs[segs.length - 1].x1, index: segs.length - 1, writing: false, done: t >= plan.total };
}

// 書き終えたあと:g の線が水の筋になって伸び(tail)、筋の先でためて(hang)、葉っぱへ落ちる(fall)
export const FINALE = { tail: 3.6, hang: 0.45, fall: 0.42, end: 3.6 + 0.45 + 0.42 };

export function finaleAt(w, total) {
  const t = w - total;
  if (t < 0) return { phase: 'write' };
  if (t < FINALE.tail) {
    const u = t / FINALE.tail;
    return { phase: 'tail', s: u * 0.8 + u * u * 0.2 }; // ほぼ一定で、最後は少し速く流れ落ちる
  }
  if (t < FINALE.tail + FINALE.hang) return { phase: 'hang', s: 1, k: (t - FINALE.tail) / FINALE.hang };
  if (t < FINALE.end) {
    const u = (t - FINALE.tail - FINALE.hang) / FINALE.fall;
    return { phase: 'fall', s: 1, k: u * u }; // 重力で落ちる
  }
  return { phase: 'landed', s: 1, k: 1, since: t - FINALE.end };
}

// なめらかな道(Catmull-Rom)。引数ごとに1本の曲線で、つなぎ目は角になる(ハートのくぼみ用)
export function smoothPath(...pieces) {
  const pts = [];
  for (const P of pieces) {
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const N = 24;
      for (let k = (pts.length ? 1 : 0); k <= N; k++) {
        const t = k / N, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
}

// 道の長さの s 割(0〜1)の地点
export function pathAt(path, s) {
  const { pts, cum, len } = path;
  if (s <= 0) return { x: pts[0].x, y: pts[0].y };
  if (s >= 1) return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  const d = s * len;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; }
  const k = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * k, y: pts[lo].y + (pts[hi].y - pts[lo].y) * k };
}

// きれいなハートの形(上が +y)。t=0 がくぼみ、t=±π が下のとがり、t>0 が右半分
export function heartPoint(t) {
  const s = Math.sin(t);
  return {
    x: 16 * s * s * s,
    y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
  };
}
