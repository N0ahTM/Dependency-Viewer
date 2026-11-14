export function projectCamera(view, width, height) {
  const scale = Math.min(width / view.width, height / view.height);
  return {
    scale,
    x: (width - view.width * scale) / 2 - view.x * scale,
    y: (height - view.height * scale) / 2 - view.y * scale,
  };
}

export function unproject(camera, point) {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
}

export function pinPoint(view, camera, point, screen) {
  const current = unproject(camera, screen);
  return { ...view, x: view.x + point.x - current.x, y: view.y + point.y - current.y };
}

export function relativePoint(rect, point) {
  return { x: (point.x - rect.left) / rect.width, y: (point.y - rect.top) / rect.height };
}
