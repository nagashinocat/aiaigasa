// 物語を書く画面。ユーザーの文字は value / textContent でだけ扱う
import { LIMITS, normalizeCustom } from './custom.js';

const DRAFT_KEY = 'aiaigasa-draft';

export const SAMPLE = {
  title: '雨の帰り道', kids: false,
  lines: [
    { who: 'she', text: '急に降ってきたね' },
    { who: 'he', text: '…入ってく?' },
    { who: 'she', text: 'いいの?' },
    { who: 'he', text: 'どうぞ。駅まで一緒だし' },
    { who: 'she', text: 'あのね…' },
    { who: 'he', text: '…うん' },
  ],
  ask: '明日も、一緒に帰らない?',
  answer: '…うん。晴れてもね',
};

export function createEditor(doc, { storage, onPlay, onBack }) {
  const $ = (id) => doc.getElementById(id);
  const root = $('editor'), list = $('edLines'), errorsEl = $('edErrors');
  let kids = false;

  function read() {
    return {
      title: $('edTitle').value, kids,
      lines: [...list.children].map((li) => ({ who: li.dataset.who, text: li.querySelector('input').value })),
      ask: $('edAsk').value, answer: $('edAnswer').value,
    };
  }
  function save() { try { storage?.setItem(DRAFT_KEY, JSON.stringify(read())); } catch { /* 保存できない環境 */ } }
  function loadDraft() {
    try { const d = JSON.parse(storage?.getItem(DRAFT_KEY) || 'null'); if (d && Array.isArray(d.lines)) return d; } catch { /* 壊れた下書き */ }
    return null;
  }

  function markClimax() {
    const items = [...list.children];
    items.forEach((li, i) => li.classList.toggle('climax', i >= items.length - 2));
    $('edAdd').disabled = items.length >= LIMITS.maxLines;
  }

  function setWho(li, who) {
    li.dataset.who = who;
    li.className = `line ${who}`;
    li.querySelector('.who').textContent = who === 'he' ? '彼' : '彼女';
  }

  function addLine(line) {
    const li = doc.createElement('li');
    const who = doc.createElement('button'); who.type = 'button'; who.className = 'who';
    const input = doc.createElement('input'); input.maxLength = LIMITS.lineLen; input.autocomplete = 'off';
    input.value = line.text || ''; input.setAttribute('aria-label', 'せりふ');
    const del = doc.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '×';
    del.setAttribute('aria-label', 'この行を消す');
    li.append(who, input, del);
    setWho(li, line.who === 'he' ? 'he' : 'she');
    who.addEventListener('click', () => { setWho(li, li.dataset.who === 'he' ? 'she' : 'he'); markClimax(); save(); });
    del.addEventListener('click', () => { li.remove(); markClimax(); save(); });
    input.addEventListener('input', save);
    list.append(li);
    markClimax();
  }

  function setKids(v) {
    kids = !!v;
    for (const b of root.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String((b.dataset.kids === '1') === kids));
  }

  function fill(input) {
    $('edTitle').value = input.title || '';
    setKids(input.kids);
    list.innerHTML = '';
    for (const l of input.lines) addLine(l);
    $('edAsk').value = input.ask || '';
    $('edAnswer').value = input.answer || '';
    errorsEl.textContent = '';
  }

  for (const b of root.querySelectorAll('.seg button')) b.addEventListener('click', () => { setKids(b.dataset.kids === '1'); save(); });
  for (const id of ['edTitle', 'edAsk', 'edAnswer']) $(id).addEventListener('input', save);
  $('edAdd').addEventListener('click', () => {
    if (list.children.length >= LIMITS.maxLines) return;
    const last = list.lastElementChild?.dataset.who;
    addLine({ who: last === 'she' ? 'he' : 'she', text: '' });
    list.lastElementChild.querySelector('input').focus();
    save();
  });
  $('edPlay').addEventListener('click', () => {
    const input = read();
    const { story, errors } = normalizeCustom(input);
    if (!story) { errorsEl.textContent = errors.join('\n'); root.scrollTop = 0; return; }
    save();
    onPlay(story, input);
  });
  $('edBack').addEventListener('click', () => onBack());

  return {
    open(input) {
      fill(input || loadDraft() || SAMPLE);
      root.hidden = false; root.scrollTop = 0;
    },
    close() { root.hidden = true; },
  };
}
