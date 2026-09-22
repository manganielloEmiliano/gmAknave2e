import { t } from "../i18n.js";
import { getState, updateState } from "../state.js";
import { rollDie } from "../dice.js";

const SPEEDS = ["crawling", "walking", "running"];
const LIGHT_TYPES = ["none", "torch", "candle"];

export function renderDelving(container) {
  draw();

  function draw() {
    const state = getState();
    const lang = state.lang;
    const d = state.delving;

    container.innerHTML = `
      <h1>${t("delving.title", lang)}</h1>
      <p class="hint">${t("delving.subtitle", lang)}</p>

      <div class="card">
        <h2>${t("delving.turn", lang)}</h2>
        <p class="result">${d.turn}</p>
        <div class="btn-row">
          <button id="d-next-turn">${t("delving.nextTurn", lang)}</button>
          <button id="d-reset-turn" class="secondary">${t("delving.resetTurn", lang)}</button>
        </div>
      </div>

      <div class="card">
        <h2>${t("delving.speedTitle", lang)}</h2>
        <div class="field">
          <select id="d-speed">
            ${SPEEDS.map(
              (s) => `<option value="${s}" ${d.speed === s ? "selected" : ""}>${t(`delving.speed.${s}`, lang)}</option>`
            ).join("")}
          </select>
        </div>
        <p class="hint">${t(`delving.speedDesc.${d.speed}`, lang)}</p>
      </div>

      <div class="card">
        <h2>${t("delving.lightTitle", lang)}</h2>
        <div class="field">
          <select id="d-light-type">
            ${LIGHT_TYPES.map(
              (l) => `<option value="${l}" ${d.light.type === l ? "selected" : ""}>${t(`delving.light.${l}`, lang)}</option>`
            ).join("")}
          </select>
        </div>
        <p class="hint">${t(`delving.lightDesc.${d.light.type}`, lang)}</p>
        <p class="pill">${d.light.type !== "none" ? (d.light.remaining === false ? t("delving.lightOut", lang) : t("delving.lightLit", lang)) : t("delving.lightNone", lang)}</p>
        ${
          d.light.type !== "none"
            ? `<div class="btn-row"><button id="d-relight" class="secondary">${t("delving.relight", lang)}</button></div>`
            : ""
        }
      </div>

      <div class="card">
        <h2>${t("delving.hazardDie", lang)}</h2>
        <p class="hint">${t("delving.hazardHint", lang)}</p>
        <button id="d-roll-hazard">${t("delving.rollHazard", lang)}</button>
        <div id="d-hazard-result"></div>
        <h3>${t("delving.log", lang)}</h3>
        <div class="log">
          ${
            d.log.length === 0
              ? `<p class="hint">${t("delving.logEmpty", lang)}</p>`
              : d.log
                  .slice()
                  .reverse()
                  .map((entry) => `<div class="log-entry">${entry}</div>`)
                  .join("")
          }
        </div>
        <button id="d-clear-log" class="secondary">${t("delving.clearLog", lang)}</button>
      </div>
    `;

    container.querySelector("#d-next-turn").addEventListener("click", () => {
      updateState((s) => ({ ...s, delving: { ...s.delving, turn: s.delving.turn + 1 } }));
      draw();
    });
    container.querySelector("#d-reset-turn").addEventListener("click", () => {
      updateState((s) => ({ ...s, delving: { ...s.delving, turn: 0, log: [] } }));
      draw();
    });
    container.querySelector("#d-speed").addEventListener("change", (e) => {
      updateState((s) => ({ ...s, delving: { ...s.delving, speed: e.target.value } }));
      draw();
    });
    container.querySelector("#d-light-type").addEventListener("change", (e) => {
      updateState((s) => ({
        ...s,
        delving: { ...s.delving, light: { type: e.target.value, remaining: true } },
      }));
      draw();
    });
    const relightBtn = container.querySelector("#d-relight");
    if (relightBtn) {
      relightBtn.addEventListener("click", () => {
        updateState((s) => ({
          ...s,
          delving: { ...s.delving, light: { ...s.delving.light, remaining: true } },
        }));
        draw();
      });
    }

    container.querySelector("#d-roll-hazard").addEventListener("click", () => {
      const roll = rollDie(6);
      const desc = t(`delving.hazardResult.${roll}`, lang);
      updateState((s) => {
        const light = { ...s.delving.light };
        let extra = "";
        if (roll === 3 && light.type === "torch") {
          light.remaining = false;
          extra = ` — ${t("delving.torchBurnsOut", lang)}`;
        }
        const entry = `${t("delving.turn", lang)} ${s.delving.turn}: d6=${roll} — ${desc}${extra}`;
        return { ...s, delving: { ...s.delving, light, log: [...s.delving.log, entry] } };
      });
      draw();
    });

    container.querySelector("#d-clear-log").addEventListener("click", () => {
      updateState((s) => ({ ...s, delving: { ...s.delving, log: [] } }));
      draw();
    });
  }
}
