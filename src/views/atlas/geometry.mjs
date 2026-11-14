function clipLine(from, to, area) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let first = 0;
  let last = 1;
  const sides = [
    [-dx, from.x - area.x], [dx, area.x + area.width - from.x],
    [-dy, from.y - area.y], [dy, area.y + area.height - from.y],
  ];
  for (const [direction, gap] of sides) {
    if (direction === 0) {
      if (gap < 0) return null;
      continue;
    }
    const t = gap / direction;
    if (direction < 0) first = Math.max(first, t);
    else last = Math.min(last, t);
    if (first > last) return null;
  }
  return [from.x + first * dx, from.y + first * dy, from.x + last * dx, from.y + last * dy];
}

export function visibleSegments(wires, visible) {
  const result = [];
  for (const wire of wires) {
    const segments = [];
    for (let i = 1; i < wire.points.length; i++) {
      const points = clipLine(wire.points[i - 1], wire.points[i], visible);
      if (points) segments.push(points);
    }
    if (segments.length) result.push({ wire, segments });
  }
  return result;
}

export function wireAt(point, displayedWires, scale) {
  const radius = 7 / scale;
  let best;
  let distance = radius;
  for (const { wire, segments } of displayedWires) {
    for (const [x, y, endX, endY] of segments) {
      const dx = endX - x;
      const dy = endY - y;
      const squared = dx * dx + dy * dy;
      if (!squared) continue;
      const t = Math.max(0, Math.min(1, ((point.x - x) * dx + (point.y - y) * dy) / squared));
      const gap = Math.hypot(point.x - x - dx * t, point.y - y - dy * t);
      if (gap >= distance) continue;
      distance = gap;
      best = wire;
    }
  }
  return best;
}
