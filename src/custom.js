// 自分で作る物語:入力のチェックと整形、リンクへの詰め込み
export const LIMITS = { minLines: 6, maxLines: 15, lineLen: 30, titleLen: 20, askLen: 40 };

const clean = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const len = (s) => [...s].length;

const GOODBYE = {
  closed: '「…止んじゃったね」\n「…うん。また明日」\n(…言えなかったな)',
  shelter: '「すごい雨…!」\n「今日はここまで、だね。また明日」\n(…言えなかったな)',
};

export function normalizeCustom(input) {
  const errors = [];
  const title = clean(input?.title) || '雨の帰り道';
  if (len(title) > LIMITS.titleLen) errors.push(`題名は${LIMITS.titleLen}字までにしてください`);
  const raw = Array.isArray(input?.lines) ? input.lines : [];
  if (raw.length < LIMITS.minLines) errors.push(`会話は${LIMITS.minLines}行以上にしてください`);
  if (raw.length > LIMITS.maxLines) errors.push(`会話は${LIMITS.maxLines}行までにしてください`);
  const lines = raw.map((l, i) => {
    const text = clean(l?.text);
    if (!text) errors.push(`${i + 1}行目が空です`);
    else if (len(text) > LIMITS.lineLen) errors.push(`${i + 1}行目は${LIMITS.lineLen}字までにしてください`);
    return { who: l?.who === 'he' ? 'he' : 'she', text };
  });
  const ask = clean(input?.ask), answer = clean(input?.answer);
  if (!ask) errors.push('問いかけを書いてください');
  else if (len(ask) > LIMITS.askLen) errors.push(`問いかけは${LIMITS.askLen}字までにしてください`);
  if (!answer) errors.push('答えを書いてください');
  else if (len(answer) > LIMITS.askLen) errors.push(`答えは${LIMITS.askLen}字までにしてください`);
  if (errors.length) return { story: null, errors };

  // ドキドキの区切り:最後の2行が山場(0.88 / 0.94)、それ以外は 0〜0.83 に等間隔
  const n = lines.length, rest = n - 2;
  const placed = lines.map((l, i) => {
    if (i >= rest) return { at: i === rest ? 0.88 : 0.94, who: l.who, text: l.text, climax: true };
    const at = rest === 1 ? 0 : Math.round((i / (rest - 1)) * 0.83 * 1000) / 1000;
    return { at, who: l.who, text: l.text };
  });
  return {
    story: {
      id: 'custom', title, blurb: title, tune: {}, kids: !!input.kids, lines: placed,
      ask: { who: lines[n - 2].who, text: ask },
      answer: { who: lines[n - 1].who, text: answer },
      goodbye: GOODBYE, endTitle: 'ふたりの約束、成立!',
    },
    errors: [],
  };
}

// 組み込み物語の改行は見た目のためだけなので、つなげて戻す
const joinLines = (s) => clean(String(s).replace(/\n/g, ''));

export function storyToInput(story) {
  return {
    title: story.title, kids: !!story.kids,
    lines: story.lines.map((l) => ({ who: l.who, text: joinLines(l.text) })),
    ask: joinLines(story.ask.text), answer: joinLines(story.answer.text),
  };
}

// ---- リンク:JSON → deflate → base64url ----
const toB64url = (u8) => {
  let s = ''; for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
async function pipe(u8, stream) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
}

async function pack(input) {
  const compact = { t: input.title, k: input.kids ? 1 : 0, l: input.lines.map((l) => [l.who === 'he' ? 1 : 0, l.text]), a: input.ask, b: input.answer };
  return toB64url(await pipe(new TextEncoder().encode(JSON.stringify(compact)), new CompressionStream('deflate-raw')));
}
export const packForTest = pack;

export async function encodeStory(input) {
  const { story } = normalizeCustom(input);
  if (!story) throw new Error('invalid story');
  return pack(storyToInput(story));
}

export async function decodeStory(code) {
  try {
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    const json = new TextDecoder().decode(await pipe(fromB64url(code), new DecompressionStream('deflate-raw')));
    const c = JSON.parse(json);
    if (!c || !Array.isArray(c.l)) return null;
    const input = { title: c.t, kids: !!c.k, lines: c.l.map((x) => ({ who: x?.[0] === 1 ? 'he' : 'she', text: x?.[1] })), ask: c.a, answer: c.b };
    return normalizeCustom(input).story;
  } catch {
    return null;
  }
}
