import { ITEM } from './costumes.js';
import { fitFor, setLocalFit, exportFit, kidKey } from './costumefit.js';

// ---------------------------------------------------------------------------
// Fit tuner: open the game with ?fit=1, go into Hares Hill, try something on,
// then slide it into place. Tweaks save on this device right away. "Copy"
// puts all of them on the clipboard as JSON for data/costume_fit.json.
// ---------------------------------------------------------------------------

const ROWS = [
  ['Left / right', 'p', 0, -0.3, 0.3, 0.005],
  ['Up / down', 'p', 1, -0.3, 0.3, 0.005],
  ['Back / front', 'p', 2, -0.3, 0.3, 0.005],
  ['Tilt fwd', 'r', 0, -90, 90, 1],
  ['Turn', 'r', 1, -180, 180, 1],
  ['Lean', 'r', 2, -90, 90, 1],
  ['Size', 's', 0, 0.3, 3, 0.01],
];

export function initFitTuner({ getKid, isShop }) {
  if (!new URLSearchParams(location.search).has('fit')) return;
  const css = document.createElement('style');
  css.textContent = `
  #fit { position: fixed; z-index: 9; left: 8px; top: calc(8px + env(safe-area-inset-top, 0px)); width: min(300px, 74vw);
    background: rgba(24, 10, 34, .92); color: #f3e6ff; border-radius: 14px; padding: 8px 10px; font: 700 12px system-ui, sans-serif;
    box-shadow: 0 6px 18px rgba(0,0,0,.4); }
  #fit.min .fit-body { display: none; }
  #fit .fit-head { display: flex; gap: 6px; align-items: center; }
  #fit select, #fit button { font: inherit; border-radius: 8px; border: 0; padding: 5px 7px; }
  #fit select { flex: 1; min-width: 0; }
  #fit button { background: #6b3fa0; color: #fff; }
  #fit label { display: grid; grid-template-columns: 76px 1fr 44px; gap: 6px; align-items: center; margin-top: 5px; }
  #fit input[type=range] { width: 100%; }
  #fit .fit-btns { display: flex; gap: 6px; margin-top: 8px; }
  #fit .fit-btns button { flex: 1; }`;
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.id = 'fit';
  el.innerHTML = `<div class="fit-head"><select id="fit-pick"></select><button id="fit-min">–</button></div>
    <div class="fit-body"><div id="fit-rows"></div>
    <div class="fit-btns"><button id="fit-reset">Reset</button><button id="fit-copy">Copy all</button></div></div>`;
  document.body.appendChild(el);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('pointerup', (e) => e.stopPropagation());

  const pick = el.querySelector('#fit-pick');
  const rowsEl = el.querySelector('#fit-rows');
  const inputs = ROWS.map(([label, key, i, min, max, step]) => {
    const l = document.createElement('label');
    l.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    rowsEl.appendChild(l);
    return { key, i, input: l.querySelector('input'), out: l.querySelector('output') };
  });
  el.querySelector('#fit-min').onclick = () => el.classList.toggle('min');

  let lastKey = '';
  const current = () => {
    const kid = getKid(), id = pick.value;
    return { kid, id, who: kidKey(kid), item: ITEM[id] };
  };
  const show = () => {
    const { id, who, item } = current();
    if (!item) return;
    const f = fitFor(who, id, item.slot) || {};
    const p = f.p || [0, 0, 0], r = f.r || [0, 0, 0];
    for (const row of inputs) {
      const v = row.key === 's' ? (f.s ?? 1) : row.key === 'p' ? p[row.i] : r[row.i];
      row.input.value = v;
      row.out.textContent = (+v).toFixed(row.key === 'p' ? 3 : row.key === 's' ? 2 : 0);
    }
  };
  const apply = () => {
    const { kid, id, who } = current();
    if (!id) return;
    const f = { p: [0, 0, 0], r: [0, 0, 0], s: 1 };
    for (const row of inputs) {
      const v = +row.input.value;
      if (row.key === 's') f.s = v; else f[row.key][row.i] = v;
      row.out.textContent = v.toFixed(row.key === 'p' ? 3 : row.key === 's' ? 2 : 0);
    }
    setLocalFit(id, who, f);
    kid.setCostume(kid.costume);
  };
  inputs.forEach((r) => r.input.addEventListener('input', apply));
  pick.onchange = show;
  el.querySelector('#fit-reset').onclick = () => {
    const { kid, id, who } = current();
    if (!id) return;
    setLocalFit(id, who, null);
    kid.setCostume(kid.costume);
    show();
  };
  el.querySelector('#fit-copy').onclick = async () => {
    const txt = exportFit();
    try { await navigator.clipboard.writeText(txt); el.querySelector('#fit-copy').textContent = 'Copied!'; }
    catch { prompt('Copy this:', txt); }
    setTimeout(() => (el.querySelector('#fit-copy').textContent = 'Copy all'), 1500);
  };

  // keep the list in step with what the boy is wearing
  setInterval(() => {
    el.style.display = isShop() ? '' : 'none';
    const kid = getKid();
    const worn = ['hat', 'face', 'outfit', 'prop'].map((s) => kid.costume[s]).filter(Boolean);
    const key = kidKey(kid) + worn.join();
    if (key === lastKey) return;
    const keep = pick.value;
    lastKey = key;
    pick.innerHTML = worn.map((id) => `<option value="${id}">${kidKey(kid)}: ${ITEM[id].name}</option>`).join('') || '<option value="">(try something on)</option>';
    // jump to whatever was just put on, otherwise stay on the same piece
    const newest = worn.find((id) => !lastWorn.includes(id));
    if (newest) pick.value = newest;
    else if (worn.includes(keep)) pick.value = keep;
    lastWorn = worn;
    show();
  }, 300);
  let lastWorn = [];
}
