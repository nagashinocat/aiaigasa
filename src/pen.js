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
export const FINALE = { tail: 1.5, hang: 0.45, fall: 0.38, end: 1.5 + 0.45 + 0.38 };

export function finaleAt(w, total) {
  const t = w - total;
  if (t < 0) return { phase: 'write' };
  if (t < FINALE.tail) {
    const u = t / FINALE.tail;
    return { phase: 'tail', s: u * u * 0.55 + u * 0.45 }; // だんだん速く流れる
  }
  if (t < FINALE.tail + FINALE.hang) return { phase: 'hang', s: 1, k: (t - FINALE.tail) / FINALE.hang };
  if (t < FINALE.end) {
    const u = (t - FINALE.tail - FINALE.hang) / FINALE.fall;
    return { phase: 'fall', s: 1, k: u * u }; // 重力で落ちる
  }
  return { phase: 'landed', s: 1, k: 1, since: t - FINALE.end };
}
