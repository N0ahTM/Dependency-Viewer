export function intersects(a, b) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y;
}

// Bounding boxes are stored once. Even very long wires occupy just one leaf.
export function spatialIndex(items) {
  function build(rows, depth = 0) {
    if (!rows.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const { box } of rows) {
      left = Math.min(left, box.x);
      top = Math.min(top, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    }
    const box = { x: left, y: top, width: right - left, height: bottom - top };
    if (rows.length <= 12) return { box, rows };
    const axis = depth % 2 ? 'y' : 'x';
    rows.sort((a, b) => a.box[axis] - b.box[axis]);
    const middle = Math.floor(rows.length / 2);
    return { box, left: build(rows.slice(0, middle), depth + 1), right: build(rows.slice(middle), depth + 1) };
  }
  const root = build([...items]);
  return area => {
    const found = [];
    function visit(branch) {
      if (!branch || !intersects(branch.box, area)) return;
      if (branch.rows) {
        for (const item of branch.rows) if (intersects(item.box, area)) found.push(item);
      } else {
        visit(branch.left);
        visit(branch.right);
      }
    }
    visit(root);
    return found;
  };
}
