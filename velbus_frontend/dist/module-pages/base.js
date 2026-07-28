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

export function sourceChannelOptions(modules, moduleAddress) {
  const module = getModule(modules, moduleAddress);
  if (!module?.channels) {
    return "";
  }
  return Object.entries(module.channels)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([channel, info]) => {
      const label = info.name || `Channel ${channel}`;
      return `<option value="${channel}">${label}</option>`;
    })
    .join("");
}

export function channelLabel(channel, sections, liveChannels) {
  const channelMeta = (
    sections.find((section) => section.type === "channels")?.channels || []
  ).find((entry) => entry.channel === channel);
  const live = liveChannels[String(channel)] || {};
  return live.name || channelMeta?.name || `Channel ${channel}`;
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
