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
      const mk = doc.createElement('button');
      mk.dataset.id = 'make'; mk.className = 'make';
      const mt = doc.createElement('b'); mt.textContent = '✎ 自分で作る';
      const md = doc.createElement('span'); md.textContent = '会話を書いて、守り切って、共有しよう';
      mk.append(mt, md);
      mk.addEventListener('click', () => onPick('make'));
      list.append(mk);
      title.hidden = true; hud.hidden = true; end.hidden = true; select.hidden = false;
    },
    showPlay() { select.hidden = true; meter.style.visibility = ''; doc.getElementById('doki').style.visibility = ''; title.hidden = true; hud.hidden = false; end.hidden = true; lastText = null; bubble.className = ''; },
    showEnd(text, heading = '', canShare = false) { $('endTitle').textContent = heading; $('endText').textContent = text; $('share').hidden = !canShare; $('toast').textContent = ''; end.hidden = false; hud.hidden = true; },
    toast(t) { $('toast').textContent = t; },
    onShare(fn) { $('share').addEventListener('click', fn); },
    hideHud() { hud.hidden = true; },
    hideMeter() { meter.style.visibility = 'hidden'; doc.getElementById('doki').style.visibility = 'hidden'; },
    onStart(fn) { title.addEventListener('pointerup', fn); },
    onRetry(fn) { $('retry').addEventListener('click', fn); },
    onChoose(fn) { $('choose').addEventListener('click', fn); },
  };
}
