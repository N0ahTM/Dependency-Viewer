const easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// CSS cubic-bezier(.77, 0, .175, 1) evaluated for the Canvas camera.
export function cameraProgress(time) {
  const curve = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 15; i++) {
    const t = (low + high) / 2;
    if (curve(.77, .175, t) < time) low = t;
    else high = t;
  }
  return curve(0, 1, (low + high) / 2);
}

export function screenRect(svg, area = svg.viewBox.baseVal) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return svg.getBoundingClientRect();
  const a = new DOMPoint(area.x, area.y).matrixTransform(matrix);
  const b = new DOMPoint(area.x + area.width, area.y + area.height).matrixTransform(matrix);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

export function transitionGraph(host, previous, next, from, destination, reverse, { duration = 290, animateGrid, interactive, fadeOnly } = {}) {
  const moving = reverse ? previous : next;
  const base = reverse ? from : destination;
  const tiny = reverse ? destination : from;
  const reduced = reducedMotion();
  const timings = { duration: reduced ? 100 : duration, easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
    fill: 'both', direction: reverse ? 'reverse' : 'normal' };
  const flights = [];
  const parent = reverse ? next : previous;
  if (previous) {
    previous.classList.add('departing');
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
    if (!interactive) host.prepend(previous);
  }
  if (!reduced && !fadeOnly && moving && base?.width && base.height && tiny?.width && tiny.height) {
    const transform = `translate(${tiny.left - base.left}px, ${tiny.top - base.top}px) scale(${tiny.width / base.width}, ${tiny.height / base.height})`;
    moving.style.transformOrigin = `${base.left}px ${base.top}px`;
    moving.style.zIndex = '1';
    moving.classList.add('in-flight');
    flights.push(moving.animate([{ transform, opacity: 0 }, { transform: 'none', opacity: 1 }], timings));
  } else if (moving) {
    const frames = reduced || fadeOnly ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: 'scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }];
    flights.push(moving.animate(frames, timings));
  }
  if (parent) flights.push(parent.animate([{ opacity: 1 }, { opacity: 0 }], timings));
  const gridFlight = reduced ? undefined : animateGrid?.({ ...timings, direction: 'normal', manual: Boolean(interactive) });
  let finished = false;
  function finish(arrived = true) {
    if (finished) return;
    finished = true;
    for (const flight of flights) flight.cancel();
    gridFlight?.cancel();
    if (moving) {
      moving.style.transformOrigin = '';
      moving.style.zIndex = '';
      moving.classList.remove('in-flight');
    }
    if (arrived) previous?.remove();
    else if (previous) {
      previous.classList.remove('departing');
      previous.inert = false;
      previous.removeAttribute('aria-hidden');
    }
  }
  if (interactive) {
    return driveTransition(flights, gridFlight, timings.duration, arrived => {
      finish(arrived);
      interactive(arrived);
    });
  }
  const running = gridFlight ? [...flights, gridFlight] : flights;
  Promise.allSettled(running.map(flight => flight.finished)).then(() => finish());
  return finish;
}

function driveTransition(flights, grid, duration, finish) {
  let progress = 0;
  let target = 1;
  let lastTime = performance.now();
  let frame;
  for (const flight of flights) {
    flight.pause();
    flight.currentTime = 0;
  }

  function draw(time) {
    const step = Math.max(0, time - lastTime) / duration;
    lastTime = time;
    progress = target ? Math.min(1, progress + step) : Math.max(0, progress - step);
    for (const flight of flights) flight.currentTime = progress * duration;
    grid?.seek(progress);
    if (progress === target) finish(target === 1);
    else frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return {
    aim(forward) { target = forward ? 1 : 0; },
    cancel() { cancelAnimationFrame(frame); finish(false); },
  };
}

export function slideScene(previous, next, direction) {
  const reduced = reducedMotion();
  previous.classList.add('departing');
  previous.inert = true;
  previous.setAttribute('aria-hidden', 'true');
  const timing = { duration: reduced ? 100 : 240, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'both' };
  const outgoing = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
    { transform: 'translateX(0)', opacity: 1 },
    { transform: `translateX(${-direction * 16}%)`, opacity: 0 },
  ];
  const incoming = reduced ? [{ opacity: .35 }, { opacity: 1 }] : [
    { transform: `translateX(${direction * 24}%)`, opacity: 0 },
    { transform: 'translateX(0)', opacity: 1 },
  ];
  const animations = [previous.animate(outgoing, timing), next.animate(incoming, timing)];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    animations.forEach(animation => animation.cancel());
    previous.remove();
  };
  Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  return finish;
}
