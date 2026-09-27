// 項目の状態管理と重み付き抽選

export const PALETTE = [
  '#e8505b', '#f9a03f', '#f6d743', '#7bc96f', '#3fb8af', '#4a90d9',
  '#7b6fd6', '#c86dd7', '#ef7fa8', '#8d6e63', '#26a69a', '#5c6bc0',
];

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 100;

let nextId = 1;
let colorIndex = 0;
const listeners = new Set();

export const state = {
  items: [],
  excludeMode: false,
};

function emit() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clampWeight(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_WEIGHT;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, n));
}

export function addItem(name, weight = 1) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const item = {
    id: nextId++,
    name: trimmed,
    weight: clampWeight(weight),
    color: PALETTE[colorIndex++ % PALETTE.length],
    won: false,
  };
  state.items.push(item);
  emit();
  return item;
}

export function updateItem(id, patch) {
  const item = state.items.find((it) => it.id === id);
  if (!item) return;
  if ('name' in patch) item.name = String(patch.name).trim();
  if ('weight' in patch) item.weight = clampWeight(patch.weight);
  emit();
}

export function removeItem(id) {
  state.items = state.items.filter((it) => it.id !== id);
  emit();
}

export function setExcludeMode(on) {
  state.excludeMode = Boolean(on);
  if (!state.excludeMode) resetWon({ silent: true });
  emit();
}

export function markWon(id) {
  const item = state.items.find((it) => it.id === id);
  if (item) item.won = true;
  emit();
}

export function resetWon({ silent = false } = {}) {
  for (const it of state.items) it.won = false;
  if (!silent) emit();
}

// 抽選の対象になる項目（名前が空のものと当選済みのものを除く）
export function activeItems() {
  return state.items.filter((it) => it.name && !it.won);
}

export function totalWeight(list) {
  return list.reduce((sum, it) => sum + it.weight, 0);
}

export function pickWeighted(list, rand = Math.random) {
  const total = totalWeight(list);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const it of list) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return list[list.length - 1];
}
