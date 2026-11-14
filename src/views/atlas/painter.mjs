const colors = { library: '#638caf', group: '#73a99d', module: '#969cc7' };

export function createAtlasPainter(context) {
  const labels = new Map();

  function drawWires(wires, scale, highlight, dim = false, pinned) {
    if (highlight) {
      context.strokeStyle = '#0b111beb';
      context.lineWidth = 11 / scale;
      context.lineJoin = context.lineCap = 'round';
      context.beginPath();
      for (const { segments } of wires) traceSegments(segments);
      context.stroke();
    }
    context.strokeStyle = highlight ? '#c0edff' : dim ? '#38516a65' : '#6586a5a0';
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const { wire, segments } of wires) {
      const pinColor = pinned?.get(wire.source) ?? pinned?.get(wire.target);
      if (highlight) context.strokeStyle = pinColor ?? '#c0edff';
      const thickness = wire.pairs > 1 ? Math.min(4.5, 1.5 + Math.log2(wire.pairs) * .48) : 1.4;
      context.lineWidth = (highlight ? Math.max(2.4, thickness) : thickness) / scale;
      context.beginPath();
      traceSegments(segments);
      context.stroke();
      if (!highlight) continue;
      const from = wire.points[0];
      const to = wire.points.at(-1);
      context.beginPath();
      context.arc(from.x, from.y, 3.3 / scale, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(to.x, to.y, 3.3 / scale, 0, Math.PI * 2);
      context.fillStyle = pinColor ?? '#c0edff';
      context.fill();
    }
  }

  function traceSegments(segments) {
    let endX, endY;
    for (const [x, y, nextX, nextY] of segments) {
      if (endX !== x || endY !== y) context.moveTo(x, y);
      context.lineTo(nextX, nextY);
      endX = nextX;
      endY = nextY;
    }
  }

  function drawNode(node, scale, { chosen, hovered, activeEndpoints, level, emphasis, pins }) {
    const active = chosen === node.id || hovered === node.id || activeEndpoints.has(node.id) ||
      (level === 2 && emphasis?.nodes.has(node.id));
    const hasHighlight = hovered !== undefined || activeEndpoints.size > 0 || (level === 2 && emphasis);
    context.globalAlpha = hasHighlight && !active ? 0.34 : 1;
    context.fillStyle = active ? '#26465d' : level === 2 ? '#22263c' : '#192b39';
    context.fillRect(node.x, node.y, node.width, node.height);
    context.strokeStyle = pins?.color(node) ?? (active ? '#c3edff' : colors[node.type]);
    context.lineWidth = (active ? 2 : 1) / scale;
    context.strokeRect(node.x, node.y, node.width, node.height);
    const screenWidth = node.width * scale;
    const screenHeight = node.height * scale;
    if (screenHeight >= 15 && (screenWidth >= 47 || active)) {
      const fontSize = level === 0 ? 15 : level === 1 ? 12 : 11;
      drawLabel(node.label, node.x + 8 / scale, node.y + node.height / 2,
        node.width - 16 / scale, fontSize, scale, '#e7f0f8');
    }
    context.globalAlpha = 1;
  }

  function drawLabel(text, x, y, width, fontSize, scale, color) {
    const pixels = Math.floor(width * scale / 4) * 4;
    if (pixels < 16) return;
    const key = JSON.stringify([text, fontSize, pixels]);
    context.save();
    context.translate(x, y);
    context.scale(1 / scale, 1 / scale);
    context.font = '600 ' + fontSize + 'px system-ui';
    context.fillStyle = color;
    context.textBaseline = 'middle';
    let label = labels.get(key);
    if (label === undefined) {
      label = text;
      if (context.measureText(label).width > pixels) {
        do { label = label.slice(0, -1); }
        while (label.length && context.measureText(label + '…').width > pixels);
        label += '…';
      }
      if (labels.size >= 2048) labels.clear();
      labels.set(key, label);
    }
    context.fillText(label, 0, 0);
    context.restore();
  }

  return { drawWires, drawNode, drawLabel };
}
