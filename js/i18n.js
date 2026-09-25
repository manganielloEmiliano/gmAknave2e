let dictionaries = { en: {}, es: {} };
let rulesContent = [];
// null means "not loaded / failed": data/slayers.json is optional homebrew
// content, so a missing or malformed file must not break the rest of the app.
let slayersContent = null;

export async function loadDictionaries() {
  const [en, es, rules, slayers] = await Promise.all([
    fetch("data/i18n.en.json").then((r) => r.json()),
    fetch("data/i18n.es.json").then((r) => r.json()),
    fetch("data/rules.json").then((r) => r.json()),
    fetch("data/slayers.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  dictionaries = { en, es };
  rulesContent = rules;
  slayersContent = slayers;
}

function lookup(dict, key) {
  return key
    .split(".")
    .reduce(
      (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
      dict
    );
}

export function t(key, lang) {
  const dict = dictionaries[lang] || dictionaries.es;
  const value = lookup(dict, key);
  if (value !== undefined) return value;
  const fallback = lookup(dictionaries.es, key);
  return fallback !== undefined ? fallback : key;
}

export function getRules() {
  return rulesContent;
}

// Returns null when data/slayers.json is missing or failed to parse; callers
// must show a hint instead of assuming the shape below.
export function getSlayers() {
  return slayersContent;
}
