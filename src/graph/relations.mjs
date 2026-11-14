export function indexBy(items, key) {
  const index = new Map();
  for (const item of items) {
    const id = key(item);
    if (!index.has(id)) index.set(id, []);
    index.get(id).push(item);
  }
  return index;
}

export function relationIndex(edges) {
  return { outgoing: indexBy(edges, edge => edge.source), incoming: indexBy(edges, edge => edge.target) };
}

export function neighbors(index, id, depth) {
  const nodes = new Set([id]);
  const edges = new Set();
  let frontier = [id];
  for (let level = 0; level < depth; level++) {
    const next = [];
    for (const node of frontier) {
      for (const edge of [...(index.outgoing.get(node) ?? []), ...(index.incoming.get(node) ?? [])]) {
        edges.add(edge.id);
        const other = edge.source === node ? edge.target : edge.source;
        if (nodes.has(other)) continue;
        nodes.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  return { nodes, edges };
}

export function findPath(index, start, end) {
  const previous = new Map([[start, null]]);
  const queue = [start];
  for (let i = 0; i < queue.length && !previous.has(end); i++) {
    for (const edge of index.outgoing.get(queue[i]) ?? []) {
      if (previous.has(edge.target)) continue;
      previous.set(edge.target, edge);
      queue.push(edge.target);
    }
  }
  if (!previous.has(end)) return null;
  const result = [];
  for (let edge = previous.get(end); edge; edge = previous.get(edge.source)) result.push(edge);
  return result.reverse();
}
