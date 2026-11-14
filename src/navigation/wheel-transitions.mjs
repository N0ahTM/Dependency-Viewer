import { transitionGraph } from './motion.mjs';
import { relativePoint } from './camera.mjs';

export function createWheelTransitions({ host, grid, mountGraph, getViewport, getPreviewRect, onArrival }) {
  let transition;

  function start(to, { reverse, screen, parentId, childId, duration }) {
    const source = getViewport();
    source.paint();
    const outgoing = host.firstElementChild;
    const previous = outgoing.querySelector('.diagram');
    const from = reverse ? null : getPreviewRect(childId);
    const savedGrid = grid.snapshot();
    const panel = document.createElement('div');
    panel.className = 'graph-scene';
    panel.inert = true;
    host.append(panel);
    const incoming = mountGraph(panel, to);
    if (reverse) incoming.viewport.center(parentId);
    else if (from?.width && from.height) {
      const relative = relativePoint(from, screen);
      const bounds = incoming.viewport.contentBounds;
      incoming.viewport.pin({ x: bounds.x + relative.x * bounds.width, y: bounds.y + relative.y * bounds.height }, screen);
    }
    // Start the new scene at the same grid projection. Only wheel input moves it.
    grid.restore(savedGrid);
    grid.rebase();
    incoming.viewport.paint();
    const driver = transitionGraph(host, previous, incoming.svg, null, null, reverse, {
      duration,
      fadeOnly: true,
      interactive(arrived) {
        transition = undefined;
        if (!arrived) {
          incoming.viewport.destroy();
          panel.remove();
          grid.restore(savedGrid);
          return;
        }
        const previousView = source.snapshot();
        source.destroy();
        outgoing.remove();
        onArrival({ to, panel, incoming, previousView });
      },
    });
    transition = { driver, camera: incoming.viewport, direction: reverse ? 1 : -1 };
  }

  function handleWheel(event, bounds, delta) {
    if (!transition) return false;
    const forward = Math.sign(delta) === transition.direction;
    transition.driver.aim(forward);
    if (forward) {
      transition.camera.wheel(event, bounds, delta, {
        navigate: false, aroundCenter: transition.direction > 0,
      });
    }
    return true;
  }

  return {
    start,
    handleWheel,
    reverse() {
      if (!transition) return false;
      transition.driver.aim(false);
      return true;
    },
    cancel() { transition?.driver.cancel(); },
  };
}
