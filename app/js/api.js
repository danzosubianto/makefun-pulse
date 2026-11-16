// Pulse's API layer: the only module that talks to the network.
//
// Every read is a GET against make.fun's public API. Responses are kept in a
// small in-memory cache keyed by URL, each with the ETag the API sent. The
// API's ETags are minute-bound, so an entry counts as fresh for a short window
// and route changes inside that window cost no request at all. Past the
// window we revalidate with If-None-Match: a 304 reuses the cached body, so
// repeat visits stay cheap even when the data has not changed. Identical
// in-flight requests are deduped — two views asking for the same URL share
// one fetch.

const API_BASE = 'https://make.fun/api';
const FRESH_MS = 45_000; // inside the API's own minute-bound ETag lifetime

const cache = new Map(); // url -> { etag: string|null, body: unknown, at: number }
const inflight = new Map(); // url -> Promise<unknown>

export function apiUrl(path) {
  return API_BASE + path;
}

async function fetchJson(url) {
  const hit = cache.get(url);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.body;
  }
  if (!res.ok) {
    const err = new Error(`make.fun API answered ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  cache.set(url, { etag: res.headers.get('etag'), body, at: Date.now() });
  return body;
}

// GET a public API path (e.g. "/competitions") and resolve with parsed JSON.
export function get(path) {
  const url = apiUrl(path);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.body);
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = fetchJson(url).finally(() => {
    if (inflight.get(url) === p) inflight.delete(url);
  });
  inflight.set(url, p);
  return p;
}

// Drop one cached path (used by retry buttons after an error).
export function invalidate(path) {
  cache.delete(apiUrl(path));
}
