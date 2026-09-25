import { t } from "../../i18n.js";
import { getState, updateState } from "../../state.js";
import { rollDie } from "../../dice.js";

// Per-character Slayers tracker (the "Magos" tab): spell pools/charges,
// known spells, entity favor and artifacts. Everything lives under
// state.slayers.byCharacter[charId] so it never touches the base character
// sheet (js/views/characters.js), only char.spellbooks and char.wounds
// through the same state API characters.js itself uses.

const STAT_KEY_MAP = { INT: "int", CHA: "cha", WIS: "wis" };
// débil holds 3 uses, medio 2, fuerte 1 — a charge committed to a tier is
// spent down to 0 and stays committed until "Nuevo día" resets the pool.
const TIER_CAPACITY = { debil: 3, medio: 2, fuerte: 1 };
const SOURCES = ["aprendido", "grimorio", "maestro"];

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function localized(field, lang) {
  if (!field) return "";
  return field[lang] || field.es || "";
}

function findSchool(data, id) {
  return (data.schools || []).find((s) => s.id === id);
}

function findEntity(data, id) {
  return (data.entities || []).find((e) => e.id === id);
}

function findArtifact(data, id) {
  return (data.artifacts || []).find((a) => a.id === id);
}

function schoolLabel(data, id, lang) {
  const school = findSchool(data, id);
  return school ? localized(school.name, lang) : id;
}

function defaultCharSlayerState() {
  return {
    charges: { negra: [], chamanica: [], blanca: [] },
    knownSpells: [], // { spellId, source: "aprendido"|"grimorio"|"maestro" }
    entities: {}, // entityId -> { status }
    artifacts: [], // { artifactId, awakenings: [{ unlocked, active }] }
    spiritBlessings: [], // { id, text, active }
    lastCast: null, // for "deshacer": { school, index, prevTier, prevUsesLeft }
  };
}

function getCharSlayerState(state, charId) {
  const byCharacter = (state.slayers && state.slayers.byCharacter) || {};
  return byCharacter[charId] || defaultCharSlayerState();
}

function updateCharSlayerState(charId, updater) {
  updateState((s) => {
    const byCharacter = (s.slayers && s.slayers.byCharacter) || {};
    const current = byCharacter[charId] || defaultCharSlayerState();
    const updated = updater({ ...current });
    return {
      ...s,
      slayers: { ...s.slayers, byCharacter: { ...byCharacter, [charId]: updated } },
    };
  });
}

// Pads/truncates the saved charge list to the pool's current size (the
// character's stat may have changed since the last save).
function normalizedCharges(list, size) {
  const arr = (list || []).slice(0, size).map((c) => ({ ...c }));
  while (arr.length < size) arr.push({ tier: null, usesLeft: 0 });
  return arr;
}

function grimorioName(spell) {
  return `Grimorio: ${spell.name}`;
}

function isGrimorioCarried(char, spell) {
  const name = grimorioName(spell);
  return (char.spellbooks || []).some((sp) => sp.name === name);
}

function addGrimorioEntry(charId, spell, lang) {
  const name = grimorioName(spell);
  updateState((s) => ({
    ...s,
    characters: s.characters.map((c) => {
      if (c.id !== charId) return c;
      if ((c.spellbooks || []).some((sp) => sp.name === name)) return c;
      return { ...c, spellbooks: [...c.spellbooks, { name, description: localized(spell.effect, lang) }] };
    }),
  }));
}

// Mirrors the direct-damage path in characters.js (wounds capped at
// 10 + CON) since that helper is private to that view and this section must
// not import or edit it.
function applyWounds(charId, amount) {
  updateState((s) => ({
    ...s,
    characters: s.characters.map((c) => {
      if (c.id !== charId) return c;
      const slotsMax = 10 + c.abilities.con;
      return { ...c, wounds: Math.min(slotsMax, c.wounds + Math.max(0, amount)) };
    }),
  }));
}

