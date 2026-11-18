// WebGL → だめなら 2D。途中でコンテキストを失ったり重すぎたら 2D に切り替える
import { createRainGL } from './rainGL.js';
import { createRain2D } from './rain2d.js';

export function createRain(canvas, bgCanvas, { force, perfCheck = true, onFallback } = {}) {
  let size = [1, 1, 1];
  let impl = null;
  let frames = 0, total = 0;

  const use2D = () => {
    if (impl && impl.kind === 'gl') {
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    impl = createRain2D(canvas);
    impl.resize(...size);
    bgCanvas.style.visibility = 'visible';
    onFallback && onFallback();
  };

  if (force !== '2d') impl = createRainGL(canvas, bgCanvas);
  if (impl) {
    bgCanvas.style.visibility = 'hidden';
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); use2D(); });
  } else {
    use2D();
  }

  return {
    get kind() { return impl.kind; },
    resize(w, h, dpr) { size = [w, h, dpr]; impl.resize(w, h, dpr); },
    draw(rain, dt, t) {
      if (impl.kind === 'gl' && perfCheck && frames < 120) {
        frames++; total += dt;
        if (frames === 120 && total / frames > 0.04) { use2D(); return; }
      }
      impl.draw(rain, dt, t);
    },
  };
}
