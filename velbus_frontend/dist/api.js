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

export async function syncClock(callWs) {
  return callWs("velbus/config_panel/sync_clock", {});
}

export async function loadAllActions(callWs) {
  return callWs("velbus/config_panel/actions/all", {});
}

export async function clearActionCache(callWs) {
  const result = await callWs("velbus/config_panel/actions/clear_cache", {});
  return result.cleared || [];
}

export function createSubscriber(hass, configEntryId) {
  return function subscribe(type, extra, onEvent) {
    return hass.connection.subscribeMessage(onEvent, {
      type,
      config_entry: configEntryId,
      ...extra,
    });
  };
}

// Reading every action table is minutes of bus traffic, so the backend reports
// as it goes instead of answering once. This turns that back into a promise
// that settles on the last event, with the progress passed on meanwhile.
export function scanActions(subscribe, { force = false } = {}, onProgress) {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let settled = false;

    const stop = () => {
      settled = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    subscribe("velbus/config_panel/actions/scan", { force }, (event) => {
      if (event.type === "progress") {
        onProgress?.(event);
        return;
      }
      if (event.type === "error") {
        stop();
        reject(new Error(event.message));
        return;
      }
      stop();
      resolve(event);
    }).then(
      (unsub) => {
        // The scan can be over before the subscription handle arrives.
        if (settled) {
          unsub();
        } else {
          unsubscribe = unsub;
        }
      },
      (error) => {
        settled = true;
        reject(error);
      }
    );
  });
}
