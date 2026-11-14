import { createModel } from '../data/model.mjs';
import { normalizeInput } from '../data/input.mjs';

export function bindDatasetPicker(button, input, { accept, reportError }) {
  button.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = normalizeInput(JSON.parse(await file.text()));
      accept(data, createModel(data));
    } catch (error) {
      reportError(error.message);
    }
  };
}
