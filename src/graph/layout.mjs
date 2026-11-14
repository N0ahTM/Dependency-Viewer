import { components } from './cycles.mjs';

const COLUMN_GAP = 120;
const ROW_GAP = 28;

export function snapToGrid(value) {
  return Math.round(value / 24) * 24;
}

// Tarjan's algorithm groups cycles in one pass over the scene.
export function layout(graph, { width = 210, height = 64, positions = new Map() } = {}) {
  const links = new Map(graph.nodes.map(node => [node.id, []]));
  for (const edge of graph.edges) links.get(edge.source).push(edge.target);
  const component = components(links);
  const dependencies = new Map([...component.values()].map(id => [id, new Set()]));
  for (const edge of graph.edges) {
    const source = component.get(edge.source);
    const target = component.get(edge.target);
    if (source !== target) dependencies.get(source).add(target);
  }
  const ranks = new Map();
  function rank(id) {
    if (!ranks.has(id)) ranks.set(id, Math.max(0, ...[...dependencies.get(id)].map(next => rank(next) + 1)));
    return ranks.get(id);
  }

  const rankColumns = new Map();
  graph.nodes.forEach(node => {
    const column = rank(component.get(node.id));
    if (!rankColumns.has(column)) rankColumns.set(column, []);
    rankColumns.get(column).push(node);
  });
  const columns = [...rankColumns].sort(([a], [b]) => a - b).flatMap(([, members]) => {
    const chunkSize = Math.ceil(members.length / Math.ceil(members.length / 7));
    const chunks = [];
    for (let index = 0; index < members.length; index += chunkSize) chunks.push(members.slice(index, index + chunkSize));
    return chunks;
  });
  const maxRows = Math.max(1, ...columns.map(column => column.length));
  const nodes = [];
  for (const [column, rows] of columns.entries()) {
    rows.forEach((node, row) => {
      const position = positions.get(node.id) ?? {
        x: snapToGrid(column * (width + COLUMN_GAP)),
        y: snapToGrid((row + (maxRows - rows.length) / 2) * (height + ROW_GAP)),
      };
      nodes.push({ ...node, ...position, width, height });
    });
  }
  return {
    nodes,
    edges: graph.edges,
    left: Math.min(0, ...nodes.map(node => node.x)),
    top: Math.min(0, ...nodes.map(node => node.y)),
    right: Math.max(width, ...nodes.map(node => node.x + node.width)),
    bottom: Math.max(height, ...nodes.map(node => node.y + node.height)),
  };
}

export function connectionPath(source, target, y, endY, lane, diagram) {
  const endX = target.x + target.width;
  if (source.x > endX) {
    const x = source.x;
    const blocked = diagram.nodes.some(node => (
      node.x > endX && node.x + node.width < x &&
      node.y < Math.max(y, endY) + 8 && node.y + node.height > Math.min(y, endY) - 8
    ));
    if (blocked) {
      const outerY = (y + endY) / 2 < (diagram.top + diagram.bottom) / 2
        ? diagram.top - 15 - lane * 5
        : diagram.bottom + 15 + lane * 5;
      return { d: `M ${x} ${y} H ${x - 22 - lane % 7 * 5} V ${outerY} H ${endX + 22 + lane % 7 * 5} V ${endY} H ${endX}`, outerY };
    }
    const mid = (x + endX) / 2;
    return { d: `M ${x} ${y} C ${mid} ${y}, ${mid} ${endY}, ${endX} ${endY}` };
  }
  const x = source.x + source.width;
  const laneX = endX + 18 + lane % 12 * 7;
  if (source.x === target.x) return { d: `M ${x} ${y} H ${laneX} V ${endY} H ${endX}` };
  const outerY = diagram.top - 15 - lane * 5;
  return { d: `M ${x} ${y} H ${x + 18 + lane % 12 * 7} V ${outerY} H ${laneX} V ${endY} H ${endX}`, outerY };
}
