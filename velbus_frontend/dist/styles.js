export const PANEL_STYLES = `
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 16px;
    font-family: var(--primary-font-family, Roboto, Noto, sans-serif);
    color: var(--primary-text-color, #212121);
    background: transparent;
    box-sizing: border-box;
    color-scheme: inherit;
  }
  .card {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #212121);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,.12));
    box-sizing: border-box;
  }
  h1, h2, h3 { margin: 0 0 12px; color: var(--primary-text-color, #212121); }
  .page-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .page-header h1 { margin: 0; flex: 1 1 auto; }
  .page-header .page-back {
    flex: 0 0 auto;
    padding: 4px 0;
    font-size: 1rem;
    line-height: 1.2;
  }
  .muted { color: var(--secondary-text-color, #727272); }
  .warning { color: var(--warning-color, #f57c00); }
  .modules-section { margin-bottom: 16px; }
  .modules-section h2 { margin-bottom: 16px; }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .section-header h2 { margin: 0; }
  .view-switch {
    display: inline-flex;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    overflow: hidden;
  }
  button.view-option {
    padding: 6px 14px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--primary-text-color, #212121);
    font-size: 0.9rem;
  }
  button.view-option + button.view-option {
    border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
  }
  button.view-option.active {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }
  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
  .module-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: 108px;
    padding: 16px;
    text-align: left;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #212121);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 12px;
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,.12));
    cursor: pointer;
  }
  button.module-tile {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #212121);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
  }
  .module-tile:hover,
  .module-tile:focus-visible {
    border-color: var(--primary-color, #03a9f4);
    outline: none;
  }
  .module-address {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--primary-color, #03a9f4);
  }
  .module-name {
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
  }
  .module-type { font-size: 0.85rem; }
  button.link, .link {
    background: none;
    border: none;
    color: var(--primary-color, #03a9f4);
    cursor: pointer;
    text-align: left;
    padding: 8px 0;
  }
  .header-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
  .header-row .back { width: auto; }
  .module-layout { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; margin-bottom: 16px; width: 100%; }
  .channel-panel { flex: 0 0 240px; width: 240px; margin-bottom: 0; }
  .actions-panel { flex: 1 1 0; min-width: 0; margin-bottom: 0; }
  .channel-list { list-style: none; padding: 0; margin: 0; }
  .channel-list li { margin: 0 0 4px; }
  .channel-item {
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    background: transparent;
    color: var(--primary-text-color, #212121);
    cursor: pointer;
  }
  .channel-item.active {
    background: var(--primary-color, #03a9f4);
    border-color: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }
  .channel-item.active .channel-badge {
    color: var(--text-primary-color, #fff);
    opacity: 0.85;
  }
  .channel-name { display: block; font-weight: 500; }
  .channel-badge {
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--secondary-text-color, #727272);
  }
  .channel-item.disabled-channel .channel-name { opacity: 0.65; }
  .channel-enable { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--primary-text-color, #212121); }
  .actions-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
  .actions-header h3 { margin: 0; flex: 1 1 auto; }
  .channel-rename { flex: 1; min-width: 180px; max-width: 280px; margin: 0; }
  label { display: block; margin-bottom: 12px; color: var(--primary-text-color, #212121); }
  label span {
    display: block;
    margin-bottom: 4px;
    font-size: 0.85rem;
    color: var(--secondary-text-color, #727272);
  }
  input, select {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--input-outlined-idle-border-color, var(--divider-color, rgba(0, 0, 0, 0.12)));
    background: var(--input-fill-color, var(--secondary-background-color, #f5f5f5));
    color: var(--input-ink-color, var(--primary-text-color, #212121));
    color-scheme: inherit;
  }
  input:hover, select:hover {
    border-color: var(--input-outlined-hover-border-color, var(--primary-text-color, #212121));
  }
  input:disabled, select:disabled {
    background: var(--input-disabled-fill-color, var(--input-fill-color, #fafafa));
    color: var(--input-disabled-ink-color, var(--disabled-text-color, #bdbdbd));
    border-color: var(--input-outlined-disabled-border-color, var(--divider-color, rgba(0, 0, 0, 0.06)));
  }
  input:focus-visible, select:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 1px;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; color: var(--primary-text-color, #212121); }
  th, td {
    text-align: left;
    padding: 8px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
  }
  th { color: var(--secondary-text-color, #727272); font-weight: 600; }
  th.numeric, td.numeric { text-align: right; }
  .table-scroll { overflow-x: auto; }
  .modules-table { margin-top: 0; white-space: nowrap; }
  .modules-table .module-row { cursor: pointer; }
  .modules-table .module-row:hover,
  .modules-table .module-row:focus-visible {
    background: var(--secondary-background-color, #e5e5e5);
    outline: none;
  }
  .modules-table .module-name-cell { font-weight: 500; white-space: normal; }
  .badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .badge-warning {
    background: var(--warning-color, #f57c00);
    color: var(--text-primary-color, #fff);
  }
  button {
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    cursor: pointer;
  }
  button.primary { margin-top: 0; }
  button.secondary {
    background: transparent;
    color: var(--primary-text-color, #212121);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 10;
  }
  .dialog { width: min(480px, 100%); margin: 0; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  @media (max-width: 560px) {
    .module-layout { flex-direction: column; }
    .channel-panel { width: 100%; flex-basis: auto; }
  }
`;
