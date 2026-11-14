import { spatialIndex } from '../../graph/spatial.mjs';

const midpoint = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

function segmentHits(a, b, box) {
  return Math.min(a.x, b.x) < box.x + box.width && Math.max(a.x, b.x) > box.x &&
    Math.min(a.y, b.y) < box.y + box.height && Math.max(a.y, b.y) > box.y;
}

function libraryRoute(source, target, from, to, boxes) {
  const xs = new Set([Math.round((from.x + to.x) / 2)]);
  const ys = new Set([Math.round((from.y + to.y) / 2)]);
  const nearby = boxes.length <= 20 ? boxes
    : boxes.filter(box => box === source || box === target || segmentHits(from, to, box));
  for (const box of nearby) {
    xs.add(box.x - 44); xs.add(box.x + box.width + 44);
    ys.add(box.y - 44); ys.add(box.y + box.height + 44);
  }
  let best;
  let lowest = Infinity;
  for (const x of xs) {
    if (x >= target.x && x <= target.x + target.width) continue;
    for (const y of ys) {
      if (y >= source.y && y <= source.y + source.height) continue;
      const start = { x: from.x, y: y < source.y ? source.y : source.y + source.height };
      const end = { x: x < target.x ? target.x : target.x + target.width, y: to.y };
      const route = [start, { x: from.x, y }, { x, y }, { x, y: to.y }, end];
      let cost = 0;
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i];
        cost += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        for (const box of boxes) {
          if (segmentHits(a, b, box)) cost += 100000;
        }
      }
      if (cost >= lowest) continue;
      best = route;
      lowest = cost;
    }
  }
  return best;
}

function routeCrossesBoxes(points, boxes) {
  return points.slice(1).some((point, index) => boxes.some(box => segmentHits(points[index], point, box)));
}

function routeBundle(source, target, from, to, boxes) {
  const direct = libraryRoute(source, target, from, to, boxes);
  if (!routeCrossesBoxes(direct, boxes)) return direct;
  const reverse = libraryRoute(target, source, to, from, boxes).reverse();
  return routeCrossesBoxes(reverse, boxes) ? direct : reverse;
}

function boxRoute(source, target, from, to) {
  const sourceRight = source.x + source.width;
  const targetRight = target.x + target.width;
  const forward = sourceRight <= target.x;
  const backward = targetRight <= source.x;
  if (forward || backward) {
    const a = { x: forward ? sourceRight : source.x, y: from.y };
    const b = { x: forward ? target.x : targetRight, y: to.y };
    const x = (a.x + b.x) / 2;
    return [a, { x, y: a.y }, { x, y: b.y }, b];
  }
  if (source.y + source.height <= target.y || target.y + target.height <= source.y) {
    const down = from.y < to.y;
    const a = { x: from.x, y: down ? source.y + source.height : source.y };
    const b = { x: to.x, y: down ? target.y : target.y + target.height };
    const y = (a.y + b.y) / 2;
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  return [from, to];
}

export function wireLayer(nodes, records, resolve, bundle = false) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const wires = new Map();
  const incident = new Map(nodes.map(node => [node.id, []]));
  for (const record of records) {
    const [source, target] = resolve(record);
    if (source === target || !byId.has(source) || !byId.has(target)) continue;
    const id = JSON.stringify([source, target]);
    if (!wires.has(id)) {
      const wire = { id, source, target, records: [], pairs: 0 };
      wires.set(id, wire);
      incident.get(source).push(wire);
      incident.get(target).push(wire);
    }
    const wire = wires.get(id);
    wire.pairs++;
    for (const evidence of record.records) wire.records.push(evidence);
  }
  for (const wire of wires.values()) {
    const source = byId.get(wire.source), target = byId.get(wire.target);
    wire.fromNode = source;
    wire.toNode = target;
    const from = midpoint(source), to = midpoint(target);
    if (bundle) {
      const outgoing = incident.get(source.id);
      const incoming = incident.get(target.id);
      from.x = source.x + source.width * (.18 + .64 * (outgoing.indexOf(wire) + 1) / (outgoing.length + 1));
      to.y = target.y + target.height * (.18 + .64 * (incoming.indexOf(wire) + 1) / (incoming.length + 1));
    }
    wire.points = bundle ? routeBundle(source, target, from, to, nodes)
      : boxRoute(source, target, from, to);
    const xs = wire.points.map(point => point.x);
    const ys = wire.points.map(point => point.y);
    wire.box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys) };
  }
  return { byId, incident, edges: wires, nodes: spatialIndex(nodes.map(node => ({ node, box: node }))),
    wires: spatialIndex(wires.values()) };
}
