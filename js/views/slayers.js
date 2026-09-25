import { t, getSlayers } from "../i18n.js";
import { getState } from "../state.js";
import { renderRulesTab, renderSpellsTab, renderEntitiesTab, renderArtifactsTab } from "./slayers/reference.js";
import { renderTrackerTab } from "./slayers/tracker.js";

// Optional fan homebrew section: Slayers magic schools, spells, entities and
// artifacts, plus a per-character caster tracker. Entirely self-contained —
// it only reads/writes its own state.slayers slice (and, for the tracker,
// char.spellbooks/char.wounds through the same state API characters.js
// itself uses) and never touches js/views/characters.js.
const TABS = ["rules", "spells", "entities", "artifacts", "tracker"];

export function renderSlayers(container) {
  let activeTab = "rules";

  function draw() {
    const state = getState();
    const lang = state.lang;
    const data = getSlayers();

    container.innerHTML = `
      <h1>${t("slayers.title", lang)}</h1>
      <p class="hint">${t("slayers.subtitle", lang)}</p>
      <div class="btn-row" id="slayers-tabs"></div>
      <div id="slayers-tab-content"></div>
    `;

    const tabsEl = container.querySelector("#slayers-tabs");
    tabsEl.innerHTML = TABS.map(
      (tab) =>
        `<button class="tab-btn ${tab === activeTab ? "" : "secondary"}" data-tab="${tab}">${t(
          `slayers.tabs.${tab}`,
          lang
        )}</button>`
    ).join("");
    tabsEl.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-tab");
        draw();
      });
    });

    const contentEl = container.querySelector("#slayers-tab-content");

    if (!data) {
      contentEl.innerHTML = `<p class="hint">${t("slayers.dataMissing", lang)}</p>`;
      return;
    }

    if (activeTab === "rules") renderRulesTab(contentEl, lang, data);
    else if (activeTab === "spells") renderSpellsTab(contentEl, lang, data);
    else if (activeTab === "entities") renderEntitiesTab(contentEl, lang, data);
    else if (activeTab === "artifacts") renderArtifactsTab(contentEl, lang, data);
    else if (activeTab === "tracker") renderTrackerTab(contentEl, lang);
  }

  draw();
}
