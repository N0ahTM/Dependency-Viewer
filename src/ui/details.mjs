import { setIconButton } from './icons.mjs';

const panel = document.querySelector('#details');
const heading = document.querySelector('#detail-title');
const body = document.querySelector('#detail-body');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function source(record) {
  const location = record.path ? record.path + ':' + record.line : 'No source location';
  const line = element('li', undefined, 'source');
  const row = element('div', undefined, 'source-row');
  const path = element('span', location, 'source-path');
  row.append(path);
  line.append(row);
  if (!record.path) return line;
  const copy = setIconButton(element('button', undefined, 'copy'), 'copy', 'Copy source location');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location);
      setIconButton(copy, 'check', 'Source location copied');
    } catch {
      const field = element('input');
      field.value = location;
      field.readOnly = true;
      field.setAttribute('aria-label', 'Source location to copy');
      field.className = 'source-path';
      path.replaceWith(field);
      field.select();
    }
  });
  row.append(copy);
  const conditions = [...(record.conditions ?? [])];
  if (record.scope) conditions.unshift(record.scope);
  if (record.reexport) conditions.unshift('export import');
  if (record.listedInBuild === false) conditions.unshift('Found by source scan; no CMake source entry found');
  for (const condition of conditions) line.append(element('small', condition));
  return line;
}

function section(title, records, label) {
  if (records.length === 0) return;
  const block = element('section');
  block.append(element('h3', title));
  const rows = new Map();
  for (const record of records) {
    const name = label(record);
    if (!rows.has(name)) rows.set(name, []);
    rows.get(name).push(record);
  }
  for (const [name, occurrences] of rows) {
    const row = element('details');
    row.append(element('summary', name + ' · ' + occurrences.length));
    const list = element('ul');
    for (const occurrence of occurrences) list.append(source(occurrence));
    row.append(list);
    block.append(row);
  }
  body.append(block);
}

function start(title, subtitle, pointerX) {
  heading.textContent = title;
  body.replaceChildren();
  if (subtitle) body.append(element('p', subtitle, 'muted'));
  // Keep the first click's target available for a second click.
  const placeLeft = pointerX !== undefined && pointerX >= window.innerWidth / 2;
  panel.classList.toggle('details-left', placeLeft);
  panel.classList.toggle('details-beside-target', pointerX !== undefined);
  panel.hidden = false;
  panel.scrollTop = 0;
  panel.querySelector('button').focus();
}

export function closeDetails() {
  panel.hidden = true;
}

export function showNode(node, details, pointerX, label) {
  const buildOnly = record => record.scope === 'add_dependencies';
  const uses = details.outgoing.filter(record => details.generic || record.kind !== 'include');
  start(node.label, details.definition?.type === 'custom_target' ? 'CMake build task' : undefined, pointerX);
  section('Uses', uses.filter(record => !buildOnly(record)), record => label(record.target));
  section('Used by', details.incoming.filter(record => !buildOnly(record)), record => label(record.source) ?? record.path);
  section('Build prerequisites', uses.filter(buildOnly), record => label(record.target));
  section('Required at build time by', details.incoming.filter(buildOnly), record => label(record.source));
  if (details.definition) {
    const list = element('ul');
    const files = details.definition.files ?? (details.definition.path ? [details.definition] : []);
    for (const file of files) list.append(source(file));
    if (files.length) {
      const block = element('section');
      block.append(element('h3', details.definition.files ? 'Definition' : 'CMake declaration'), list);
      body.append(block);
    }
  }
  section('Source files', details.members.flatMap(module => module.files.map(file => ({
    ...file, name: file.path,
  }))), record => record.name);
  const outgoing = new Set(details.outgoing);
  section('Internal dependencies', details.imports.filter(record => !outgoing.has(record)
    && (details.generic || record.kind !== 'include')), record => label(record.target));
  section('Includes', details.includes, record => record.target);
}

export function showConnection(edge, from, to, label) {
  const cmake = edge.records.every(record => 'scope' in record);
  const kinds = [...new Set(edge.records.map(record => record.kind).filter(Boolean))];
  const buildOnly = edge.records.every(record => record.scope === 'add_dependencies');
  start(from.label + ' → ' + to.label, kinds.length ? kinds.join(' · ')
    : buildOnly ? 'CMake build prerequisite' : cmake ? 'CMake' : 'C++ imports');
  if (edge.pairs > 1) body.append(element('p', edge.pairs + ' connections'));
  section('Source locations', edge.records, record => cmake ? label(record.target)
    : (label(record.source) + ' → ' + label(record.target)));
  if (!(edge.pairs > 1)) for (const row of body.querySelectorAll('details')) row.open = true;
}

export function showPath(path, nodes, source, target, label) {
  start(nodes.get(source).label + ' → ' + nodes.get(target).label,
    path ? path.length + ' direct steps' : 'No directed path in this view.');
  if (!path) return;
  for (const edge of path) {
    section(nodes.get(edge.source).label + ' → ' + nodes.get(edge.target).label, edge.records, record => label(record.target));
  }
}

export function showBoundary(boundary, label) {
  const incoming = boundary.type === 'users';
  start(incoming ? 'External consumers' : 'External dependencies');
  section('Source locations', boundary.records, record => incoming ? label(record.source) ?? record.path : label(record.target));
}

export function showCycles(groups, locate) {
  start('Cycles');
  if (!groups.length) body.append(element('p', 'No cycles in the item graph.'));
  for (const group of groups) {
    const block = element('details');
    block.open = groups.length === 1;
    block.append(element('summary', group.length + ' mutually reachable items'));
    const list = element('ul');
    for (const node of group) {
      const item = element('li');
      const button = element('button', node.label);
      button.onclick = () => locate(node.id);
      item.append(button);
      list.append(item);
    }
    block.append(list);
    body.append(block);
  }
}
