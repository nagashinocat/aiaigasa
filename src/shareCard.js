// 共有画像:LINEのように左右に並ぶ吹き出し、雨と相合傘、虹、タイトル、URL
export const CARD = { w: 1080, h: 1920, chatTop: 300, chatBottom: 1300 };
const TITLE = '絶対に相合傘をやめさせないゲーム';
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';

// 1行に収まるように折り返す。日本語は1文字ずつ、英単語は単語ごと(長すぎる単語は文字で切る)
export function wrapText(text, maxWidth, measure) {
  const tokens = [];
  for (const m of String(text).matchAll(/[A-Za-z0-9'’!?.,:;\-]+|\s+|./gu)) tokens.push(m[0]);
  const rows = [];
  let cur = '';
  const push = () => { if (cur.trim()) rows.push(cur.trim()); cur = ''; };
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) { if (cur && measure(cur + ' ') <= maxWidth) cur += ' '; continue; }
    if (measure(cur + tok) <= maxWidth) { cur += tok; continue; }
    if (cur.trim()) push();
    if (measure(tok) <= maxWidth) { cur = tok; continue; }
    for (const ch of [...tok]) {
      if (measure(cur + ch) > maxWidth && cur) push();
      cur += ch;
    }
  }
  push();
  // 行頭禁則:、。」などが行の先頭に来たら前の行へ戻す
  for (let i = 1; i < rows.length; i++) {
    while (rows[i] && NO_START.test(rows[i][0])) { rows[i - 1] += rows[i][0]; rows[i] = rows[i].slice(1); }
  }
  return rows.filter((r) => r).length ? rows.filter((r) => r) : [''];
}
const NO_START = /[、。，．」』）)!?！？…ー〜]/;

function place(lines, width, top, size, gap, measure) {
  const padX = size * 0.7, padY = size * 0.45, lineH = size * 1.4, side = 56;
  const maxInner = width * 0.74 - padX * 2;
  let y = top;
  const bubbles = lines.map((l) => {
    const rows = wrapText(l.text, maxInner, measure);
    const inner = Math.max(...rows.map(measure));
    const w = Math.ceil(inner + padX * 2), h = Math.ceil(rows.length * lineH + padY * 2);
    const x = l.who === 'he' ? width - side - w : side;
    const b = { who: l.who, rows, x, y, w, h, padX, padY, lineH };
    y += h + gap;
    return b;
  });
  return { bubbles, bottom: y - gap };
}

