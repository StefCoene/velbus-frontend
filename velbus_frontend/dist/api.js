export function createApi(hass, configEntryId) {
  return async function callWs(type, extra = {}) {
    return hass.callWS({
      type,
      config_entry: configEntryId,
      ...extra,
    });
  };
}

export async function loadModules(callWs) {
  const result = await callWs("velbus/config_panel/modules", {});
  return result.modules || [];
}

export async function loadBaseData(callWs) {
  return callWs("velbus/config_panel/get_base_data", {});
}

export async function loadModule(callWs, address) {
  return callWs("velbus/config_panel/module/get", { address });
}

export async function loadActions(callWs, address, channel) {
  const result = await callWs("velbus/config_panel/module/actions/get", {
    address,
    channel,
    refresh: true,
  });
  return result.slots || [];
}

export async function saveChannelName(callWs, address, channel, value) {
  return callWs("velbus/config_panel/module/config/set", {
    address,
    channel,
    key: "name",
    value,
  });
}

export async function saveChannelEnabled(callWs, address, channel, enabled) {
  return callWs("velbus/config_panel/module/config/set", {
    address,
    channel,
    key: "enabled",
    value: enabled,
  });
}

export async function saveChannelContact(callWs, address, channel, value) {
  return callWs("velbus/config_panel/module/config/set", {
    address,
    channel,
    key: "contact",
    value,
  });
}

export async function saveConfigParameter(callWs, address, channel, key, value) {
  return callWs("velbus/config_panel/module/config/set", {
    address,
    channel,
    key,
    value,
  });
}

export async function programAction(
  callWs,
  address,
  channel,
  sourceAddress,
  sourceChannel,
  action,
  slot,
  times
) {
  return callWs("velbus/config_panel/module/actions/set", {
    address,
    channel,
    source_address: sourceAddress,
    source_channel: sourceChannel,
    action,
    // Writing an existing slot replaces it; without one the module picks a
    // free slot itself.
    ...(slot === null || slot === undefined ? {} : { slot }),
    ...(times || {}),
  });
}

export async function clearActionSlot(callWs, address, channel, slot) {
  return callWs("velbus/config_panel/module/actions/clear", {
    address,
    channel,
    slot,
  });
}

export async function loadSharedConfig(callWs) {
  const result = await callWs("velbus/config_panel/config/shared", {});
  return result.settings || [];
}

export async function saveSharedConfig(callWs, key, value, addresses) {
  const result = await callWs("velbus/config_panel/config/set_shared", {
    key,
    value,
    // The modules the page listed, so one that appeared since is not written
    // without the user having seen it.
    addresses,
  });
  return result.results || [];
}
