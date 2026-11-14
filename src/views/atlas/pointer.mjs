export function bindAtlasPointer(input, actions) {
  let drag;
  let canClick = false;
  const controller = new AbortController();
  const listen = (type, listener) => input.addEventListener(type, listener, { signal: controller.signal });

  function position(event) {
    const { x, y, scale } = actions.getView();
    return { x: x + event.offsetX / scale, y: y + event.offsetY / scale, width: 0, height: 0 };
  }

  listen('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    canClick = false;
    actions.onStart();
    drag = { x: event.clientX, y: event.clientY, pointer: event.pointerId, start: { ...actions.getView() }, moved: false };
    input.setPointerCapture(event.pointerId);
  });
  listen('pointermove', event => {
    if (!drag && event.pointerType === 'mouse' && actions.canHover()) {
      const point = position(event);
      const node = actions.hitNode(point);
      const wire = node ? null : actions.hitWire(point);
      actions.hover(node, wire, event);
    }
    if (drag?.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved ||= Math.hypot(dx, dy) >= 5;
    if (!drag.moved) return;
    const { scale } = actions.getView();
    actions.pan(drag.start.x - dx / scale, drag.start.y - dy / scale);
  });
  listen('pointerleave', () => {
    actions.leave();
  });
  listen('pointerup', event => {
    if (drag?.pointer !== event.pointerId) return;
    canClick = !drag.moved;
    drag = null;
  });
  listen('click', event => {
    if (!canClick) return;
    canClick = false;
    const point = position(event);
    const hit = actions.hitNode(point);
    if (hit) actions.select(hit, event);
    else {
      const wire = actions.hitWire(point);
      if (wire) actions.inspect(wire, wire.fromNode, wire.toNode);
    }
  });
  listen('contextmenu', event => {
    if (!actions.pin) return;
    const point = position(event);
    const node = actions.hitNode(point);
    if (!node) return;
    event.preventDefault();
    actions.pin(node);
  });
  listen('lostpointercapture', () => { drag = null; });

  return { destroy() { controller.abort(); } };
}
