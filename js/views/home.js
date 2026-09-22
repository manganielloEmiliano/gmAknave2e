import { t } from "../i18n.js";
import { getState } from "../state.js";
import { resolveCheck } from "../dice.js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export function renderHome(container) {
  const state = getState();
  const lang = state.lang;

  container.innerHTML = `
    <h1>${t("home.title", lang)}</h1>
    <p class="hint">${t("home.subtitle", lang)}</p>

    <div class="grid grid-3">
      <div class="card">
        <h2>${t("home.characters", lang)}</h2>
        <p class="result">${state.characters.length}</p>
        <a href="#/personajes"><button>${t("home.goCharacters", lang)}</button></a>
      </div>
      <div class="card">
        <h2>${t("home.delvingTurn", lang)}</h2>
        <p class="result">${state.delving.turn}</p>
        <a href="#/delving"><button>${t("home.goDelving", lang)}</button></a>
      </div>
      <div class="card">
        <h2>${t("home.watch", lang)}</h2>
        <p class="result">${state.travel.watch} / 6</p>
        <a href="#/viaje"><button>${t("home.goTravel", lang)}</button></a>
      </div>
    </div>

    <div class="card" id="quick-check">
      <h2>${t("checks.title", lang)}</h2>
      <p class="hint">${t("checks.description", lang)}</p>
      <div class="grid grid-3">
        <div class="field">
          <label>${t("checks.ability", lang)}</label>
          <select id="qc-ability">
            ${ABILITIES.map(
              (a) => `<option value="${a}">${t(`abilities.${a}`, lang)}</option>`
            ).join("")}
          </select>
        </div>
        <div class="field">
          <label>${t("checks.score", lang)}</label>
          <input id="qc-score" type="number" value="0" />
        </div>
        <div class="field">
          <label>${t("checks.difficulty", lang)}</label>
          <input id="qc-difficulty" type="number" value="5" min="0" max="10" />
        </div>
      </div>
      <div class="field">
        <label>${t("checks.modifiers", lang)}</label>
        <input id="qc-modifiers" type="number" value="0" step="5" />
        <p class="hint">${t("checks.modifiersHint", lang)}</p>
      </div>
      <div class="btn-row">
        <button id="qc-roll">${t("checks.roll", lang)}</button>
      </div>
      <div id="qc-result"></div>
    </div>
  `;

  container.querySelector("#qc-roll").addEventListener("click", () => {
    const abilityScore = Number(container.querySelector("#qc-score").value) || 0;
    const difficulty = Number(container.querySelector("#qc-difficulty").value) || 0;
    const modifiers = Number(container.querySelector("#qc-modifiers").value) || 0;
    const result = resolveCheck({ abilityScore, difficulty, modifiers });
    const resultEl = container.querySelector("#qc-result");
    resultEl.innerHTML = `
      <p class="result ${result.success ? "success" : "fail"}">
        d20 (${result.d20}) + ${abilityScore} + ${modifiers} = ${result.total}
        ${t("checks.vs", lang)} ${result.targetNumber}
        — ${result.success ? t("checks.success", lang) : t("checks.fail", lang)}
      </p>
    `;
  });
}
