export function enableSearch(search, choose) {
  const bar = document.querySelector('#search-bar');
  const input = document.querySelector('#search-query');
  const results = document.querySelector('#search-results');
  let matches = [];
  let active = 0;
  function expanded(value) {
    results.hidden = !value;
    input.setAttribute('aria-expanded', String(value));
  }
  function update() {
    matches = search(input.value);
    active = 0;
    results.replaceChildren();
    for (const entry of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.node.label;
      const location = document.createElement('small');
      location.textContent = [entry.node.library, entry.node.group, entry.node.type === 'module' && entry.node.id].filter(Boolean).join(' / ');
      button.append(location);
      button.addEventListener('click', () => commit(entry));
      results.append(button);
    }
    if (!matches.length) results.textContent = 'No results';
    expanded(true);
    markActive();
  }

  function markActive() {
    [...results.children].forEach((button, index) => button.classList.toggle('active', index === active));
    results.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  function commit(entry) {
    if (!entry) return;
    expanded(false);
    input.blur();
    choose(entry);
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('click', () => { if (results.hidden) update(); });
  bar.addEventListener('focusout', event => {
    if (!bar.contains(event.relatedTarget)) expanded(false);
  });
  document.addEventListener('pointerdown', event => {
    if (!bar.contains(event.target)) expanded(false);
  }, true);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      expanded(false);
      input.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(matches[active]);
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    active = Math.max(0, Math.min(matches.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
    markActive();
  });
  return function open() {
    if (document.activeElement === input && results.hidden) update();
    input.focus();
    input.select();
  };
}