function resetDay(charId) {
  updateCharSlayerState(charId, (cs) => {
    cs.charges = { negra: [], chamanica: [], blanca: [] };
    cs.lastCast = null;
    return cs;
  });
}

function undoLastCast(charId) {
  updateCharSlayerState(charId, (cs) => {
    if (!cs.lastCast) return cs;
    const { school, index, prevTier, prevUsesLeft } = cs.lastCast;
    const charges = [...(cs.charges[school] || [])];
    if (charges[index]) charges[index] = { tier: prevTier, usesLeft: prevUsesLeft };
    cs.charges = { ...cs.charges, [school]: charges };
    cs.lastCast = null;
    return cs;
  });
}

// Returns { ok, reason } — reason is a translated hint shown when disabled.
function evalCastability(char, slayerState, spell, data, lang) {
  const known = slayerState.knownSpells.find((k) => k.spellId === spell.id);
  if (!known) return { ok: false, reason: t("slayers.tracker.reasonNotKnown", lang) };

  const schoolDef = findSchool(data, spell.school);
  const statKey = STAT_KEY_MAP[schoolDef && schoolDef.stat];
  if (spell.tier === "perdida" || !statKey) {
    return { ok: false, reason: t("slayers.tracker.noSchoolStat", lang) };
  }
  const stat = char.abilities[statKey] || 0;

  if (spell.tier === "medio" && stat < 2) {
    return { ok: false, reason: `${t("slayers.tracker.reasonStatTooLowPrefix", lang)} ${schoolDef.stat} 2+` };
  }
  if (spell.tier === "fuerte") {
    if (stat < 5) {
      return { ok: false, reason: `${t("slayers.tracker.reasonStatTooLowPrefix", lang)} ${schoolDef.stat} 5+` };
    }
    if (known.source !== "grimorio" && known.source !== "maestro") {
      return { ok: false, reason: t("slayers.tracker.reasonNeedsGrimorioOrMaster", lang) };
    }
    if (known.source === "grimorio" && !isGrimorioCarried(char, spell)) {
      return { ok: false, reason: t("slayers.tracker.reasonGrimorioMissing", lang) };
    }
  }
  if (spell.school === "negra" && spell.entity) {
    const est = slayerState.entities[spell.entity];
    if (est && (est.status === "caido" || est.status === "rechazo")) {
      return { ok: false, reason: t("slayers.tracker.reasonEntityBlocked", lang) };
    }
  }
  if (spell.school === "chamanica" && spell.tier === "fuerte" && spell.entity) {
    const est = slayerState.entities[spell.entity];
    if (!est || est.status !== "favor") {
      return { ok: false, reason: t("slayers.tracker.reasonNeedsFavor", lang) };
    }
  }

  const charges = normalizedCharges(slayerState.charges[spell.school], stat);
  const hasPartial = charges.some((c) => c.tier === spell.tier && c.usesLeft > 0);
  const hasEmpty = charges.some((c) => c.tier === null);
  if (!hasPartial && !hasEmpty) {
    return { ok: false, reason: t("slayers.tracker.reasonNoCharges", lang) };
  }
  return { ok: true, reason: "" };
}

// Commits a charge for the cast and returns the d4 direct-damage roll for a
// fuerte cast, or null otherwise. Assumes evalCastability already passed.
function castSpell(char, data, spell) {
  const schoolDef = findSchool(data, spell.school);
  const statKey = STAT_KEY_MAP[schoolDef && schoolDef.stat];
  const stat = statKey ? char.abilities[statKey] || 0 : 0;
  const capacity = TIER_CAPACITY[spell.tier];
  if (!capacity) return null;

  updateCharSlayerState(char.id, (cs) => {
    const charges = normalizedCharges(cs.charges[spell.school], stat);
    let idx = charges.findIndex((c) => c.tier === spell.tier && c.usesLeft > 0);
    if (idx === -1) idx = charges.findIndex((c) => c.tier === null);
    if (idx === -1) return cs;
    const prev = { ...charges[idx] };
    charges[idx] =
      prev.tier === spell.tier
        ? { tier: spell.tier, usesLeft: prev.usesLeft - 1 }
        : { tier: spell.tier, usesLeft: capacity - 1 };
    cs.charges = { ...cs.charges, [spell.school]: charges };
    cs.lastCast = { school: spell.school, index: idx, prevTier: prev.tier, prevUsesLeft: prev.usesLeft };
    return cs;
  });

  return spell.tier === "fuerte" ? rollDie(4) : null;
}

