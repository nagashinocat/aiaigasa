import { createState, step, band } from './logic.js';
import { STORIES, getStory, lineAt, isClimax } from './story.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createBackground } from './background.js';
import { createRain } from './rain.js';
import { createOpening } from './opening.js';

const stage = document.getElementById('stage');
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
let state = createState();
let last = performance.now();
const game = (window.__game = { get outcome() { return state.outcome; }, get state() { return state; }, mode: () => mode, get rainKind() { return rain.kind; }, get openingKind() { return opening.kind; }, get story() { return story.id; }, rainFrames: 0 });
window.__debugSetDoki = (v) => { state = { ...state, doki: v }; };

let endT = 0, endRain = 0.5;
function chooseStory() {
  mode = 'select';
  Object.assign(view, { sunset: 0, rainbow: 0, rain: 0.5 });
  ui.showSelect(STORIES, (id) => { story = getStory(id); startGame(); });
}

function startGame() {
  state = createState();
  mode = 'play';
  Object.assign(view, { sunset: 0, rainbow: 0 });
  document.getElementById('couple').classList.toggle('kids', story.kids);
  ui.showPlay();
}

function finish() {
  endT = 0; endRain = state.rain;
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
  if (endT >= 7) ui.say(story.answer.text, story.answer.who);
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
