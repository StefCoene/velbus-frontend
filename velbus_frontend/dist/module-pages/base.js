export function getModule(modules, address) {
  return modules.find((module) => module.address === address);
}

export function formatSource(slot) {
  if (slot.source_module_name) {
    const channelLabel =
      slot.source_channel_name ||
      (slot.source_channel != null ? `Channel ${slot.source_channel}` : "?");
    return `${slot.source_module_name} / ${channelLabel}`;
  }
  return `${slot.source_address}:${slot.source_channel ?? "?"}`;
}

export function formatSourceModule(slot) {
  return slot.source_module_name || `Address ${slot.source_address}`;
}

// What the module actually stores, for comparing against VelbusLink: the type,
// and the raw address and channel the slot holds. A subaddress shows here as
// itself, not as the primary address its name came from.
export function sourceTooltip(slot) {
  const address = `${slot.source_address}:${slot.source_channel ?? "?"}`;
  return slot.source_module_type
    ? `${slot.source_module_type} — ${address}`
    : address;
}

// The number stays visible next to the name: it is what the module itself
// stores, and what you compare against when reading a table in VelbusLink.
export function formatSourceChannel(slot) {
  if (slot.source_channel == null) {
    return "?";
  }
  return slot.source_channel_name
    ? `${slot.source_channel}: ${slot.source_channel_name}`
    : `${slot.source_channel}`;
}

export function sourceChannelOptions(modules, moduleAddress, selected) {
  const module = getModule(modules, moduleAddress);
  if (!module?.channels) {
    return "";
  }
  return Object.entries(module.channels)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([channel, info]) => {
      const label = info.name ? `${channel}. ${info.name}` : `Channel ${channel}`;
      const isSelected = Number(channel) === Number(selected) ? " selected" : "";
      return `<option value="${channel}"${isSelected}>${label}</option>`;
    })
    .join("");
}

// A module numbers its channels through, but everything above channel eight
// lives on a subaddress and is numbered from one again there. The action table
// stores what the bus uses, so a channel picked from the list has to be
// translated back before it is written.
export function busLocation(modules, moduleAddress, channel) {
  const info = getModule(modules, moduleAddress)?.channels?.[String(channel)];
  return {
    address: info?.bus_address ?? moduleAddress,
    channel: info?.bus_channel ?? channel,
  };
}

export function channelLabel(channel, sections, liveChannels) {
  const channelMeta = (
    sections.find((section) => section.type === "channels")?.channels || []
  ).find((entry) => entry.channel === channel);
  const live = liveChannels[String(channel)] || {};
  return live.name || channelMeta?.name || `Channel ${channel}`;
}

// The channel list leads with the number, so a name can be matched against the
// numbering VelbusLink and the action tables use. An unnamed channel already
// reads as "Channel 9" and is left alone.
export function numberedChannelLabel(channel, sections, liveChannels) {
  const label = channelLabel(channel, sections, liveChannels);
  return label === `Channel ${channel}` ? label : `${channel}. ${label}`;
}

export function findActionTable(sections) {
  return sections.find((section) => section.type === "action_table");
}

export function findChannelNames(sections) {
  return sections.find((section) => section.type === "channel_names");
}

export function findChannelEnable(sections) {
  return sections.find((section) => section.type === "channel_enable");
}

export function findContact(sections) {
  return sections.find((section) => section.type === "contact");
}

export function isProgrammedSlot(slot) {
  if (slot.empty) {
    return false;
  }
  const source = slot.source_address;
  return source != null && source !== 0 && source !== 255;
}

export function findAction(actionTable, key) {
  return (actionTable?.actions || []).find((action) => action.key === key);
}

// The byte a slot holds is an index into a fixed table of durations, so a
// label only exists by looking it up in the options the backend sent.
export function actionTimeLabel(actionTable, value) {
  const option = (actionTable?.time_options || []).find(
    (entry) => entry.value === value
  );
  return option ? option.label : `${value ?? ""}`;
}

// What a slot's times say, but only the ones its action actually uses: the
// remaining bytes are leftovers the module ignores.
export function actionTimeSummary(actionTable, slot) {
  const action = findAction(actionTable, slot.action_key);
  if (!action?.times) {
    return "";
  }
  return [slot.time1, slot.time2, slot.time3]
    .slice(0, action.times)
    .map((value) => actionTimeLabel(actionTable, value))
    .join(" / ");
}
