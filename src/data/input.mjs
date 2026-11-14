// The v1 interchange format describes a three-level graph independent of language.
// Adapt it to the same model used by scanner reports.
export function normalizeInput(input) {
  if (input?.format !== 'dependency-viewer') {
    if (input?.version === 1 && input.libraries && input.modules &&
        ['links', 'imports', 'includes'].every(key => Array.isArray(input[key]))) return input;
    throw new Error('Expected Dependency Viewer format version 1.');
  }
  if (input.version !== 1) throw new Error('Unsupported format version.');
  const require = (ok, message) => { if (!ok) throw new Error(message); };
  const string = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const fields = (value, allowed, where) => {
    require(Object.keys(value).every(key => allowed.includes(key)), where + ': Unknown field.');
  };
  fields(input, ['format', 'version', 'name', 'nodes', 'edges'], 'Dataset');
  require(string(input.name), 'Missing name.');
  require(Array.isArray(input.nodes) && input.nodes.length > 0, 'nodes must contain at least one node.');
  require(Array.isArray(input.edges), 'edges must be an array.');
  const byId = new Map();
  function sources(items, where) {
    require(Array.isArray(items), where + ': sources must be an array.');
    for (const source of items) {
      require(source && string(source.path) && Number.isSafeInteger(source.line) && source.line >= 1,
        where + ': Source locations require path and line starting at 1.');
      fields(source, ['path', 'line'], where);
    }
    return items;
  }
  for (const node of input.nodes) {
    require(node && string(node.id) && string(node.label) && ['project', 'group', 'item'].includes(node.kind),
      'Each node requires id, label, and kind (project, group, or item).');
    require(!byId.has(node.id), 'Duplicate node ID: ' + node.id);
    fields(node, ['id', 'label', 'kind', 'parent', 'sources'], node.id);
    sources(node.sources === undefined ? [] : node.sources, node.id);
    byId.set(node.id, node);
  }
  const libraries = Object.create(null);
  const modules = Object.create(null);
  const groups = Object.create(null);
  for (const node of byId.values()) {
    const parent = byId.get(node.parent);
    if (node.kind === 'project') {
      require(node.parent === undefined, node.id + ': Project nodes cannot have a parent.');
      libraries[node.id] = { name: node.id, label: node.label, files: node.sources ?? [] };
    } else if (node.kind === 'group') {
      require(parent?.kind === 'project', node.id + ': parent must refer to a project.');
      groups[node.id] = { label: node.label, library: parent.id, files: node.sources ?? [] };
    } else {
      require(parent?.kind === 'group' && byId.get(parent.parent)?.kind === 'project',
        node.id + ': parent must refer to a group within a project.');
      modules[node.id] = { name: node.id, label: node.label, library: parent.parent,
        group: parent.id, files: node.sources ?? [] };
    }
  }
  const links = [];
  const imports = [];
  for (const edge of input.edges) {
    require(edge && string(edge.kind), 'Each edge requires kind.');
    fields(edge, ['source', 'target', 'kind', 'sources'], 'Edge');
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    require(source && target && source.kind === target.kind && ['project', 'item'].includes(source.kind),
      'Invalid edge ' + edge.source + ' → ' + edge.target + '.');
    require(source !== target, 'Self-edges are unsupported in version 1: ' + source.id);
    const evidence = sources(edge.sources === undefined ? [] : edge.sources, source.id + ' → ' + target.id);
    for (const location of evidence.length ? evidence : [{}]) {
      const record = { source: source.id, target: target.id, kind: edge.kind, ...location };
      if (source.kind === 'project') links.push(record);
      else imports.push({ ...record, library: modules[source.id].library });
    }
  }
  // Explicit empty groups would otherwise disappear from the overview.
  const populated = new Set(Object.values(modules).map(module => module.group));
  for (const group of Object.keys(groups)) require(populated.has(group), 'Group without items: ' + group);
  return { version: 1, generic: true, name: input.name, libraries, groups, modules, links, imports, includes: [] };
}
