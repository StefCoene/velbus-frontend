import {
  channelLabel,
  findActionTable,
  findChannelEnable,
  findChannelNames,
  findContact,
  formatSourceChannel,
  actionTimeSummary,
  formatSourceModule,
  isProgrammedSlot,
  numberedChannelLabel,
  sourceChannelOptions,
  sourceTooltip,
} from "./base.js";

function canEdit(advancedMode, interactionsDisabled) {
  return advancedMode && !interactionsDisabled;
}

function escapeAttr(value) {
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

function settingControl(param, disabled) {
  const id = `${param.channel}:${param.key}`;
  // The original is kept on the element so Save can tell what actually
  // changed, and send only that rather than rewriting every setting.
  const original = param.kind === "bool" ? String(!!param.value) : `${param.value ?? ""}`;
  const common = `data-config="${escapeAttr(id)}" data-original="${escapeAttr(
    original
  )}" ${disabled ? "disabled" : ""}`;
  if (param.kind === "bool") {
    return `<input type="checkbox" ${common} ${param.value ? "checked" : ""} />`;
  }
  if (param.kind === "select") {
    return `<select ${common}>
      ${(param.options || [])
        .map(
          (option) =>
            `<option value="${escapeAttr(option)}"${
              option === param.value ? " selected" : ""
            }>${escapeAttr(option)}</option>`
        )
        .join("")}
    </select>`;
  }
  if (param.kind === "number") {
    const min = param.min === null ? "" : `min="${param.min}"`;
    const max = param.max === null ? "" : `max="${param.max}"`;
    return `<input type="number" ${min} ${max} ${common} value="${
      param.value === null ? "" : escapeAttr(param.value)
    }" />`;
  }
  const maxLength = param.max_length ? `maxlength="${param.max_length}"` : "";
  return `<input type="text" ${maxLength} ${common} value="${escapeAttr(
    param.value ?? ""
  )}" />`;
}

// These settings are sent as a bus message rather than written to module
// memory, so they do not need advanced mode the way the action table does.
function settingRow(param, interactionsDisabled) {
  const unit = param.metadata?.unit;
  const hint = param.metadata?.hint;
  return `<label class="setting">
    <span>${escapeAttr(param.label)}${
      unit ? ` <span class="muted">(${escapeAttr(unit)})</span>` : ""
    }</span>
    ${settingControl(param, interactionsDisabled)}
    ${hint ? `<small class="muted">${escapeAttr(hint)}</small>` : ""}
    ${
      param.value === null
        ? `<small class="warning">The module has not reported this value.</small>`
        : ""
    }
  </label>`;
}

function renderSettings(config, interactionsDisabled, sections, channels) {
  if (!config || !config.length) {
    return "";
  }
  // The backend names the group, so the panel follows the headings VelbusLink
  // uses instead of inventing its own. What it leaves ungrouped is grouped by
  // channel, because a setting like "Inhibit" exists once per channel and its
  // label alone does not say which one it belongs to. Module wide settings
  // carry channel 0 and stay at the top.
  const groups = new Map([[null, []]]);
  for (const param of config) {
    const key =
      param.group ||
      (param.channel
        ? numberedChannelLabel(param.channel, sections, channels)
        : null);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(param);
  }
  const rows = (params) =>
    params.map((param) => settingRow(param, interactionsDisabled)).join("");

  return `
    <section class="card">
      <h3>Settings</h3>
      ${rows(groups.get(null))}
      ${[...groups]
        .filter(([name]) => name !== null)
        .map(
          ([name, params]) => `
        <h4 class="setting-group">${escapeAttr(name)}</h4>
        ${rows(params)}`
        )
        .join("")}
      <div class="dialog-actions">
        <span class="muted" id="settings-status"></span>
        <button type="button" class="primary" id="save-settings" disabled>Save</button>
      </div>
    </section>`;
}

// Up to three time fields, one per time parameter the chosen action takes.
// Which ones apply changes with the action, so all three are rendered and the
// dialog shows or hides them; that keeps a value the user already picked when
// they browse through the action list.
function renderActionTimes(actionTable, editingSlot, editable) {
  const options = actionTable.time_options || [];
  if (!options.length) {
    return "";
  }
  const current = [editingSlot?.time1, editingSlot?.time2, editingSlot?.time3];
  return `<div id="action-times">
    ${[0, 1, 2]
      .map((index) => {
        // A new action starts at the shortest time rather than at the 0xFF an
        // empty slot holds, which the module reads as "never times out".
        const selected = current[index] ?? 0;
        return `<label class="action-time" data-time-index="${index}" hidden>
          <span></span>
          <select data-time-select="${index}" ${editable ? "" : "disabled"}>
            ${options
              .map(
                (option) =>
                  `<option value="${option.value}"${
                    option.value === selected ? " selected" : ""
                  }>${escapeAttr(option.label)}</option>`
              )
              .join("")}
          </select>
        </label>`;
      })
      .join("")}
  </div>`;
}

function renderAddActionDialog(ctx) {
  const {
    showAddActionDialog,
    actionTable,
    modules,
    advancedMode,
    interactionsDisabled,
    sourceModuleAddress,
    editingSlot,
    self,
  } = ctx;
  if (!showAddActionDialog || !actionTable) {
    return "";
  }
  const editable = canEdit(advancedMode, interactionsDisabled);
  // When editing, the dialog starts on the module the slot already points at.
  // That is its primary address: a slot pointing at a subaddress belongs to the
  // same module, which is what the list is keyed on.
  const sourceAddress =
    sourceModuleAddress ??
    editingSlot?.source_module_address ??
    editingSlot?.source_address ??
    (modules.length ? modules[0].address : null);
  const noun = actionTable.kind === "input" ? "input action" : "action";
  return `
    <div class="dialog-backdrop" id="add-action-dialog">
      <div class="dialog card">
        <h3>${editingSlot ? `Edit ${noun}` : `Add ${noun}`}</h3>
        <p class="muted">${
          editingSlot
            ? `Slot ${editingSlot.slot} is overwritten with what you choose here.`
            : "Program a new action for the selected channel."
        }</p>
        <label><span>Source module</span>
          <select id="source-module" ${editable ? "" : "disabled"}>
            ${modules
              .map(
                (module) =>
                  `<option value="${module.address}" ${
                    module.address === sourceAddress ? "selected" : ""
                  }>${module.name} (${module.address})</option>`
              )
              .join("")}
          </select>
        </label>
        <label><span>Source channel</span>
          <select id="source-channel" ${editable ? "" : "disabled"}>
            ${sourceChannelOptions(
              modules,
              sourceAddress,
              editingSlot?.source_module_channel ?? editingSlot?.source_channel,
              self
            )}
          </select>
        </label>
        <label><span>Action</span>
          <select id="action-key" ${editable ? "" : "disabled"}>
            ${actionTable.actions
              .map(
                (action) =>
                  `<option value="${action.key}" data-times="${
                    action.times || 0
                  }" data-time-labels="${escapeAttr(
                    (action.time_labels || []).join("|")
                  )}"${
                    action.key === editingSlot?.action_key ? " selected" : ""
                  }>${action.label}</option>`
              )
              .join("")}
          </select>
        </label>
        ${renderActionTimes(actionTable, editingSlot, editable)}
        <div class="dialog-actions">
          <button class="secondary" id="cancel-add-action">Cancel</button>
          <button id="confirm-add-action" ${
            editable ? "" : "disabled"
          }>${editingSlot ? "Save action" : "Program action"}</button>
        </div>
      </div>
    </div>`;
}

