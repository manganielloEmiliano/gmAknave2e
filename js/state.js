import * as storage from "./storage.js";

let current = storage.load();
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(current);
}

export function getState() {
  return current;
}

export function setState(patch) {
  current = { ...current, ...patch };
  storage.save(current);
  notify();
}

// updater: (state) => newState. Use for nested/complex updates.
export function updateState(updater) {
  current = updater(current);
  storage.save(current);
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState() {
  current = storage.reset();
  notify();
}

export function replaceState(newState) {
  current = newState;
  storage.save(current);
  notify();
}
