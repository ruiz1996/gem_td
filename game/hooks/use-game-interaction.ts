'use client';
import { useSyncExternalStore } from 'react';
import {
  prefersTouch,
  type InteractionPreference,
} from '@/lib/game/interaction';
const KEY = 'gemtd-interaction-mode';
const CHANGE = 'gemtd-interaction-change';
let fallbackPreference: InteractionPreference = 'auto';
function getSnapshot() {
  let preference = fallbackPreference;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'auto' || saved === 'touch' || saved === 'desktop') {
      preference = saved;
    }
  } catch {
    /* Input mode also works when storage is disabled. */
  }
  const coarse =
    window.matchMedia('(any-pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0;
  // A primitive snapshot remains stable until a browser setting changes.
  return `${preference}|${window.innerWidth}|${window.innerHeight}|${coarse ? 1 : 0}`;
}
function getServerSnapshot() {
  return 'auto|1280|800|0';
}
function subscribe(update: () => void) {
  const query = window.matchMedia('(any-pointer: coarse)');
  query.addEventListener('change', update);
  window.addEventListener('resize', update);
  window.addEventListener('storage', update);
  window.addEventListener(CHANGE, update);
  return () => {
    query.removeEventListener('change', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('storage', update);
    window.removeEventListener(CHANGE, update);
  };
}
function changePreference(value: InteractionPreference) {
  fallbackPreference = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* Optional preference persistence. */
  }
  window.dispatchEvent(new Event(CHANGE));
}
export function useGameInteraction() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [mode, width, height, coarse] = snapshot.split('|');
  const preference = mode as InteractionPreference;
  return {
    touch: prefersTouch(
      preference,
      Number(width),
      Number(height),
      coarse === '1',
    ),
    preference,
    changePreference,
  };
}