// The other direction. A slot lives in the module that reacts, so a channel
// that only sends -- a push button, a PIR -- has nothing to show about itself
// until the modules that listen to it have been read.
function triggerRows(items) {
  return `<table>
    <thead>
      <tr><th>Module</th><th>Channel</th><th>Action</th><th>Slot</th></tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `<tr>
            <td>${escapeAttr(item.name)} (${item.address})</td>
            <td>${escapeAttr(item.channelName)}</td>
            <td>${escapeAttr(item.action)}</td>
            <td>${item.slot}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

// How much of the bus the answer above is based on. Without this a channel
// that nothing reacts to and a channel whose listeners were never read look
// exactly the same.
function triggerCoverageNote(triggerCoverage) {
  const scanned = triggerCoverage?.scanned ?? 0;
  const total = triggerCoverage?.total ?? 0;
  if (total > 0 && scanned >= total) {
    return "";
  }
  return `<p class="muted"><small>
    Read ${scanned} of ${total} modules. Only modules whose action tables have
    been read can appear here — use "Read all actions" to complete the picture.
  </small></p>`;
}

function triggersComplete(triggerCoverage) {
  const total = triggerCoverage?.total ?? 0;
  return total > 0 && (triggerCoverage?.scanned ?? 0) >= total;
}

// A card of its own beside the slots that drive this channel, not a footnote
// under them: for an input module the outgoing side is the whole story, and
// for a relay both directions answer questions of the same weight.
function renderChannelTriggers(ctx, channel, channelLabelText) {
  const { triggers, triggerCoverage } = ctx;
  if (!triggers) {
    return "";
  }
  const items = triggers.filter((item) => item.sourceChannel === channel);
  return `<section class="card actions-panel">
    <div class="actions-header">
      <h3>This channel triggers — ${escapeAttr(channelLabelText)}</h3>
    </div>
    ${
      items.length
        ? triggerRows(items)
        : `<p class="muted">${
            triggersComplete(triggerCoverage)
              ? "Nothing on the bus reacts to this channel."
              : "No action found yet in what has been read."
          }</p>`
    }
    ${triggerCoverageNote(triggerCoverage)}
  </section>`;
}

// For a module with no action table of its own -- a PIR, a push button panel --
// there is no channel list to pick from, so every channel that triggers
// something gets its own heading.
function renderTriggersByChannel(ctx) {
  const { triggers, triggerCoverage } = ctx;
  if (!triggers) {
    return "";
  }
  const byChannel = new Map();
  for (const item of triggers) {
    if (!byChannel.has(item.sourceChannel)) {
      byChannel.set(item.sourceChannel, []);
    }
    byChannel.get(item.sourceChannel).push(item);
  }
  return `<section class="card">
    <h3>What this module triggers</h3>
    ${
      byChannel.size
        ? [...byChannel]
            .map(
              ([, items]) => `<h4 class="setting-group">${escapeAttr(
                items[0].sourceChannelName
              )}</h4>
              ${triggerRows(items)}`
            )
            .join("")
        : `<p class="muted">${
            triggersComplete(triggerCoverage)
              ? "Nothing on the bus reacts to this module."
              : "No action found yet in what has been read."
          }</p>`
    }
    ${triggerCoverageNote(triggerCoverage)}
  </section>`;
}

// Memory is read four bytes at a time, so bytes are what moves while a module
// is being read; counting modules would sit at "0 of 1" for the whole minute.
function renderReadProgress(progress) {
  const done = progress?.bytes_done ?? 0;
  const total = progress?.bytes_total ?? 0;
  if (!total) {
    return `<p class="muted">Reading this module\u2019s action tables…</p>`;
  }
  const percent = Math.min(100, Math.round((done / total) * 100));
  return `<p class="muted">
    Reading this module\u2019s action tables — ${done} of ${total} bytes (${percent}%).
    <progress value="${done}" max="${total}"></progress>
  </p>`;
}

// Everything that acts on the module as a whole, in one place. These used to
// be buttons beside the back link, which put them in the same row as -- and at
// the same weight as -- leaving the page.
function renderModuleMenu(ctx) {
  const {
    menuOpen,
    showSettings,
    hasSettings,
    actionTable,
    editable,
    interactionsDisabled,
    actionBusy,
  } = ctx;
  const items = [];
  if (hasSettings) {
    items.push({
      id: "menu-settings",
      label: showSettings ? "Hide settings" : "Settings",
      disabled: false,
    });
  }
  if (actionTable) {
    items.push({
      id: "menu-scan-actions",
      label: actionBusy ? "Reading…" : "Read all actions",
      disabled: interactionsDisabled || actionBusy,
    });
    items.push({
      id: "menu-add-action",
      label: actionTable.kind === "input" ? "Add input action" : "Add action",
      disabled: !editable,
    });
  }
  if (!items.length) {
    return "";
  }
  return `<div class="menu-anchor">
    <button
      id="module-menu"
      class="menu-button"
      aria-haspopup="true"
      aria-expanded="${menuOpen ? "true" : "false"}"
      title="Module actions"
    >⋮</button>
    ${
      menuOpen
        ? `<div class="menu-backdrop" id="module-menu-backdrop"></div>
           <div class="menu" role="menu">
             ${items
               .map(
                 (item) =>
                   `<button type="button" role="menuitem" id="${item.id}" ${
                     item.disabled ? "disabled" : ""
                   }>${escapeAttr(item.label)}</button>`
               )
               .join("")}
           </div>`
        : ""
    }
  </div>`;
}

export function render(ctx) {
  const {
    moduleData,
    modules,
    actionChannel,
    actionSlots,
    loadingActions,
    interactionsDisabled,
    advancedMode,
    showAddActionDialog,
    sourceModuleAddress,
    editingSlot,
    triggers,
    triggerCoverage,
    menuOpen,
    showSettings,
    actionBusy,
    actionProgress,
    actionError,
  } = ctx;

  if (!moduleData) {
    return "";
  }

  const editable = canEdit(advancedMode, interactionsDisabled);

  const schema = moduleData.schema || { sections: [] };
  const sections = schema.sections || [];
  const channelNames = findChannelNames(sections);
  const actionTable = findActionTable(sections);
  const channelEnable = findChannelEnable(sections);
  const contact = findContact(sections);
  const channels = moduleData.channels || {};
  const actions = (actionSlots || []).filter(isProgrammedSlot);
  const selectedChannelLabel = channelLabel(actionChannel, sections, channels);
  const selectedSupportsEnable =
    channelEnable?.channels?.includes(actionChannel) ||
    (sections.find((section) => section.type === "channels")?.channels || []).some(
      (entry) => entry.channel === actionChannel && entry.supports_enable
    );
  const selectedEnabled = channels[String(actionChannel)]?.enabled !== false;
  const metaParts = [
    `Address ${moduleData.address}`,
    moduleData.type_name,
    moduleData.sw_version ? `Firmware ${moduleData.sw_version}` : null,
    moduleData.serial ? `Serial ${moduleData.serial}` : null,
  ].filter(Boolean);

  const dialogCtx = {
    showAddActionDialog,
    actionTable,
    modules,
    advancedMode,
    interactionsDisabled,
    sourceModuleAddress,
    editingSlot,
    self: { address: moduleData.address, channel: actionChannel },
  };

  return `
    <section class="card header">
      <div class="header-row">
        <button class="link back" id="back-button">← Modules</button>
        ${renderModuleMenu({
          menuOpen,
          showSettings,
          hasSettings: (moduleData.config || []).length > 0,
          actionTable,
          editable,
          interactionsDisabled,
          actionBusy,
        })}
      </div>
      <h2>${moduleData.name}</h2>
      <p class="muted">${metaParts.join(" · ")}</p>
      ${actionBusy ? renderReadProgress(actionProgress) : ""}
      ${actionError ? `<p class="warning">${escapeAttr(actionError)}</p>` : ""}
      ${
        !advancedMode
          ? `<p class="warning">Advanced mode is disabled. Enable it in the Velbus integration configuration to program module memory.</p>`
          : ""
      }
    </section>
    ${
      showSettings
        ? renderSettings(moduleData.config, interactionsDisabled, sections, channels)
        : ""
    }
    ${
      actionTable
        ? `<div class="module-layout">
            <section class="card channel-panel">
              <h3>Channels</h3>
              <ul class="channel-list">
                ${actionTable.channels
                  .map((channel) => {
                    const label = numberedChannelLabel(channel, sections, channels);
                    const isActive = channel === actionChannel;
                    const live = channels[String(channel)] || {};
                    const disabled = live.enabled === false;
                    return `<li>
                      <button
                        type="button"
                        class="channel-item${isActive ? " active" : ""}${
                          disabled ? " disabled-channel" : ""
                        }"
                        data-action-channel="${channel}"
                        ${interactionsDisabled ? "disabled" : ""}
                      >
                        <span class="channel-name">${label}</span>
                        ${
                          disabled
                            ? `<span class="channel-badge">Disabled</span>`
                            : ""
                        }
                      </button>
                    </li>`;
                  })
                  .join("")}
              </ul>
            </section>
            <div class="channel-detail">
            <section class="card actions-panel">
              <div class="actions-header">
                <h3>${
                  actionTable.kind === "input" ? "Input actions" : "Actions"
                } — ${selectedChannelLabel}</h3>
                ${
                  channelNames?.channels?.some(
                    (entry) => entry.channel === actionChannel
                  )
                    ? `<label class="channel-rename">
                        <span>Channel name</span>
                        <span class="rename-row">
                          <input
                            type="text"
                            maxlength="16"
                            id="channel-name-input"
                            data-original="${escapeAttr(
                              channels[String(actionChannel)]?.name || ""
                            )}"
                            value="${escapeAttr(
                              channels[String(actionChannel)]?.name || ""
                            )}"
                            ${editable ? "" : "disabled"}
                          />
                          <button type="button" class="primary" id="save-channel-name"
                            data-channel="${actionChannel}" disabled>Save</button>
                        </span>
                      </label>`
                    : ""
                }
                ${
                  contact?.channels?.includes(actionChannel)
                    ? `<label class="channel-contact">
                        <span>Contact</span>
                        <select
                          data-channel-contact="${actionChannel}"
                          ${editable ? "" : "disabled"}
                        >
                          ${(contact.options || ["NO", "NC"])
                            .map((option) => {
                              const current =
                                channels[String(actionChannel)]?.contact || "NO";
                              return `<option value="${option}" ${
                                option === current ? "selected" : ""
                              }>${option}</option>`;
                            })
                            .join("")}
                        </select>
                      </label>`
                    : ""
                }
                ${
                  selectedSupportsEnable
                    ? `<label class="channel-enable">
                        <input
                          type="checkbox"
                          data-channel-enable="${actionChannel}"
                          ${selectedEnabled ? "checked" : ""}
                          ${editable ? "" : "disabled"}
                        />
                        <span>Channel enabled</span>
                      </label>`
                    : ""
                }
              </div>
              ${loadingActions ? "<p>Loading actions…</p>" : ""}
              <table>
                <thead>
                  <tr><th>Slot</th><th>Source</th><th>Channel</th><th>Action</th><th>Time</th><th></th></tr>
                </thead>
                <tbody>
                  ${
                    actions.length
                      ? actions
                          .map(
                            (slot) => `<tr>
                        <td>${slot.slot}</td>
                        <td title="${escapeAttr(
                              sourceTooltip(slot)
                            )}">${formatSourceModule(slot)}</td>
                        <td>${formatSourceChannel(slot)}</td>
                        <td>${slot.action_label || slot.action_key || ""}</td>
                        <td>${escapeAttr(actionTimeSummary(actionTable, slot))}</td>
                        <td>${
                          editable
                            ? `<button class="link" data-edit-slot="${slot.slot}" ${
                                interactionsDisabled ? "disabled" : ""
                              }>Edit</button>
                               <button class="link" data-clear-slot="${slot.slot}" ${
                                 interactionsDisabled ? "disabled" : ""
                               }>Clear</button>`
                            : ""
                        }</td>
                      </tr>`
                          )
                          .join("")
                      : `<tr><td colspan="4">${
                          loadingActions
                            ? ""
                            : "No programmed actions for this channel."
                        }</td></tr>`
                  }
                </tbody>
              </table>
            </section>
            ${renderChannelTriggers(
              { triggers, triggerCoverage },
              actionChannel,
              selectedChannelLabel
            )}
            </div>
          </div>
          ${renderAddActionDialog(dialogCtx)}`
        : `${renderTriggersByChannel({ triggers, triggerCoverage })}${
            channelNames
              ? `<section class="card">
              <h3>Channel names</h3>
              ${channelNames.channels
                .map((channel) => {
                  const live = channels[String(channel.channel)] || {};
                  const value = live.name || "";
                  return `<label>
                    <span>${channel.name}</span>
                    <input
                      type="text"
                      maxlength="16"
                      data-channel-name="${channel.channel}"
                      value="${value}"
                      ${editable ? "" : "disabled"}
                    />
                  </label>`;
                })
                .join("")}
            </section>`
              : ""
          }${
            contact
              ? `<section class="card">
              <h3>Contact type</h3>
              ${contact.channels
                .map((channel) => {
                  const live = channels[String(channel)] || {};
                  const current = live.contact || "NO";
                  const label = channelLabel(channel, sections, channels);
                  return `<label>
                    <span>${label}</span>
                    <select
                      data-channel-contact="${channel}"
                      ${editable ? "" : "disabled"}
                    >
                      ${(contact.options || ["NO", "NC"])
                        .map(
                          (option) =>
                            `<option value="${option}" ${
                              option === current ? "selected" : ""
                            }>${option}</option>`
                        )
                        .join("")}
                    </select>
                  </label>`;
                })
                .join("")}
            </section>`
              : ""
          }`
    }`;
}

export function bind(root, handlers) {
  root.querySelector("#back-button")?.addEventListener("click", () => {
    handlers.onBack();
  });

  root.querySelectorAll("[data-action-channel]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onSelectChannel(Number(element.dataset.actionChannel));
    });
  });

  root.querySelector("#module-menu")?.addEventListener("click", () => {
    handlers.onToggleMenu();
  });

  root
    .querySelector("#module-menu-backdrop")
    ?.addEventListener("click", () => {
      handlers.onCloseMenu();
    });

  root.querySelector("#menu-settings")?.addEventListener("click", () => {
    handlers.onToggleSettings();
  });

  root.querySelector("#menu-add-action")?.addEventListener("click", () => {
    handlers.onShowAddAction();
  });

  root.querySelector("#menu-scan-actions")?.addEventListener("click", () => {
    handlers.onScanModuleActions();
  });

  root.querySelector("#cancel-add-action")?.addEventListener("click", () => {
    handlers.onHideAddAction();
  });

  root.querySelector("#add-action-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "add-action-dialog") {
      handlers.onHideAddAction();
    }
  });

  root.querySelector("#source-module")?.addEventListener("change", (event) => {
    handlers.onSourceModuleChange(Number(event.target.value), root);
  });

  const actionSelect = root.querySelector("#action-key");
  const timeRows = [...root.querySelectorAll("[data-time-index]")];

  // Which time fields apply is a property of the action, and the option
  // carries it, so switching action needs no trip through the panel state.
  const syncActionTimes = () => {
    const option = actionSelect?.selectedOptions?.[0];
    const count = Number(option?.dataset.times || 0);
    const labels = (option?.dataset.timeLabels || "")
      .split("|")
      .filter(Boolean);
    timeRows.forEach((row, index) => {
      row.hidden = index >= count;
      row.querySelector("span").textContent = labels[index] || `Time ${index + 1}`;
    });
  };
  actionSelect?.addEventListener("change", syncActionTimes);
  syncActionTimes();

  root.querySelector("#confirm-add-action")?.addEventListener("click", () => {
    const sourceAddress = Number(root.querySelector("#source-module")?.value);
    const sourceChannel = Number(root.querySelector("#source-channel")?.value);
    const action = actionSelect?.value;
    // A time the action does not use stays at what an empty slot holds.
    const times = {};
    timeRows.forEach((row, index) => {
      const select = row.querySelector("[data-time-select]");
      times[`time${index + 1}`] = row.hidden ? 0xff : Number(select.value);
    });
    handlers.onProgramAction(sourceAddress, sourceChannel, action, times);
  });

  root.querySelectorAll("[data-edit-slot]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onEditAction?.(Number(element.dataset.editSlot));
    });
  });

  root.querySelectorAll("[data-clear-slot]").forEach((element) => {
    element.addEventListener("click", () => {
      handlers.onClearSlot(Number(element.dataset.clearSlot));
    });
  });

  const nameInput = root.querySelector("#channel-name-input");
  const nameButton = root.querySelector("#save-channel-name");
  if (nameInput && nameButton) {
    nameInput.addEventListener("input", () => {
      nameButton.disabled = nameInput.value === nameInput.dataset.original;
    });
    nameButton.addEventListener("click", () => {
      handlers.onSaveChannelName(
        Number(nameButton.dataset.channel),
        nameInput.value
      );
    });
  }

  root.querySelectorAll("[data-channel-enable]").forEach((element) => {
    element.addEventListener("change", (event) => {
      handlers.onSaveChannelEnabled(
        Number(event.target.dataset.channelEnable),
        event.target.checked
      );
    });
  });

  root.querySelectorAll("[data-channel-contact]").forEach((element) => {
    element.addEventListener("change", (event) => {
      handlers.onSaveChannelContact(
        Number(event.target.dataset.channelContact),
        event.target.value
      );
    });
  });

  const settings = [...root.querySelectorAll("[data-config]")];
  const saveButton = root.querySelector("#save-settings");
  const status = root.querySelector("#settings-status");

  const currentValue = (element) =>
    element.type === "checkbox" ? String(element.checked) : element.value;
  const changed = () =>
    settings.filter(
      (element) => currentValue(element) !== element.dataset.original
    );

  settings.forEach((element) => {
    // "input" rather than "change" so the button wakes up while typing, not
    // only once the field is left.
    element.addEventListener("input", () => {
      const count = changed().length;
      saveButton.disabled = count === 0;
      status.textContent = count ? `${count} unsaved` : "";
    });
  });

  saveButton?.addEventListener("click", () => {
    const edits = changed().map((element) => {
      const [channel, key] = element.dataset.config.split(":");
      const value =
        element.type === "checkbox"
          ? element.checked
          : element.type === "number"
            ? Number(element.value)
            : element.value;
      return { channel: Number(channel), key, value };
    });
    if (edits.length) {
      handlers.onSaveConfig?.(edits);
    }
  });
}
