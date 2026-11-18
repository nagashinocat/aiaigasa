// 押している/いないの管理
export function createInput(target, win) {
  let down = false;
  const press = () => { down = true; };
  const release = () => { down = false; };
  target.addEventListener('pointerdown', press);
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) target.addEventListener(t, release);
  win.addEventListener('blur', release);
  win.addEventListener('visibilitychange', release);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  return { pressing: () => down };
}
