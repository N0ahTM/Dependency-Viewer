import { renderSelection } from '../views/selection.mjs';
import { bindDatasetPicker } from '../ui/dataset-picker.mjs';
import { ViewerHistory } from '../navigation/history.mjs';
import { bindShortcuts } from '../ui/shortcuts.mjs';
import { rememberCheckbox } from '../ui/preferences.mjs';
import { updateControls, updateAtlasControls, initializeControlIcons, bindViewControls } from '../ui/controls.mjs';
import { renderBoundaries } from '../ui/boundaries.mjs';
import { createModel } from '../data/model.mjs';
import { createDiagramScenes } from '../views/diagram/scenes.mjs';
import { closeDetails, showConnection, showCycles, showNode, showPath } from '../ui/details.mjs';
import { enableSearch } from '../ui/search.mjs';
import { findPath } from '../graph/relations.mjs';
import { screenRect, slideScene, transitionGraph } from '../navigation/motion.mjs';
import { prepareAtlas } from '../views/atlas/layout.mjs';
import { mountAtlas } from '../views/atlas/view.mjs';
import { icon } from '../ui/icons.mjs';
import { normalizeInput } from '../data/input.mjs';
import { createZoomGrid } from '../navigation/zoom-grid.mjs';
import { createWheelPace } from '../navigation/wheel-pace.mjs';
import { createWheelTransitions } from '../navigation/wheel-transitions.mjs';
import { createWheelNavigation } from '../navigation/wheel-navigation.mjs';
import { createPins } from '../graph/pins.mjs';

const select = id => document.getElementById(id);
const wheelSetting = select('wheel-navigation');
const clickSetting = select('double-click-navigation');

rememberCheckbox(wheelSetting);
rememberCheckbox(clickSetting);
let data = normalizeInput(JSON.parse(select('viewer-data').textContent));
document.title = data.name + ' · Dependency Viewer';
let model = createModel(data);
const host = select('graph');
const grid = createZoomGrid(select('graph-background'));
const wheelPace = createWheelPace();
const parentPreview = Symbol('parent');
let previewCard;
const wheelNavigation = createWheelNavigation(target => {
  previewCard?.classList.remove('wheel-preview');
  previewCard = typeof target === 'string' ? box(target) : undefined;
  previewCard?.classList.add('wheel-preview');
  select('back').classList.toggle('wheel-preview', target === parentPreview);
});
const history = new ViewerHistory(window.history);
const diagram = createDiagramScenes(() => model);
const pins = createPins();
const status = select('status');
let atlasLevel = 'Libraries';
let viewport;
let scene;
let stopTransition;
let atlasTask;
let atlasArrangement;
let tabRequest = 0;
let generation = 0;
let pathStart;
let graphTabState;
let atlasTabState;
let pendingWheelBack;

function entry() { return history.current; }

function box(id, panel = host) {
  return [...panel.querySelectorAll('.card[data-node-id]')]
    .find(card => card.dataset.nodeId === id && !card.closest('.departing'));
}

function inspectNode(node, pointerX) {
  entry().selected = node.id;
  entry().path = null;
  emphasize();
  showNode(node, model.details(node), pointerX);
}

function dismissDetails() {
  closeDetails();
  entry().selected = null;
  entry().path = null;
  pathStart = null;
  status.textContent = '';
  emphasize();
}

function openNode(node, event, atlasOrigin) {
  cancelMotion();
  if (pathStart && scene.nodes.has(node.id)) {
    const source = pathStart;
    if (source === node.id) {
      status.textContent = 'Choose a different node as the destination.';
      return;
    }
    const path = findPath(scene.index, source, node.id);
    pathStart = null;
    entry().path = path;
    entry().pathSource = source;
    entry().selected = node.id;
    emphasize();
    showPath(path, scene.nodes, source, node.id);
    status.textContent = path ? path.length + ' steps' : 'No directed path';
    return;
  }

  const pointer = event?.type === 'click' && event.detail > 0;
  const useDoubleClick = clickSetting.checked && pointer && node.next;
  const focusedGraph = entry().focused && !entry().location.atlas;
  if (!node.next || focusedGraph || event?.shiftKey || (useDoubleClick && event.detail !== 2)) {
    inspectNode(node, useDoubleClick ? event.clientX : undefined);
    return;
  }
  if (useDoubleClick) entry().selected = null;
  else if (atlasOrigin === undefined) entry().selected = node.id;
  entry().path = null;
  const miniature = box(node.id)?.querySelector('.miniature');
  const from = miniature ? screenRect(miniature) : null;
  push(node.next, { from }, { atlasOrigin });
}

