import { setView } from './svg.mjs';
import { snapToGrid } from '../../graph/layout.mjs';
import { reducedMotion } from '../../navigation/motion.mjs';
import { pinPoint, projectCamera, unproject } from '../../navigation/camera.mjs';

export function enableViewport(svg, bounds, { initialView, nodes, previewMove, move, wheelNavigation, cameraScale }) {
  let view = { ...(initialView ?? bounds) };
  let drag = null;
  let frame = 0;
  let flight;
  let dragFrame = 0;
  let suppressClick = false;
  function draw() {
    setView(svg, view);
    svg.classList.toggle('labels-small', svg.clientWidth / view.width < 0.48);
    const { scale, x, y } = projectCamera(view, svg.clientWidth, svg.clientHeight);
    cameraScale?.(scale, x, y);
  }
  function requestDraw() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; draw(); });
  }
  function stopFlight() {
    flight?.cancel();
    flight = null;
  }
  const world = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());

  function zoom(factor, point = { x: view.x + view.width / 2, y: view.y + view.height / 2 }) {
    stopFlight();
    const width = Math.max(bounds.width / 10, Math.min(bounds.width * 3, view.width * factor));
    const scale = width / view.width;
    view = {
      x: point.x + (view.x - point.x) * scale,
      y: point.y + (view.y - point.y) * scale,
      width, height: view.height * scale,
    };
    requestDraw();
  }

  function wheel(event, frameBounds, delta, { navigate = true, aroundCenter = false } = {}) {
    const factor = Math.exp(Math.max(-250, Math.min(250, delta)) * 0.002);
    if (aroundCenter) {
      zoom(factor);
      return;
    }
    // Use the live camera, independently of the outgoing scene and its CSS transform.
    const camera = projectCamera(view, frameBounds.width, frameBounds.height);
    if (!(camera.scale > 0)) return;
    const screen = { x: event.clientX, y: event.clientY };
    const point = unproject(camera, { x: screen.x - frameBounds.left, y: screen.y - frameBounds.top });
    zoom(factor, point);
    if (!navigate || !wheelNavigation) return;
    const node = delta < 0 ? [...nodes.values()].find(candidate =>
      point.x >= candidate.x && point.x <= candidate.x + candidate.width &&
      point.y >= candidate.y && point.y <= candidate.y + candidate.height) : undefined;
    const scale = Math.min(svg.clientWidth / view.width, svg.clientHeight / view.height);
    wheelNavigation({
      delta,
      time: event.timeStamp,
      screen,
      node,
      viewportShare: node ? node.width * scale / svg.clientWidth : 0,
      zoomedOut: view.width / bounds.width,
    });
  }
  svg.addEventListener('pointerdown', event => {
    stopFlight();
    if (event.button !== 0 || !event.isPrimary) return;
    const card = event.target.closest('[data-node-id]');
    if (!card && event.target.closest('[role="button"]')) return;
    const node = card ? nodes.get(card.dataset.nodeId) : null;
    suppressClick = false;
    drag = { x: event.clientX, y: event.clientY, card, node, pointer: event.pointerId, moved: false,
      origin: node && { x: node.x, y: node.y } };
    if (!card) svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    if (drag.card && !svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    const before = world(drag.x, drag.y);
    const after = world(event.clientX, event.clientY);
    if (drag.node) {
      drag.position = {
        x: snapToGrid(drag.origin.x + after.x - before.x),
        y: snapToGrid(drag.origin.y + after.y - before.y),
      };
      if (!dragFrame) dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        if (drag?.position) previewMove(drag.node.id, drag.position);
      });
      return;
    }
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    requestDraw();
  });
  svg.addEventListener('pointerup', event => {
    if (drag?.pointer !== event.pointerId) return;
    const finished = drag;
    drag = null;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    if (!finished.position) return;
    suppressClick = true;
    const { node, position } = finished;
    const overlap = [...nodes.values()].some(other => (
      other.id !== node.id && position.x < other.x + other.width && position.x + node.width > other.x &&
      position.y < other.y + other.height && position.y + node.height > other.y
    ));
    if (!overlap) move(node.id, position, view);
    else previewMove(node.id, finished.origin);
  });
  function cancelDrag() {
    if (drag?.node && drag.position) previewMove(drag.node.id, drag.origin);
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    drag = null;
  }
  svg.addEventListener('pointercancel', cancelDrag);
  svg.addEventListener('lostpointercapture', cancelDrag);
  svg.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.stopImmediatePropagation();
  }, true);
  draw();
  return {
    zoom, wheel,
    paint() { cancelAnimationFrame(frame); frame = 0; draw(); },
    pin(point, screen) {
      const rect = svg.getBoundingClientRect();
      const camera = projectCamera(view, svg.clientWidth, svg.clientHeight);
      view = pinPoint(view, camera, point, { x: screen.x - rect.left, y: screen.y - rect.top });
      draw();
    },
    contentBounds: bounds,
    snapshot() { return { ...view }; },
    center(id) {
      const node = nodes.get(id);
      if (!node) return;
      view.x = node.x + (node.width - view.width) / 2;
      view.y = node.y + (node.height - view.height) / 2;
      draw();
    },
    focus(id) {
      const node = nodes.get(id);
      if (!node) return;
      const width = Math.min(view.width, node.width * 3.4);
      const height = width * view.height / view.width;
      view = { x: node.x + (node.width - width) / 2, y: node.y + (node.height - height) / 2, width, height };
      draw();
    },
    fit(animate) {
      stopFlight();
      const old = svg.getScreenCTM();
      view = { ...bounds };
      draw();
      const next = svg.getScreenCTM();
      if (!animate || reducedMotion() || !old || !next) return;
      const scale = old.a / next.a;
      flight = svg.animate([
        { transformOrigin: '0 0', transform: `translate(${old.e - next.e * scale}px, ${old.f - next.f * scale}px) scale(${scale})` },
        { transformOrigin: '0 0', transform: 'none' },
      ], { duration: 180, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
    },
    destroy() { stopFlight(); cancelAnimationFrame(frame); cancelDrag(); },
  };
}
