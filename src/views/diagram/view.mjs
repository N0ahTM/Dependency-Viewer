import { svgElement, activate, setView } from './svg.mjs';
import { startFlow, pulseOnce } from './flow.mjs';
import { connectionPath, layout } from '../../graph/layout.mjs';
import { icon } from '../../ui/icons.mjs';

const padding = 28;
let previewClipId = 0;

function labelLines(label, limit) {
  const parts = label.match(/[^ .:/_\\]+[ .:/_\\]*|[ .:/_\\]+/g) ?? [label];
  const lines = [];
  let line = '';
  for (let part of parts) {
    if (line && line.length + part.length > limit) {
      lines.push(line.trimEnd());
      line = '';
    }
    while (part.length > limit) {
      lines.push(part.slice(0, limit));
      part = part.slice(limit);
    }
    line += part;
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

export function drawGraph(graph, options = {}) {
  const miniature = !options.open;
  const preview = options.preview;
  const sizes = preview ? { width: 230, height: 138 } : {};
  const prepared = options.diagram ?? layout(graph, { ...sizes, positions: options.positions });
  const diagram = { ...prepared, nodes: prepared.nodes.map(node => ({ ...node })) };
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const svg = svgElement('svg', { class: miniature ? 'miniature' : 'diagram' });
  svg.setAttribute('aria-label', graph.title);
  if (miniature) svg.setAttribute('aria-hidden', 'true');
  const wires = svgElement('g', { class: 'wires' });
  const cards = svgElement('g', { class: 'cards' });
  svg.append(wires, cards);
  const pins = options.pins;
  let hoveredCard;

  const ports = new Map(diagram.nodes.map(node => [node.id, { left: [], right: [] }]));
  const routes = [];
  const incidentRoutes = new Map(diagram.nodes.map(node => [node.id, []]));
  for (const edge of diagram.edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const forward = source.x > target.x + target.width;
    const outgoing = ports.get(source.id)[forward ? 'left' : 'right'];
    const incoming = ports.get(target.id).right;
    const route = { edge, source, target, outgoing, incoming };
    routes.push(route);
    incidentRoutes.get(source.id).push(route);
    if (target !== source) incidentRoutes.get(target.id).push(route);
    outgoing.push(route);
    incoming.push(route);
  }
  const portY = (node, list, route) => node.y + node.height * (list.indexOf(route) + 1) / (list.length + 1);
  let top = diagram.top;
  let bottom = diagram.bottom;
  for (const [lane, route] of routes.entries()) {
    const { edge, source, target, outgoing, incoming } = route;
    const { d, outerY } = connectionPath(source, target, portY(source, outgoing, route), portY(target, incoming, route), lane, diagram);
    if (outerY !== undefined) {
      top = Math.min(top, outerY);
      bottom = Math.max(bottom, outerY);
    }
    const wire = svgElement('g', { class: 'wire' });
    route.wire = wire;
    route.lane = lane;
    wire.append(svgElement('path', { d, class: 'line' }));
    if (!miniature) {
      wire.dataset.edgeId = edge.id;
      wire.append(svgElement('path', { d, class: 'hit' }));
      activate(wire, `${source.label} uses ${target.label}`, event => {
        if (event.type === 'click') pulseOnce(wire, wire.querySelector('.line').getAttribute('d'));
        options.inspectEdge(edge, source, target);
      });
      wire.addEventListener('pointerenter', event => {
        setEndpoints(true);
        if (event.pointerType === 'mouse') startFlow(wire);
      });
      wire.addEventListener('pointerleave', () => {
        setEndpoints(false);
        wire.querySelector('.hover-flow')?.remove();
      });
      wire.addEventListener('focus', () => setEndpoints(true));
      wire.addEventListener('blur', () => setEndpoints(false));
      function setEndpoints(active) {
        cardElements.get(source.id)?.classList.toggle('endpoint', active);
        cardElements.get(target.id)?.classList.toggle('endpoint', active);
      }
    }
    wires.append(wire);
  }

  const cardElements = new Map();
  for (const node of diagram.nodes) {
    const card = svgElement('g', { class: 'card ' + node.type, transform: `translate(${node.x} ${node.y})` });
    card.append(svgElement('rect', { class: 'box', width: node.width, height: node.height, rx: 9 }));
    const labelX = miniature ? 14 : 37;
    const available = node.width - labelX - (node.next && !miniature ? 36 : 12);
    const rows = node.next ? 2 : 3;
    const lines = labelLines(node.label, Math.floor(available / 8.7));
    const fitting = lines.slice(0, rows - 1);
    fitting.push(lines.slice(rows - 1).join(''));
    const label = svgElement('text', { x: labelX, y: fitting.length > 1 ? 20 : 27, class: 'label' });
    for (const [index, line] of fitting.entries()) {
      const span = svgElement('tspan', { x: labelX, dy: index ? 15 : 0 }, line);
      if (line.length * 8.7 > available) {
        span.setAttribute('textLength', available);
        span.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      label.append(span);
    }
    card.append(svgElement('title', {}, node.label), label);
    if (!miniature) {
      const symbol = icon(node.type, 'card-icon');
      for (const [key, value] of Object.entries({ x: 13, y: 12, width: 17, height: 17 })) symbol.setAttribute(key, value);
      card.append(symbol);
    }
    const mini = preview?.(node);
    if (mini) {
      card.append(svgElement('rect', { class: 'preview-box', x: 12, y: 40, width: node.width - 24, height: 88, rx: 6 }));
      const id = 'preview-clip-' + ++previewClipId;
      const clip = svgElement('clipPath', { id });
      clip.append(svgElement('rect', { x: 13, y: 41, width: node.width - 26, height: 86, rx: 5 }));
      for (const [key, value] of Object.entries({ x: 17, y: 44, width: node.width - 34, height: 80 })) {
        mini.svg.setAttribute(key, value);
      }
      const previewContent = svgElement('g', { class: 'preview-content', 'clip-path': `url(#${id})` });
      previewContent.append(mini.svg);
      card.append(clip, previewContent);
    }
    if (!miniature) {
      card.dataset.nodeId = node.id;
      cardElements.set(node.id, card);
      activate(card, node.label, event => options.open(node, event));
      const incident = incidentRoutes.get(node.id);
      function highlightHover(event) {
        if (event.pointerType !== 'mouse') return;
        showNeighbors(node.id);
        for (const { wire } of incident) wire.classList.add('related');
        for (const { wire } of incident.slice(0, 6)) startFlow(wire);
      }
      card.addEventListener('pointerenter', highlightHover);
      card.addEventListener('pointerleave', event => {
        const info = event.relatedTarget?.closest?.('.node-info');
        if (info && info === card.nextElementSibling) return;
        clearHover();
      });
      function clearHover() {
        if (hoveredCard === node.id) showNeighbors(undefined);
        for (const { wire } of incident) {
          wire.classList.remove('related');
          wire.querySelector('.hover-flow')?.remove();
        }
      }
      function togglePin(event) {
        event.preventDefault();
        pins.toggle(node);
        paintPins();
      }
      if (pins) card.addEventListener('contextmenu', togglePin);
      if (node.next) {
        const info = svgElement('g', { class: 'node-info' });
        info.append(svgElement('rect', { width: 22, height: 22, rx: 5 }));
        info.append(svgElement('text', { x: 11, y: 15 }, 'i'));
        // Keep the info button out of the card's keyboard and click target.
        info.setAttribute('transform', `translate(${node.x + node.width - 32} ${node.y + 12})`);
        activate(info, 'Source locations for ' + node.label, () => options.inspectNode(node));
        info.addEventListener('pointerenter', highlightHover);
        info.addEventListener('pointerleave', clearHover);
        if (pins) info.addEventListener('contextmenu', togglePin);
        cards.append(card, info);
        continue;
      }
    }
    cards.append(card);
  }

  function showNeighbors(id) {
    hoveredCard = id;
    const incident = incidentRoutes.get(id) ?? [];
    const neighbors = new Set([id, ...incident.flatMap(({ edge }) => [edge.source, edge.target])]);
    svg.classList.toggle('show-neighbors', id !== undefined);
    for (const [key, card] of cardElements) card.classList.toggle('hover-neighbor', neighbors.has(key));
    const highlighted = new Set(incident);
    for (const route of routes) route.wire.classList.toggle('hover-neighbor', highlighted.has(route));
  }

  function paintPins() {
    const neighbors = new Set();
    for (const { wire, source, target } of routes) {
      const color = pins.color(source) ?? pins.color(target);
      wire.classList.toggle('pinned', Boolean(color));
      if (color) {
        wire.style.setProperty('--pin-color', color);
        neighbors.add(source.id);
        neighbors.add(target.id);
      } else wire.style.removeProperty('--pin-color');
    }
    for (const [id, card] of cardElements) {
      const color = pins.color(byId.get(id));
      card.classList.toggle('pinned', Boolean(color));
      card.classList.toggle('pin-neighbor', neighbors.has(id));
      if (color) card.style.setProperty('--pin-color', color);
      else card.style.removeProperty('--pin-color');
    }
  }
  if (pins) paintPins();

  const bounds = {
    x: diagram.left - padding, y: top - padding,
    width: diagram.right - diagram.left + padding * 2 + 104,
    height: bottom - top + padding * 2,
  };
  setView(svg, bounds);
  function move(id, position, commit = false) {
    const node = byId.get(id);
    Object.assign(node, position);
    const card = cardElements.get(id);
    card.setAttribute('transform', `translate(${node.x} ${node.y})`);
    if (node.next) card.nextElementSibling.setAttribute('transform', `translate(${node.x + node.width - 32} ${node.y + 12})`);
    const extents = {
      nodes: diagram.nodes,
      top: Math.min(diagram.top, node.y),
      bottom: Math.max(diagram.bottom, node.y + node.height),
    };
    for (const route of incidentRoutes.get(id)) {
      const { source, target, outgoing, incoming, lane, wire } = route;
      const { d } = connectionPath(source, target, portY(source, outgoing, route), portY(target, incoming, route), lane, extents);
      for (const path of wire.querySelectorAll('path')) path.setAttribute('d', d);
      route.wire.querySelector('.pulse')?.remove();
      route.wire.querySelector('.hover-flow')?.remove();
    }
    if (!commit) return;
    const right = Math.max(bounds.x + bounds.width, node.x + node.width + 104);
    const bottom = Math.max(bounds.y + bounds.height, extents.bottom + padding + routes.length * 5);
    bounds.x = Math.min(bounds.x, node.x - padding);
    bounds.y = Math.min(bounds.y, extents.top - padding - routes.length * 5);
    bounds.width = right - bounds.x;
    bounds.height = bottom - bounds.y;
  }
  return { svg, bounds, nodes: byId, move };
}
