const idleDelay = 180;
const confirmationDistance = 88;
const minimumPreviewTime = 45;

export function createWheelNavigation(showPreview) {
  let candidate;
  let distance = 0;
  let timer;
  let started = 0;
  let lastTime = -Infinity;
  let direction = 0;
  let peak = 0;

  function cancel() {
    clearTimeout(timer);
    if (candidate === undefined) return false;
    candidate = undefined;
    showPreview(undefined);
    return true;
  }

  function sample(target, delta, time) {
    const magnitude = Math.min(Math.abs(delta), 120);
    const sign = Math.sign(delta);
    if (time - lastTime >= idleDelay || sign !== direction) {
      cancel();
      peak = 0;
    }
    lastTime = time;
    direction = sign;
    peak = Math.max(peak, magnitude);
    if (target === undefined) {
      cancel();
      return false;
    }
    if (target !== candidate) {
      candidate = target;
      started = time;
      distance = 0;
      showPreview(target);
    } else if (magnitude >= Math.max(3, peak * .42)) {
      // A weak tail from a trackpad should not confirm a preview on its own.
      distance += magnitude;
      if (distance >= confirmationDistance && time - started >= minimumPreviewTime) {
        cancel();
        return true;
      }
    }
    clearTimeout(timer);
    timer = setTimeout(cancel, idleDelay);
    return false;
  }

  return { cancel, sample };
}