export function renderTrackerTab(container, lang, data) {
  let selectedCharId = null;
  // Holds the pending "you took X direct damage" prompt for a fuerte cast
  // until the GM applies or dismisses it. Kept outside drawBody so it
  // survives a refresh() but resets when the tab is re-entered.
  const rollState = { current: null };

  function draw() {
    const state = getState();
    const characters = state.characters;

    if (characters.length === 0) {
      container.innerHTML = `
        <h2>${t("slayers.tabs.tracker", lang)}</h2>
        <p class="hint">${t("slayers.tracker.noCharacters", lang)}</p>
      `;
      return;
    }

    if (!selectedCharId || !characters.some((c) => c.id === selectedCharId)) {
      selectedCharId = characters[0].id;
    }
    const char = characters.find((c) => c.id === selectedCharId);
    const slayerState = getCharSlayerState(state, char.id);

    container.innerHTML = `
      <h2>${t("slayers.tabs.tracker", lang)}</h2>
      <div class="field" style="max-width:320px;">
        <label>${t("slayers.tracker.selectCharacter", lang)}</label>
        <select id="sl-tr-char">
          ${characters
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === char.id ? "selected" : ""}>${c.name || t("characters.unnamed", lang)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div id="sl-tr-body"></div>
    `;

    container.querySelector("#sl-tr-char").addEventListener("change", (e) => {
      selectedCharId = e.target.value;
      rollState.current = null;
      draw();
    });

    drawBody(container.querySelector("#sl-tr-body"), lang, data, char, slayerState, draw, rollState);
  }

  draw();
}

