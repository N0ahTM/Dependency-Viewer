export function createMinimap(map, bounds, libraries) {
  const mini = map.getContext('2d');

  function mapScale() {
    return Math.min(map.width / bounds.width, map.height / bounds.height);
  }

  function drawMap(area) {
    const scale = mapScale();
    mini.fillStyle = '#141e2a';
    mini.fillRect(0, 0, map.width, map.height);
    mini.fillStyle = '#466281';
    for (const node of libraries) mini.fillRect((node.x - bounds.x) * scale, (node.y - bounds.y) * scale, node.width * scale, node.height * scale);
    mini.strokeStyle = '#d6f1ff';
    mini.strokeRect((area.x - bounds.x) * scale, (area.y - bounds.y) * scale, area.width * scale, area.height * scale);
  }

  function getCenter(event) {
    const rect = map.getBoundingClientRect();
    return {
      x: bounds.x + (event.clientX - rect.left) * map.width / rect.width / mapScale(),
      y: bounds.y + (event.clientY - rect.top) * map.height / rect.height / mapScale(),
    };
  }

  return { draw: drawMap, getCenter };
}
