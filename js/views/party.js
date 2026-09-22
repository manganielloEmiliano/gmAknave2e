import { t } from "../i18n.js";
import { getState, updateState } from "../state.js";

export function renderParty(container) {
  const state = getState();
  const lang = state.lang;
  const mount = state.party.mount;
  const usedSlots = mount.items.reduce((sum, it) => sum + (it.slots || 1), 0);

  container.innerHTML = `
    <h1>${t("party.title", lang)}</h1>
    <p class="hint">${t("party.subtitle", lang)}</p>

    <div class="card">
      <h2>${t("party.mount", lang)}</h2>
      <div class="grid grid-2">
        <div class="field">
          <label>${t("party.mountName", lang)}</label>
          <input id="p-mount-name" type="text" value="${mount.name}" />
        </div>
        <div class="field">
          <label>${t("party.mountSlots", lang)}</label>
          <input id="p-mount-slots" type="number" value="${mount.slots}" />
        </div>
      </div>
      <p class="hint">${t("party.used", lang)}: ${usedSlots} / ${mount.slots}</p>
      <div class="grid grid-3">
        <input id="p-item-name" type="text" placeholder="${t("sheet.itemName", lang)}" />
        <select id="p-item-slots">
          <option value="1">${t("sheet.oneSlot", lang)}</option>
          <option value="2">${t("sheet.twoSlots", lang)}</option>
        </select>
        <button id="p-item-add">${t("sheet.addItem", lang)}</button>
      </div>
      <ul id="p-item-list">
        ${mount.items
          .map(
            (it, i) =>
              `<li>${it.name} (${it.slots}) <button data-i="${i}" class="secondary p-item-remove">x</button></li>`
          )
          .join("")}
      </ul>
    </div>

    <div class="card">
      <h2>${t("party.purse", lang)}</h2>
      <div class="field">
        <label>${t("party.purseAmount", lang)}</label>
        <input id="p-purse" type="number" value="${state.party.purse}" />
      </div>
    </div>
  `;

  container.querySelector("#p-mount-name").addEventListener("change", (e) => {
    updateState((s) => ({
      ...s,
      party: { ...s.party, mount: { ...s.party.mount, name: e.target.value } },
    }));
  });

  container.querySelector("#p-mount-slots").addEventListener("change", (e) => {
    updateState((s) => ({
      ...s,
      party: {
        ...s.party,
        mount: { ...s.party.mount, slots: Number(e.target.value) || 0 },
      },
    }));
    renderParty(container);
  });

  container.querySelector("#p-purse").addEventListener("change", (e) => {
    updateState((s) => ({ ...s, party: { ...s.party, purse: Number(e.target.value) || 0 } }));
  });

  container.querySelector("#p-item-add").addEventListener("click", () => {
    const nameInput = container.querySelector("#p-item-name");
    const slotsSelect = container.querySelector("#p-item-slots");
    if (nameInput.value.trim()) {
      updateState((s) => ({
        ...s,
        party: {
          ...s.party,
          mount: {
            ...s.party.mount,
            items: [
              ...s.party.mount.items,
              { name: nameInput.value.trim(), slots: Number(slotsSelect.value) },
            ],
          },
        },
      }));
      renderParty(container);
    }
  });

  container.querySelectorAll(".p-item-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      updateState((s) => ({
        ...s,
        party: {
          ...s.party,
          mount: {
            ...s.party.mount,
            items: s.party.mount.items.filter((_, idx) => idx !== i),
          },
        },
      }));
      renderParty(container);
    });
  });
}