function drawBody(bodyEl, lang, data, char, slayerState, refresh, rollState) {
  const poolSchools = ["negra", "chamanica", "blanca"].map((id) => findSchool(data, id)).filter(Boolean);

  const poolsHtml = poolSchools
    .map((school) => {
      const statKey = STAT_KEY_MAP[school.stat];
      const stat = statKey ? char.abilities[statKey] || 0 : 0;
      const charges = normalizedCharges(slayerState.charges[school.id], stat);
      const chipLabels = charges.map((c) => {
        if (!c.tier) return "□";
        const letter = t(`slayers.tierLabel.${c.tier}`, lang)[0].toUpperCase();
        const capacity = TIER_CAPACITY[c.tier];
        return `${letter}${"■".repeat(c.usesLeft)}${"□".repeat(Math.max(0, capacity - c.usesLeft))}`;
      });
      return `
        <div style="margin-top:10px;">
          <p><strong>${localized(school.name, lang)}</strong> — ${school.stat} ${stat}</p>
          <div class="charge-row">
            ${chipLabels.map((label) => `<span class="pill charge-chip">${label}</span>`).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  const knownSpells = slayerState.knownSpells || [];
  const knownIds = new Set(knownSpells.map((k) => k.spellId));
  const availableSpells = (data.spells || []).filter((sp) => !knownIds.has(sp.id));

  const knownListHtml =
    knownSpells.length === 0
      ? `<li class="hint">${t("slayers.tracker.knownEmpty", lang)}</li>`
      : knownSpells
          .map((k, i) => {
            const spell = (data.spells || []).find((sp) => sp.id === k.spellId);
            if (!spell) return "";
            const castability = evalCastability(char, slayerState, spell, data, lang);
            const carriedHint =
              k.source === "grimorio"
                ? `<span class="hint">(${
                    isGrimorioCarried(char, spell)
                      ? t("slayers.tracker.grimorioCarriedYes", lang)
                      : t("slayers.tracker.grimorioCarriedNo", lang)
                  })</span>`
                : "";
            return `
              <li>
                <strong>${spell.name}</strong> — ${schoolLabel(data, spell.school, lang)}, ${t(`slayers.tierLabel.${spell.tier}`, lang)}
                · ${t(`slayers.tracker.sourceLabel.${k.source}`, lang)} ${carriedHint}
                <div class="btn-row">
                  <button class="sl-tr-cast" data-i="${i}" ${castability.ok ? "" : "disabled"} title="${castability.reason}">${t(
              "slayers.tracker.cast",
              lang
            )}</button>
                  <button class="secondary sl-tr-remove-spell" data-i="${i}">${t("slayers.tracker.remove", lang)}</button>
                </div>
                ${!castability.ok ? `<p class="hint">${castability.reason}</p>` : ""}
              </li>
            `;
          })
          .join("");

  const assigned = slayerState.artifacts || [];
  const activeArtifactAwakenings = assigned.reduce(
    (sum, a) => sum + (a.awakenings || []).filter((x) => x.active).length,
    0
  );
  const spiritBlessings = slayerState.spiritBlessings || [];
  const activeSpiritBlessings = spiritBlessings.filter((b) => b.active).length;
  const activeTotal = activeArtifactAwakenings + activeSpiritBlessings;
  const cha = char.abilities.cha || 0;

  const entitiesList = Object.keys(slayerState.entities || {})
    .map((id) => ({ id, status: slayerState.entities[id].status, def: findEntity(data, id) }))
    .filter((e) => e.def);

  bodyEl.innerHTML = `
    <div class="card">
      <h3>${t("slayers.tracker.pools", lang)}</h3>
      <p class="hint">${t("slayers.tracker.poolsHint", lang)}</p>
      <div class="btn-row">
        <button id="sl-tr-newday" class="secondary">${t("slayers.tracker.newDay", lang)}</button>
        <button id="sl-tr-undo" class="secondary" ${slayerState.lastCast ? "" : "disabled"} title="${
    slayerState.lastCast ? "" : t("slayers.tracker.undoNone", lang)
  }">${t("slayers.tracker.undo", lang)}</button>
      </div>
      ${poolsHtml}
    </div>

    <div class="card">
      <h3>${t("slayers.tracker.known", lang)}</h3>
      <p class="hint">${t("slayers.tracker.knownHint", lang)}</p>
      <p class="hint">${t("slayers.tracker.sourceFuerteHint", lang)}</p>
      <div class="grid grid-3">
        <select id="sl-tr-add-spell">
          <option value="">…</option>
          ${availableSpells
            .map(
              (sp) =>
                `<option value="${sp.id}">${sp.name} — ${schoolLabel(data, sp.school, lang)}, ${t(
                  `slayers.tierLabel.${sp.tier}`,
                  lang
                )}</option>`
            )
            .join("")}
        </select>
        <select id="sl-tr-add-source"></select>
        <button id="sl-tr-add-spell-btn" class="secondary">${t("slayers.tracker.add", lang)}</button>
      </div>
      <ul id="sl-tr-known-list">${knownListHtml}</ul>
      <div id="sl-tr-cast-result">
        ${
          rollState.current
            ? `
          <p class="result">
            ${t("slayers.tracker.fuerteDamageResultPrefix", lang)} ${rollState.current.amount}
            ${t("slayers.tracker.fuerteDamageResultSuffix", lang)}
          </p>
          <div class="btn-row">
            <button id="sl-tr-apply-wounds" class="danger">${t("slayers.tracker.applyWounds", lang)}</button>
          </div>
        `
            : ""
        }
      </div>
    </div>

    <div class="card">
      <h3>${t("slayers.tracker.entitiesTitle", lang)}</h3>
      <p class="hint">${t("slayers.tracker.entitiesHint", lang)}</p>
      <ul>
        ${entitiesList
          .map((e) => {
            const isMazoku = e.def.kind === "mazoku";
            const options = isMazoku ? ["activo", "rechazo", "caido"] : ["neutral", "favor", "desfavor"];
            const labelBase = isMazoku ? "entityStatusMazoku" : "entityStatusSpirit";
            return `
              <li>
                <strong>${e.def.name}</strong>
                <select class="sl-tr-entity-status" data-entity="${e.id}">
                  ${options
                    .map(
                      (o) =>
                        `<option value="${o}" ${o === e.status ? "selected" : ""}>${t(
                          `slayers.tracker.${labelBase}.${o}`,
                          lang
                        )}</option>`
                    )
                    .join("")}
                </select>
                <button class="secondary sl-tr-entity-remove" data-entity="${e.id}">${t("slayers.tracker.remove", lang)}</button>
              </li>
            `;
          })
          .join("")}
      </ul>
      <div class="grid grid-3">
        <select id="sl-tr-add-entity">
          <option value="">…</option>
          ${(data.entities || [])
            .filter((e) => !(slayerState.entities || {})[e.id])
            .map((e) => `<option value="${e.id}">${e.name}</option>`)
            .join("")}
        </select>
        <button id="sl-tr-add-entity-btn" class="secondary">${t("slayers.tracker.addEntity", lang)}</button>
      </div>
    </div>

    <div class="card">
      <h3>${t("slayers.tracker.artifactsTitle", lang)}</h3>
      <p class="hint">${t("slayers.tracker.artifactsHint", lang)}</p>
      ${assigned
        .map((a, i) => {
          const def = findArtifact(data, a.artifactId);
          if (!def) return "";
          const awakenings = def.awakenings || [];
          return `
            <div class="card">
              <button class="secondary sl-tr-artifact-remove" data-i="${i}" style="float:right;">${t(
            "slayers.tracker.remove",
            lang
          )}</button>
              <strong>${def.name}</strong>
              <ul>
                ${awakenings
                  .map((awk, awkIdx) => {
                    const awkState = (a.awakenings && a.awakenings[awkIdx]) || { unlocked: false, active: false };
                    return `
                      <li>
                        <label style="display:inline-flex;align-items:center;gap:6px;">
                          <input type="checkbox" class="sl-tr-awk-unlocked" data-i="${i}" data-awk="${awkIdx}" ${
                      awkState.unlocked ? "checked" : ""
                    } style="width:auto;" />
                          ${t("slayers.tracker.unlocked", lang)}
                        </label>
                        <label style="display:inline-flex;align-items:center;gap:6px;margin-left:10px;">
                          <input type="checkbox" class="sl-tr-awk-active" data-i="${i}" data-awk="${awkIdx}" ${
                      awkState.active ? "checked" : ""
                    } ${awkState.unlocked ? "" : "disabled"} style="width:auto;" />
                          ${t("slayers.tracker.active", lang)}
                        </label>
                        <strong>${localized(awk.name, lang)}</strong> — ${localized(awk.effect, lang)}
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            </div>
          `;
        })
        .join("")}
      <div class="grid grid-3">
        <select id="sl-tr-add-artifact">
          <option value="">…</option>
          ${(data.artifacts || [])
            .filter((a) => !assigned.some((x) => x.artifactId === a.id))
            .map((a) => `<option value="${a.id}">${a.name}</option>`)
            .join("")}
        </select>
        <button id="sl-tr-add-artifact-btn" class="secondary">${t("slayers.tracker.addArtifact", lang)}</button>
      </div>
    </div>

    <div class="card">
      <h3>${t("slayers.tracker.blessingsTitle", lang)}</h3>
      <p class="hint">${t("slayers.tracker.spiritBlessingsHint", lang)}</p>
      <ul>
        ${spiritBlessings
          .map(
            (b, i) => `
              <li>
                <label style="display:inline-flex;align-items:center;gap:6px;">
                  <input type="checkbox" class="sl-tr-blessing-active" data-i="${i}" ${
              b.active ? "checked" : ""
            } style="width:auto;" />
                  ${b.text}
                </label>
                <button class="secondary sl-tr-blessing-remove" data-i="${i}">${t("slayers.tracker.remove", lang)}</button>
              </li>
            `
          )
          .join("")}
      </ul>
      <div class="grid grid-3">
        <input id="sl-tr-blessing-text" type="text" placeholder="${t("slayers.tracker.addBlessing", lang)}" />
        <button id="sl-tr-blessing-add" class="secondary">${t("slayers.tracker.add", lang)}</button>
      </div>
      <p class="result ${activeTotal > cha ? "fail" : ""}">${t("slayers.tracker.blessingsActive", lang)}: ${activeTotal} / ${cha}</p>
      ${activeTotal > cha ? `<p class="hint">${t("slayers.tracker.blessingsOverCap", lang)}</p>` : ""}
    </div>
  `;

  // Pools: nuevo día / deshacer.
  bodyEl.querySelector("#sl-tr-newday").addEventListener("click", () => {
    resetDay(char.id);
    rollState.current = null;
    refresh();
  });
  bodyEl.querySelector("#sl-tr-undo").addEventListener("click", () => {
    undoLastCast(char.id);
    rollState.current = null;
    refresh();
  });

  // Known spells: add (with source filtered to grimorio/maestro for fuerte).
  const addSpellSelect = bodyEl.querySelector("#sl-tr-add-spell");
  const addSourceSelect = bodyEl.querySelector("#sl-tr-add-source");
  function refreshSourceOptions() {
    const spell = (data.spells || []).find((sp) => sp.id === addSpellSelect.value);
    const allowed = spell && spell.tier === "fuerte" ? ["grimorio", "maestro"] : SOURCES;
    addSourceSelect.innerHTML = allowed
      .map((src) => `<option value="${src}">${t(`slayers.tracker.sourceLabel.${src}`, lang)}</option>`)
      .join("");
  }
  refreshSourceOptions();
  addSpellSelect.addEventListener("change", refreshSourceOptions);

  bodyEl.querySelector("#sl-tr-add-spell-btn").addEventListener("click", () => {
    const spellId = addSpellSelect.value;
    if (!spellId) return;
    const spell = (data.spells || []).find((sp) => sp.id === spellId);
    const source = addSourceSelect.value;
    updateCharSlayerState(char.id, (cs) => {
      cs.knownSpells = [...cs.knownSpells, { spellId, source }];
      if (spell.entity && !cs.entities[spell.entity]) {
        const entityDef = findEntity(data, spell.entity);
        cs.entities = {
          ...cs.entities,
          [spell.entity]: { status: entityDef && entityDef.kind === "mazoku" ? "activo" : "neutral" },
        };
      }
      return cs;
    });
    if (source === "grimorio") {
      const prompt = `${t("slayers.tracker.addGrimorioBookPromptPrefix", lang)} ${spell.name}${t(
        "slayers.tracker.addGrimorioBookPromptSuffix",
        lang
      )}`;
      if (confirm(prompt)) addGrimorioEntry(char.id, spell, lang);
    }
    refresh();
  });

  bodyEl.querySelectorAll(".sl-tr-cast").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      const known = knownSpells[i];
      const spell = (data.spells || []).find((sp) => sp.id === known.spellId);
      const dmg = castSpell(char, data, spell);
      rollState.current = dmg !== null ? { amount: dmg } : null;
      refresh();
    });
  });

  bodyEl.querySelectorAll(".sl-tr-remove-spell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      updateCharSlayerState(char.id, (cs) => {
        cs.knownSpells = cs.knownSpells.filter((_, idx) => idx !== i);
        return cs;
      });
      refresh();
    });
  });

  const applyWoundsBtn = bodyEl.querySelector("#sl-tr-apply-wounds");
  if (applyWoundsBtn) {
    applyWoundsBtn.addEventListener("click", () => {
      applyWounds(char.id, rollState.current.amount);
      rollState.current = null;
      refresh();
    });
  }

  // Entities and favor.
  bodyEl.querySelectorAll(".sl-tr-entity-status").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const entityId = sel.getAttribute("data-entity");
      updateCharSlayerState(char.id, (cs) => {
        cs.entities = { ...cs.entities, [entityId]: { status: e.target.value } };
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelectorAll(".sl-tr-entity-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entityId = btn.getAttribute("data-entity");
      updateCharSlayerState(char.id, (cs) => {
        const entities = { ...cs.entities };
        delete entities[entityId];
        cs.entities = entities;
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelector("#sl-tr-add-entity-btn").addEventListener("click", () => {
    const sel = bodyEl.querySelector("#sl-tr-add-entity");
    const entityId = sel.value;
    if (!entityId) return;
    const def = findEntity(data, entityId);
    updateCharSlayerState(char.id, (cs) => {
      cs.entities = { ...cs.entities, [entityId]: { status: def.kind === "mazoku" ? "activo" : "neutral" } };
      return cs;
    });
    refresh();
  });

  // Artifacts and awakenings.
  bodyEl.querySelectorAll(".sl-tr-artifact-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      updateCharSlayerState(char.id, (cs) => {
        cs.artifacts = cs.artifacts.filter((_, idx) => idx !== i);
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelectorAll(".sl-tr-awk-unlocked").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const i = Number(cb.getAttribute("data-i"));
      const awkIdx = Number(cb.getAttribute("data-awk"));
      updateCharSlayerState(char.id, (cs) => {
        cs.artifacts = cs.artifacts.map((a, idx) => {
          if (idx !== i) return a;
          const awakenings = [...(a.awakenings || [])];
          const prev = awakenings[awkIdx] || { unlocked: false, active: false };
          awakenings[awkIdx] = { unlocked: e.target.checked, active: e.target.checked ? prev.active : false };
          return { ...a, awakenings };
        });
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelectorAll(".sl-tr-awk-active").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const i = Number(cb.getAttribute("data-i"));
      const awkIdx = Number(cb.getAttribute("data-awk"));
      updateCharSlayerState(char.id, (cs) => {
        cs.artifacts = cs.artifacts.map((a, idx) => {
          if (idx !== i) return a;
          const awakenings = [...(a.awakenings || [])];
          const prev = awakenings[awkIdx] || { unlocked: false, active: false };
          awakenings[awkIdx] = { ...prev, active: e.target.checked };
          return { ...a, awakenings };
        });
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelector("#sl-tr-add-artifact-btn").addEventListener("click", () => {
    const sel = bodyEl.querySelector("#sl-tr-add-artifact");
    const artifactId = sel.value;
    if (!artifactId) return;
    const def = findArtifact(data, artifactId);
    updateCharSlayerState(char.id, (cs) => {
      cs.artifacts = [
        ...cs.artifacts,
        { artifactId, awakenings: (def.awakenings || []).map(() => ({ unlocked: false, active: false })) },
      ];
      return cs;
    });
    refresh();
  });

  // Blessings: spirit blessings (free text) + the active-count warning.
  bodyEl.querySelectorAll(".sl-tr-blessing-active").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const i = Number(cb.getAttribute("data-i"));
      updateCharSlayerState(char.id, (cs) => {
        cs.spiritBlessings = cs.spiritBlessings.map((b, idx) => (idx === i ? { ...b, active: e.target.checked } : b));
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelectorAll(".sl-tr-blessing-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      updateCharSlayerState(char.id, (cs) => {
        cs.spiritBlessings = cs.spiritBlessings.filter((_, idx) => idx !== i);
        return cs;
      });
      refresh();
    });
  });
  bodyEl.querySelector("#sl-tr-blessing-add").addEventListener("click", () => {
    const input = bodyEl.querySelector("#sl-tr-blessing-text");
    if (!input.value.trim()) return;
    updateCharSlayerState(char.id, (cs) => {
      cs.spiritBlessings = [...cs.spiritBlessings, { id: uid("b"), text: input.value.trim(), active: false }];
      return cs;
    });
    refresh();
  });
}
