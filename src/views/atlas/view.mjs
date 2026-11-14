import { bindAtlasPointer } from './pointer.mjs';
import { visibleSegments, wireAt } from './geometry.mjs';
import { createAtlasPainter } from './painter.mjs';
import { createMinimap } from './minimap.mjs';
import { wireLayer } from './routes.mjs';
import { cameraProgress } from '../../navigation/motion.mjs';

const center = node => ({ x: node.x + node.width / 2, y: node.y + node.height / 2 });

export function mountAtlas(host, arrangement, graph, links, callbacks) {
  const { bounds, libraries, groups, modules } = arrangement;
  const byId = new Map(modules.map(node => [node.id, node]));
  const libraryOf = id => byId.get(id).library;
  const groupOf = id => JSON.stringify([libraryOf(id), byId.get(id).group]);
  const layers = [
    wireLayer(libraries, links, edge => [edge.source, edge.target], true),
    wireLayer(groups, graph.edges, edge => [groupOf(edge.source), groupOf(edge.target)]),
    wireLayer(modules, graph.edges, edge => [edge.source, edge.target]),
  ];
  const bundles = wireLayer(libraries, graph.edges, edge => [libraryOf(edge.source), libraryOf(edge.target)], true);
  const canvas = document.createElement('canvas');
  canvas.className = 'atlas-surface';
  canvas.setAttribute('aria-hidden', 'true');
  const input = document.createElement('div');
  input.className = 'atlas-input';
  input.setAttribute('role', 'region');
  input.setAttribute('aria-label', 'Graph overview. Use search to find any module.');
  const tooltip = document.createElement('div');
  tooltip.className = 'atlas-tooltip';
  tooltip.hidden = true;
  host.style.overflow = 'hidden';
  const context = canvas.getContext('2d');
  host.replaceChildren(canvas, input, tooltip);
  const map = document.querySelector('#minimap');
  const minimap = createMinimap(map, bounds, libraries);
  map.hidden = false;
  let size = { width: 1, height: 1, dpr: 1 };
  let view = { x: bounds.x, y: bounds.y, scale: 1 };
  let frame = 0;
  let level = 0;
  let emphasis;
  let chosen;
  let flight;
  let fixedLevel = null;
  let showLines = false;
  let bitmap;
  let reportedLevel;
  let settled = true;
  let settleTimer;
  let border = 0;
  let displayedWires = [];
  let hovered;
  let hoveredWire;
  let activeEndpoints = new Set();
  const pins = callbacks.pins;
  const { drawWires, drawNode, drawLabel } = createAtlasPainter(context);
  const large = graph.edges.length > 8000;
  const maxWires = large ? 220 : 420;

  function request(repaint = false) {
    if (repaint) bitmap = null;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function changedCamera() {
    tooltip.hidden = true;
    if (hovered || hoveredWire) {
      hovered = hoveredWire = null;
      bitmap = null;
    }
    settled = false;
    canvas.style.willChange = 'transform';
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settled = true;
      canvas.style.willChange = '';
      request(true);
    }, 120);
    request();
  }

  function fitted() {
    const scale = Math.min(size.width / bounds.width, size.height / bounds.height);
    return { scale, x: bounds.x - (size.width / scale - bounds.width) / 2,
      y: bounds.y - (size.height / scale - bounds.height) / 2 };
  }

  function resize() {
    const rect = input.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    if (rect.width === size.width && rect.height === size.height && dpr === size.dpr) return;
    border = Math.round(Math.min(rect.width, rect.height) * .14);
    const width = rect.width + border * 2;
    const height = rect.height + border * 2;
    size = { width: rect.width, height: rect.height, dpr };
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    Object.assign(canvas.style, { width: width + 'px', height: height + 'px', left: -border + 'px', top: -border + 'px' });
    request(true);
  }

  function snapshot() {
    return { x: view.x, y: view.y, width: size.width / view.scale, height: size.height / view.scale };
  }

  function fit(animate = false) {
    const next = fitted();
    flight = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches
      ? { from: { ...view }, to: next, start: performance.now() } : null;
    if (!flight) view = next;
    request(!flight);
  }

  function zoom(factor, point = { x: size.width / 2, y: size.height / 2 }) {
    resize();
    flight = null;
    const old = view.scale;
    view.scale = Math.max(fitted().scale / 3, Math.min(3, old / factor));
    view.x += point.x * (1 / old - 1 / view.scale);
    view.y += point.y * (1 / old - 1 / view.scale);
    changedCamera();
  }

  function focus(id) {
    const node = byId.get(id) ?? layers[0].byId.get(id);
    if (!node) return;
    const point = center(node);
    flight = null;
    if (byId.has(id) && fixedLevel !== null && fixedLevel !== 2) {
      fixedLevel = 2;
      callbacks.mode?.(2);
    }
    const scale = byId.has(id) ? Math.max(view.scale, 0.65) : Math.max(view.scale, 0.23);
    view = { scale, x: point.x - size.width / (2 * scale), y: point.y - size.height / (2 * scale) };
    request(true);
  }

  function draw(time) {
    frame = 0;
    if (flight) {
      const raw = Math.min(1, (time - flight.start) / 180);
      const t = cameraProgress(raw);
      for (const key of ['x', 'y', 'scale']) view[key] = flight.from[key] + (flight.to[key] - flight.from[key]) * t;
      if (raw >= 1) {
        flight = null;
        bitmap = null;
      }
      else request();
    }
    const { scale } = view;
    callbacks.cameraScale?.(scale, -view.x * scale, -view.y * scale);
    // Switch only once the next level has enough screen space. A small
    // hysteresis keeps the scene stable at the boundary during wheel zoom.
    const groupWidth = 218 * scale;
    const moduleWidth = 180 * scale;
    const nextLevel = fixedLevel ?? (moduleWidth >= (level === 2 ? 78 : 90) ? 2
      : groupWidth >= (level >= 1 ? 31 : 38) ? 1 : 0);
    if (nextLevel !== reportedLevel) {
      callbacks.level(['Libraries', 'Module groups', 'C++ modules'][nextLevel]);
      reportedLevel = nextLevel;
    }
    const area = snapshot();
    if (bitmap?.level === nextLevel && bitmap.scale === scale && area.x >= bitmap.area.x && area.y >= bitmap.area.y &&
        area.x + area.width <= bitmap.area.x + bitmap.area.width &&
        area.y + area.height <= bitmap.area.y + bitmap.area.height) {
      const x = (bitmap.area.x - area.x) * scale + border;
      const y = (bitmap.area.y - area.y) * scale + border;
      const snap = value => Math.round(value * size.dpr) / size.dpr;
      canvas.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
      minimap.draw(area);
      return;
    }
    level = nextLevel;
    const current = layers[level];
    const margin = border / scale;
    const visible = { x: area.x - margin, y: area.y - margin, width: area.width + 2 * margin, height: area.height + 2 * margin };
    bitmap = { area: visible, scale, level };
    canvas.style.transform = '';
    const nodes = current.nodes(visible);
    const base = level === 0 ? current : bundles;
    const background = base.wires(visible);
    const localScale = level === 1 ? .32 : .65;
    if (level > 0 && showLines && scale >= localScale && settled && !flight) {
      const local = current.wires(visible).filter(wire => wire.fromNode.library === wire.toNode.library);
      // If the detail view is still dense, use the complete coarser view.
      if (local.length <= maxWires) background.push(...local);
    }
    const selected = level === 2 && emphasis ? [...emphasis.edges].map(id => current.edges.get(id)).filter(Boolean) : [];
    const preview = hoveredWire ? [hoveredWire] : hovered ? current.incident.get(hovered) ?? [] : [];
    const pinned = pins?.entries(['library', 'group', 'module'][level]);
    const pinnedWires = pinned ? [...pinned.keys()].flatMap(id => current.incident.get(id) ?? []) : [];
    const active = new Set([...selected, ...preview, ...pinnedWires]);
    activeEndpoints = new Set([...(pinned?.keys() ?? []), ...[...active].flatMap(wire => [wire.source, wire.target])]);
    const backgroundWires = visibleSegments(background.filter(wire => !active.has(wire)), visible);
    const highlighted = visibleSegments(active, visible);
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    context.clearRect(0, 0, size.width + border * 2, size.height + border * 2);
    context.scale(scale, scale);
    context.translate(-visible.x, -visible.y);

    if (level > 0) {
      context.fillStyle = '#131d29';
      context.strokeStyle = '#294659';
      context.lineWidth = 1 / scale;
      for (const node of layers[0].nodes(visible).map(item => item.node)) {
        context.fillRect(node.x, node.y, node.width, node.height);
        context.strokeRect(node.x, node.y, node.width, node.height);
        drawLabel(node.label, node.x + 24, node.y + 42, node.width - 48, 13, scale, '#adc7dd');
        context.fillStyle = '#131d29';
      }
    }
    if (level === 2 && scale >= .36) {
      context.strokeStyle = '#25423f';
      context.lineWidth = 1 / scale;
      for (const { node } of layers[1].nodes(visible)) {
        context.strokeRect(node.x, node.y, node.width, node.height);
        drawLabel(node.label, node.x + 12, node.y + 16, node.width - 24, 11, scale, '#8fc5b9');
      }
    }
    drawWires(backgroundWires, scale, false, activeEndpoints.size > 0 || hovered !== undefined);
    displayedWires = [...backgroundWires, ...highlighted];
    const nodeStyle = { chosen, hovered, activeEndpoints, level, emphasis, pins };
    for (const { node } of nodes) drawNode(node, scale, nodeStyle);
    if (highlighted.length) drawWires(highlighted, scale, true, false, pinned);
    minimap.draw(area);
  }

  map.onclick = event => {
    const point = minimap.getCenter(event);
    view.x = point.x - size.width / (2 * view.scale);
    view.y = point.y - size.height / (2 * view.scale);
    flight = null;
    changedCamera();
  };
  const pointer = bindAtlasPointer(input, {
    getView: () => view,
    canHover: () => !flight && settled,
    onStart() { flight = null; tooltip.hidden = true; },
    hitNode: point => layers[level].nodes(point)[0]?.node,
    hitWire: point => wireAt(point, displayedWires, view.scale),
    hover(node, wire, event) {
      if (hovered !== node?.id || hoveredWire !== wire) {
        hovered = node?.id;
        hoveredWire = wire;
        request(true);
      }
      tooltip.hidden = !node && !wire;
      if (node || wire) {
        tooltip.textContent = node ? (node.type === 'module' ? node.id : node.label)
          : `${wire.fromNode.label} uses ${wire.toNode.label}${wire.pairs > 1 ? ' · ' + wire.pairs + ' module pairs' : ''}`;
        tooltip.style.left = Math.max(8, Math.min(event.offsetX + 14, size.width - 310)) + 'px';
        tooltip.style.top = Math.max(8, Math.min(event.offsetY + 16, size.height - 52)) + 'px';
      }
    },
    leave() {
      tooltip.hidden = true;
      hovered = hoveredWire = null;
      request(true);
    },
    pan(x, y) {
      view.x = x;
      view.y = y;
      changedCamera();
    },
    select: callbacks.select,
    inspect: callbacks.inspect,
    pin: pins && (node => { pins.toggle(node); request(true); }),
  });
  const observer = new ResizeObserver(resize);
  observer.observe(input);
  window.addEventListener('resize', resize);
  resize();
  fit();
  return {
    paint() { cancelAnimationFrame(frame); draw(performance.now()); },
    fit, zoom, focus, snapshot,
    center(id) {
      const node = layers[0].byId.get(id) ?? layers[1].byId.get(id);
      if (!node) return;
      const point = center(node);
      view.x = point.x - size.width / (2 * view.scale);
      view.y = point.y - size.height / (2 * view.scale);
      request(true);
    },
    wheel(event, frameBounds, delta) {
      zoom(Math.exp(Math.max(-250, Math.min(250, delta)) * 0.002),
        { x: event.clientX - frameBounds.left, y: event.clientY - frameBounds.top });
    },
    setLevel(next) { fixedLevel = next; request(true); },
    showLines(show) { showLines = show; request(true); },
    restore(area) {
      view = { x: area.x, y: area.y, scale: size.width / area.width };
      changedCamera();
    },
    highlight(next, id) { emphasis = next; chosen = id; request(true); },
    destroy() {
      pointer.destroy();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      host.style.overflow = '';
      map.onclick = null;
      map.hidden = true;
    },
  };
}
