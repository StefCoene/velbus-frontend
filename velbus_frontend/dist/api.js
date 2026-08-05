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

export async function loadActions(callWs, address, channel, refresh = true) {
  const result = await callWs("velbus/config_panel/module/actions/get", {
    address,
    channel,
    refresh,
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
  function subscribe(type, extra, onEvent) {
    return hass.connection.subscribeMessage(onEvent, {
      type,
      config_entry: configEntryId,
      ...extra,
    });
  }
  // Carried along so a subscriber can also notice the connection going away,
  // which is the one thing that never arrives as an event on the subscription
  // itself.
  subscribe.connection = hass.connection;
  return subscribe;
}

// Reading every action table is minutes of bus traffic, so the backend reports
// as it goes instead of answering once. This turns that back into a promise
// that settles on the last event, with the progress passed on meanwhile.
export function scanActions(
  subscribe,
  { force = false, addresses = null } = {},
  onProgress
) {
  return new Promise((resolve, reject) => {
    const connection = subscribe.connection;
    let unsubscribe = null;
    let settled = false;

    const stop = () => {
      settled = true;
      connection?.removeEventListener?.("disconnected", onDisconnected);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    // Home Assistant restarting, or the socket dropping, takes the scan with
    // it and no further event is coming. Without this the caller waits for a
    // result that can no longer arrive -- a progress bar frozen at whatever it
    // last reached.
    function onDisconnected() {
      if (settled) {
        return;
      }
      stop();
      reject(new Error("Lost the connection to Home Assistant; the read stopped"));
    }
    connection?.addEventListener?.("disconnected", onDisconnected);

    const request = addresses ? { force, addresses } : { force };
    subscribe("velbus/config_panel/actions/scan", request, (event) => {
      if (event.type === "progress") {
        // A caller that throws while drawing must not strand the read.
        try {
          onProgress?.(event);
        } catch (error) {
          console.error("Velbus: progress handler failed", error);
        }
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
