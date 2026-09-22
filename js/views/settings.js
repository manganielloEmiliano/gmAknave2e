import { t } from "../i18n.js";
import { getState, setState, replaceState, resetState } from "../state.js";
import { exportToFile, importFromFile } from "../storage.js";

export function renderSettings(container) {
  const state = getState();
  const lang = state.lang;

  container.innerHTML = `
    <h1>${t("settings.title", lang)}</h1>

    <div class="card">
      <h2>${t("settings.language", lang)}</h2>
      <div class="btn-row">
        <button id="lang-es" class="${lang === "es" ? "" : "secondary"}">Español</button>
        <button id="lang-en" class="${lang === "en" ? "" : "secondary"}">English</button>
      </div>
    </div>

    <div class="card">
      <h2>${t("settings.theme", lang)}</h2>
      <div class="btn-row">
        <button id="theme-light" class="${state.theme === "light" ? "" : "secondary"}">${t("settings.light", lang)}</button>
        <button id="theme-dark" class="${state.theme === "dark" ? "" : "secondary"}">${t("settings.dark", lang)}</button>
      </div>
    </div>

    <div class="card">
      <h2>${t("settings.backup", lang)}</h2>
      <p class="hint">${t("settings.backupHint", lang)}</p>
      <div class="btn-row">
        <button id="export-btn">${t("settings.export", lang)}</button>
        <label class="secondary" style="display:inline-flex;align-items:center;padding:9px 14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;">
          ${t("settings.import", lang)}
          <input id="import-input" type="file" accept="application/json" style="display:none;" />
        </label>
      </div>
    </div>

    <div class="card">
      <h2>${t("settings.danger", lang)}</h2>
      <button id="reset-btn" class="danger">${t("settings.reset", lang)}</button>
    </div>
  `;

  container.querySelector("#lang-es").addEventListener("click", () => setState({ lang: "es" }));
  container.querySelector("#lang-en").addEventListener("click", () => setState({ lang: "en" }));
  container.querySelector("#theme-light").addEventListener("click", () => setState({ theme: "light" }));
  container.querySelector("#theme-dark").addEventListener("click", () => setState({ theme: "dark" }));

  container.querySelector("#export-btn").addEventListener("click", () => {
    exportToFile(getState());
  });

  container.querySelector("#import-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importFromFile(file);
      replaceState(imported);
      alert(t("settings.importSuccess", lang));
    } catch (err) {
      alert(`${t("settings.importError", lang)}: ${err.message}`);
    }
  });

  container.querySelector("#reset-btn").addEventListener("click", () => {
    if (confirm(t("settings.confirmReset", lang))) {
      resetState();
      renderSettings(container);
    }
  });
}
