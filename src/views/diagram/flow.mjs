import { svgElement } from './svg.mjs';

export function startFlow(wire) {
  if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
  if (wire.querySelector('.hover-flow')) return;
  const path = wire.querySelector('.line').cloneNode(false);
  path.setAttribute('class', 'hover-flow');
  wire.append(path);
}

export function pulseOnce(wire, path) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  wire.querySelector('.pulse')?.remove();
  const dot = svgElement('circle', { class: 'pulse', r: 3.2 });
  dot.style.offsetPath = `path("${path}")`;
  wire.append(dot);
  const motion = dot.animate([{ offsetDistance: '100%' }, { offsetDistance: '0%' }], { duration: 850, easing: 'linear' });
  motion.finished.then(() => dot.remove(), () => dot.remove());
}
