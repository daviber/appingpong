import { ApiError, createSeries, SeriesInput, StoredSeries, updateSeries } from './series';

const STORAGE_KEY = 'appingpong:series:v1';
const METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  return origin && (origin === 'http://localhost:4200' || origin === env.ALLOWED_ORIGIN) ? origin : null;
}

function headers(origin: string | null): Headers {
  const result = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' });
  if (origin) {
    result.set('Access-Control-Allow-Origin', origin);
    result.set('Access-Control-Allow-Methods', METHODS);
    result.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return result;
}

function json(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}

async function body(request: Request): Promise<SeriesInput> {
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as SeriesInput;
  } catch { throw new ApiError(400, 'BAD_REQUEST', 'Request body must be valid JSON'); }
}

async function readSeries(env: Env): Promise<StoredSeries[]> {
  const value = await env.APPINGPONG_KV.get<unknown>(STORAGE_KEY, 'json');
  return Array.isArray(value) ? value as StoredSeries[] : [];
}

async function route(request: Request, env: Env, origin: string | null): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (url.pathname === '/api/health') {
    if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return json({ ok: true }, 200, origin);
  }
  if (url.pathname === '/api/series') {
    const series = await readSeries(env);
    if (request.method === 'GET') return json({ series: series.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }, 200, origin);
    if (request.method === 'POST') {
      const created = createSeries(await body(request));
      await env.APPINGPONG_KV.put(STORAGE_KEY, JSON.stringify([created, ...series]));
      return json({ series: created }, 201, origin);
    }
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  const match = url.pathname.match(/^\/api\/series\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const series = await readSeries(env);
    const index = series.findIndex(item => item.id === id);
    if (index < 0) throw new ApiError(404, 'NOT_FOUND', 'Series not found');
    if (request.method === 'PATCH') {
      const updated = updateSeries(series[index], await body(request));
      series[index] = updated;
      await env.APPINGPONG_KV.put(STORAGE_KEY, JSON.stringify(series));
      return json({ series: updated }, 200, origin);
    }
    if (request.method === 'DELETE') {
      await env.APPINGPONG_KV.put(STORAGE_KEY, JSON.stringify(series.filter(item => item.id !== id)));
      const responseHeaders = headers(origin); responseHeaders.delete('Content-Type');
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  throw new ApiError(404, 'NOT_FOUND', 'Route not found');
}

export default {
  async fetch(request, env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    try { return await route(request, env, origin); }
    catch (error) {
      if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status, origin);
      console.error('Worker error', error);
      return json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }, 500, origin);
    }
  },
} satisfies ExportedHandler<Env>;
