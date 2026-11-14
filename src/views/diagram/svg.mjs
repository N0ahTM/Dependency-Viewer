const namespace = 'http://www.w3.org/2000/svg';

export function svgElement(name, attributes = {}, text) {
  const element = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

export function activate(element, label, action) {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', action);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action(event);
    }
  });
}

export function setView(svg, { x, y, width, height }) {
  svg.setAttribute('viewBox', [x, y, width, height].join(' '));
}