function wheelNavigate({ delta, time, node, viewportShare, zoomedOut, screen }) {
  const duration = wheelPace(delta, time);
  const { library, group } = entry().location;
  const allowed = wheelSetting.checked && !pathStart && !entry().focused;
  const target = !allowed ? undefined
    : delta < 0 && node?.next && viewportShare >= .48 ? node.id
    : delta > 0 && library && zoomedOut >= 1.55 ? parentPreview : undefined;
  if (!wheelNavigation.sample(target, delta, time)) return;

  const reverse = target === parentPreview;
  const location = reverse ? group === undefined ? {} : { library } : node.next;
  const last = history.previous;
  const backEntry = reverse && last && !last.location.atlas &&
    last.location.library === location.library && last.location.group === location.group ? last : null;
  startWheelTransition(backEntry ?? { location }, {
    reverse, screen, parentId: group ?? library, childId: node?.id, duration,
  });
}

function push(location, motion = {}, state = {}) {
  cancelMotion();
  const oldAtlas = Boolean(entry().location.atlas);
  const newAtlas = Boolean(location.atlas);
  entry().view = viewport?.snapshot();
  history.push({ ...state, location });
  render(oldAtlas !== newAtlas ? { slide: newAtlas ? 1 : -1 } : motion);
}

const back = () => history.back();
const forward = () => history.forward();

window.addEventListener('popstate', event => {
  const next = history.resolve(event.state);
  if (!next) return;
  if (pendingWheelBack) {
    const settled = pendingWheelBack;
    pendingWheelBack = undefined;
    if (event.state.index === settled.index) {
      history.activate(event.state);
      finishWheelScene(settled);
      return;
    }
  }
  cancelMotion();
  const child = entry();
  child.view = viewport?.snapshot();
  const old = host.querySelector('.diagram');
  const nextAtlas = Boolean(next.location.atlas);
  const goingBack = event.state.index < history.index;
  const parentId = !next.location.library ? child.location.library
    : next.location.library === child.location.library && next.location.group === undefined ? child.location.group
    : undefined;
  const targetId = next.location.group ?? next.location.library;
  const preview = targetId && box(targetId)?.querySelector('.miniature');
  const motion = nextAtlas !== Boolean(child.location.atlas)
    ? { slide: nextAtlas ? 1 : -1, atlasOrigin: nextAtlas && goingBack ? child.atlasOrigin : undefined }
    : goingBack
      ? { from: old && screenRect(old), parentId, reverse: true }
      : { from: preview && screenRect(preview) };
  history.activate(event.state);
  render(motion);
});

function fromSearch(result) {
  const { node, location } = result;
  cancelMotion();
  if (entry().location.atlas && node.type === 'module' && viewport) {
    if (pathStart) openNode(node);
    else {
      entry().selected = node.id;
      entry().focused = true;
      entry().path = null;
      emphasize();
    }
    viewport.focus(node.id);
    status.textContent = node.id;
    return;
  }
  if (pathStart && scene.nodes.has(node.id) && JSON.stringify(location) === JSON.stringify(entry().location)) {
    openNode(node);
    return;
  }
  const changed = JSON.stringify(location) !== JSON.stringify(entry().location);
  if (changed) push(location);
  entry().selected = node.id;
  entry().focused = true;
  entry().path = null;
  emphasize();
  viewport.focus(node.id);
  status.textContent = node.id;
}

function cancelMotion() {
  wheelNavigation.cancel();
  wheelTransitions.cancel();
  stopTransition?.();
  stopTransition = null;
}

function refreshControls() {
  updateControls(select, host, entry(), { data, model, canGoBack: history.canGoBack, pathStart, atlasLevel });
}

function showBoundaries(location, graph) {
  renderBoundaries(select('boundary'), host, model.boundaries(location, graph));
}

function emphasize() {
  renderSelection(host, viewport, scene, entry());
  refreshControls();
}

