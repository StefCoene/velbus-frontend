export const MODULE_VIEWS = ["cards", "table"];
export const DEFAULT_MODULE_VIEW = "cards";

// Module and channel names come out of module eeprom, so they can hold anything.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]
  );
}

function hexAddress(address) {
  return Number(address).toString(16).toUpperCase().padStart(2, "0");
}

// An older backend does not send every column, so an absent value is normal.
function cell(value) {
  return value === undefined || value === null || value === ""
    ? `<span class="muted">&ndash;</span>`
    : escapeHtml(value);
}

function memoryMapCell(module) {
  const build = cell(module.memory_map_build);
  if (!module.memory_map_outdated) {
    return build;
  }
  return `${build} <span class="badge badge-warning" title="This module predates the memory map its spec describes, so writing to its memory is refused.">older module</span>`;
}

function renderViewSwitch(view) {
  const option = (value, label) =>
    `<button type="button" class="view-option${
      view === value ? " active" : ""
    }" data-view="${value}" aria-pressed="${view === value}">${label}</button>`;
  return `
    <div class="view-switch" role="group" aria-label="Module view">
      ${option("cards", "Cards")}${option("table", "Table")}
    </div>`;
}

function renderCards(modules) {
  return `<div class="module-grid">
    ${modules
      .map(
        (module) => `
      <button class="module-tile" type="button" data-address="${module.address}">
        <span class="module-address">Address ${module.address} (0x${hexAddress(module.address)})</span>
        <span class="module-name">${escapeHtml(module.name)}</span>
        <span class="module-type muted">${escapeHtml(module.type_name)}</span>
      </button>`
      )
      .join("")}
  </div>`;
}

function renderTable(modules) {
  return `<div class="table-scroll">
    <table class="modules-table">
      <thead>
        <tr>
          <th>Address</th>
          <th>Name</th>
          <th>Type</th>
          <th>Serial</th>
          <th>Firmware</th>
          <th>Memory map from</th>
          <th class="numeric">Channels</th>
        </tr>
      </thead>
      <tbody>
        ${modules
          .map(
            (module) => `
        <tr class="module-row" tabindex="0" role="button" data-address="${module.address}">
          <td><span class="module-address">${module.address}</span> <span class="muted">0x${hexAddress(module.address)}</span></td>
          <td class="module-name-cell">${cell(module.name)}</td>
          <td>${cell(module.type_name)}</td>
          <td>${cell(module.serial)}</td>
          <td>${cell(module.firmware_build)}</td>
          <td>${memoryMapCell(module)}</td>
          <td class="numeric">${Object.keys(module.channels || {}).length}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

export function renderModulesList(ctx) {
  const { modules } = ctx;
  const view = MODULE_VIEWS.includes(ctx.view) ? ctx.view : DEFAULT_MODULE_VIEW;
  return `
    <section class="modules-section">
      <div class="section-header">
        <h2>Modules</h2>
        ${modules.length ? renderViewSwitch(view) : ""}
      </div>
      ${
        modules.length
          ? view === "table"
            ? renderTable(modules)
            : renderCards(modules)
          : "<p>No modules found.</p>"
      }
    </section>`;
}

export function bindModulesList(root, handlers) {
  root.querySelectorAll("[data-address]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onSelect(Number(element.dataset.address));
    });
    // A table row is not focusable by default, so it needs its own key handling.
    if (element.tagName === "TR") {
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlers.onSelect(Number(element.dataset.address));
        }
      });
    }
  });

  root.querySelectorAll("[data-view]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onChangeView?.(element.dataset.view);
    });
  });
}
