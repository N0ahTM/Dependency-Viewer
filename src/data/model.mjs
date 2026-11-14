import { indexBy, relationIndex } from '../graph/relations.mjs';
import { cycleGroups } from '../graph/cycles.mjs';

const sorted = nodes => nodes.sort((a, b) => a.label.localeCompare(b.label));

export function createModel(data) {
  if (data.version !== 1) throw new Error('Unknown data file version.');
  const libraries = Object.values(data.libraries);
  const modules = Object.values(data.modules);
  const modulesByLibrary = new Map(libraries.map(library => [library.name, []]));
  for (const module of modules) modulesByLibrary.get(module.library).push(module);

  const libraryNode = library => ({
    id: library.name, label: library.label ?? library.name, type: 'library', library: library.name,
    count: modulesByLibrary.get(library.name).length,
    next: { library: library.name },
  });

  const groups = new Map([...modulesByLibrary].map(([id, members]) => [id, indexBy(members, module => module.group)]));
  const importsByLibrary = indexBy(data.imports, record => record.library);
  const includesByLibrary = indexBy(data.includes, record => record.library);
  const linksByLibrary = indexBy(data.links, record => record.source);
  const importsTo = indexBy(data.imports, record => record.target);
  const importsFrom = indexBy(data.imports, record => record.source);
  const linksTo = indexBy(data.links, record => record.target);
  const cache = new Map();
  const safeModule = id => Object.hasOwn(data.modules, id) ? data.modules[id] : undefined;

  function moduleNode(module) {
    return {
      id: module.name, label: module.label ?? module.name,
      type: 'module', library: module.library, group: module.group, groupLabel: data.groups?.[module.group]?.label,
    };
  }

  // The graph stores consumer → provider. Every visible line retains its declarations.
  function connections(records, resolve) {
    const edges = new Map();
    for (const record of records) {
      const [source, target] = resolve(record);
      if (!source || !target || source === target) continue;
      const id = JSON.stringify([source, target]);
      if (!edges.has(id)) edges.set(id, { id, source, target, records: [] });
      edges.get(id).records.push(record);
    }
    return [...edges.values()];
  }

  const overview = {
    title: data.name,
    nodes: sorted(libraries.map(libraryNode)),
    edges: connections(data.links, link => [
      link.source, !link.expression && Object.hasOwn(data.libraries, link.target) ? link.target : null,
    ]),
  };
  const groupLabel = id => data.groups?.[id]?.label ?? id;
  const libraryLabel = id => data.libraries[id]?.label ?? id;

  function view(location = {}) {
    const { library, group } = location;
    if (!library) return overview;
    const key = JSON.stringify([library, group]);
    if (cache.has(key)) return cache.get(key);
    const byGroup = groups.get(library);
    const nodes = group === undefined
      ? sorted([...byGroup].map(([name, members]) => ({
        id: name, label: groupLabel(name), type: 'group', library, group: name, count: members.length,
        next: { library, group: name },
      })))
      : sorted(byGroup.get(group).map(moduleNode));
    const ids = new Set(nodes.map(node => node.id));
    function resolve(name) {
      if (group !== undefined) return ids.has(name) ? name : null;
      const module = safeModule(name);
      return module?.library === library ? module.group : null;
    }
    const graph = {
      title: group === undefined ? libraryLabel(library) : groupLabel(group),
      nodes,
      edges: connections(importsByLibrary.get(library) ?? [], record => [
        resolve(record.source), resolve(record.target),
      ]),
    };
    cache.set(key, graph);
    return graph;
  }

  function details(node) {
    const library = data.libraries[node.library];
    const wanted = moduleName => {
      if (node.type === 'library') return true;
      if (node.type === 'group') return safeModule(moduleName)?.group === node.group;
      return moduleName === node.id;
    };
    const members = modulesByLibrary.get(node.library).filter(module => wanted(module.name));
    const imports = node.type === 'module' ? importsFrom.get(node.id) ?? []
      : (importsByLibrary.get(node.library) ?? []).filter(record => wanted(record.source));
    const includes = (includesByLibrary.get(node.library) ?? []).filter(record => wanted(record.source));
    const membersSet = new Set(members.map(module => module.name));
    const boundary = record => !membersSet.has(record.source);
    const incoming = node.type === 'library' ? linksTo.get(node.library) ?? []
      : members.flatMap(module => (importsTo.get(module.name) ?? []).filter(boundary));
    const outgoing = node.type === 'library' ? linksByLibrary.get(node.library) ?? []
      : imports.filter(record => !membersSet.has(record.target));
    return {
      members, imports, includes,
      incoming, outgoing,
      definition: node.type === 'library' ? library : node.type === 'group' ? data.groups?.[node.id] : null,
      generic: data.generic,
    };
  }

  function boundaries(location, graph) {
    const byId = new Map(graph.nodes.map(node => [node.id, node]));
    const shown = name => {
      const module = safeModule(name);
      if (module?.library !== location.library) return null;
      const id = location.group === undefined ? module.group : name;
      return byId.has(id) ? id : null;
    };
    const unique = new Map();
    for (const record of data.imports) {
      const source = shown(record.source);
      const target = shown(record.target);
      if (Boolean(source) === Boolean(target)) continue;
      const outgoing = Boolean(source);
      const type = outgoing ? 'imports' : 'users';
      const id = outgoing ? source : target;
      if (!unique.has(type)) unique.set(type, { type, members: new Set(), records: [] });
      const boundary = unique.get(type);
      boundary.members.add(id);
      boundary.records.push(record);
    }
    return [...unique.values()];
  }

  const allModules = sorted(modules.map(moduleNode));
  let fullGraph;
  function full() {
    if (!fullGraph) {
      const edges = connections(data.imports, record => [
        Object.hasOwn(data.modules, record.source) ? record.source : null,
        Object.hasOwn(data.modules, record.target) ? record.target : null,
      ]);
      fullGraph = { title: 'Overview', nodes: allModules, edges, index: relationIndex(edges) };
    }
    return fullGraph;
  }

  const searchEntries = [
    ...overview.nodes.map(node => ({ node, location: {}, path: data.libraries[node.id].path ??
      data.libraries[node.id].files?.map(file => file.path).join(' ') })),
    ...libraries.flatMap(library => [...groups.get(library.name).keys()].map(group => ({
      node: { id: group, label: groupLabel(group), type: 'group', library: library.name, group },
      location: { library: library.name }, path: library.name,
    }))),
    ...allModules.map(node => ({
      node, location: { library: node.library, group: node.group },
      path: data.modules[node.id].files.map(file => file.path).join(' '),
    })),
  ].map(entry => ({
    ...entry,
    text: [entry.node.id, entry.node.label, libraryLabel(entry.node.library), groupLabel(entry.node.group), entry.path].join(' ').toLowerCase(),
  }));

  function search(query, limit = 18) {
    const input = query.trim().toLowerCase();
    const words = input.split(/\s+/);
    return searchEntries.filter(entry => words.every(word => entry.text.includes(word)))
      .sort((a, b) => Number(b.node.label.toLowerCase().startsWith(input)) - Number(a.node.label.toLowerCase().startsWith(input)))
      .slice(0, limit);
  }

  return { view, details, full, search, boundaries, libraryLabel, groupLabel,
    cycles: () => cycleGroups(full()), generic: data.generic };
}
