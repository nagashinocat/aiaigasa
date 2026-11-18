// ゲージ・メーター・ふきだし・画面切替
export function createUI(doc) {
  const $ = (id) => doc.getElementById(id);
  const hud = $('hud'), title = $('title'), end = $('end');
  const dokiBar = doc.querySelector('#doki .bar i');
  const meter = $('meter'), bandEl = meter.querySelector('.band'), needle = meter.querySelector('.needle');
  const bubble = $('bubble');
  let lastText = null;

  const say = (text, who = '', climax = false) => {
    if (text === lastText) return;
    lastText = text;
    bubble.classList.remove('show');
    setTimeout(() => {
      bubble.textContent = text;
      bubble.className = `${who} ${climax ? 'climax' : ''} show`;
    }, 150);
  };

  return {
    update(state, b, cur) {
      dokiBar.style.width = `${(state.doki * 100).toFixed(1)}%`;
      bandEl.style.left = `${b.low * 100}%`;
      bandEl.style.width = `${(b.high - b.low) * 100}%`;
      needle.style.left = `${state.rain * 100}%`;
      meter.classList.toggle('warn', state.rain < b.low || state.rain > b.high);
      if (cur) say(cur.line.text, cur.line.who, cur.line.climax);
    },
    say,
    showTitle() { title.hidden = false; hud.hidden = true; end.hidden = true; },
    showPlay() { title.hidden = true; hud.hidden = false; end.hidden = true; lastText = null; bubble.className = ''; },
    showEnd(text) { $('endText').textContent = text; end.hidden = false; hud.hidden = true; },
    hideHud() { hud.hidden = true; },
    onStart(fn) { title.addEventListener('pointerup', fn); },
    onRetry(fn) { $('retry').addEventListener('click', fn); },
  };
}
