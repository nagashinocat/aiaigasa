// 共有画像:LINEのように左右に並ぶ吹き出し、雨と相合傘、虹、タイトル、URL
export const CARD = { w: 1080, h: 1920, chatTop: 300, chatBottom: 1300 };
const TITLE = "while it's raining";
const SUBTITLE = '絶対に相合傘をやめさせないゲーム';
const SCRIPT = '"Title Script", "Snell Roundhand", "Apple Chancery", cursive';
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

// 共有画像に出すのは最初のやり取り2回ぶん(吹き出し4つ)まで。山場と結末は見せない
export function teaserLines(story) {
  return story.lines.filter((l) => !l.climax).slice(0, 4);
}

export function renderShareCard(canvas, story, { url }) {
  const W = CARD.w, H = CARD.h;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const measureFor = (size) => { c.font = `${size}px ${FONT}`; return (s) => c.measureText(s).width; };
  const lay = layoutChat(teaserLines(story).map((l) => ({ who: l.who, text: String(l.text).replace(/\n/g, '') })),
    { width: W, top: 410, bottom: 1240, measureFor });

  // 雨の空(結末を匂わせる夕焼けや虹は出さない)
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a4252'); g.addColorStop(0.6, '#5d6678'); g.addColorStop(1, '#2a303b');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 街の灯のぼけ
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W, y = 1350 + rnd() * 260, r = 18 + rnd() * 40;
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,${200 + rnd() * 40 | 0},150,${0.25 + rnd() * 0.25})`); rg.addColorStop(1, 'rgba(255,210,150,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // 雨筋
  c.lineCap = 'round';
  for (let i = 0; i < 320; i++) {
    const x = rnd() * (W + 200) - 100, y = rnd() * H, L = 20 + rnd() * 60;
    c.strokeStyle = `rgba(225,235,250,${0.1 + rnd() * 0.22})`; c.lineWidth = 1 + rnd() * 2.4;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - L * 0.12, y - L); c.stroke();
  }

  // タイトル
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#f4f1ea';
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16;
  c.font = `130px ${SCRIPT}`; c.fillText(TITLE, W / 2, 178);
  c.shadowBlur = 0;
  c.font = `30px ${FONT}`; c.globalAlpha = 0.8; c.fillText(SUBTITLE, W / 2, 262);
  c.font = `38px ${FONT}`; c.globalAlpha = 0.9; c.fillText(`― ${story.title} ―`, W / 2, 325); c.globalAlpha = 1;

  // 吹き出し
  for (const b of lay.bubbles) {
    c.fillStyle = 'rgba(0,0,0,.2)'; roundRect(c, b.x + 4, b.y + 6, b.w, b.h, 30); c.fill();
    c.fillStyle = b.who === 'he' ? '#d6e8ff' : '#ffffff'; roundRect(c, b.x, b.y, b.w, b.h, 30); c.fill();
    c.fillStyle = '#2b2f38'; c.font = `${lay.fontSize}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    b.rows.forEach((row, i) => c.fillText(row, b.x + b.padX, b.y + b.padY + b.lineH * (i + 0.5)));
  }
  // 続きがありそうな「…」の吹き出し
  const dy = lay.bottom + 40;
  c.fillStyle = 'rgba(255,255,255,.55)'; roundRect(c, 56, dy, 150, 76, 30); c.fill();
  c.fillStyle = '#2b2f38';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(98 + i * 33, dy + 38, 8, 0, 7); c.fill(); }

  // 誘いの一文
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff';
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 12;
  c.font = `bold 46px ${FONT}`; c.fillText('この続きは、', W / 2, 1330);
  c.fillText('あなたが雨を降らせて見届けて。', W / 2, 1400);
  c.shadowBlur = 0;

  // 相合傘の二人とURL
  if (typeof Path2D !== 'undefined') {
    const k = story.kids ? 1.5 : 2;
    c.save(); c.translate(W / 2 - 60 * k, H - 150 - 130 * k - 10); c.scale(k, k);
    c.fillStyle = 'rgba(14,17,23,.92)'; c.fill(new Path2D(COUPLE)); c.restore();
  }
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, H - 150, W, 150);
  c.fillStyle = '#ffffff'; c.font = `bold 38px ${FONT}`; c.textAlign = 'center';
  c.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, H - 92);
  c.font = `28px ${FONT}`; c.globalAlpha = 0.85;
  c.fillText('この二人の相合傘、守り切れる?', W / 2, H - 44);
  c.globalAlpha = 1;
  return canvas;
}
