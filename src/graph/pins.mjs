const palette = ['#ffbc78', '#daabff', '#86e4ad', '#ff9fbf', '#f0df82', '#8ae0e2', '#aab7ff', '#ff9d85'];

export function createPins() {
  const groups = { library: new Map(), group: new Map(), module: new Map() };
  // The overview identifies groups by both library and group name.
  const key = node => node.type === 'group' ? JSON.stringify([node.library, node.group]) : node.id;
  return {
    color(node) { return groups[node.type].get(key(node)); },
    entries(type) { return groups[type]; },
    toggle(node) {
      const pins = groups[node.type];
      const id = key(node);
      if (pins.delete(id)) return;
      const used = new Set(Object.values(groups).flatMap(group => [...group.values()]));
      const available = palette.filter(color => !used.has(color));
      const choices = available.length ? available : palette;
      pins.set(id, choices[Math.floor(Math.random() * choices.length)]);
    },
    clear() { for (const pins of Object.values(groups)) pins.clear(); },
  };
}
