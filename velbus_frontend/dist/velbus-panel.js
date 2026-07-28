import { PANEL_STYLES } from "./styles.js";
import {
  clearActionSlot,
  createApi,
  loadActions,
  loadBaseData,
  loadModule,
  loadModules,
  programAction,
  saveChannelContact,
  saveChannelEnabled,
  saveChannelName,
  saveConfigParameter,
} from "./api.js";
import { sourceChannelOptions } from "./module-pages/base.js";
import {
  loadModulePage,
  resolveModulePageType,
} from "./module-pages/registry.js";
import {
  DEFAULT_MODULE_SORT,
  DEFAULT_MODULE_VIEW,
  MODULE_VIEWS,
  bindModulesList,
  renderModulesList,
} from "./pages/modules-list.js";

const MODULE_VIEW_STORAGE_KEY = "velbus-panel:modules-view";

class VelbusPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._panel = undefined;
    this._route = undefined;
    this._configEntryId = undefined;
    this._callWs = undefined;
    this._advancedMode = false;
    this._modules = [];
    this._modulesView = this._readStoredModulesView();
    this._modulesSort = { ...DEFAULT_MODULE_SORT };
    this._moduleAddress = null;
    this._moduleData = null;
    this._modulePage = null;
    this._actionChannel = 1;
    this._actionSlots = [];
    this._sourceModuleAddress = null;
    this._showAddActionDialog = false;
    this._editingSlot = null;
    this._loading = false;
    this._loadingActions = false;
    this._moduleBusy = false;
    this._error = null;
  }

  set hass(hass) {
    const firstLoad = !this._hass && hass;
    const themeChanged =
      this._hass?.themes?.darkMode !== hass?.themes?.darkMode ||
      this._hass?.themes?.theme !== hass?.themes?.theme;
    this._hass = hass;
    this._syncTheme();
    if (firstLoad) {
      this._bootstrap();
    } else if (themeChanged) {
      this._render();
    }
  }

  set panel(panel) {
    this._panel = panel;
    this._configEntryId = this._resolveConfigEntryId(panel);
    this._bootstrap();
  }

  set route(route) {
    const pathChanged = this._route?.path !== route?.path;
    this._route = route;
    if (pathChanged && this._hass && this._configEntryId) {
      this._onRouteChange();
    }
  }

  _resolveConfigEntryId(panel) {
    if (panel?.config?.config_entry_id) {
      return panel.config.config_entry_id;
    }
    if (panel?.config?.config_entry) {
      return panel.config.config_entry;
    }
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("config_entry")) {
      return searchParams.get("config_entry");
    }
    return undefined;
  }

  // localStorage is unavailable when the browser blocks storage for the iframe.
  _readStoredModulesView() {
    try {
      const stored = window.localStorage?.getItem(MODULE_VIEW_STORAGE_KEY);
      if (MODULE_VIEWS.includes(stored)) {
        return stored;
      }
    } catch (_error) {
      // fall through to the default
    }
    return DEFAULT_MODULE_VIEW;
  }

  _setModulesView(view) {
    if (!MODULE_VIEWS.includes(view) || view === this._modulesView) {
      return;
    }
    this._modulesView = view;
    try {
      window.localStorage?.setItem(MODULE_VIEW_STORAGE_KEY, view);
    } catch (_error) {
      // remembering the choice is a convenience, not a requirement
    }
    this._render();
  }

  _setModulesSort(column) {
    this._modulesSort =
      this._modulesSort.column === column
        ? {
            column,
            direction: this._modulesSort.direction === "asc" ? "desc" : "asc",
          }
        : { column, direction: "asc" };
    this._render();
  }

  _modulePageBusy() {
    return this._loading || this._loadingActions || this._moduleBusy;
  }

  async _withModuleBusy(fn) {
    if (this._moduleBusy) {
      return;
    }
    this._moduleBusy = true;
    this._render();
    try {
      await fn();
    } finally {
      this._moduleBusy = false;
      this._render();
    }
  }

  _parseRoute() {
    const rawPath =
      this._route?.path ??
      window.location.pathname.replace(/^\/velbus\/?/, "");
    const path = rawPath.replace(/^\//, "");
    if (!path) {
      return { page: "list" };
    }
    const match = path.match(/^module\/(\d+)/);
    if (match) {
      return { page: "module", address: Number(match[1]) };
    }
    return { page: "list" };
  }

  _navigate(path) {
    const search = this._configEntryId
      ? `?config_entry=${this._configEntryId}`
      : "";
    const fullPath = `/velbus${path}${search}`;
    if (window.parent?.customPanel?.navigate) {
      window.parent.customPanel.navigate(fullPath);
      return;
    }
    window.history.pushState(null, "", fullPath);
    window.dispatchEvent(
      new CustomEvent("location-changed", {
        detail: {},
        bubbles: true,
        composed: true,
      })
    );
    this._onRouteChange();
  }

  _goBackToIntegration() {
    let path = "/config/integrations/integration/velbus";
    if (this._configEntryId) {
      path += `#config_entry=${this._configEntryId}`;
    }
    if (window.parent?.customPanel?.navigate) {
      window.parent.customPanel.navigate(path);
      return;
    }
    window.history.pushState(null, "", path);
    window.dispatchEvent(
      new CustomEvent("location-changed", {
        detail: {},
        bubbles: true,
        composed: true,
      })
    );
  }

  async _bootstrap() {
    if (!this._configEntryId) {
      this._configEntryId = this._resolveConfigEntryId(this._panel);
    }
    if (!this._hass || !this._configEntryId) {
      return;
    }
    this._callWs = createApi(this._hass, this._configEntryId);
    try {
      const base = await loadBaseData(this._callWs);
      this._advancedMode = base.advanced_mode;
      await this._refreshModules();
      await this._onRouteChange();
    } catch (error) {
      this._error = String(error);
      this._render();
    }
  }

  async _refreshModules() {
    this._loading = true;
    this._render();
    this._modules = await loadModules(this._callWs);
    this._loading = false;
    this._render();
  }

  async _onRouteChange() {
    const route = this._parseRoute();
    if (route.page === "list") {
      this._moduleAddress = null;
      this._moduleData = null;
      this._modulePage = null;
      this._showAddActionDialog = false;
      this._render();
      return;
    }

    if (route.address !== this._moduleAddress || !this._moduleData) {
      await this._loadModulePage(route.address);
    } else {
      this._render();
    }
  }

  async _loadModulePage(address) {
    this._moduleAddress = address;
    this._loading = true;
    this._error = null;
    this._actionSlots = [];
    this._showAddActionDialog = false;
    this._render();
    try {
      this._moduleData = await loadModule(this._callWs, address);
      const pageType = resolveModulePageType(this._moduleData);
      this._modulePage = await loadModulePage(pageType);
      const actionSection = (
        this._moduleData.schema?.sections || []
      ).find((section) => section.type === "action_table");
      if (actionSection?.channels?.length) {
        this._actionChannel = actionSection.channels[0];
      }
    } catch (error) {
      this._error = String(error);
      this._moduleData = null;
      this._modulePage = null;
    }
    this._loading = false;
    this._render();
    if (this._moduleData) {
      await this._refreshActions();
    }
  }

  async _refreshActions() {
    const actionSection = (this._moduleData?.schema?.sections || []).find(
      (section) => section.type === "action_table"
    );
    if (!this._moduleAddress || !actionSection) {
      return;
    }
    this._loadingActions = true;
    this._render();
    try {
      this._actionSlots = await loadActions(
        this._callWs,
        this._moduleAddress,
        this._actionChannel
      );
    } catch (error) {
      this._error = String(error);
      this._actionSlots = [];
    }
    this._loadingActions = false;
    this._render();
  }

  _syncTheme() {
    const root = document.documentElement;
    const dark = Boolean(this._hass?.themes?.darkMode);
    root.style.colorScheme = dark ? "dark" : "light";
    document.body.style.backgroundColor = "";
    document.body.style.color = "";

    const themeVars = [
      "--primary-background-color",
      "--card-background-color",
      "--secondary-background-color",
      "--primary-text-color",
      "--secondary-text-color",
      "--disabled-text-color",
      "--divider-color",
      "--primary-color",
      "--accent-color",
      "--warning-color",
      "--error-color",
      "--success-color",
      "--text-primary-color",
      "--ha-card-box-shadow",
      "--primary-font-family",
      "--input-fill-color",
      "--input-disabled-fill-color",
      "--input-ink-color",
      "--input-label-ink-color",
      "--input-disabled-ink-color",
      "--input-outlined-idle-border-color",
      "--input-outlined-hover-border-color",
      "--input-outlined-disabled-border-color",
    ];

    let parentStyles;
    try {
      parentStyles = window.parent?.getComputedStyle?.(
        window.parent.document.documentElement
      );
    } catch (_error) {
      parentStyles = undefined;
    }

    for (const name of themeVars) {
      const value = parentStyles?.getPropertyValue(name)?.trim();
      if (value) {
        root.style.setProperty(name, value);
      } else {
        root.style.removeProperty(name);
      }
    }

    if (!parentStyles) {
      const fallbacks = dark
        ? {
            "--primary-background-color": "#111111",
            "--card-background-color": "#1c1c1c",
            "--secondary-background-color": "#282828",
            "--primary-text-color": "#e1e1e1",
            "--secondary-text-color": "#9b9b9b",
            "--disabled-text-color": "#6f6f6f",
            "--divider-color": "rgba(225, 225, 225, 0.12)",
            "--primary-color": "#03a9f4",
            "--text-primary-color": "#ffffff",
            "--warning-color": "#f57c00",
            "--input-fill-color": "rgba(255, 255, 255, 0.05)",
            "--input-disabled-fill-color": "rgba(255, 255, 255, 0.02)",
            "--input-ink-color": "rgba(255, 255, 255, 0.87)",
            "--input-label-ink-color": "rgba(255, 255, 255, 0.6)",
            "--input-disabled-ink-color": "rgba(255, 255, 255, 0.37)",
            "--input-outlined-idle-border-color": "rgba(255, 255, 255, 0.38)",
            "--input-outlined-hover-border-color": "rgba(255, 255, 255, 0.87)",
            "--input-outlined-disabled-border-color": "rgba(255, 255, 255, 0.06)",
            "--ha-card-box-shadow": "none",
          }
        : {
            "--primary-background-color": "#fafafa",
            "--card-background-color": "#ffffff",
            "--secondary-background-color": "#e5e5e5",
            "--primary-text-color": "#212121",
            "--secondary-text-color": "#727272",
            "--disabled-text-color": "#bdbdbd",
            "--divider-color": "rgba(0, 0, 0, 0.12)",
            "--primary-color": "#03a9f4",
            "--text-primary-color": "#ffffff",
            "--warning-color": "#f57c00",
            "--input-fill-color": "rgb(245, 245, 245)",
            "--input-disabled-fill-color": "rgb(250, 250, 250)",
            "--input-ink-color": "rgba(0, 0, 0, 0.87)",
            "--input-label-ink-color": "rgba(0, 0, 0, 0.6)",
            "--input-disabled-ink-color": "rgba(0, 0, 0, 0.37)",
            "--input-outlined-idle-border-color": "rgba(0, 0, 0, 0.38)",
            "--input-outlined-hover-border-color": "rgba(0, 0, 0, 0.87)",
            "--input-outlined-disabled-border-color": "rgba(0, 0, 0, 0.06)",
          };
      for (const [name, value] of Object.entries(fallbacks)) {
        root.style.setProperty(name, value);
      }
    }

    document.body.style.backgroundColor = getComputedStyle(root)
      .getPropertyValue("--primary-background-color")
      .trim();
    document.body.style.color = getComputedStyle(root)
      .getPropertyValue("--primary-text-color")
      .trim();
  }

  _renderPageContent() {
    const route = this._parseRoute();
    if (route.page === "list") {
      return renderModulesList({
        modules: this._modules,
        view: this._modulesView,
        sort: this._modulesSort,
      });
    }
    if (!this._modulePage) {
      return "";
    }
    return this._modulePage.render({
      moduleData: this._moduleData,
      modules: this._modules,
      actionChannel: this._actionChannel,
      actionSlots: this._actionSlots,
      loadingActions: this._loadingActions,
      interactionsDisabled: this._modulePageBusy(),
      advancedMode: this._advancedMode,
      showAddActionDialog: this._showAddActionDialog,
      sourceModuleAddress: this._sourceModuleAddress,
      editingSlot: this._editingSlot,
    });
  }

  _bindPageContent(contentRoot) {
    const route = this._parseRoute();
    if (route.page === "list") {
      bindModulesList(contentRoot, {
        onSelect: (address) => {
          this._navigate(`/module/${address}`);
        },
        onChangeView: (view) => {
          this._setModulesView(view);
        },
        onSort: (column) => {
          this._setModulesSort(column);
        },
      });
      return;
    }
    if (!this._modulePage) {
      return;
    }
    this._modulePage.bind(contentRoot, {
      onBack: () => {
        this._navigate("");
      },
      onSelectChannel: async (channel) => {
        if (this._modulePageBusy()) {
          return;
        }
        this._actionChannel = channel;
        await this._refreshActions();
      },
      onShowAddAction: () => {
        if (this._modulePageBusy()) {
          return;
        }
        this._editingSlot = null;
        this._sourceModuleAddress = null;
        this._showAddActionDialog = true;
        this._render();
      },
      onEditAction: (slot) => {
        if (this._modulePageBusy()) {
          return;
        }
        this._editingSlot =
          this._actionSlots.find((item) => item.slot === slot) ?? null;
        // Start on the module the slot points at, not on the first in the list.
        this._sourceModuleAddress = this._editingSlot?.source_address ?? null;
        this._showAddActionDialog = true;
        this._render();
      },
      onHideAddAction: () => {
        this._showAddActionDialog = false;
        this._editingSlot = null;
        this._render();
      },
      onSourceModuleChange: (address, root) => {
        this._sourceModuleAddress = address;
        const channelSelect = root.querySelector("#source-channel");
        if (channelSelect) {
          channelSelect.innerHTML = sourceChannelOptions(
            this._modules,
            address
          );
        }
      },
      onProgramAction: async (sourceAddress, sourceChannel, action) => {
        if (!sourceAddress || !sourceChannel || !action || this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          const editing = this._editingSlot;
          await programAction(
            this._callWs,
            this._moduleAddress,
            this._actionChannel,
            sourceAddress,
            sourceChannel,
            action,
            editing?.slot,
            // Keep the timings the slot already had; the dialog does not offer
            // them, so rewriting the slot must not silently drop them.
            editing
              ? {
                  time1: editing.time1,
                  time2: editing.time2,
                  time3: editing.time3,
                }
              : null
          );
          this._showAddActionDialog = false;
          this._editingSlot = null;
          await this._refreshActions();
        });
      },
      onClearSlot: async (slot) => {
        if (this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          await clearActionSlot(
            this._callWs,
            this._moduleAddress,
            this._actionChannel,
            slot
          );
          await this._refreshActions();
        });
      },
      onSaveChannelName: async (channel, value) => {
        if (this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          await saveChannelName(
            this._callWs,
            this._moduleAddress,
            channel,
            value
          );
          await this._loadModulePage(this._moduleAddress);
        });
      },
      onSaveChannelEnabled: async (channel, enabled) => {
        if (this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          await saveChannelEnabled(
            this._callWs,
            this._moduleAddress,
            channel,
            enabled
          );
          await this._loadModulePage(this._moduleAddress);
          await this._refreshActions();
        });
      },
      onSaveConfig: async (edits) => {
        if (this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          // One at a time: each write puts a message on a 16.6 kbit/s bus,
          // and a module that rejects one must not hide the rest.
          for (const edit of edits) {
            await saveConfigParameter(
              this._callWs,
              this._moduleAddress,
              edit.channel,
              edit.key,
              edit.value
            );
          }
          await this._loadModulePage(this._moduleAddress);
        });
      },
      onSaveChannelContact: async (channel, value) => {
        if (this._modulePageBusy()) {
          return;
        }
        await this._withModuleBusy(async () => {
          await saveChannelContact(
            this._callWs,
            this._moduleAddress,
            channel,
            value
          );
          await this._loadModulePage(this._moduleAddress);
        });
      },
    });
  }

  _render() {
    this._syncTheme();
    this.shadowRoot.innerHTML = `
      <style>${PANEL_STYLES}</style>
      <div class="page-header">
        <button type="button" class="link page-back" id="back-to-integration">← Back</button>
        <h1>Velbus configuration</h1>
      </div>
      ${this._loading ? "<p>Loading…</p>" : ""}
      ${this._error ? `<p class="warning">${this._error}</p>` : ""}
      <div id="page-content">${this._renderPageContent()}</div>
    `;

    this.shadowRoot
      .getElementById("back-to-integration")
      ?.addEventListener("click", () => {
        this._goBackToIntegration();
      });

    const contentRoot = this.shadowRoot.getElementById("page-content");
    if (contentRoot) {
      this._bindPageContent(contentRoot);
    }
  }
}

customElements.define("velbus-panel", VelbusPanel);
