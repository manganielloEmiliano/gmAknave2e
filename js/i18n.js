let dictionaries = { en: {}, es: {} };
let rulesContent = [];

export async function loadDictionaries() {
  const [en, es, rules] = await Promise.all([
    fetch("data/i18n.en.json").then((r) => r.json()),
    fetch("data/i18n.es.json").then((r) => r.json()),
    fetch("data/rules.json").then((r) => r.json()),
  ]);
  dictionaries = { en, es };
  rulesContent = rules;
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
