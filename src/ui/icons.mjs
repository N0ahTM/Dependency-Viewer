const shapes = {
  library: 'M3 7 12 3l9 4-9 4-9-4Z M3 12l9 4 9-4 M3 17l9 4 9-4',
  group: 'M3 7h7l2 3h9v10H3V7Z',
  module: 'M8 3h8l5 5v13H3V3h5 M15 3v6h6 M7 13h10 M7 17h7',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 1 1 16 0',
  atlas: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  focus: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M12 9v6 M9 12h6',
  path: 'M4 17h4l4-10h8 M17 4l3 3-3 3 M4 14v6',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  check: 'M4 12l5 5L20 6',
  open: 'M3 7h7l2 2h9l-3 11H3z M3 7V4h7l2 3h7',
  back: 'M10 5l-7 7 7 7 M3 12h18',
  close: 'M6 6l12 12 M18 6 6 18',
  fit: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z',
  plus: 'M5 12h14 M12 5v14',
  minus: 'M5 12h14',
  cycle: 'M20 7v5h-5 M4 17v-5h5 M4 10a8 8 0 0 1 13-5l3 7 M20 14a8 8 0 0 1-13 5l-3-7',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 18h.01',
  incoming: 'M4 5v14 M20 12H8 M13 7l-5 5 5 5',
  outgoing: 'M20 5v14 M4 12h12 M11 7l5 5-5 5',
};

export function icon(name, cssClass = 'tool-icon') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cssClass);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', shapes[name]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.7');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

export function setIconButton(button, glyph, label) {
  button.replaceChildren(icon(glyph));
  button.classList.add('icon-button');
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}
