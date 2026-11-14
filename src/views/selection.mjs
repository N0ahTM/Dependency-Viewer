import { neighbors } from '../graph/relations.mjs';

export function renderSelection(host, viewport, scene, state) {
  const selected = state.selected;
  let emphasis;
  if (state.path) {
    emphasis = {
      nodes: new Set([state.pathSource, selected, ...state.path.flatMap(edge => [edge.source, edge.target])]),
      edges: new Set(state.path.map(edge => edge.id)),
    };
  } else if (state.focused && selected && scene.nodes.has(selected)) {
    emphasis = neighbors(scene.index, selected, state.depth ?? 1);
  }
  if (viewport?.highlight) viewport.highlight(emphasis, selected);
  for (const card of host.querySelectorAll('.card[data-node-id]')) {
    card.classList.toggle('selected', card.dataset.nodeId === selected);
    card.classList.toggle('dimmed', Boolean(emphasis && !emphasis.nodes.has(card.dataset.nodeId)));
  }
  for (const wire of host.querySelectorAll('.wire[data-edge-id]')) {
    wire.classList.toggle('dimmed', Boolean(emphasis && !emphasis.edges.has(wire.dataset.edgeId)));
    wire.classList.toggle('marked', Boolean(emphasis?.edges.has(wire.dataset.edgeId)));
  }
}
