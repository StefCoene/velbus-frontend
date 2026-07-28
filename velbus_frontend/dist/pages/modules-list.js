export const MODULE_VIEWS = ["cards", "table"];
export const DEFAULT_MODULE_VIEW = "cards";
export const DEFAULT_MODULE_SORT = { column: "address", direction: "asc" };

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

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

// An older backend does not send every column, so an absent value is normal.
function cell(value) {
  return isEmpty(value) ? `<span class="muted">&ndash;</span>` : escapeHtml(value);
}

function channelCount(module) {
  return Object.keys(module.channels || {}).length;
}

// Green only means "checked and fine". Without a build on either side there is
// nothing to compare, and claiming otherwise would be a false reassurance.
function minimumFirmwareCell(module) {
  if (isEmpty(module.memory_map_build) || isEmpty(module.firmware_build)) {
    return cell(module.memory_map_build);
  }
  const supported = !module.memory_map_outdated;
  const label = supported
    ? "The module firmware is at or above the minimum this configuration supports."
    : "The module firmware predates the memory map its configuration describes, so writing to its memory is refused.";
  return `${escapeHtml(module.memory_map_build)} <span class="status ${
    supported ? "status-ok" : "status-bad"
  }" role="img" aria-label="${label}" title="${label}">${supported ? "✓" : "✗"}</span>`;
}

const COLUMNS = [
  {
    key: "address",
    label: "Address",
    sortValue: (module) => Number(module.address),
    render: (module) =>
      `<span class="module-address">${module.address}</span> <span class="muted">0x${hexAddress(module.address)}</span>`,
  },
  {
    key: "name",
    label: "Name",
    className: "module-name-cell",
    sortValue: (module) => String(module.name ?? "").toLowerCase(),
    render: (module) => cell(module.name),
  },
  {
    key: "type",
    label: "Type",
    sortValue: (module) => String(module.type_name ?? "").toLowerCase(),
    render: (module) => cell(module.type_name),
  },
  {
    key: "serial",
    label: "Serial",
    sortValue: (module) => module.serial,
    render: (module) => cell(module.serial),
  },
  {
    key: "firmware",
    label: "Firmware",
    sortValue: (module) => module.firmware_build,
    render: (module) => cell(module.firmware_build),
  },
  {
    key: "min_firmware",
    label: "Minimum supported Firmware",
    sortValue: (module) => module.memory_map_build,
    render: minimumFirmwareCell,
  },
  {
    key: "channels",
    label: "Channels",
    className: "numeric",
    sortValue: channelCount,
    render: channelCount,
  },
];

function compareValues(first, second) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (!Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first).localeCompare(String(second));
}

export function sortModules(modules, sort) {
  const column =
    COLUMNS.find((candidate) => candidate.key === sort?.column) || COLUMNS[0];
  const factor = sort?.direction === "desc" ? -1 : 1;
  return [...modules].sort((first, second) => {
    const firstValue = column.sortValue(first);
    const secondValue = column.sortValue(second);
    // Blanks stay at the bottom in both directions; they are not a low value.
    if (isEmpty(firstValue) || isEmpty(secondValue)) {
      if (isEmpty(firstValue) && isEmpty(secondValue)) {
        return Number(first.address) - Number(second.address);
      }
      return isEmpty(firstValue) ? 1 : -1;
    }
    return (
      factor * compareValues(firstValue, secondValue) ||
      Number(first.address) - Number(second.address)
    );
  });
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

function renderHeaderCell(column, sort) {
  const active = column.key === sort.column;
  const ariaSort = active
    ? sort.direction === "desc"
      ? "descending"
      : "ascending"
    : "none";
  const arrow = active
    ? `<span class="sort-arrow">${sort.direction === "desc" ? "▼" : "▲"}</span>`
    : "";
  return `<th class="${column.className || ""}" aria-sort="${ariaSort}">
    <button type="button" class="sort-header${active ? " active" : ""}" data-sort="${column.key}">
      ${escapeHtml(column.label)}${arrow}
    </button>
  </th>`;
}

function renderTable(modules, sort) {
  return `<div class="table-scroll">
    <table class="modules-table">
      <thead>
        <tr>${COLUMNS.map((column) => renderHeaderCell(column, sort)).join("")}</tr>
      </thead>
      <tbody>
        ${sortModules(modules, sort)
          .map(
            (module) => `
        <tr class="module-row" tabindex="0" role="button" data-address="${module.address}">
          ${COLUMNS.map(
            (column) =>
              `<td class="${column.className || ""}">${column.render(module)}</td>`
          ).join("")}
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
  const sort = ctx.sort || DEFAULT_MODULE_SORT;
  return `
    <section class="modules-section">
      <div class="section-header">
        <h2>Modules</h2>
        ${modules.length ? renderViewSwitch(view) : ""}
      </div>
      ${
        modules.length
          ? view === "table"
            ? renderTable(modules, sort)
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

  root.querySelectorAll("[data-sort]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onSort?.(element.dataset.sort);
    });
  });
}
