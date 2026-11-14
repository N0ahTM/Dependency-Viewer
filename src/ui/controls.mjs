import { setIconButton } from './icons.mjs';

export function updateControls(select, host, state, { data, model, canGoBack, pathStart, atlasLevel }) {
  const { library, group, atlas } = state.location;
  select('breadcrumb').textContent = [data.name, atlas ? 'Overview' : model.libraryLabel(library), model.groupLabel(group)].filter(Boolean).join(' / ');
  select('back').hidden = !canGoBack;
  for (const [id, active] of [['graph-tab', !atlas], ['atlas-tab', Boolean(atlas)]]) {
    select(id).setAttribute('aria-selected', String(active));
    select(id).tabIndex = active ? 0 : -1;
  }
  host.setAttribute('role', 'tabpanel');
  host.setAttribute('aria-labelledby', atlas ? 'atlas-tab' : 'graph-tab');
  select('atlas-controls').hidden = !atlas;
  if (atlas) updateAtlasControls(select, state, atlasLevel);
  select('focus').disabled = false;
  select('focus').setAttribute('aria-pressed', String(Boolean(state.focused)));
  select('depth').hidden = !(state.focused && state.selected);
  const depth = state.depth ?? 1;
  const depthButton = select('depth');
  depthButton.title = depth === 1 ? '1 level · switch' : '2 levels · switch';
  depthButton.setAttribute('aria-label', depthButton.title);
  depthButton.setAttribute('aria-pressed', String(depth === 2));
  select('path').disabled = !state.selected;
  select('path').setAttribute('aria-pressed', String(Boolean(pathStart)));
}

export function updateAtlasControls(select, state, atlasLevel) {
  for (const button of select('atlas-controls').querySelectorAll('[data-level]')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === String(state.fixedLevel ?? 'auto')));
  }
  select('atlas-lines').setAttribute('aria-pressed', String(Boolean(state.showLines)));
  const auto = select('atlas-controls').querySelector('[data-level="auto"]');
  auto.title = 'Automatic level · ' + atlasLevel;
  auto.setAttribute('aria-label', auto.title);
}

export function initializeControlIcons(select) {
  for (const [id, glyph, label] of [
    ['focus', 'focus', 'Focus'], ['path', 'path', 'Path'], ['back', 'back', 'Back · Alt+←'],
    ['open-data', 'open', 'Open JSON'], ['cycles', 'cycle', 'Cycles'], ['help', 'help', 'Keyboard shortcuts and settings · ?'],
    ['detail-close', 'close', 'Close details'],
    ['help-close', 'close', 'Close keyboard shortcuts'], ['fit', 'fit', 'Fit · F or 0'],
    ['zoom-in', 'plus', 'Zoom in'], ['zoom-out', 'minus', 'Zoom out'],
    ['atlas-lines', 'path', 'Internal connections'],
    ['depth', 'group', 'Focus depth'],
  ]) {
    setIconButton(select(id), glyph, label);
  }
  for (const [level, glyph, label] of [
    ['auto', 'fit', 'Automatic level'], ['0', 'library', 'Projects or libraries'],
    ['1', 'group', 'Groups'], ['2', 'module', 'Items or modules'],
  ]) {
    setIconButton(select('atlas-controls').querySelector('[data-level="' + level + '"]'), glyph, label);
  }
}

export function bindViewControls(select, {
  switchTab, getEntry, getViewport, refreshAtlasControls, back, dismissDetails, fit, zoom,
}) {
  select('graph-tab').onclick = () => switchTab(false);
  select('atlas-tab').onclick = () => switchTab(true);
  select('view-tabs').onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.altKey) return;
    event.preventDefault();
    const atlas = event.key === 'End' || (event.key !== 'Home' && event.target.id === 'graph-tab');
    select(atlas ? 'atlas-tab' : 'graph-tab').focus();
    switchTab(atlas);
  };
  for (const button of select('atlas-controls').querySelectorAll('[data-level]')) {
    button.onclick = () => {
      getEntry().fixedLevel = button.dataset.level === 'auto' ? null : Number(button.dataset.level);
      if (getEntry().fixedLevel !== 2) {
        getEntry().showLines = false;
        getViewport()?.showLines(false);
      }
      getViewport()?.setLevel(getEntry().fixedLevel);
      refreshAtlasControls();
    };
  }
  select('atlas-lines').onclick = () => {
    getEntry().showLines = !getEntry().showLines;
    if (getEntry().showLines) {
      getEntry().fixedLevel = 2;
      getViewport()?.setLevel(2);
    }
    getViewport()?.showLines(getEntry().showLines);
    refreshAtlasControls();
  };
  select('back').onclick = back;
  select('detail-close').onclick = dismissDetails;
  select('help').onclick = () => select('help-dialog').showModal();
  select('help-close').onclick = () => select('help-dialog').close();
  select('fit').onclick = event => fit(event.detail > 0);
  select('zoom-in').onclick = () => zoom(0.8);
  select('zoom-out').onclick = () => zoom(1.25);
}
