import { t } from "../i18n.js";
import { getState, updateState } from "../state.js";
import { rollDie, resolveCheck } from "../dice.js";

export function renderTravel(container) {
  draw();

  function draw() {
    const state = getState();
    const lang = state.lang;
    const tr = state.travel;
    const watchInDay = ((tr.watch - 1 + 6) % 6) + 1;

    container.innerHTML = `
      <h1>${t("travel.title", lang)}</h1>
      <p class="hint">${t("travel.subtitle", lang)}</p>

      <div class="card">
        <h2>${t("travel.watch", lang)}</h2>
        <p class="result">${t("travel.day", lang)} ${tr.day} — ${t("travel.watchNumber", lang)} ${watchInDay} / 6</p>
        <div class="btn-row">
          <button id="t-next-watch">${t("travel.nextWatch", lang)}</button>
          <button id="t-reset-watch" class="secondary">${t("travel.resetWatch", lang)}</button>
        </div>
      </div>

      <div class="card">
        <h2>${t("travel.hazardDie", lang)}</h2>
        <p class="hint">${t("travel.hazardHint", lang)}</p>
        <button id="t-roll-hazard">${t("travel.rollHazard", lang)}</button>
        <div id="t-hazard-result"></div>
        <h3>${t("travel.log", lang)}</h3>
        <div class="log">
          ${
            tr.log.length === 0
              ? `<p class="hint">${t("travel.logEmpty", lang)}</p>`
              : tr.log
                  .slice()
                  .reverse()
                  .map((entry) => `<div class="log-entry">${entry}</div>`)
                  .join("")
          }
        </div>
        <button id="t-clear-log" class="secondary">${t("travel.clearLog", lang)}</button>
      </div>

      <div class="card">
        <h2>${t("travel.foraging", lang)}</h2>
        <p class="hint">${t("travel.foragingHint", lang)}</p>
        <div class="grid grid-2">
          <div class="field">
            <label>${t("checks.score", lang)} (WIS)</label>
            <input id="t-wis" type="number" value="0" />
          </div>
          <div class="field">
            <label>${t("checks.modifiers", lang)}</label>
            <input id="t-forage-mod" type="number" value="0" step="5" />
          </div>
        </div>
        <button id="t-roll-forage" class="secondary">${t("travel.rollForage", lang)}</button>
        <div id="t-forage-result"></div>
      </div>
    `;

    container.querySelector("#t-next-watch").addEventListener("click", () => {
      updateState((s) => {
        const watch = s.travel.watch + 1;
        const day = s.travel.day + (watch % 6 === 1 && watch > 1 ? 1 : 0);
        return { ...s, travel: { ...s.travel, watch, day } };
      });
      draw();
    });
    container.querySelector("#t-reset-watch").addEventListener("click", () => {
      updateState((s) => ({ ...s, travel: { ...s.travel, watch: 0, day: 1, log: [] } }));
      draw();
    });

    container.querySelector("#t-roll-hazard").addEventListener("click", () => {
      const roll = rollDie(6);
      const desc = t(`travel.hazardResult.${roll}`, lang);
      updateState((s) => {
        const entry = `${t("travel.day", lang)} ${s.travel.day}: d6=${roll} — ${desc}`;
        return { ...s, travel: { ...s.travel, log: [...s.travel.log, entry] } };
      });
      draw();
    });

    container.querySelector("#t-clear-log").addEventListener("click", () => {
      updateState((s) => ({ ...s, travel: { ...s.travel, log: [] } }));
      draw();
    });

    container.querySelector("#t-roll-forage").addEventListener("click", () => {
      const abilityScore = Number(container.querySelector("#t-wis").value) || 0;
      const modifiers = Number(container.querySelector("#t-forage-mod").value) || 0;
      const result = resolveCheck({ abilityScore, difficulty: 5, modifiers });
      container.querySelector("#t-forage-result").innerHTML = `
        <p class="result ${result.success ? "success" : "fail"}">
          d20 (${result.d20}) + ${abilityScore} + ${modifiers} = ${result.total}
          ${t("checks.vs", lang)} ${result.targetNumber}
          — ${result.success ? t("travel.forageSuccess", lang) : t("travel.forageFail", lang)}
        </p>
      `;
    });
  }
}