function render(motion = null) {
  const run = ++generation;
  cancelMotion();
  const state = entry();
  const location = state.location;
  if (location.atlas && !atlasArrangement) {
    status.textContent = 'Preparing overview…';
    prepareAtlasOnce().then(() => {
      if (run === generation) render(motion);
    });
    return;
  }
  const outgoing = motion ? host.firstElementChild : null;
  const previous = outgoing?.querySelector('.diagram');
  const anchor = motion?.from && {
    x: motion.from.left + motion.from.width / 2, y: motion.from.top + motion.from.height / 2,
  };
  const previousGrid = grid.rebase(outgoing && previous && !location.atlas && !motion.slide
    ? motion.reverse ? 1 / 1.18 : 1.18 : 1, anchor ?? { x: host.clientWidth / 2, y: host.clientHeight / 2 });
  viewport?.destroy();
  viewport = null;
  pathStart = null;
  status.textContent = '';
  closeDetails();
  select('boundary').hidden = true;
  refreshControls();
  const panel = document.createElement('div');
  panel.className = 'graph-scene';
  host.replaceChildren(panel);
  if (location.atlas) {
    const graph = model.full();
    scene = { index: graph.index, nodes: new Map(graph.nodes.map(node => [node.id, node])) };
    viewport = mountAtlas(panel, atlasArrangement, graph, model.view().edges, {
        pins,
        cameraScale: grid.update,
        level(level) { atlasLevel = level; updateAtlasControls(select, entry(), atlasLevel); },
        mode(level) { state.fixedLevel = level; updateAtlasControls(select, entry(), atlasLevel); },
        inspect: showConnection,
        select(node, event) {
          const target = node.type === 'module' ? node : { ...node, next: { library: node.library, group: node.group } };
          openNode(target, event, node.id);
        },
    });
    if (state.view) viewport.restore(state.view);
    viewport.setLevel(state.fixedLevel ?? null);
    viewport.showLines(Boolean(state.showLines));
    if (motion?.atlasOrigin !== undefined) viewport.center(motion.atlasOrigin);
    emphasize();
    viewport.paint();
    animateScene(outgoing, previous, panel, null, motion, previousGrid);
    return;
  }

  const graphScene = mountGraph(panel, state);
  ({ viewport, scene } = graphScene);
  if (motion?.reverse && motion.parentId !== undefined) viewport.center(motion.parentId);
  if (location.library) showBoundaries(location, graphScene.graph);
  emphasize();
  animateScene(outgoing, previous, panel, graphScene.svg, motion, previousGrid);
}

function mountGraph(panel, state) {
  return diagram.mount(panel, state, {
    pins, openNode, inspectNode, cameraScale: grid.update, wheelNavigate,
    inspectEdge(edge, source, target) {
      state.path = [edge];
      state.pathSource = edge.source;
      state.selected = edge.target;
      emphasize();
      showConnection(edge, source, target);
    },
  });
}

function previewRect(card) {
  const miniature = card?.querySelector('.miniature');
  return miniature ? screenRect(miniature) : card?.getBoundingClientRect();
}

const wheelTransitions = createWheelTransitions({
  host, grid, mountGraph,
  getViewport: () => viewport,
  getPreviewRect: id => previewRect(box(id)),
  onArrival({ to, panel, incoming, previousView }) {
    entry().view = previousView;
    ({ viewport, scene } = incoming);
    closeDetails();
    if (to === history.previous) {
      to.view = viewport.snapshot();
      pendingWheelBack = { index: history.index - 1, panel, graph: incoming.graph };
      history.back();
    } else {
      history.push(to);
      finishWheelScene({ panel, graph: incoming.graph });
    }
  },
});

function startWheelTransition(to, motion) {
  cancelMotion();
  wheelTransitions.start(to, motion);
}

function finishWheelScene({ panel, graph }) {
  panel.inert = false;
  select('boundary').hidden = true;
  if (entry().location.library) showBoundaries(entry().location, graph);
  emphasize();
}

function animateScene(outgoing, previous, panel, svg, motion, previousGrid) {
  if (!outgoing || !motion) return;
  if (motion.slide || !previous || !svg) {
    host.prepend(outgoing);
    stopTransition = slideScene(outgoing, panel, motion.slide ?? -1);
  } else {
    const destination = motion.reverse ? previewRect(box(motion.parentId)) : screenRect(svg);
    stopTransition = transitionGraph(host, previous, svg, motion.from, destination, motion.reverse, {
      animateGrid: timing => grid.animateFrom(previousGrid, timing),
    });
  }
}

