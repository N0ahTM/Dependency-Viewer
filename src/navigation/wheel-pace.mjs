export function createWheelPace() {
  let lastTime = -Infinity;
  let lastDirection = 0;
  let speed = 0;
  return function sample(delta, time) {
    const direction = Math.sign(delta);
    const elapsed = time - lastTime;
    const fresh = elapsed > 180 || direction !== lastDirection;
    const instant = Math.abs(delta) / (fresh ? 48 : Math.max(12, elapsed));
    speed = fresh ? instant : speed * .62 + instant * .38;
    lastTime = time;
    lastDirection = direction;
    return Math.round(295 - 150 * Math.max(0, Math.min(1, (speed - .5) / 5.5)));
  };
}
