import { t } from "../i18n.js";
import { getState } from "../state.js";
import { roll2d6, resolveAttack, rollD20, parseDiceNotation } from "../dice.js";

export function renderCombat(container) {
  const state = getState();
  const lang = state.lang;

  container.innerHTML = `
    <h1>${t("combat.title", lang)}</h1>

    <div class="card">
      <h2>${t("combat.initiative", lang)}</h2>
      <p class="hint">${t("combat.initiativeHint", lang)}</p>
      <div class="grid grid-2">
        <div class="field">
          <label>${t("combat.sideA", lang)} CHA</label>
          <input id="cb-cha-a" type="number" value="0" />
        </div>
        <div class="field">
          <label>${t("combat.sideB", lang)} CHA</label>
          <input id="cb-cha-b" type="number" value="0" />
        </div>
      </div>
      <button id="cb-roll-initiative">${t("combat.rollInitiative", lang)}</button>
      <div id="cb-initiative-result"></div>
    </div>

    <div class="card">
      <h2>${t("combat.attack", lang)}</h2>
      <div class="grid grid-3">
        <div class="field">
          <label>${t("combat.attackAbility", lang)}</label>
          <input id="cb-attack-score" type="number" value="0" />
        </div>
        <div class="field">
          <label>${t("combat.targetAp", lang)}</label>
          <input id="cb-target-ap" type="number" value="0" />
        </div>
        <div class="field">
          <label>${t("combat.modifiers", lang)}</label>
          <input id="cb-attack-mod" type="number" value="0" step="5" />
        </div>
      </div>
      <button id="cb-roll-attack">${t("combat.rollAttack", lang)}</button>
      <div id="cb-attack-result"></div>

      <div class="grid grid-2" style="margin-top:10px;">
        <div class="field">
          <label>${t("combat.weaponDie", lang)}</label>
          <input id="cb-weapon-die" type="text" value="d6" />
        </div>
        <div class="field">
          <label><input id="cb-power-attack" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("combat.powerAttack", lang)}</label>
        </div>
      </div>
      <button id="cb-roll-damage" class="secondary">${t("combat.rollDamage", lang)}</button>
      <div id="cb-damage-result"></div>
    </div>

    <div class="card">
      <h2>${t("combat.morale", lang)}</h2>
      <div class="field">
        <label>${t("combat.moraleRating", lang)}</label>
        <input id="cb-morale-rating" type="number" value="7" />
      </div>
      <button id="cb-roll-morale" class="secondary">${t("combat.rollMorale", lang)}</button>
      <div id="cb-morale-result"></div>
    </div>
  `;

  container.querySelector("#cb-roll-initiative").addEventListener("click", () => {
    const chaA = Number(container.querySelector("#cb-cha-a").value) || 0;
    const chaB = Number(container.querySelector("#cb-cha-b").value) || 0;
    const rollA = rollD20() + chaA;
    const rollB = rollD20() + chaB;
    const winner = rollA >= rollB ? t("combat.sideA", lang) : t("combat.sideB", lang);
    container.querySelector("#cb-initiative-result").innerHTML = `
      <p class="result">${t("combat.sideA", lang)}: ${rollA} — ${t("combat.sideB", lang)}: ${rollB}</p>
      <p class="result success">${t("combat.actsFirst", lang)}: ${winner}</p>
    `;
  });

  container.querySelector("#cb-roll-attack").addEventListener("click", () => {
    const attackAbility = Number(container.querySelector("#cb-attack-score").value) || 0;
    const armorPoints = Number(container.querySelector("#cb-target-ap").value) || 0;
    const modifiers = Number(container.querySelector("#cb-attack-mod").value) || 0;
    const result = resolveAttack({ attackAbility, armorPoints, modifiers });
    const parts = [
      `<p class="result ${result.hit ? "success" : "fail"}">
        d20 (${result.d20}) + ${attackAbility} + ${modifiers} = ${result.total}
        ${t("checks.vs", lang)} AC ${result.armorClass}
        — ${result.hit ? t("combat.hit", lang) : t("combat.miss", lang)}
      </p>`,
    ];
    if (result.freeManeuver) parts.push(`<p class="pill">${t("combat.freeManeuver", lang)}</p>`);
    if (result.weaponBreaks) parts.push(`<p class="pill">${t("combat.weaponBreaks", lang)}</p>`);
    container.querySelector("#cb-attack-result").innerHTML = parts.join("");
  });

  container.querySelector("#cb-roll-damage").addEventListener("click", () => {
    const notation = container.querySelector("#cb-weapon-die").value || "d6";
    const power = container.querySelector("#cb-power-attack").checked;
    try {
      const base = parseDiceNotation(notation);
      let total = base.total;
      let rolls = base.rolls;
      if (power) {
        // Power attack doubles the number of damage dice rolled.
        const doubled = parseDiceNotation(`${base.count * 2}d${base.sides}`);
        total = doubled.total;
        rolls = doubled.rolls;
      }
      container.querySelector("#cb-damage-result").innerHTML = `
        <p class="result">${t("combat.damage", lang)}: ${total} <span class="hint">(${rolls.join(", ")})</span></p>
        ${power ? `<p class="pill">${t("combat.weaponBreaks", lang)}</p>` : ""}
      `;
    } catch (err) {
      container.querySelector("#cb-damage-result").innerHTML = `<p class="result fail">${err.message}</p>`;
    }
  });

  container.querySelector("#cb-roll-morale").addEventListener("click", () => {
    const rating = Number(container.querySelector("#cb-morale-rating").value) || 0;
    const { total } = roll2d6();
    const holds = total <= rating;
    container.querySelector("#cb-morale-result").innerHTML = `
      <p class="result ${holds ? "success" : "fail"}">2d6 = ${total} ${t("checks.vs", lang)} ${rating} — ${
      holds ? t("combat.moraleHolds", lang) : t("combat.moraleBreaks", lang)
    }</p>
    `;
  });
}
