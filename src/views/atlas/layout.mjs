// Shared by the worker and the synchronous fallback. Coordinates never change
// when a different level of detail is drawn.
export function arrangeAtlas(nodes, projects = []) {
  const libraries = new Map(projects.map(project => [project.id, new Map()]));
  const projectLabels = new Map(projects.map(project => [project.id, project.label]));
  for (const node of nodes) {
    if (!libraries.has(node.library)) libraries.set(node.library, new Map());
    const groups = libraries.get(node.library);
    if (!groups.has(node.group)) groups.set(node.group, []);
    groups.get(node.group).push(node);
  }
  const result = { libraries: [], groups: [], modules: [], bounds: null };
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let right = 0;
  const rowLength = Math.ceil(Math.sqrt(libraries.size));
  for (const [name, groups] of libraries) {
    if (result.libraries.length && result.libraries.length % rowLength === 0) {
      x = 0;
      y += rowHeight + 180;
      rowHeight = 0;
    }
    const start = result.groups.length;
    let width = 0;
    let height = 82;
    let groupRowHeight = 0;
    let groupX = 32;
    for (const [group, members] of groups) {
      if (result.groups.length > start && (result.groups.length - start) % 3 === 0) {
        groupX = 32;
        height += groupRowHeight + 36;
        groupRowHeight = 0;
      }
      const columns = Math.min(4, Math.ceil(Math.sqrt(members.length)));
      const block = { id: JSON.stringify([name, group]), label: members[0].groupLabel ?? group, library: name, group, type: 'group',
        x: x + groupX, y: y + height, width: columns * 194 + 24, height: Math.ceil(members.length / columns) * 53 + 47 };
      result.groups.push(block);
      members.forEach((member, i) => result.modules.push({
        ...member, x: block.x + 12 + (i % columns) * 194, y: block.y + 35 + Math.floor(i / columns) * 53,
        width: 180, height: 40,
      }));
      width = Math.max(width, groupX + block.width + 32);
      groupX += block.width + 36;
      groupRowHeight = Math.max(groupRowHeight, block.height);
    }
    height += groupRowHeight + 32;
    width = Math.max(width, 220);
    result.libraries.push({ id: name, label: projectLabels.get(name) ?? name, library: name, type: 'library', x, y, width, height });
    right = Math.max(right, x + width);
    x += width + 180;
    rowHeight = Math.max(rowHeight, height);
  }
  result.bounds = { x: -70, y: -70, width: right + 140, height: y + rowHeight + 140 };
  return result;
}

export function prepareAtlas(nodes, projects) {
  return new Promise(resolve => {
    let worker;
    let url;
    const fallback = () => resolve(arrangeAtlas(nodes, projects));
    try {
      url = URL.createObjectURL(new Blob([
        'onmessage = event => postMessage((' + arrangeAtlas.toString() + ')(...event.data))',
      ], { type: 'text/javascript' }));
      worker = new Worker(url);
      const cleanup = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
      };
      worker.onmessage = event => { cleanup(); resolve(event.data); };
      worker.onerror = () => { cleanup(); fallback(); };
      worker.postMessage([nodes, projects]);
    } catch {
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
      fallback();
    }
  });
}
