import { t, getRules } from "../i18n.js";
import { getState } from "../state.js";

export function renderRules(container) {
  const state = getState();
  const lang = state.lang;
  const rules = getRules();

  container.innerHTML = `
    <h1>${t("rules.title", lang)}</h1>
    <p class="hint">${t("rules.disclaimer", lang)}</p>
    <div class="field">
      <input id="rules-search" type="search" placeholder="${t("rules.searchPlaceholder", lang)}" />
    </div>
    <div id="rules-list"></div>
  `;

  const listEl = container.querySelector("#rules-list");

  function renderList(filter) {
    const query = (filter || "").trim().toLowerCase();
    const filtered = rules.filter((section) => {
      if (!query) return true;
      const title = (section.title[lang] || section.title.es || "").toLowerCase();
      const body = (section.body[lang] || section.body.es || []).join(" ").toLowerCase();
      return title.includes(query) || body.includes(query);
    });

    listEl.innerHTML = filtered
      .map((section, idx) => {
        const title = section.title[lang] || section.title.es;
        const paragraphs = section.body[lang] || section.body.es || [];
        return `
          <button class="section-toggle" data-idx="${idx}" type="button">
            ${title}
          </button>
          <div class="section-body" data-body="${idx}" hidden>
            ${paragraphs.map((p) => `<p>${p}</p>`).join("")}
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".section-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.getAttribute("data-idx");
        const body = listEl.querySelector(`[data-body="${idx}"]`);
        body.hidden = !body.hidden;
      });
    });
  }

  renderList("");

  container.querySelector("#rules-search").addEventListener("input", (e) => {
    renderList(e.target.value);
  });
}
