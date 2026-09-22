const STORAGE_KEY = "knave-gm:v1";
const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    lang: "es",
    theme: "dark",
    characters: [],
    party: {
      mount: { name: "", slots: 0, items: [] },
      purse: 0,
    },
    delving: {
      turn: 0,
      speed: "walking",
      light: { type: "none", remaining: null },
      log: [],
    },
    travel: {
      watch: 0,
      day: 1,
      log: [],
      trip: {
        distanceHexes: 0,
        remainingHexes: 0,
        plannedDays: 0,
        mounted: false,
        difficult: false,
      },
    },
  };
}

function mergeWithDefaults(parsed) {
  const defaults = defaultState();
  return {
    ...defaults,
    ...parsed,
    party: { ...defaults.party, ...(parsed.party || {}) },
    delving: { ...defaults.delving, ...(parsed.delving || {}) },
    travel: {
      ...defaults.travel,
      ...(parsed.travel || {}),
      trip: { ...defaults.travel.trip, ...((parsed.travel || {}).trip || {}) },
    },
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    version: SCHEMA_VERSION,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (err) {
    console.error("No se pudo leer el estado guardado, se reinicia.", err);
    return defaultState();
  }
}

export function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function reset() {
  localStorage.removeItem(STORAGE_KEY);
  return defaultState();
}

export function exportToFile(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `knave-gm-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        resolve(mergeWithDefaults(parsed));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
