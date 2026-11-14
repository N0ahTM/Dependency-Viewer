export function rememberCheckbox(control) {
  const key = 'dependency-viewer:' + control.id;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'true' || saved === 'false') control.checked = saved === 'true';
  } catch {
    // Preferences still work for this page when browser storage is blocked.
  }
  control.addEventListener('change', () => {
    try { localStorage.setItem(key, String(control.checked)); } catch {}
  });
}
