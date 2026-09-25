import { loadDictionaries, t } from "./i18n.js";
import { getState, subscribe } from "./state.js";
import { registerRoute, startRouter, currentPath } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderRules } from "./views/rules.js";
import { renderCharacters } from "./views/characters.js";
import { renderParty } from "./views/party.js";
import { renderCombat } from "./views/combat.js";
import { renderDelving } from "./views/delving.js";
import { renderTravel } from "./views/travel.js";
import { renderSettings } from "./views/settings.js";
import { renderSlayers } from "./views/slayers.js";

const NAV_ITEMS = [
  { path: "/", labelKey: "nav.home" },
  { path: "/reglas", labelKey: "nav.rules" },
  { path: "/personajes", labelKey: "nav.characters" },
  { path: "/grupo", labelKey: "nav.party" },
  { path: "/combate", labelKey: "nav.combat" },
  { path: "/delving", labelKey: "nav.delving" },
  { path: "/viaje", labelKey: "nav.travel" },
  { path: "/slayers", labelKey: "nav.slayers" },
  { path: "/ajustes", labelKey: "nav.settings" },
];

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function renderNav() {
  const state = getState();
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  const active = currentPath();
  for (const item of NAV_ITEMS) {
    const a = document.createElement("a");
    a.href = `#${item.path}`;
    a.textContent = t(item.labelKey, state.lang);
    if (active === item.path) a.classList.add("active");
    nav.appendChild(a);
  }
}

async function main() {
  await loadDictionaries();
  const state = getState();
  applyTheme(state.theme);
  document.documentElement.lang = state.lang;

  registerRoute("/", renderHome);
  registerRoute("/reglas", renderRules);
  registerRoute("/personajes", renderCharacters);
  registerRoute("/grupo", renderParty);
  registerRoute("/combate", renderCombat);
  registerRoute("/delving", renderDelving);
  registerRoute("/viaje", renderTravel);
  registerRoute("/slayers", renderSlayers);
  registerRoute("/ajustes", renderSettings);

  renderNav();
  const outlet = document.getElementById("view");
  startRouter(outlet);

  window.addEventListener("hashchange", renderNav);

  subscribe((s) => {
    applyTheme(s.theme);
    document.documentElement.lang = s.lang;
    renderNav();
  });
}

main();
