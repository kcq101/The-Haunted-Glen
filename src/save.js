import { STARTER_ITEMS } from './costumes.js';

const KEY = 'haunted-glen-save-v1';

const DEFAULT = () => ({
  candy: 0,
  owned: [...STARTER_ITEMS],
  outfits: {
    carter: { hat: null, face: null, outfit: null, prop: 'candy_pail' },
    jack: { hat: null, face: null, outfit: null, prop: 'candy_pail' },
  },
  current: 'carter',
  knocked: {}, // houseId -> night number when last visited
  found: [], // golden candy corn ids found in the haunted house
  nightNumber: 0,
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULT(), ...JSON.parse(raw) };
      for (const id of STARTER_ITEMS) if (!s.owned.includes(id)) s.owned.push(id);
      return s;
    }
  } catch (e) { /* storage unavailable: play without saving */ }
  return DEFAULT();
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
