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

// What the modules currently hold, as one line: the same value everywhere is
// the answer people are looking for, and anything else has to name who differs
// or the page would hide the very thing it is meant to fix.
export function summarise(setting) {
  const modules = setting.modules || [];
  const known = modules.filter((module) => module.value !== null);
  const unknown = modules.length - known.length;
  const counts = new Map();
  for (const module of known) {
    const key = String(module.value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const unit = setting.metadata?.unit ? ` ${setting.metadata.unit}` : "";
  if (!known.length) {
    return "No module reported a value.";
  }
  const parts = [...counts]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => `${value}${unit} on ${count}`);
  if (unknown) {
    parts.push(`unknown on ${unknown}`);
  }
  if (counts.size === 1 && !unknown) {
    return `${[...counts.keys()][0]}${unit} on all ${modules.length} modules`;
  }
  return parts.join(", ");
}

function control(setting) {
  const id = escapeAttr(setting.key);
  if (setting.kind === "bool") {
    return `<input type="checkbox" data-shared="${id}" />`;
  }
  if (setting.kind === "select") {
    return `<select data-shared="${id}">
      ${(setting.options || [])
        .map(
          (option) =>
            `<option value="${escapeAttr(option)}">${escapeAttr(option)}</option>`
        )
        .join("")}
    </select>`;
  }
  if (setting.kind === "number") {
    const min = setting.min === null ? "" : `min="${setting.min}"`;
    const max = setting.max === null ? "" : `max="${setting.max}"`;
    return `<input type="number" ${min} ${max} data-shared="${id}" />`;
  }
  return `<input type="text" data-shared="${id}" />`;
}

function renderSetting(setting, busy, result) {
  const unit = setting.metadata?.unit;
  const hint = setting.metadata?.hint;
  const failed = (result?.results || []).filter((item) => !item.success);
  return `<section class="card">
    <h3>${escapeAttr(setting.label)}${
      unit ? ` <span class="muted">(${escapeAttr(unit)})</span>` : ""
    }</h3>
    <p class="muted">${escapeAttr(summarise(setting))}</p>
    ${hint ? `<p class="muted"><small>${escapeAttr(hint)}</small></p>` : ""}
    <div class="rename-row">
      ${control(setting)}
      <button type="button" class="primary" data-apply="${escapeAttr(setting.key)}" ${
        busy ? "disabled" : ""
      }>Apply to ${setting.modules.length} modules</button>
    </div>
    ${
      result
        ? failed.length
          ? `<p class="warning">${escapeAttr(
              failed
                .map((item) => `${item.name} (${item.address}): ${item.error}`)
                .join("; ")
            )}</p>`
          : `<p class="muted">Written to all ${result.results.length} modules.</p>`
        : ""
    }
    <details>
      <summary class="muted">Per module</summary>
      <table>
        <thead><tr><th>Module</th><th>Address</th><th>Value</th></tr></thead>
        <tbody>
          ${setting.modules
            .map(
              (module) => `<tr>
                <td>${escapeAttr(module.name)}</td>
                <td>${module.address}</td>
                <td>${module.value === null ? "?" : escapeAttr(module.value)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </details>
  </section>`;
}

// Actions that go to the whole bus at once rather than to a setting on each
// module. The clock is a broadcast: one message, every module picks it up.
function renderActions(ctx) {
  return `<section class="card">
    <h3>Clock</h3>
    <p class="muted">
      Send the current Home Assistant time to every module on the bus.
    </p>
    <div class="rename-row">
      <button type="button" class="primary" id="sync-clock" ${
        ctx.busy ? "disabled" : ""
      }>Sync clock</button>
      ${
        ctx.clockResult
          ? ctx.clockResult.error
            ? `<span class="warning">${escapeAttr(ctx.clockResult.error)}</span>`
            : `<span class="muted">Sent at ${escapeAttr(ctx.clockResult.at)}.</span>`
          : ""
      }
    </div>
  </section>`;
}

export function render(ctx) {
  const { settings, loading, busy, results } = ctx;
  if (loading) {
    return "<p>Loading…</p>";
  }
  return `
    <section class="card header">
      <div class="header-row">
        <button class="link back" id="back-to-modules">← Modules</button>
      </div>
      <h2>All modules</h2>
      <p class="muted">
        Settings every module of this kind has. Writing one here sends it to all
        of them; a module that does not answer is reported and the rest still
        get the value.
      </p>
    </section>
    ${renderActions(ctx)}
    ${
      settings.length
        ? settings
            .map((setting) => renderSetting(setting, busy, results[setting.key]))
            .join("")
        : `<section class="card"><p class="muted">No module shares a setting that can be written this way.</p></section>`
    }`;
}

export function bind(root, handlers) {
  root.querySelector("#back-to-modules")?.addEventListener("click", () => {
    handlers.onBack();
  });

  root.querySelector("#sync-clock")?.addEventListener("click", () => {
    handlers.onSyncClock();
  });

  root.querySelectorAll("[data-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.apply;
      const field = root.querySelector(`[data-shared="${key}"]`);
      const value = field.type === "checkbox" ? field.checked : field.value;
      if (value === "") {
        return;
      }
      handlers.onApply(key, value);
    });
  });
}
