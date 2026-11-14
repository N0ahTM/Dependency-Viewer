export function components(links) {
  const discovered = new Map();
  const stack = [];
  const active = new Set();
  const result = new Map();
  let order = 0;
  function visit(id) {
    const entry = { index: order, low: order };
    order++;
    discovered.set(id, entry);
    stack.push(id);
    active.add(id);
    for (const next of links.get(id)) {
      if (!discovered.has(next)) {
        visit(next);
        entry.low = Math.min(entry.low, discovered.get(next).low);
      } else if (active.has(next)) {
        entry.low = Math.min(entry.low, discovered.get(next).index);
      }
    }
    if (entry.low !== entry.index) return;
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      result.set(member, id);
    } while (member !== id);
  }
  for (const id of links.keys()) if (!discovered.has(id)) visit(id);
  return result;
}

export function cycleGroups(graph) {
  const links = new Map(graph.nodes.map(node => [node.id, []]));
  for (const edge of graph.edges) links.get(edge.source).push(edge.target);
  const groups = new Map();
  for (const [id, key] of components(links)) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.values()].filter(group => group.length > 1);
}
