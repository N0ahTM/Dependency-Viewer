import { drawGraph } from './view.mjs';
import { enableViewport } from './viewport.mjs';
import { layout } from '../../graph/layout.mjs';
import { relationIndex } from '../../graph/relations.mjs';

export function createDiagramScenes(getModel) {
  const arrangements = new Map();
  const layouts = new Map();
  const previews = new Map();

  function nodePreview(location) {
    const key = JSON.stringify(location);
    const graph = getModel().view(location);
    if (graph.nodes.length === 0) return null;
    if (!previews.has(key)) {
      previews.set(key, drawGraph(graph, {
        positions: arrangements.get(key),
        diagram: sceneLayout(location, graph, location.group === undefined),
      }).svg);
    }
    return { svg: previews.get(key).cloneNode(true) };
  }

  function sceneLayout(location, graph, miniatureCards) {
    const key = JSON.stringify(location);
    if (!layouts.has(key)) {
      const sizes = miniatureCards ? { width: 230, height: 138 } : {};
      layouts.set(key, layout(graph, { ...sizes, positions: arrangements.get(key) }));
    }
    return layouts.get(key);
  }

  function mount(panel, state, { pins, openNode, inspectNode, inspectEdge, cameraScale, wheelNavigate }) {
    const { location } = state;
    const graph = getModel().view(location);
    const key = JSON.stringify(location);
    if (!arrangements.has(key)) arrangements.set(key, new Map());
    const positions = arrangements.get(key);
    const hasPreviews = location.group === undefined;
    const drawing = drawGraph(graph, {
      pins,
      diagram: sceneLayout(location, graph, hasPreviews),
      open: openNode,
      inspectNode,
      inspectEdge,
      preview: hasPreviews ? node => node.next ? nodePreview(node.next) : null : undefined,
    });
    const { svg, bounds, nodes } = drawing;
    panel.append(svg);
    const camera = enableViewport(svg, bounds, {
      initialView: state.view, nodes,
      cameraScale,
      wheelNavigation: wheelNavigate,
      previewMove: drawing.move,
      move(id, position, view) {
        positions.set(id, position);
        layouts.delete(key);
        previews.delete(key);
        state.view = view;
        drawing.move(id, position, true);
      },
    });
    return { svg, viewport: camera, graph, scene: {
      index: relationIndex(graph.edges), nodes: new Map(graph.nodes.map(node => [node.id, node])),
    } };
  }

  function clear() {
    arrangements.clear();
    layouts.clear();
    previews.clear();
  }

  return { mount, clear };
}
