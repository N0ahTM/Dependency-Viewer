export function bindShortcuts({ canGoBack, canGoForward, back, forward, openSearch, zoom, fit, openHelp, escape }) {
  document.addEventListener('mousedown', event => {
    if ((event.button === 3 && canGoBack()) || (event.button === 4 && canGoForward())) {
      event.preventDefault();
    }
  });
  document.addEventListener('auxclick', event => {
    if (event.button !== 3 && event.button !== 4) return;
    if (event.button === 3 && !canGoBack()) return;
    if (event.button === 4 && !canGoForward()) return;
    event.preventDefault();
    if (event.button === 3) back();
    else forward();
  });
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if ((event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) ||
        ['BrowserBack', 'BrowserForward'].includes(event.key)) {
      event.preventDefault();
      if (['ArrowLeft', 'BrowserBack'].includes(event.key)) back();
      else forward();
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      openSearch();
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      zoom(event.key === '-' ? 1.25 : .8);
    }
    if (['0', 'f', 'F'].includes(event.key)) {
      event.preventDefault();
      fit();
    }
    if (event.key === '?') openHelp();
    if (event.key === 'Escape') escape();
  });
}
