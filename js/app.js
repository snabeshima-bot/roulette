import {
  state, subscribe, addItem, updateItem, removeItem, setExcludeMode, markWon, resetWon,
  activeItems, totalWeight, pickWeighted, MIN_WEIGHT, MAX_WEIGHT,
} from './items.js';
import { createRoulette } from './roulette.js';
import { createLottery } from './lottery.js';
import { createGaragara } from './garagara.js';

const $ = (sel) => document.querySelector(sel);

const modes = {
  roulette: { view: createRoulette($('#rouletteCanvas')), label: '回す' },
  lottery: { view: createLottery($('#lottery')), label: 'くじを引く' },
  garagara: { view: createGaragara($('#garagaraCanvas')), label: 'ガラガラ回す' },
};

let currentMode = 'roulette';
let busy = false;
let pendingWinner = null;

const drawButton = $('#drawButton');
const itemList = $('#itemList');
const dialog = $('#resultDialog');

// ---- 項目リスト ----

function createRow(item) {
  const li = document.createElement('li');
  li.className = 'item-row';
  li.dataset.id = item.id;
  li.innerHTML = `
    <span class="swatch"></span>
    <input class="item-name" type="text" maxlength="40" aria-label="項目名">
    <input class="item-weight" type="number" min="${MIN_WEIGHT}" max="${MAX_WEIGHT}" step="1" aria-label="重み">
    <span class="item-prob"></span>
    <button type="button" class="icon-button item-delete" aria-label="削除">×</button>
  `;
  const id = item.id;
  li.querySelector('.item-name').addEventListener('input', (e) => updateItem(id, { name: e.target.value }));
  const weight = li.querySelector('.item-weight');
  weight.addEventListener('input', (e) => {
    if (e.target.value !== '') updateItem(id, { weight: e.target.value });
  });
  weight.addEventListener('change', (e) => {
    const item = state.items.find((it) => it.id === id);
    if (item) e.target.value = item.weight;
  });
  li.querySelector('.item-delete').addEventListener('click', () => removeItem(id));
  return li;
}

function setIfIdle(input, value) {
  if (document.activeElement !== input && input.value !== String(value)) input.value = value;
}

function renderList() {
  const rows = new Map([...itemList.children].map((li) => [Number(li.dataset.id), li]));
  const active = activeItems();
  const total = totalWeight(active);

  state.items.forEach((item, index) => {
    let li = rows.get(item.id);
    if (!li) li = createRow(item);
    rows.delete(item.id);
    if (itemList.children[index] !== li) itemList.insertBefore(li, itemList.children[index] || null);

    li.classList.toggle('is-won', item.won);
    li.querySelector('.swatch').style.background = item.color;
    setIfIdle(li.querySelector('.item-name'), item.name);
    setIfIdle(li.querySelector('.item-weight'), item.weight);
    const inPool = item.name && !item.won;
    li.querySelector('.item-prob').textContent = item.won
      ? '当選済'
      : inPool && total ? `${((item.weight / total) * 100).toFixed(1)}%` : '—';
  });
  for (const li of rows.values()) li.remove();

  if (!state.items.length) {
    itemList.innerHTML = '<li class="empty">項目を追加してください</li>';
  } else {
    itemList.querySelector('.empty')?.remove();
  }

  $('#excludeStatus').hidden = !state.excludeMode;
  const won = state.items.filter((it) => it.won).length;
  $('#excludeCount').textContent = `当選済み ${won} / ${state.items.length}`;
}

// ---- 抽選 ----

function renderStage() {
  const active = activeItems();
  for (const m of Object.values(modes)) m.view.render(active);
  drawButton.textContent = modes[currentMode].label;
  drawButton.disabled = busy || active.length === 0;

  let note = '';
  if (!active.length) {
    note = state.excludeMode && state.items.some((it) => it.won)
      ? 'すべて当選しました。「リセット」で元に戻せます。'
      : '項目を追加してください。';
  }
  $('#stageNote').textContent = note;
}

function setBusy(on) {
  busy = on;
  document.body.classList.toggle('is-busy', on);
  for (const el of document.querySelectorAll('.tab, .items-card input, .items-card button')) {
    el.disabled = on;
  }
  drawButton.disabled = on || activeItems().length === 0;
}

async function draw() {
  if (busy) return;
  const winner = pickWeighted(activeItems());
  if (!winner) return;
  setBusy(true);
  await modes[currentMode].view.play(winner);
  pendingWinner = winner;
  $('#resultName').textContent = winner.name;
  $('#resultName').style.setProperty('--result-color', winner.color);
  dialog.showModal();
}

dialog.addEventListener('close', () => {
  const winner = pendingWinner;
  pendingWinner = null;
  setBusy(false);
  modes.lottery.view.reset();
  if (winner && state.excludeMode) markWon(winner.id);
  else refresh();
});

dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

drawButton.addEventListener('click', draw);

// ---- タブ ----

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (busy) return;
    currentMode = tab.dataset.mode;
    for (const t of document.querySelectorAll('.tab')) {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    }
    for (const p of document.querySelectorAll('.panel')) {
      p.classList.toggle('is-active', p.dataset.panel === currentMode);
    }
    renderStage();
  });
}

// ---- 追加・設定 ----

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#addName');
  if (addItem(input.value)) input.value = '';
  input.focus();
});

$('#excludeToggle').addEventListener('change', (e) => setExcludeMode(e.target.checked));
$('#resetWon').addEventListener('click', () => resetWon());

function refresh() {
  renderList();
  renderStage();
}

subscribe(refresh);

['大吉', '中吉', '小吉', '吉', '末吉', '凶'].forEach((name, i) => addItem(name, [1, 2, 3, 3, 2, 1][i]));
refresh();

// 動作確認用（コンソールから重みの偏りを確かめられる）
window.__lottery = { state, pickWeighted, activeItems };
