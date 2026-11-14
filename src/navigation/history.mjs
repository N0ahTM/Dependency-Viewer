export class ViewerHistory {
  #browser;
  #session;
  #entries;
  #index;

  constructor(browser) {
    this.#browser = browser;
    this.reset();
  }

  get current() { return this.#entries[this.#index]; }
  get previous() { return this.#entries[this.#index - 1]; }
  get index() { return this.#index; }
  get canGoBack() { return this.#index > 0; }
  get canGoForward() { return this.#index + 1 < this.#entries.length; }

  reset() {
    this.#session = crypto.randomUUID?.() ?? String(Date.now());
    this.#entries = [{ location: {} }];
    this.#index = 0;
    this.#browser.replaceState(this.#browserState(), '');
  }

  push(entry) {
    this.#index++;
    this.#entries.splice(this.#index, this.#entries.length, entry);
    this.#browser.pushState(this.#browserState(), '');
  }

  back() { if (this.canGoBack) this.#browser.back(); }
  forward() { if (this.canGoForward) this.#browser.forward(); }

  resolve(state) {
    if (state?.viewer === this.#session) return this.#entries[state.index];
  }

  activate(state) { this.#index = state.index; }

  #browserState() { return { viewer: this.#session, index: this.#index }; }
}
