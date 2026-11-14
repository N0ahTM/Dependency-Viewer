import { cameraProgress } from './motion.mjs';

export function gridTile({ scale, x, y }) {
  const worldStep = 24 * 2 ** Math.ceil(Math.log2(24 / (24 * scale)));
  const spacing = worldStep * scale;
  const alpha = Math.max(0, Math.min(1, Math.log2(spacing / 24)));
  // The top-left dot of each tile is a world-grid intersection. The other
  // three dots fill in the next subdivision without moving existing points.
  const phase = value => ((value % spacing) + spacing) % spacing - spacing / 4;
  return { spacing, alpha, x: phase(x), y: phase(y) };
}

export function createZoomGrid(element) {
  const pattern = element.querySelector('pattern');
  const fine = element.querySelector('.grid-fine');
  const dots = [...element.querySelectorAll('circle')];
  let camera = { scale: 1, x: 0, y: 0 };
  let base = camera;
  let reference;
  let animation;

  function paint(projection) {
    const { spacing, alpha, x, y } = gridTile(projection);
    pattern.setAttribute('width', spacing);
    pattern.setAttribute('height', spacing);
    pattern.setAttribute('x', x);
    pattern.setAttribute('y', y);
    fine.setAttribute('opacity', alpha);
    for (const dot of dots) dot.setAttribute('r', 2.4 / spacing);
  }

  return {
    snapshot() { return { camera, base, reference }; },
    restore(snapshot) {
      ({ camera, base, reference } = snapshot);
      paint(camera);
    },
    rebase(factor = 1, anchor = { x: 0, y: 0 }) {
      animation?.cancel();
      reference = undefined;
      base = {
        scale: camera.scale * factor,
        x: anchor.x + (camera.x - anchor.x) * factor,
        y: anchor.y + (camera.y - anchor.y) * factor,
      };
      return camera;
    },
    update(scale, x, y) {
      if (!Number.isFinite(scale) || scale <= 0) return;
      reference ??= { scale, x, y };
      const ratio = scale / reference.scale;
      const next = {
        scale: base.scale * ratio,
        x: x + (base.x - reference.x) * ratio,
        y: y + (base.y - reference.y) * ratio,
      };
      if (next.scale === camera.scale && next.x === camera.x && next.y === camera.y) return;
      camera = next;
      if (!animation) paint(camera);
    },
    animateFrom(previous, timing) {
      if (previous === camera) return;
      const start = performance.now();
      let frame;
      let resolve;
      const finished = new Promise(done => { resolve = done; });
      const handle = { finished, cancel: finish, seek };
      function finish() {
        if (animation !== handle) return;
        cancelAnimationFrame(frame);
        animation = undefined;
        paint(camera);
        resolve();
      }
      function seek(progress) {
        const weight = progress === 0 || progress === 1 ? progress : cameraProgress(progress);
        paint({
          scale: previous.scale + (camera.scale - previous.scale) * weight,
          x: previous.x + (camera.x - previous.x) * weight,
          y: previous.y + (camera.y - previous.y) * weight,
        });
      }
      function draw(time) {
        const progress = Math.min(1, Math.max(0, (time - start) / timing.duration));
        if (progress === 1) { finish(); return; }
        seek(progress);
        frame = requestAnimationFrame(draw);
      }
      animation = handle;
      paint(previous);
      if (!timing.manual) frame = requestAnimationFrame(draw);
      return handle;
    },
  };
}