// 文字は40pxから。入らなければ間隔を詰め、それでも入らなければ2pxずつ下げて最低34px。
// 34pxでも入らないときは文字を小さくせず、画像を縦に伸ばす(bottom が chatBottom を超える)
export function layoutChat(lines, { width, top, bottom, measureFor }) {
  for (let size = 40; size >= 34; size -= 2) {
    for (const gap of [26, 14]) {
      const r = place(lines, width, top, size, gap, measureFor(size));
      if (r.bottom <= bottom) return { ...r, fontSize: size };
    }
  }
  return { ...place(lines, width, top, 34, 14, measureFor(34)), fontSize: 34 };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

const COUPLE = 'M10 48 Q60 -6 110 48 Q100 42 92 48 Q84 42 76 48 Q68 42 60 48 Q52 42 44 48 Q36 42 28 48 Q20 42 10 48Z M59 46 h2 v40 h-2Z M36 66 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0Z M33 128 L35 90 Q36 77 44 77 Q52 77 53 90 L55 128Z M67 62 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0Z M64 128 L66 88 Q67 74 76 74 Q85 74 86 88 L88 128Z';

export function renderShareCard(canvas, story, { url }) {
  const W = CARD.w;
  const probe = canvas.getContext('2d');
  const measureFor = (size) => { probe.font = `${size}px ${FONT}`; return (s) => probe.measureText(s).width; };
  const lay = layoutChat(story.lines.map((l) => ({ who: l.who, text: String(l.text).replace(/\n/g, '') })),
    { width: W, top: CARD.chatTop, bottom: CARD.chatBottom, measureFor });
  // 下の段(虹・問いかけと答え・二人・URL)の高さを先に測る
  const qaRows = (txt, size) => { probe.font = `bold ${size}px ${FONT}`; return wrapText(`「${String(txt).replace(/\n/g, '')}」`, W - 160, (x) => probe.measureText(x).width); };
  const askRows = qaRows(story.ask.text, 44), ansRows = qaRows(story.answer.text, 48);
  const k = story.kids ? 1.5 : 2;
  const qaH = askRows.length * 44 * 1.35 + 24 + ansRows.length * 48 * 1.35;
  const finaleH = 120 + qaH + 40 + 130 * k + 150;
  const H = Math.max(CARD.h, Math.ceil(lay.bottom + 60 + finaleH));
  const finaleY = H - finaleH;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');

  // 空:雨の灰色 → 下のほうで夕焼けへ
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3e4656'); g.addColorStop(Math.min(0.95, finaleY / H), '#6b7486');
  g.addColorStop(Math.min(0.98, (finaleY + 220) / H), '#e79a84'); g.addColorStop(1, '#f3c79a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // 雨筋(会話のところだけ降らせる)
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  c.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * (W + 200) - 100, y = rnd() * (finaleY - 40), L = 20 + rnd() * 50;
    c.strokeStyle = `rgba(225,235,250,${0.12 + rnd() * 0.22})`; c.lineWidth = 1 + rnd() * 2.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - L * 0.12, y - L); c.stroke();
  }

  // タイトル
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#f4f1ea';
  c.font = `bold 58px ${FONT}`;
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16;
  c.fillText(TITLE, W / 2, 130);
  c.shadowBlur = 0;
  c.font = `36px ${FONT}`; c.globalAlpha = 0.85;
  c.fillText(`― ${story.title} ―`, W / 2, 205);
  c.globalAlpha = 1;

  // 吹き出し
  for (const b of lay.bubbles) {
    c.fillStyle = 'rgba(0,0,0,.18)'; roundRect(c, b.x + 4, b.y + 6, b.w, b.h, 30); c.fill();
    c.fillStyle = b.who === 'he' ? '#d6e8ff' : '#ffffff'; roundRect(c, b.x, b.y, b.w, b.h, 30); c.fill();
    c.fillStyle = '#2b2f38'; c.font = `${lay.fontSize}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    b.rows.forEach((row, i) => c.fillText(row, b.x + b.padX, b.y + b.padY + b.lineH * (i + 0.5)));
  }

  // 虹と、問いかけ・答え
  const R = 520, cx = W / 2, cy = finaleY + 30 + R;
  ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa'].forEach((col, i) => {
    c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 16;
    c.beginPath(); c.arc(cx, cy, R - i * 16, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  });
  c.globalAlpha = 1;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff';
  c.shadowColor = 'rgba(80,30,30,.45)'; c.shadowBlur = 14;
  const qa = (rows, y, size) => {
    c.font = `bold ${size}px ${FONT}`;
    rows.forEach((r, i) => c.fillText(r, cx, y + size * 0.6 + i * size * 1.35));
    return rows.length * size * 1.35;
  };
  let qy = finaleY + 120;
  qy += qa(askRows, qy, 44) + 24;
  qy += qa(ansRows, qy, 48);
  c.shadowBlur = 0;

  // 相合傘の二人とURL
  if (typeof Path2D !== 'undefined') {
    c.save(); c.translate(W / 2 - 60 * k, qy + 40); c.scale(k, k);
    c.fillStyle = 'rgba(40,24,34,.85)'; c.fill(new Path2D(COUPLE)); c.restore();
  }
  c.fillStyle = 'rgba(40,24,34,.35)'; c.fillRect(0, H - 150, W, 150);
  c.fillStyle = '#ffffff'; c.font = `bold 38px ${FONT}`; c.textAlign = 'center';
  c.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, H - 92);
  c.font = `28px ${FONT}`; c.globalAlpha = 0.85;
  c.fillText('この二人の相合傘、守り切れる?', W / 2, H - 44);
  c.globalAlpha = 1;
  return canvas;
}
