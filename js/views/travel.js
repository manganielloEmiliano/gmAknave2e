import { t } from "../i18n.js";
import { getState, updateState } from "../state.js";
import { rollDie, resolveCheck } from "../dice.js";

// Base speed is 1 hex (6 miles) per watch, up to 3 watches of actual travel
// per day. Mounted doubles it, difficult terrain/night/severe weather halves
// it (the two combine, per the book's flat modifiers).
function hexesPerWatch(trip) {
  let rate = 1;
  if (trip.mounted) rate *= 2;
  if (trip.difficult) rate *= 0.5;
  return rate;
}

function applyPartyDirectDamage(amount) {
  updateState((s) => ({
    ...s,
    characters: s.characters.map((c) => {
      const slotsMax = 10 + c.abilities.con;
      return { ...c, wounds: Math.min(slotsMax, c.wounds + amount) };
    }),
  }));
}

export function renderTravel(container) {
  draw();

  function draw() {
    const state = getState();
    const lang = state.lang;
    const tr = state.travel;
    const trip = tr.trip;
    const watchInDay = ((tr.watch - 1 + 6) % 6) + 1;
    const rate = hexesPerWatch(trip);
    const ratePerDay = rate * 3;
    const hasDistance = trip.distanceHexes > 0;
    const hasPlannedDays = trip.plannedDays > 0;
    const extraWatch = watchInDay > 3;

    container.innerHTML = `
      <h1>${t("travel.title", lang)}</h1>
      <p class="hint">${t("travel.subtitle", lang)}</p>

      <div class="card">
        <h2>${t("travel.planTitle", lang)}</h2>
        <p class="hint">${t("travel.planHint", lang)}</p>
        <div class="grid grid-2">
          <div class="field">
            <label>${t("travel.distanceHexes", lang)}</label>
            <input id="t-trip-distance" type="number" min="0" value="${trip.distanceHexes}" />
          </div>
          <div class="field">
            <label>${t("travel.plannedDays", lang)}</label>
            <input id="t-trip-days" type="number" min="0" value="${trip.plannedDays}" />
          </div>
        </div>
        <label><input id="t-trip-mounted" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" ${trip.mounted ? "checked" : ""} />${t("travel.mounted", lang)}</label>
        <label><input id="t-trip-difficult" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" ${trip.difficult ? "checked" : ""} />${t("travel.difficult", lang)}</label>
        <p class="pill">${t("travel.rate", lang)}: ${rate} ${t("travel.hexesPerWatch", lang)} (${ratePerDay}/${t("travel.day", lang).toLowerCase()})</p>
        ${
          hasDistance
            ? `<p class="pill">${t("travel.estimatedDays", lang)}: ${Math.ceil(trip.distanceHexes / ratePerDay)}</p>`
            : ""
        }
        <div class="btn-row">
          <button id="t-start-trip">${t("travel.startTrip", lang)}</button>
        </div>
        ${
          hasDistance || hasPlannedDays
            ? `<p class="result ${trip.remainingHexes <= 0 && hasDistance ? "success" : ""}">
                ${
                  hasDistance
                    ? trip.remainingHexes <= 0
                      ? t("travel.arrived", lang)
                      : `${t("travel.remaining", lang)}: ${trip.remainingHexes} / ${trip.distanceHexes}`
                    : `${t("travel.day", lang)} ${tr.day} / ${trip.plannedDays}`
                }
              </p>`
            : ""
        }
      </div>

      <div class="card">
        <h2>${t("travel.watch", lang)}</h2>
        <p class="result">${t("travel.day", lang)} ${tr.day} — ${t("travel.watchNumber", lang)} ${watchInDay} / 6</p>
        ${
          extraWatch
            ? `<p class="pill">${t("travel.extraWatch", lang)}</p>
               <div class="btn-row">
                 <button id="t-apply-extra-damage" class="danger">${t("travel.applyExtraDamage", lang)}</button>
               </div>`
            : ""
        }
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

    container.querySelector("#t-trip-distance").addEventListener("change", (e) => {
      updateState((s) => ({
        ...s,
        travel: { ...s.travel, trip: { ...s.travel.trip, distanceHexes: Math.max(0, Number(e.target.value) || 0) } },
      }));
      draw();
    });
    container.querySelector("#t-trip-days").addEventListener("change", (e) => {
      updateState((s) => ({
        ...s,
        travel: { ...s.travel, trip: { ...s.travel.trip, plannedDays: Math.max(0, Number(e.target.value) || 0) } },
      }));
      draw();
    });
    container.querySelector("#t-trip-mounted").addEventListener("change", (e) => {
      updateState((s) => ({
        ...s,
        travel: { ...s.travel, trip: { ...s.travel.trip, mounted: e.target.checked } },
      }));
      draw();
    });
    container.querySelector("#t-trip-difficult").addEventListener("change", (e) => {
      updateState((s) => ({
        ...s,
        travel: { ...s.travel, trip: { ...s.travel.trip, difficult: e.target.checked } },
      }));
      draw();
    });
    container.querySelector("#t-start-trip").addEventListener("click", () => {
      updateState((s) => ({
        ...s,
        travel: {
          ...s.travel,
          watch: 0,
          day: 1,
          trip: { ...s.travel.trip, remainingHexes: s.travel.trip.distanceHexes },
        },
      }));
      draw();
    });

    container.querySelector("#t-next-watch").addEventListener("click", () => {
      updateState((s) => {
        const watch = s.travel.watch + 1;
        const day = s.travel.day + (watch % 6 === 1 && watch > 1 ? 1 : 0);
        const currentRate = hexesPerWatch(s.travel.trip);
        const remainingHexes =
          s.travel.trip.distanceHexes > 0
            ? Math.max(0, s.travel.trip.remainingHexes - currentRate)
            : s.travel.trip.remainingHexes;
        return {
          ...s,
          travel: { ...s.travel, watch, day, trip: { ...s.travel.trip, remainingHexes } },
        };
      });
      draw();
    });
    container.querySelector("#t-reset-watch").addEventListener("click", () => {
      updateState((s) => ({ ...s, travel: { ...s.travel, watch: 0, day: 1, log: [] } }));
      draw();
    });

    const extraDamageBtn = container.querySelector("#t-apply-extra-damage");
    if (extraDamageBtn) {
      extraDamageBtn.addEventListener("click", () => {
        applyPartyDirectDamage(1);
        alert(t("travel.extraDamageApplied", lang));
      });
    }

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
