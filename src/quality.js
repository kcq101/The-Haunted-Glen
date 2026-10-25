import * as THREE from 'three';

// Graphics quality. "high" (default) = smoother shapes, softer lighting,
// sharper shadows, antialiasing. "low" = the original lighter look for older
// tablets. Changing it reloads the page so everything is rebuilt.
const KEY = 'hauntedglen.quality';
let saved = null;
try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
const forced = new URLSearchParams(location.search).get('quality');

export const QUALITY = forced === 'low' || forced === 'high' ? forced : saved === 'low' ? 'low' : 'high';
export const HIGH = QUALITY === 'high';

export function setQuality(q) {
  try { localStorage.setItem(KEY, q); } catch { /* ignore */ }
  location.reload();
}

// Lit material: soft physically-based shading on high, cheap Lambert on low.
export function litMat(params = {}) {
  return HIGH
    ? new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, ...params })
    : new THREE.MeshLambertMaterial(params);
}

// Pick a detail level: q(high, low)
export const q = (high, low) => (HIGH ? high : low);
