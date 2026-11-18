// 共有:共有シート(画像+文+リンク)、使えなければ 画像保存+Xの投稿画面+リンクのコピー
import { STORIES } from './story.js';

export const SITE_URL = 'https://nagashinocat.github.io/aiaigasa/';
const IDS = new Set(STORIES.map((s) => s.id));

export function readHash(hash) {
  const h = String(hash || '');
  let m = h.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (m) return { kind: 'custom', code: m[1] };
  m = h.match(/^#story=([a-z]+)$/);
  if (m && IDS.has(m[1])) return { kind: 'builtin', id: m[1] };
  return null;
}

export const storyLink = (ref) => SITE_URL + (ref.kind === 'custom' ? `#s=${ref.code}` : `#story=${ref.id}`);

export const shareText = (link) => `この二人の相合傘、守り切れる? #相合傘をやめさせない\n${link}`;

const toBlob = (canvas) => new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));

// 画像とリンクは終了画面が出たときに先に用意しておく(タップの中で待つと、スマホが共有をはじくため)
export async function prepareShare(canvas, link) {
  const blob = await toBlob(canvas);
  const file = blob && typeof File !== 'undefined' ? new File([blob], 'aiaigasa.png', { type: 'image/png' }) : null;
  return { blob, file, link };
}

// タップの中で呼ぶ。待ち時間なしで共有シート/投稿画面/コピーを始める
export function shareStory({ prepared, nav = navigator, doc = document, win = window }) {
  const { blob, file, link } = prepared;
  if (file && nav.canShare && nav.canShare({ files: [file] })) {
    return nav.share({ files: [file], text: shareText(link) })
      .then(() => 'sheet')
      .catch((e) => (e && e.name === 'AbortError' ? 'cancel' : fallback()));
  }
  return Promise.resolve(fallback());

  function fallback() {
    win.open(`https://x.com/intent/post?text=${encodeURIComponent(shareText(link))}`, '_blank', 'noopener');
    if (blob) {
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'aiaigasa.png';
      doc.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    try { const pr = nav.clipboard?.writeText(link); if (pr && pr.catch) pr.catch(() => {}); } catch { /* コピーできない環境 */ }
    return 'fallback';
  }
}
