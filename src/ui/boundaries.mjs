import { setIconButton } from './icons.mjs';
import { showBoundary } from './details.mjs';

export function renderBoundaries(panel, host, boundaries, label) {
  panel.replaceChildren();
  for (const boundary of boundaries) {
    const outgoing = boundary.type === 'imports';
    const button = setIconButton(document.createElement('button'), outgoing ? 'outgoing' : 'incoming',
      outgoing ? 'External dependencies' : 'External consumers');
    button.type = 'button';
    const highlight = active => {
      for (const card of host.querySelectorAll('.card[data-node-id]')) {
        card.classList.toggle('endpoint', active && boundary.members.has(card.dataset.nodeId));
      }
    };
    button.onpointerenter = () => highlight(true);
    button.onpointerleave = () => highlight(false);
    button.onfocus = () => highlight(true);
    button.onblur = () => highlight(false);
    button.onclick = () => showBoundary(boundary, label);
    panel.append(button);
  }
  panel.hidden = !panel.childElementCount;
}