const openSearch = enableSearch(query => model.search(query), fromSearch);
select('search-glyph').append(icon('search'));
function prepareAtlasOnce() {
  if (atlasArrangement) return Promise.resolve(atlasArrangement);
  if (!atlasTask) {
    const currentModel = model;
    atlasTask = prepareAtlas(model.full().nodes, model.view().nodes).then(arrangement => {
      if (currentModel === model) atlasArrangement = arrangement;
      return arrangement;
    });
  }
  return atlasTask;
}

async function switchTab(atlas) {
  const request = ++tabRequest;
  const initial = entry();
  const state = entry();
  if (Boolean(state.location.atlas) === atlas) {
    if (status.textContent === 'Preparing overview…') status.textContent = '';
    return;
  }
  if (atlas && !atlasArrangement) {
    status.textContent = 'Preparing overview…';
    await prepareAtlasOnce();
    if (request !== tabRequest || initial !== entry()) return;
  }
  const saved = { ...state, view: viewport?.snapshot() };
  if (atlas) graphTabState = saved;
  else atlasTabState = saved;
  const next = atlas ? atlasTabState : graphTabState;
  push(next?.location ?? (atlas ? { atlas: true } : {}), {}, next);
}
select('focus').onclick = () => {
  entry().focused = !entry().focused;
  entry().path = null;
  status.textContent = entry().focused && !entry().selected ? 'Choose a node to focus on.' : '';
  emphasize();
};
select('depth').onclick = () => {
  entry().depth = entry().depth === 2 ? 1 : 2;
  emphasize();
};
select('path').onclick = () => {
  const state = entry();
  closeDetails();
  if (state.path) state.path = null;
  pathStart = pathStart ? null : state.selected;
  status.textContent = pathStart ? 'Choose the path destination in this view.' : '';
  emphasize();
};
function replaceDataset(imported, importedModel) {
  data = imported;
  document.title = data.name + ' · Dependency Viewer';
  model = importedModel;
  history.reset();
  atlasTask = null;
  atlasArrangement = null;
  tabRequest++;
  graphTabState = atlasTabState = undefined;
  diagram.clear();
  pins.clear();
  render({ slide: 1 });
}

bindDatasetPicker(select('open-data'), select('data-file'), {
  accept: replaceDataset,
  reportError(message) { status.textContent = message; },
});
select('cycles').onclick = () => {
  const graph = model.full();
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  showCycles(model.cycles().map(group => group.map(id => byId.get(id))), id => {
    const node = byId.get(id);
    fromSearch({ node, location: { library: node.library, group: node.group } });
  });
};
host.addEventListener('pointerdown', cancelMotion, { capture: true });
// Some browsers deliver a whole wheel gesture to its original target. Keep
// routing on the persistent graph container as the scene underneath changes.
host.addEventListener('wheel', event => {
  if (!viewport) return;
  event.preventDefault();
  const bounds = host.getBoundingClientRect();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
  const delta = event.deltaY * unit;
  if (!delta) return;
  if (wheelTransitions.handleWheel(event, bounds, delta)) return;
  viewport.wheel(event, bounds, delta, {
    navigate: !pendingWheelBack, aroundCenter: Boolean(pendingWheelBack),
  });
}, { passive: false });
function escape() {
  if (wheelTransitions.reverse() || wheelNavigation.cancel()) {
    return;
  }
  if (!select('details').hidden) dismissDetails();
  else if (pathStart || entry().path || entry().selected) {
    pathStart = null;
    entry().path = null;
    entry().selected = null;
    status.textContent = '';
    emphasize();
  } else back();
}

bindShortcuts({
  canGoBack: () => history.canGoBack,
  canGoForward: () => history.canGoForward,
  back, forward, openSearch, escape,
  zoom(factor) { cancelMotion(); viewport?.zoom(factor); },
  fit() { cancelMotion(); viewport?.fit(); },
  openHelp() { select('help-dialog').showModal(); },
});
bindViewControls(select, {
  switchTab, getEntry: entry, getViewport: () => viewport, back, dismissDetails,
  refreshAtlasControls: () => updateAtlasControls(select, entry(), atlasLevel),
  fit(animate) { cancelMotion(); viewport?.fit(animate); },
  zoom(factor) { cancelMotion(); viewport?.zoom(factor); },
});
wheelSetting.addEventListener('change', cancelMotion);
initializeControlIcons(select);
render();
