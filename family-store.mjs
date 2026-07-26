async function responseError(response) {
  const body = await response.text().catch(() => '');
  return new Error(`Shared state request failed: ${response.status}${body ? ` ${body}` : ''}`);
}

export class JsonBlobStore {
  constructor({fetchImpl = globalThis.fetch, now = Date.now} = {}) {
    if (!fetchImpl) throw new Error('fetch is required');
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.now = now;
  }

  async read(url) {
    const separator = url.includes('?') ? '&' : '?';
    const response = await this.fetchImpl(`${url}${separator}_t=${this.now()}`, {
      cache:'no-store',
      headers:{Accept:'application/json'}
    });
    if (!response.ok) throw await responseError(response);
    return response.json();
  }

  async write(url, value) {
    const next = {...value, updatedAt:this.now()};
    const response = await this.fetchImpl(url, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(next)
    });
    if (!response.ok) throw await responseError(response);
    return next;
  }

  async update(url, updater) {
    const current = await this.read(url);
    const next = await updater(current);
    return this.write(url, next);
  }
}

export function startPolling(load, {interval = 2000, onError = console.error} = {}) {
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try { await load(); } catch (error) { onError(error); }
    if (!stopped) timer = setTimeout(tick, interval);
  };
  tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
