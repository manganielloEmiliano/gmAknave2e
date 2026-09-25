import { t } from "../../i18n.js";

// Read-only catalog tabs (rules, spells, entities, artifacts) for the
// Slayers section. All four share the same "filter + render list" shape as
// js/views/rules.js, just with more filter fields for hechizos.

function findSchool(data, id) {
  return (data.schools || []).find((s) => s.id === id);
}

function findEntity(data, id) {
  return (data.entities || []).find((e) => e.id === id);
}

function localized(field, lang) {
  if (!field) return "";
  return field[lang] || field.es || "";
}

export function renderRulesTab(container, lang, data) {
  const rules = data.rules || [];

  container.innerHTML = `
    <h2>${t("slayers.tabs.rules", lang)}</h2>
    <div class="field">
      <input id="sl-rules-search" type="search" placeholder="${t("slayers.rulesSearchPlaceholder", lang)}" />
    </div>
    <div id="sl-rules-list"></div>
  `;

  const listEl = container.querySelector("#sl-rules-list");

  function renderList(filter) {
    const query = (filter || "").trim().toLowerCase();
    const filtered = rules.filter((section) => {
      if (!query) return true;
      const title = localized(section.title, lang).toLowerCase();
      const body = (section.body[lang] || section.body.es || []).join(" ").toLowerCase();
      return title.includes(query) || body.includes(query);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="hint">${t("slayers.rulesEmpty", lang)}</p>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((section, idx) => {
        const title = localized(section.title, lang);
        const paragraphs = section.body[lang] || section.body.es || [];
        return `
          <button class="section-toggle" data-idx="${idx}" type="button">${title}</button>
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
  container.querySelector("#sl-rules-search").addEventListener("input", (e) => {
    renderList(e.target.value);
  });
}

export function renderSpellsTab(container, lang, data) {
  const spells = data.spells || [];
  const schools = data.schools || [];
  const tiers = ["debil", "medio", "fuerte", "perdida"];
  const elements = ["fuego", "agua", "tierra", "viento", "astral"];

  container.innerHTML = `
    <h2>${t("slayers.tabs.spells", lang)}</h2>
    <div class="grid grid-3">
      <div class="field">
        <label>${t("slayers.school", lang)}</label>
        <select id="sl-sp-school">
          <option value="">${t("slayers.schoolAll", lang)}</option>
          ${schools.map((s) => `<option value="${s.id}">${localized(s.name, lang)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>${t("slayers.tier", lang)}</label>
        <select id="sl-sp-tier">
          <option value="">${t("slayers.tierAll", lang)}</option>
          ${tiers.map((tier) => `<option value="${tier}">${t(`slayers.tierLabel.${tier}`, lang)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>${t("slayers.element", lang)}</label>
        <select id="sl-sp-element">
          <option value="">${t("slayers.elementAll", lang)}</option>
          ${elements.map((el) => `<option value="${el}">${t(`slayers.elementLabel.${el}`, lang)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="field">
      <input id="sl-sp-search" type="search" placeholder="${t("slayers.search", lang)}" />
    </div>
    <div id="sl-sp-list"></div>
  `;

  const listEl = container.querySelector("#sl-sp-list");

  function renderList() {
    const schoolFilter = container.querySelector("#sl-sp-school").value;
    const tierFilter = container.querySelector("#sl-sp-tier").value;
    const elementFilter = container.querySelector("#sl-sp-element").value;
    const query = container.querySelector("#sl-sp-search").value.trim().toLowerCase();

    const filtered = spells.filter((spell) => {
      if (schoolFilter && spell.school !== schoolFilter) return false;
      if (tierFilter && spell.tier !== tierFilter) return false;
      if (elementFilter && spell.element !== elementFilter) return false;
      if (!query) return true;
      const haystack = [
        spell.name,
        localized(spell.effect, lang),
        localized(spell.canon, lang),
        localized(spell.notes, lang),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="hint">${t("slayers.spellsEmpty", lang)}</p>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((spell) => {
        const school = findSchool(data, spell.school);
        const tags = [school ? localized(school.name, lang) : spell.school, t(`slayers.tierLabel.${spell.tier}`, lang)];
        if (spell.element) tags.push(t(`slayers.elementLabel.${spell.element}`, lang));
        const entity = spell.entity ? findEntity(data, spell.entity) : null;
        if (entity) tags.push(entity.name);
        const notes = localized(spell.notes, lang);
        const canon = localized(spell.canon, lang);
        return `
          <div class="card">
            <h3>${spell.name}</h3>
            <p class="hint">${tags.join(" · ")}</p>
            <p>${localized(spell.effect, lang)}</p>
            ${canon ? `<p class="hint"><em>${canon}</em></p>` : ""}
            <p class="hint">${t("slayers.source", lang)}: ${spell.source || "—"}</p>
            ${notes ? `<p class="hint">${t("slayers.notes", lang)}: ${notes}</p>` : ""}
          </div>
        `;
      })
      .join("");
  }

  renderList();
  container.querySelector("#sl-sp-school").addEventListener("change", renderList);
  container.querySelector("#sl-sp-tier").addEventListener("change", renderList);
  container.querySelector("#sl-sp-element").addEventListener("change", renderList);
  container.querySelector("#sl-sp-search").addEventListener("input", renderList);
}

export function renderEntitiesTab(container, lang, data) {
  const entities = data.entities || [];
  const kinds = ["mazoku", "espiritu", "dios", "otro"];

  if (entities.length === 0) {
    container.innerHTML = `
      <h2>${t("slayers.tabs.entities", lang)}</h2>
      <p class="hint">${t("slayers.entitiesEmpty", lang)}</p>
    `;
    return;
  }

  const groups = kinds
    .map((kind) => ({ kind, items: entities.filter((e) => e.kind === kind) }))
    .filter((g) => g.items.length > 0);

  container.innerHTML = `
    <h2>${t("slayers.tabs.entities", lang)}</h2>
    ${groups
      .map(
        (group) => `
          <h3>${t(`slayers.kindLabel.${group.kind}`, lang)}</h3>
          ${group.items
            .map((entity) => {
              const canonStatus = localized(entity.canonStatus, lang);
              return `
                <div class="card">
                  <h3>${entity.name}</h3>
                  ${entity.element ? `<p class="hint">${t(`slayers.elementLabel.${entity.element}`, lang)}</p>` : ""}
                  <p class="hint">${t("slayers.domain", lang)}: ${localized(entity.domain, lang)}</p>
                  <p>${localized(entity.description, lang)}</p>
                  <p class="hint">${t("slayers.favor", lang)}: ${localized(entity.favor, lang)}</p>
                  ${canonStatus ? `<p class="hint">${t("slayers.canonStatus", lang)}: ${canonStatus}</p>` : ""}
                </div>
              `;
            })
            .join("")}
        `
      )
      .join("")}
  `;
}

export function renderArtifactsTab(container, lang, data) {
  const artifacts = data.artifacts || [];

  if (artifacts.length === 0) {
    container.innerHTML = `
      <h2>${t("slayers.tabs.artifacts", lang)}</h2>
      <p class="hint">${t("slayers.artifactsEmpty", lang)}</p>
    `;
    return;
  }

  container.innerHTML = `
    <h2>${t("slayers.tabs.artifacts", lang)}</h2>
    ${artifacts
      .map((artifact) => {
        const entity = artifact.entity ? findEntity(data, artifact.entity) : null;
        const awakenings = artifact.awakenings || [];
        return `
          <div class="card">
            <h3>${artifact.name}</h3>
            <p class="hint">
              ${t("slayers.slots", lang)}: ${artifact.slots}
              ${entity ? ` · ${t("slayers.entity", lang)}: ${entity.name}` : ` · ${t("slayers.entityNone", lang)}`}
            </p>
            <p>${localized(artifact.description, lang)}</p>
            <p class="hint">${t("slayers.base", lang)}: ${localized(artifact.base, lang)}</p>
            <h4>${t("slayers.awakenings", lang)}</h4>
            ${
              awakenings.length === 0
                ? `<p class="hint">${t("slayers.awakeningsEmpty", lang)}</p>`
                : `<ul>${awakenings
                    .map((a) => `<li><strong>${localized(a.name, lang)}</strong> — ${localized(a.effect, lang)}</li>`)
                    .join("")}</ul>`
            }
            <p class="hint">${t("slayers.source", lang)}: ${artifact.source || "—"}</p>
          </div>
        `;
      })
      .join("")}
  `;
}
