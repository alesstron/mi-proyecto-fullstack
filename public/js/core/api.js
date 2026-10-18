/* =========================================================
   Cliente HTTP de la API: JSON, timeout, cancelación y errores
   normalizados con el mismo formato que devuelve el servidor.
   ========================================================= */
const BASE = (document.querySelector('meta[name="api-base"]')?.content ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, query, signal, timeout = 10_000 } = {}) {
  const url = new URL(BASE + path, location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: 'same-origin'
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timedOut = err?.name === 'TimeoutError' || ctrl.signal.reason?.name === 'TimeoutError';
    throw new ApiError(0, timedOut ? 'TIMEOUT' : 'NETWORK',
      timedOut ? 'El servidor tarda demasiado en responder. Inténtalo de nuevo.' : 'No pudimos conectar con el servidor. Revisa tu conexión.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? 'Algo salió mal. Inténtalo de nuevo.', e?.details);
  }
  return data;
}
