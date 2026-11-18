import { createState, step, band } from './logic.js';
import { lineAt, isClimax, GOODBYE, PROMISE } from './story.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createBackground } from './background.js';
import { createRain } from './rain.js';

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

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bg.resize(innerWidth, innerHeight, dpr);
  rain.resize(innerWidth, innerHeight, dpr);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

let mode = 'title';          // title | play | end
let state = createState();
let last = performance.now();
const game = (window.__game = { get outcome() { return state.outcome; }, get state() { return state; }, mode: () => mode, get rainKind() { return rain.kind; } });
window.__debugSetDoki = (v) => { state = { ...state, doki: v }; };

let endT = 0, endRain = 0.5;
function startGame() {
  state = createState();
  mode = 'play';
  Object.assign(view, { sunset: 0, rainbow: 0 });
  ui.showPlay();
}

function finish() {
  endT = 0; endRain = state.rain;
  if (state.outcome === 'clear') {
    mode = 'ending';
    ui.say(PROMISE, 'he');
    ui.hideMeter();
  } else {
    mode = 'end';
    ui.say(GOODBYE[state.outcome]);
    setTimeout(() => ui.showEnd(GOODBYE[state.outcome]), 1500);
  }
}

// クリア演出:雨が止む(0-3秒)→夕焼け(3-6秒)→虹(6-9秒)→終了画面(10秒)
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function ending(dt) {
  endT += dt;
  view.rain = endRain * (1 - ease(endT / 3));
  view.sunset = ease((endT - 3) / 3);
  view.rainbow = ease((endT - 6) / 3);
  if (endT >= 10 && mode === 'ending') {
    mode = 'end';
    ui.showEnd(`${PROMISE}\n\nデートの約束、成立!`);
  }
}

ui.onStart(() => { if (mode === 'title') startGame(); });
ui.onRetry(startGame);

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (mode === 'play') {
    const climax = isClimax(state.doki);
    state = step(state, dt, input.pressing(), climax);
    ui.update(state, band(climax), lineAt(state.doki));
    if (state.outcome !== 'playing') finish();
  }
  if (mode === 'ending') ending(Math.min(dt, 0.1));
  view.t += Math.min(dt, 0.1);
  if (mode === 'play') view.rain = state.rain;
  const v = debugView ? { ...view, ...debugView } : view;
  bg.draw(v);
  rain.draw(v.rain, Math.min(dt, 0.1), view.t);
  requestAnimationFrame(frame);
}
ui.showTitle();
requestAnimationFrame(frame);
void game;
