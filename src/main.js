import { createState, step, band } from './logic.js';
import { STORIES, getStory, lineAt, isClimax } from './story.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createBackground } from './background.js';
import { createRain } from './rain.js';
import { createOpening } from './opening.js';
import { createAudio, attachUnlock } from './audio.js';
import { createEditor } from './editor.js';
import { renderShareCard } from './shareCard.js';
import { normalizeCustom } from './custom.js';

const stage = document.getElementById('stage');
let store = null;
try { store = window.localStorage; } catch { store = null; }
const audio = createAudio({ storage: store });
const soundBtn = document.getElementById('sound');
const showSound = () => { soundBtn.classList.toggle('off', audio.muted); soundBtn.setAttribute('aria-label', audio.muted ? '音を出す' : '音を消す'); };
showSound();
attachUnlock(window, () => audio.unlock());
for (const t of ['pointerdown', 'pointerup']) soundBtn.addEventListener(t, (e) => e.stopPropagation());
soundBtn.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); showSound(); });
const ui = createUI(document);
const input = createInput(stage, window);

const bg = createBackground(document.getElementById('bg'));
const view = { rain: 0.5, sunset: 0, rainbow: 0, t: 0 };
let debugView = null;
window.__debugBackground = (v) => { debugView = v; };

const params = new URLSearchParams(location.search);
const rain = createRain(document.getElementById('rain'), document.getElementById('bg'),
  { force: params.get('rain'), perfCheck: params.get('perf') !== 'off' });

const opening = createOpening(document.getElementById('opening'), () => chooseStory(), { force: params.get('rain') });
const hint = document.querySelector('#title .hint');
window.__debugSkipOpening = () => opening.skip();
window.__debugHideOpening = () => opening.stop();
window.__debugChoose = () => chooseStory();
window.__debugCard = (id) => {
  const st = id === 'longest'
    ? normalizeCustom({ title: 'いちばん長い物語', lines: Array.from({ length: 15 }, (_, i) => ({ who: i % 2 ? 'he' : 'she', text: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ' })), ask: 'あ'.repeat(40), answer: 'Hello, see you tomorrow! また明日☔' }).story
    : getStory(id);
  const cv = renderShareCard(document.createElement('canvas'), st, { url: 'https://nagashinocat.github.io/aiaigasa/' });
  return { w: cv.width, h: cv.height, png: cv.toDataURL('image/png') };
};

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bg.resize(innerWidth, innerHeight, dpr);
  rain.resize(innerWidth, innerHeight, dpr);
  opening.resize(innerWidth, innerHeight, dpr);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

let mode = 'title';          // title | select | play | ending | end
let story = getStory(params.get('story'));
let customInput = null; // 自分で作った物語の入力(共有用)
let state = createState();
let last = performance.now();
const game = (window.__game = { get outcome() { return state.outcome; }, get state() { return state; }, mode: () => mode, get rainKind() { return rain.kind; }, get openingKind() { return opening.kind; }, get story() { return story.id; }, get audio() { return audio.muted ? 'muted' : audio.state; }, rainFrames: 0 });
window.__debugSetDoki = (v) => { state = { ...state, doki: v }; };

let endT = 0, endRain = 0.5, answered = false;
const editor = createEditor(document, {
  storage: store,
  onPlay: (st, input) => { story = st; customInput = input; editor.close(); startGame(); },
  onBack: () => chooseStory(),
});

function chooseStory() {
  mode = 'select';
  editor.close();
  Object.assign(view, { sunset: 0, rainbow: 0, rain: 0.5 });
  ui.showSelect(STORIES, (id) => {
    if (id === 'make') { mode = 'edit'; document.getElementById('select').hidden = true; editor.open(); return; }
    story = getStory(id); customInput = null; startGame();
  });
}

function startGame() {
  state = createState();
  mode = 'play';
  Object.assign(view, { sunset: 0, rainbow: 0 });
  document.getElementById('couple').classList.toggle('kids', story.kids);
  ui.showPlay();
}

function finish() {
  endT = 0; endRain = state.rain; answered = false;
  if (state.outcome === 'clear') {
    mode = 'ending';
    ui.say(story.ask.text, story.ask.who, true);
    ui.hideMeter();
  } else {
    mode = 'end';
    const bye = story.goodbye[state.outcome];
    ui.say(bye);
    setTimeout(() => ui.showEnd(bye), 1800);
  }
}

// クリア演出:問いかけ → 雨が止む(0-3秒) → 夕焼け(3-6秒) → 虹(6-9秒)、7秒で答え → 終了画面(11秒)
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function ending(dt) {
  endT += dt;
  view.rain = endRain * (1 - ease(endT / 3));
  view.sunset = ease((endT - 3) / 3);
  view.rainbow = ease((endT - 6) / 3);
  if (endT >= 7 && !answered) { answered = true; ui.say(story.answer.text, story.answer.who); audio.chime(); }
  if (endT >= 11 && mode === 'ending') {
    mode = 'end';
    ui.showEnd(`「${story.ask.text.replace(/\n/g, '')}」\n「${story.answer.text}」`, story.endTitle);
  }
}

ui.onStart(() => { if (mode === 'title') opening.tap(); });
ui.onRetry(startGame);
ui.onChoose(chooseStory);

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (mode === 'play') {
    const climax = isClimax(story, state.doki);
    state = step(state, dt, input.pressing(), climax, story.tune);
    ui.update(state, band(climax), lineAt(story, state.doki));
    if (state.outcome !== 'playing') finish();
  }
  if (mode === 'title') hint.hidden = !opening.ready;
  if (mode === 'ending') ending(Math.min(dt, 0.1));
  view.t += Math.min(dt, 0.1);
  if (mode === 'play') view.rain = state.rain;
  audio.setRain(mode === 'title' ? 0.55 : view.rain);
  // オープニングが全面を覆っている間は、下の雨を描かない(重さ対策)
  if (!opening.covering || debugView) {
    const v = debugView ? { ...view, ...debugView } : view;
    bg.draw({ ...v, sky: rain.kind !== 'gl', kids: story.kids });
    rain.draw(v.rain, Math.min(dt, 0.1), view.t, v);
    game.rainFrames++;
  }
  requestAnimationFrame(frame);
}
ui.showTitle();
opening.start();
requestAnimationFrame(frame);
void game;
