// ゲージ・メーター・ふきだし・画面切替
export function createUI(doc) {
  const $ = (id) => doc.getElementById(id);
  const hud = $('hud'), title = $('title'), end = $('end'), select = $('select');
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
    showTitle() { title.hidden = false; hud.hidden = true; end.hidden = true; select.hidden = true; },
    showSelect(stories, onPick) {
      const list = $('storyList');
      list.innerHTML = '';
      for (const st of stories) {
        const b = doc.createElement('button');
        b.dataset.id = st.id;
        const t = doc.createElement('b'); t.textContent = st.title;
        const d = doc.createElement('span'); d.textContent = st.blurb;
        b.append(t, d);
        b.addEventListener('click', () => onPick(st.id));
        list.append(b);
      }
      title.hidden = true; hud.hidden = true; end.hidden = true; select.hidden = false;
    },
    showPlay() { select.hidden = true; meter.style.visibility = ''; doc.getElementById('doki').style.visibility = ''; title.hidden = true; hud.hidden = false; end.hidden = true; lastText = null; bubble.className = ''; },
    showEnd(text, heading = '') { $('endTitle').textContent = heading; $('endText').textContent = text; end.hidden = false; hud.hidden = true; },
    hideHud() { hud.hidden = true; },
    hideMeter() { meter.style.visibility = 'hidden'; doc.getElementById('doki').style.visibility = 'hidden'; },
    onStart(fn) { title.addEventListener('pointerup', fn); },
    onRetry(fn) { $('retry').addEventListener('click', fn); },
    onChoose(fn) { $('choose').addEventListener('click', fn); },
  };
}
