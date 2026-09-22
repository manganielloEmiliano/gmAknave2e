import { t } from "../i18n.js";
import { getState, updateState } from "../state.js";
import { rollDice, parseDiceNotation } from "../dice.js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const LEVEL_TABLE = [
  { level: 1, xp: 0, hpDie: 1 },
  { level: 2, xp: 2000, hpDie: 2 },
  { level: 3, xp: 4000, hpDie: 3 },
  { level: 4, xp: 8000, hpDie: 4 },
  { level: 5, xp: 16000, hpDie: 5 },
  { level: 6, xp: 32000, hpDie: 6 },
  { level: 7, xp: 64000, hpDie: 7 },
  { level: 8, xp: 125000, hpDie: 8 },
  { level: 9, xp: 250000, hpDie: 9 },
  { level: 10, xp: 500000, hpDie: 10 },
];

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function blankAbilities() {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

// 500 coins fill a full item slot (any amount above a multiple of 500 still
// takes a whole extra slot).
function coinSlotCount(coins) {
  return coins > 0 ? Math.ceil(coins / 500) : 0;
}

function computeDerived(char) {
  const slotsMax = 10 + char.abilities.con;
  const itemSlots = char.inventory.reduce((sum, it) => sum + (it.slots || 1), 0);
  const spellbookSlots = char.spellbooks.length;
  const coinSlots = coinSlotCount(char.coins || 0);
  const usedSlots = Math.min(slotsMax, char.wounds + itemSlots + spellbookSlots + coinSlots);
  // Armor pieces are inventory items flagged isArmor: each takes 1 slot (already
  // counted in itemSlots) and grants +1 AP, up to 7 pieces (max AC 18).
  const armorCount = char.inventory.filter((it) => it.isArmor).length;
  const ac = 11 + Math.min(armorCount, 7);
  return {
    slotsMax,
    itemSlots,
    spellbookSlots,
    coinSlots,
    armorCount,
    usedSlots,
    freeSlots: Math.max(0, slotsMax - usedSlots),
    ac,
  };
}

function nextLevelInfo(char) {
  const current = LEVEL_TABLE.find((l) => l.level === char.level) || LEVEL_TABLE[0];
  const next = LEVEL_TABLE.find((l) => l.level === char.level + 1);
  return { current, next };
}

function buildSlotCells(char, derived, lang) {
  const cells = [];
  for (let i = 0; i < char.wounds && cells.length < derived.slotsMax; i += 1) {
    cells.push({ type: "wound", label: t("sheet.wound", lang) });
  }
  for (const sp of char.spellbooks) {
    if (cells.length >= derived.slotsMax) break;
    cells.push({ type: "spell", label: sp.name || t("sheet.spellbooks", lang) });
  }
  let remainingCoins = char.coins || 0;
  for (let i = 0; i < derived.coinSlots; i += 1) {
    if (cells.length >= derived.slotsMax) break;
    const chunk = Math.min(500, remainingCoins);
    remainingCoins -= chunk;
    cells.push({ type: "coins", label: `${chunk}c` });
  }
  for (const it of char.inventory) {
    const weight = it.slots || 1;
    for (let w = 0; w < weight; w += 1) {
      if (cells.length >= derived.slotsMax) break;
      const qtyTag = it.consumable && it.qty > 1 ? ` x${it.qty}` : "";
      cells.push({
        type: it.isArmor ? "armor" : "item",
        label: w === 0 ? `${it.name}${qtyTag}` : "…",
      });
    }
  }
  while (cells.length < derived.slotsMax) cells.push({ type: "empty", label: "·" });
  return cells;
}

// Finds the first consumable inventory item whose name looks like a ration
// (es: ración/raciones, en: ration/rations).
function findRationItem(char) {
  return char.inventory.find(
    (it) => it.consumable && it.qty > 0 && /raci|ration/i.test(it.name)
  );
}

export function renderCharacters(container) {
  let mode = { view: "list", editingId: null };

  function draw() {
    const state = getState();
    const lang = state.lang;

    if (mode.view === "list") {
      drawList(container, lang, state);
    } else if (mode.view === "create") {
      drawWizard(container, lang);
    } else if (mode.view === "sheet") {
      drawSheet(container, lang, mode.editingId);
    }
  }

  function drawList(container, lang, state) {
    container.innerHTML = `
      <h1>${t("characters.title", lang)}</h1>
      <p class="hint">${t("characters.subtitle", lang)}</p>
      <div class="btn-row">
        <button id="new-char">${t("characters.new", lang)}</button>
      </div>
      <div class="char-list" id="char-list"></div>
    `;
    const listEl = container.querySelector("#char-list");
    if (state.characters.length === 0) {
      listEl.innerHTML = `<p class="hint">${t("characters.empty", lang)}</p>`;
    } else {
      listEl.innerHTML = state.characters
        .map((c) => {
          const d = computeDerived(c);
          return `
            <div class="char-card" data-id="${c.id}">
              <div>
                <strong>${c.name || t("characters.unnamed", lang)}</strong>
                <div class="hint">${t("characters.level", lang)} ${c.level} · HP ${c.hpCurrent}/${c.hpMax} · AC ${d.ac} · ${t("characters.slots", lang)} ${d.usedSlots}/${d.slotsMax}</div>
              </div>
              <span class="pill">${c.career || t("characters.noCareer", lang)}</span>
            </div>
          `;
        })
        .join("");
      listEl.querySelectorAll(".char-card").forEach((cardEl) => {
        cardEl.addEventListener("click", () => {
          mode = { view: "sheet", editingId: cardEl.getAttribute("data-id") };
          draw();
        });
      });
    }
    container.querySelector("#new-char").addEventListener("click", () => {
      mode = { view: "create", editingId: null };
      draw();
    });
  }

  function drawWizard(container, lang) {
    const wizard = {
      step: 1,
      name: "",
      abilities: blankAbilities(),
      pointsRemaining: 3,
      hpMax: null,
      career: "",
      equipmentNotes: "",
      coins: 0,
      inventory: [],
      armor: [],
    };

    function renderStep() {
      const stepEl = container.querySelector("#wizard-step");
      if (wizard.step === 1) {
        stepEl.innerHTML = `
          <h2>${t("wizard.step1Title", lang)}</h2>
          <div class="field">
            <label>${t("wizard.name", lang)}</label>
            <input id="w-name" type="text" value="${wizard.name}" />
          </div>
          <p class="hint">${t("wizard.abilitiesHint", lang)}</p>
          <div class="btn-row">
            <button id="w-roll3d6" class="secondary">${t("wizard.roll3d6", lang)}</button>
            <button id="w-reset" class="secondary">${t("wizard.resetAbilities", lang)}</button>
          </div>
          <div class="grid grid-3" id="w-abilities"></div>
          <p class="hint" id="w-points">${t("wizard.pointsRemaining", lang)}: ${wizard.pointsRemaining}</p>
        `;
        renderAbilityInputs();
        stepEl.querySelector("#w-name").addEventListener("input", (e) => {
          wizard.name = e.target.value;
        });
        stepEl.querySelector("#w-roll3d6").addEventListener("click", () => {
          const order = ABILITIES;
          for (let i = 0; i < 3; i += 1) {
            const die = rollDice(1, 6).total;
            const key = order[die - 1];
            wizard.abilities[key] += 1;
          }
          wizard.pointsRemaining = 0;
          renderAbilityInputs();
          updatePointsDisplay();
        });
        stepEl.querySelector("#w-reset").addEventListener("click", () => {
          wizard.abilities = blankAbilities();
          wizard.pointsRemaining = 3;
          renderAbilityInputs();
          updatePointsDisplay();
        });
      } else if (wizard.step === 2) {
        stepEl.innerHTML = `
          <h2>${t("wizard.step2Title", lang)}</h2>
          <p class="hint">${t("wizard.hpHint", lang)}</p>
          <div class="btn-row">
            <button id="w-roll-hp" class="secondary">${t("wizard.rollHp", lang)}</button>
          </div>
          <p class="result" id="w-hp-result">${wizard.hpMax ? `HP: ${wizard.hpMax}` : ""}</p>
          <div class="grid grid-2">
            <div class="card">
              <label>${t("wizard.slotsMax", lang)}</label>
              <p class="result">${10 + wizard.abilities.con}</p>
            </div>
            <div class="card">
              <label>${t("wizard.woundThreshold", lang)}</label>
              <p class="result">${10 + wizard.abilities.con}</p>
            </div>
          </div>
        `;
        stepEl.querySelector("#w-roll-hp").addEventListener("click", () => {
          wizard.hpMax = rollDice(1, 6).total;
          stepEl.querySelector("#w-hp-result").textContent = `HP: ${wizard.hpMax}`;
        });
      } else if (wizard.step === 3) {
        const slotsMax = 10 + wizard.abilities.con;
        stepEl.innerHTML = `
          <h2>${t("wizard.step3Title", lang)}</h2>
          <p class="hint">${t("wizard.careerHint", lang)}</p>
          <div class="field">
            <label>${t("wizard.career", lang)}</label>
            <input id="w-career" type="text" value="${wizard.career}" />
          </div>

          <p class="hint">${t("wizard.equipmentItemsHint", lang)}</p>
          <div class="grid grid-3">
            <div class="field">
              <input id="w-item-name" type="text" placeholder="${t("sheet.itemName", lang)}" />
            </div>
            <div class="field">
              <select id="w-item-slots">
                <option value="1">${t("sheet.oneSlot", lang)}</option>
                <option value="2">${t("sheet.twoSlots", lang)}</option>
              </select>
            </div>
            <div class="field">
              <input id="w-item-qty" type="number" min="1" value="1" placeholder="${t("sheet.qty", lang)}" />
            </div>
          </div>
          <label><input id="w-item-consumable" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("sheet.consumable", lang)}</label>
          <div class="btn-row">
            <button id="w-item-add" class="secondary">${t("sheet.addItem", lang)}</button>
          </div>
          <ul id="w-item-list"></ul>

          <div class="field">
            <label>${t("wizard.equipment", lang)}</label>
            <textarea id="w-equipment">${wizard.equipmentNotes}</textarea>
          </div>
          <div class="btn-row">
            <button id="w-roll-coins" class="secondary">${t("wizard.rollCoins", lang)}</button>
            <span class="pill">${t("wizard.coins", lang)}: ${wizard.coins}c</span>
          </div>
          <p class="hint" id="w-slots-used"></p>
        `;
        function renderItemList() {
          stepEl.querySelector("#w-item-list").innerHTML = wizard.inventory
            .map((it, i) => {
              const qtyTag = it.consumable ? ` — ${t("sheet.qty", lang)} ${it.qty || 1}` : "";
              return `<li>${it.name} (${it.slots})${qtyTag} <button data-i="${i}" class="secondary w-item-remove">x</button></li>`;
            })
            .join("");
          stepEl.querySelectorAll(".w-item-remove").forEach((btn) => {
            btn.addEventListener("click", () => {
              wizard.inventory.splice(Number(btn.getAttribute("data-i")), 1);
              renderItemList();
              updateSlotsUsed();
            });
          });
        }
        function updateSlotsUsed() {
          const itemSlots = wizard.inventory.reduce((sum, it) => sum + (it.slots || 1), 0);
          const used = itemSlots + coinSlotCount(wizard.coins);
          stepEl.querySelector("#w-slots-used").textContent =
            `${t("wizard.slotsUsed", lang)}: ${used} / ${slotsMax}`;
        }
        renderItemList();
        updateSlotsUsed();
        stepEl.querySelector("#w-career").addEventListener("input", (e) => {
          wizard.career = e.target.value;
        });
        stepEl.querySelector("#w-item-add").addEventListener("click", () => {
          const nameInput = stepEl.querySelector("#w-item-name");
          const slotsSelect = stepEl.querySelector("#w-item-slots");
          const qtyInput = stepEl.querySelector("#w-item-qty");
          const consumable = stepEl.querySelector("#w-item-consumable").checked;
          if (nameInput.value.trim()) {
            wizard.inventory.push({
              name: nameInput.value.trim(),
              slots: Number(slotsSelect.value),
              consumable,
              qty: consumable ? Math.max(1, Number(qtyInput.value) || 1) : 1,
            });
            nameInput.value = "";
            qtyInput.value = "1";
            stepEl.querySelector("#w-item-consumable").checked = false;
            renderItemList();
            updateSlotsUsed();
          }
        });
        stepEl.querySelector("#w-equipment").addEventListener("input", (e) => {
          wizard.equipmentNotes = e.target.value;
        });
        stepEl.querySelector("#w-roll-coins").addEventListener("click", () => {
          wizard.coins = parseDiceNotation("3d6").total * 10;
          renderStep();
        });
      } else if (wizard.step === 4) {
        stepEl.innerHTML = `
          <h2>${t("wizard.step4Title", lang)}</h2>
          <p class="hint">${t("wizard.armorHint", lang)}</p>
          <div class="field">
            <input id="w-armor-name" type="text" placeholder="${t("wizard.armorPlaceholder", lang)}" />
            <button id="w-armor-add" class="secondary" style="margin-top:6px;">${t("wizard.armorAdd", lang)}</button>
          </div>
          <ul id="w-armor-list"></ul>
          <p class="hint">${t("wizard.ac", lang)}: ${11 + wizard.armor.length}</p>
        `;
        function renderArmorList() {
          stepEl.querySelector("#w-armor-list").innerHTML = wizard.armor
            .map(
              (a, i) =>
                `<li>${a} <button data-i="${i}" class="secondary armor-remove">x</button></li>`
            )
            .join("");
          stepEl.querySelectorAll(".armor-remove").forEach((btn) => {
            btn.addEventListener("click", () => {
              wizard.armor.splice(Number(btn.getAttribute("data-i")), 1);
              renderStep();
            });
          });
        }
        stepEl.querySelector("#w-armor-add").addEventListener("click", () => {
          const input = stepEl.querySelector("#w-armor-name");
          if (input.value.trim() && wizard.armor.length < 7) {
            wizard.armor.push(input.value.trim());
            input.value = "";
            renderStep();
          }
        });
        renderArmorList();
      } else if (wizard.step === 5) {
        const slotsMax = 10 + wizard.abilities.con;
        const itemSlots = wizard.inventory.reduce((sum, it) => sum + (it.slots || 1), 0);
        const usedSlots = Math.min(slotsMax, itemSlots + coinSlotCount(wizard.coins));
        stepEl.innerHTML = `
          <h2>${t("wizard.step5Title", lang)}</h2>
          <div class="card">
            <p><strong>${wizard.name || t("characters.unnamed", lang)}</strong> — ${wizard.career || t("characters.noCareer", lang)}</p>
            <p class="hint">${ABILITIES.map((a) => `${a.toUpperCase()} ${wizard.abilities[a]}`).join(" · ")}</p>
            <p class="hint">HP ${wizard.hpMax || "?"} · ${t("characters.slots", lang)} ${usedSlots}/${slotsMax} · AC ${11 + wizard.armor.length} · ${wizard.coins}c</p>
            ${
              wizard.inventory.length > 0
                ? `<p class="hint">${wizard.inventory.map((it) => it.name).join(", ")}</p>`
                : ""
            }
          </div>
        `;
      }
    }

    function updatePointsDisplay() {
      const pointsEl = container.querySelector("#w-points");
      if (pointsEl) {
        pointsEl.textContent = `${t("wizard.pointsRemaining", lang)}: ${wizard.pointsRemaining}`;
      }
    }

    function renderAbilityInputs() {
      const el = container.querySelector("#w-abilities");
      el.innerHTML = ABILITIES.map(
        (a) => `
          <div class="field">
            <label>${t(`abilities.${a}`, lang)}</label>
            <input type="number" min="0" class="w-ability-input" data-ability="${a}" value="${wizard.abilities[a]}" />
          </div>
        `
      ).join("");
      el.querySelectorAll(".w-ability-input").forEach((input) => {
        input.addEventListener("input", () => {
          wizard.abilities[input.getAttribute("data-ability")] = Number(input.value) || 0;
          const used = ABILITIES.reduce((sum, a) => sum + wizard.abilities[a], 0);
          wizard.pointsRemaining = 3 - used;
          updatePointsDisplay();
        });
      });
    }

    container.innerHTML = `
      <h1>${t("wizard.title", lang)}</h1>
      <p class="pill">${t("wizard.stepLabel", lang)} ${wizard.step} / 5</p>
      <div class="card" id="wizard-step"></div>
      <div class="btn-row">
        <button id="w-back" class="secondary">${t("wizard.back", lang)}</button>
        <button id="w-next">${t("wizard.next", lang)}</button>
        <button id="w-cancel" class="secondary danger">${t("wizard.cancel", lang)}</button>
      </div>
    `;
    renderStep();

    container.querySelector("#w-cancel").addEventListener("click", () => {
      mode = { view: "list", editingId: null };
      draw();
    });

    container.querySelector("#w-back").addEventListener("click", () => {
      if (wizard.step > 1) {
        wizard.step -= 1;
        rerenderWizardChrome();
      }
    });

    container.querySelector("#w-next").addEventListener("click", () => {
      if (wizard.step < 5) {
        wizard.step += 1;
        rerenderWizardChrome();
      } else {
        saveCharacterFromWizard(wizard);
        mode = { view: "list", editingId: null };
        draw();
      }
    });

    function rerenderWizardChrome() {
      container.querySelector(".pill").textContent = `${t("wizard.stepLabel", lang)} ${wizard.step} / 5`;
      container.querySelector("#w-next").textContent =
        wizard.step === 5 ? t("wizard.save", lang) : t("wizard.next", lang);
      renderStep();
    }
  }

  function saveCharacterFromWizard(wizard) {
    const character = {
      id: uid(),
      name: wizard.name || "",
      abilities: wizard.abilities,
      level: 1,
      xp: 0,
      hpMax: wizard.hpMax || 1,
      hpCurrent: wizard.hpMax || 1,
      wounds: 0,
      career: wizard.career || "",
      equipmentNotes: wizard.equipmentNotes || "",
      inventory: [
        ...(wizard.inventory || []),
        ...(wizard.armor || []).map((name) => ({
          name,
          slots: 1,
          consumable: false,
          qty: 1,
          isArmor: true,
        })),
      ],
      spellbooks: [],
      blessings: [],
      notes: "",
      coins: wizard.coins || 0,
      ateToday: false,
      restedLastNight: false,
      daysWithoutWater: 0,
    };
    updateState((state) => ({ ...state, characters: [...state.characters, character] }));
  }

  function findChar(state, id) {
    return state.characters.find((c) => c.id === id);
  }

  function updateChar(id, updater) {
    updateState((state) => ({
      ...state,
      characters: state.characters.map((c) => (c.id === id ? updater({ ...c }) : c)),
    }));
  }

  function drawSheet(container, lang, id) {
    const state = getState();
    const char = findChar(state, id);
    if (!char) {
      mode = { view: "list", editingId: null };
      draw();
      return;
    }
    const derived = computeDerived(char);
    const { next } = nextLevelInfo(char);

    container.innerHTML = `
      <div class="btn-row">
        <button id="s-back" class="secondary">${t("sheet.back", lang)}</button>
        <button id="s-delete" class="danger">${t("sheet.delete", lang)}</button>
      </div>
      <h1>${char.name || t("characters.unnamed", lang)}</h1>

      <div class="card">
        <h2>${t("sheet.identity", lang)}</h2>
        <div class="grid grid-2">
          <div class="field">
            <label>${t("wizard.name", lang)}</label>
            <input id="s-name" type="text" value="${char.name || ""}" />
          </div>
          <div class="field">
            <label>${t("wizard.career", lang)}</label>
            <input id="s-career" type="text" value="${char.career || ""}" />
          </div>
        </div>
        <div class="field">
          <label>${t("wizard.equipment", lang)}</label>
          <textarea id="s-equipment-notes">${char.equipmentNotes || ""}</textarea>
        </div>
      </div>

      <div class="card">
        <h2>${t("sheet.abilities", lang)}</h2>
        <div class="grid grid-3">
          ${ABILITIES.map(
            (a) => `
            <div class="field">
              <label>${t(`abilities.${a}`, lang)}</label>
              <input type="number" class="s-ability" data-a="${a}" value="${char.abilities[a]}" />
            </div>
          `
          ).join("")}
        </div>
      </div>

      <div class="card">
        <h2>${t("sheet.status", lang)}</h2>
        <div class="grid grid-3">
          <div>
            <label>HP</label>
            <p class="result">${char.hpCurrent} / ${char.hpMax}</p>
          </div>
          <div>
            <label>${t("sheet.ac", lang)}</label>
            <p class="result">${derived.ac}</p>
          </div>
          <div>
            <label>${t("sheet.slots", lang)}</label>
            <p class="result">${derived.usedSlots} / ${derived.slotsMax}</p>
          </div>
        </div>
        <div class="slot-grid">
          ${buildSlotCells(char, derived, lang)
            .map((cell) => `<div class="slot ${cell.type}">${cell.label}</div>`)
            .join("")}
        </div>
        ${
          char.wounds >= derived.slotsMax
            ? `<p class="result fail">${t("sheet.dead", lang)}</p>`
            : ""
        }
        <div class="grid grid-2">
          <div class="field">
            <label>${t("sheet.damageAmount", lang)}</label>
            <input id="s-damage" type="number" value="0" />
          </div>
          <div class="field">
            <label><input id="s-direct" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("sheet.directDamage", lang)}</label>
          </div>
        </div>
        <div class="btn-row">
          <button id="s-apply-damage" class="danger">${t("sheet.applyDamage", lang)}</button>
          <button id="s-heal" class="secondary">${t("sheet.healFull", lang)}</button>
          <button id="s-heal-wound" class="secondary">${t("sheet.healWound", lang)}</button>
        </div>
      </div>

      <div class="card">
        <h2>${t("sheet.leveling", lang)}</h2>
        <p class="hint">${t("sheet.xp", lang)}: <input id="s-xp" type="number" value="${char.xp}" style="width:120px;display:inline-block;" /> — ${t("sheet.level", lang)} ${char.level}</p>
        ${
          next
            ? `<p class="hint">${t("sheet.nextLevel", lang)}: ${next.level} (${next.xp} XP)</p>
               <button id="s-level-up" ${char.xp >= next.xp ? "" : "disabled"}>${t("sheet.levelUp", lang)}</button>`
            : `<p class="hint">${t("sheet.maxLevel", lang)}</p>`
        }
      </div>

      <div class="card">
        <h2>${t("sheet.inventory", lang)}</h2>
        <p class="hint">${t("sheet.inventoryHint", lang)}</p>
        <p class="hint">${t("sheet.armorHint", lang)} ${t("sheet.armorCount", lang)}: ${derived.armorCount}/7 — AC ${derived.ac}.</p>
        <div class="grid grid-3">
          <div class="field">
            <input id="s-item-name" type="text" placeholder="${t("sheet.itemName", lang)}" />
          </div>
          <div class="field">
            <select id="s-item-slots">
              <option value="1">${t("sheet.oneSlot", lang)}</option>
              <option value="2">${t("sheet.twoSlots", lang)}</option>
            </select>
          </div>
          <div class="field">
            <input id="s-item-qty" type="number" min="1" value="1" placeholder="${t("sheet.qty", lang)}" />
          </div>
        </div>
        <label><input id="s-item-consumable" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("sheet.consumable", lang)}</label>
        <label><input id="s-item-armor" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("sheet.isArmor", lang)}</label>
        <div class="btn-row">
          <button id="s-item-add">${t("sheet.addItem", lang)}</button>
        </div>
        <ul id="s-item-list">
          ${char.inventory
            .map((it, i) => {
              const qtyTag = it.consumable ? ` — ${t("sheet.qty", lang)} ${it.qty || 1}` : "";
              const armorTag = it.isArmor ? ` — ${t("sheet.armorTag", lang)}` : "";
              const useBtn =
                it.consumable && it.qty > 0
                  ? `<button data-i="${i}" class="secondary s-item-use">${t("sheet.use", lang)}</button>`
                  : "";
              return `<li>${it.name} (${it.slots})${qtyTag}${armorTag} ${useBtn} <button data-i="${i}" class="secondary s-item-remove">x</button></li>`;
            })
            .join("")}
        </ul>
        <div class="field" style="max-width:220px;">
          <label>${t("sheet.coins", lang)} (${t("sheet.coinsSlotsHint", lang)})</label>
          <input id="s-coins" type="number" min="0" value="${char.coins || 0}" />
        </div>
        <p class="hint">${t("sheet.coinsSlotsUsed", lang)}: ${derived.coinSlots}</p>
      </div>

      <div class="card">
        <h2>${t("sheet.upkeep", lang)}</h2>
        <p class="hint">${t("sheet.upkeepHint", lang)}</p>
        <div class="grid grid-3">
          <span class="pill">${t("sheet.ateToday", lang)}: ${char.ateToday ? t("sheet.yes", lang) : t("sheet.no", lang)}</span>
          <span class="pill">${t("sheet.restedLastNight", lang)}: ${char.restedLastNight ? t("sheet.yes", lang) : t("sheet.no", lang)}</span>
          <span class="pill">${t("sheet.daysWithoutWater", lang)}: ${char.daysWithoutWater || 0}</span>
        </div>
        <div class="btn-row">
          <button id="s-eat-ration" class="secondary">${t("sheet.eatRation", lang)}</button>
          <label style="display:inline-flex;align-items:center;gap:6px;">
            <input id="s-rested" type="checkbox" style="width:auto;" ${char.restedLastNight ? "checked" : ""} />
            ${t("sheet.restedLastNight", lang)}
          </label>
        </div>
        <label><input id="s-safe-haven" type="checkbox" style="width:auto;display:inline-block;margin-right:6px;" />${t("sheet.safeHaven", lang)}</label>
        <div class="btn-row">
          <button id="s-apply-rest">${t("sheet.applyRest", lang)}</button>
        </div>
        <div id="s-rest-result"></div>
        <div class="btn-row">
          <button id="s-thirst-add" class="secondary">${t("sheet.dayWithoutWater", lang)}</button>
          <button id="s-thirst-reset" class="secondary">${t("sheet.drinkWater", lang)}</button>
        </div>
        ${
          (char.daysWithoutWater || 0) >= 1
            ? `<p class="pill">${t("sheet.thirstPenalty", lang)}</p>`
            : ""
        }
        ${
          (char.daysWithoutWater || 0) >= 3
            ? `<p class="pill">${t("sheet.thirstDanger", lang)}</p>`
            : ""
        }
      </div>

      <div class="card">
        <h2>${t("sheet.spellbooks", lang)}</h2>
        <p class="hint">${t("sheet.spellbooksHint", lang)}</p>
        <div class="grid grid-2">
          <input id="s-spell-name" type="text" placeholder="${t("sheet.spellName", lang)}" />
          <input id="s-spell-desc" type="text" placeholder="${t("sheet.spellDesc", lang)}" />
        </div>
        <button id="s-spell-add" class="secondary" style="margin-top:6px;">${t("sheet.addItem", lang)}</button>
        <ul id="s-spell-list">
          ${char.spellbooks
            .map(
              (sp, i) =>
                `<li><strong>${sp.name}</strong> — ${sp.description} <button data-i="${i}" class="secondary s-spell-remove">x</button></li>`
            )
            .join("")}
        </ul>
      </div>

      <div class="card">
        <h2>${t("sheet.blessings", lang)}</h2>
        <p class="hint">${t("sheet.blessingsHint", lang)} ${t("sheet.blessingsCap", lang)} ${char.abilities.cha}.</p>
        <div class="grid grid-2">
          <input id="s-blessing-name" type="text" placeholder="${t("sheet.blessingName", lang)}" />
          <input id="s-blessing-desc" type="text" placeholder="${t("sheet.blessingDesc", lang)}" />
        </div>
        <button id="s-blessing-add" class="secondary" style="margin-top:6px;">${t("sheet.addItem", lang)}</button>
        <ul id="s-blessing-list">
          ${(char.blessings || [])
            .map(
              (b, i) =>
                `<li><strong>${b.name}</strong> — ${b.description} <button data-i="${i}" class="secondary s-blessing-remove">x</button></li>`
            )
            .join("")}
        </ul>
      </div>

      <div class="card">
        <h2>${t("sheet.notes", lang)}</h2>
        <textarea id="s-notes">${char.notes || ""}</textarea>
      </div>
    `;

    container.querySelector("#s-back").addEventListener("click", () => {
      mode = { view: "list", editingId: null };
      draw();
    });

    container.querySelector("#s-delete").addEventListener("click", () => {
      if (confirm(t("sheet.confirmDelete", lang))) {
        updateState((s) => ({ ...s, characters: s.characters.filter((c) => c.id !== id) }));
        mode = { view: "list", editingId: null };
        draw();
      }
    });

    container.querySelectorAll(".s-ability").forEach((input) => {
      input.addEventListener("change", () => {
        const a = input.getAttribute("data-a");
        const val = Number(input.value) || 0;
        updateChar(id, (c) => {
          c.abilities = { ...c.abilities, [a]: val };
          return c;
        });
        drawSheet(container, lang, id);
      });
    });

    container.querySelector("#s-apply-damage").addEventListener("click", () => {
      const amount = Number(container.querySelector("#s-damage").value) || 0;
      const direct = container.querySelector("#s-direct").checked;
      updateChar(id, (c) => {
        let dmg = amount;
        if (!direct && c.hpCurrent > 0) {
          const absorbed = Math.min(c.hpCurrent, dmg);
          c.hpCurrent -= absorbed;
          dmg -= absorbed;
        }
        const slotsMax = 10 + c.abilities.con;
        c.wounds = Math.min(slotsMax, c.wounds + Math.max(0, dmg));
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-heal").addEventListener("click", () => {
      updateChar(id, (c) => {
        c.hpCurrent = c.hpMax;
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-heal-wound").addEventListener("click", () => {
      updateChar(id, (c) => {
        c.wounds = Math.max(0, c.wounds - 1);
        return c;
      });
      drawSheet(container, lang, id);
    });

    const xpInput = container.querySelector("#s-xp");
    xpInput.addEventListener("change", () => {
      updateChar(id, (c) => {
        c.xp = Number(xpInput.value) || 0;
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-coins").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.coins = Math.max(0, Number(e.target.value) || 0);
        return c;
      });
      drawSheet(container, lang, id);
    });

    const levelUpBtn = container.querySelector("#s-level-up");
    if (levelUpBtn) {
      levelUpBtn.addEventListener("click", () => {
        updateChar(id, (c) => {
          c.level += 1;
          const rerolled = rollDice(c.level, 6).total;
          c.hpMax = rerolled > c.hpMax ? rerolled : c.hpMax + 1;
          c.hpCurrent = c.hpMax;
          return c;
        });
        alert(t("sheet.levelUpHint", lang));
        drawSheet(container, lang, id);
      });
    }

    container.querySelector("#s-item-add").addEventListener("click", () => {
      const nameInput = container.querySelector("#s-item-name");
      const slotsSelect = container.querySelector("#s-item-slots");
      const qtyInput = container.querySelector("#s-item-qty");
      const consumable = container.querySelector("#s-item-consumable").checked;
      const isArmor = container.querySelector("#s-item-armor").checked;
      if (!nameInput.value.trim()) return;
      const currentArmorCount = char.inventory.filter((it) => it.isArmor).length;
      if (isArmor && currentArmorCount >= 7) {
        alert(t("sheet.armorMaxReached", lang));
        return;
      }
      updateChar(id, (c) => {
        c.inventory = [
          ...c.inventory,
          {
            name: nameInput.value.trim(),
            slots: isArmor ? 1 : Number(slotsSelect.value),
            consumable: isArmor ? false : consumable,
            qty: !isArmor && consumable ? Math.max(1, Number(qtyInput.value) || 1) : 1,
            isArmor,
          },
        ];
        return c;
      });
      drawSheet(container, lang, id);
    });
    container.querySelectorAll(".s-item-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        updateChar(id, (c) => {
          c.inventory = c.inventory.filter((_, idx) => idx !== i);
          return c;
        });
        drawSheet(container, lang, id);
      });
    });
    container.querySelectorAll(".s-item-use").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        updateChar(id, (c) => {
          const item = c.inventory[i];
          if (!item) return c;
          const remaining = (item.qty || 1) - 1;
          c.inventory =
            remaining > 0
              ? c.inventory.map((it, idx) => (idx === i ? { ...it, qty: remaining } : it))
              : c.inventory.filter((_, idx) => idx !== i);
          return c;
        });
        drawSheet(container, lang, id);
      });
    });

    container.querySelector("#s-spell-add").addEventListener("click", () => {
      const nameInput = container.querySelector("#s-spell-name");
      const descInput = container.querySelector("#s-spell-desc");
      if (nameInput.value.trim()) {
        updateChar(id, (c) => {
          c.spellbooks = [
            ...c.spellbooks,
            { name: nameInput.value.trim(), description: descInput.value.trim() },
          ];
          return c;
        });
        drawSheet(container, lang, id);
      }
    });
    container.querySelectorAll(".s-spell-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        updateChar(id, (c) => {
          c.spellbooks = c.spellbooks.filter((_, idx) => idx !== i);
          return c;
        });
        drawSheet(container, lang, id);
      });
    });

    container.querySelector("#s-blessing-add").addEventListener("click", () => {
      const nameInput = container.querySelector("#s-blessing-name");
      const descInput = container.querySelector("#s-blessing-desc");
      if (nameInput.value.trim()) {
        updateChar(id, (c) => {
          c.blessings = [
            ...(c.blessings || []),
            { name: nameInput.value.trim(), description: descInput.value.trim() },
          ];
          return c;
        });
        drawSheet(container, lang, id);
      }
    });
    container.querySelectorAll(".s-blessing-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        updateChar(id, (c) => {
          c.blessings = (c.blessings || []).filter((_, idx) => idx !== i);
          return c;
        });
        drawSheet(container, lang, id);
      });
    });

    container.querySelector("#s-eat-ration").addEventListener("click", () => {
      updateChar(id, (c) => {
        const ration = findRationItem(c);
        if (ration) {
          const remaining = (ration.qty || 1) - 1;
          c.inventory =
            remaining > 0
              ? c.inventory.map((it) => (it === ration ? { ...it, qty: remaining } : it))
              : c.inventory.filter((it) => it !== ration);
          c.ateToday = true;
        } else {
          c.ateToday = false;
        }
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-rested").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.restedLastNight = e.target.checked;
        return c;
      });
    });

    container.querySelector("#s-apply-rest").addEventListener("click", () => {
      const safeHaven = container.querySelector("#s-safe-haven").checked;
      let ok = false;
      updateChar(id, (c) => {
        ok = Boolean(c.ateToday) && Boolean(c.restedLastNight);
        if (ok) {
          c.hpCurrent = c.hpMax;
          if (safeHaven) c.wounds = Math.max(0, c.wounds - 1);
        }
        c.ateToday = false;
        c.restedLastNight = false;
        return c;
      });
      drawSheet(container, lang, id);
      const resultEl = container.querySelector("#s-rest-result");
      if (resultEl) {
        resultEl.innerHTML = `
          <p class="result ${ok ? "success" : "fail"}">${
          ok ? t("sheet.restSuccess", lang) : t("sheet.restFail", lang)
        }</p>
        `;
      }
    });

    container.querySelector("#s-thirst-add").addEventListener("click", () => {
      updateChar(id, (c) => {
        c.daysWithoutWater = (c.daysWithoutWater || 0) + 1;
        return c;
      });
      drawSheet(container, lang, id);
    });
    container.querySelector("#s-thirst-reset").addEventListener("click", () => {
      updateChar(id, (c) => {
        c.daysWithoutWater = 0;
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-notes").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.notes = e.target.value;
        return c;
      });
    });

    container.querySelector("#s-name").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.name = e.target.value;
        return c;
      });
      drawSheet(container, lang, id);
    });

    container.querySelector("#s-career").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.career = e.target.value;
        return c;
      });
    });

    container.querySelector("#s-equipment-notes").addEventListener("change", (e) => {
      updateChar(id, (c) => {
        c.equipmentNotes = e.target.value;
        return c;
      });
    });
  }

  draw();
}
