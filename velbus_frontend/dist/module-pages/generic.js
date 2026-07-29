import {
  channelLabel,
  findActionTable,
  findChannelEnable,
  findChannelNames,
  findContact,
  formatSourceChannel,
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

function renderAddActionDialog(ctx) {
  const {
    showAddActionDialog,
    actionTable,
    modules,
    advancedMode,
    interactionsDisabled,
    sourceModuleAddress,
    editingSlot,
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
              editingSlot?.source_module_channel ?? editingSlot?.source_channel
            )}
          </select>
        </label>
        <label><span>Action</span>
          <select id="action-key" ${editable ? "" : "disabled"}>
            ${actionTable.actions
              .map(
                (action) =>
                  `<option value="${action.key}"${
                    action.key === editingSlot?.action_key ? " selected" : ""
                  }>${action.label}</option>`
              )
              .join("")}
          </select>
        </label>
        <div class="dialog-actions">
          <button class="secondary" id="cancel-add-action">Cancel</button>
          <button id="confirm-add-action" ${
            editable ? "" : "disabled"
          }>${editingSlot ? "Save action" : "Program action"}</button>
        </div>
      </div>
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
  };

  return `
    <section class="card header">
      <div class="header-row">
        <button class="link back" id="back-button">← Modules</button>
        ${
          actionTable
            ? `<button id="add-action" class="primary" ${
                editable ? "" : "disabled"
              }>Add action</button>`
            : ""
        }
      </div>
      <h2>${moduleData.name}</h2>
      <p class="muted">${metaParts.join(" · ")}</p>
      ${
        !advancedMode
          ? `<p class="warning">Advanced mode is disabled. Enable it in the Velbus integration configuration to program module memory.</p>`
          : ""
      }
    </section>
    ${renderSettings(moduleData.config, interactionsDisabled, sections, channels)}
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
                  <tr><th>Slot</th><th>Source</th><th>Channel</th><th>Action</th><th></th></tr>
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
          </div>
          ${renderAddActionDialog(dialogCtx)}`
        : `${
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

  root.querySelector("#add-action")?.addEventListener("click", () => {
    handlers.onShowAddAction();
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

  root.querySelector("#confirm-add-action")?.addEventListener("click", () => {
    const sourceAddress = Number(root.querySelector("#source-module")?.value);
    const sourceChannel = Number(root.querySelector("#source-channel")?.value);
    const action = root.querySelector("#action-key")?.value;
    handlers.onProgramAction(sourceAddress, sourceChannel, action);
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
