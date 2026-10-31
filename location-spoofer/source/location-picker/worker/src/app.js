// TIKTOOOO modified 2026-10-31. AGPL-3.0; upstream mekos2772/ios-location-spoofer.
import { PAGE } from './page.js';
import { parseMap } from './parse.js';
const DEFAULT = { enabled: false, latitude: 37.3349, longitude: -122.00902,
  altitude: 530, horizontalAccuracy: 39, verticalAccuracy: 1000 };
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'origin',
  'X-Content-Type-Options': 'nosniff' };
const csp = "default-src 'none'; script-src https://unpkg.com 'unsafe-inline'; style-src https://unpkg.com 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://api.open-meteo.com https://nominatim.openstreetmap.org; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
});
function authenticated(request, env) {
  const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') ||
    new URL(request.url).searchParams.get('token') || '';
  if (!env.TOKEN || !provided) return false;
  const a = new TextEncoder().encode(provided), b = new TextEncoder().encode(env.TOKEN);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error('请求正文不能为空');
  let size = 0, text = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 10000) throw Error('请求内容过长');
      text += decoder.decode(part.value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
  const parsed = JSON.parse(text + decoder.decode());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('请求格式错误');
  return parsed;
}
const validNumber = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
async function readLoc(env) {
  const stored = await env.LOC_KV.get('loc');
  if (!stored) return { ...DEFAULT };
  const loc = JSON.parse(stored);
  if (!loc || typeof loc.enabled !== 'boolean' || !validNumber(loc.latitude, -90, 90) || !validNumber(loc.longitude, -180, 180)) throw Error('Invalid stored config');
  return loc;
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return json({ ok: !!env.LOC_KV && !!env.TOKEN,
      kv: !!env.LOC_KV, tokenConfigured: !!env.TOKEN });
    if (!env.TOKEN || !env.LOC_KV) return json({ ok: false, error: '服务器尚未配置 TOKEN 或 LOC_KV' }, 503);
    if (!authenticated(request, env)) return json({ ok: false, error: '访问口令错误' }, 403);
    if (path === '/' && request.method === 'GET') return new Response(PAGE, {
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp },
    });
    if (path === '/favicon.ico') return new Response(null, { status: 204, headers });
    if (path === '/loc.json' && request.method === 'GET') {
      try { return json(await readLoc(env)); }
      catch { return json({ ok: false, error: '配置读取失败，请稍后再试' }, 503); }
    }
    if (request.method !== 'POST' || !['/set', '/enable', '/api/parse'].includes(path)) return json({ ok: false, error: '接口或请求方式不存在' }, 404);
    let data;
    try { data = await body(request); }
    catch { return json({ ok: false, error: '请求必须是有效 JSON 且不超过 10KB' }, 400); }
    if (path === '/api/parse') {
      try { return json({ ok: true, ...await parseMap(data.text, data.datum || 'auto') }); }
      catch (error) {
        const message = error.name === 'TimeoutError' || error.name === 'AbortError' ? '地图链接解析超时，请重试' : error.message;
        return json({ ok: false, error: message }, 422);
      }
    }
    if (path === '/set' && (!validNumber(data.lat, -90, 90) || !validNumber(data.lng, -180, 180))) return json({ ok: false, error: '经纬度必须是有效数字，纬度 ±90，经度 ±180' }, 400);
    if (path === '/enable' && typeof data.enabled !== 'boolean') return json({ ok: false, error: 'enabled 必须是布尔值' }, 400);
    for (const [key, min, max] of [['altitude', -12000, 100000], ['horizontalAccuracy', 1, 100000], ['verticalAccuracy', 1, 100000]]) {
      if (data[key] != null && !validNumber(data[key], min, max)) return json({ ok: false, error: key + ' 超出有效范围' }, 400);
    }
    try {
      const loc = await readLoc(env);
      if (path === '/set') {
        Object.assign(loc, { enabled: true, latitude: data.lat, longitude: data.lng });
        for (const key of ['altitude', 'horizontalAccuracy', 'verticalAccuracy']) if (data[key] != null) loc[key] = Math.round(data[key]);
      } else loc.enabled = data.enabled;
      loc.updatedAt = new Date().toISOString();
      loc.revision = crypto.randomUUID();
      await env.LOC_KV.put('loc', JSON.stringify(loc));
      return json({ ...loc, ok: true, status: 'saved', notice: '服务器已保存；等待 Loon 刷新配置后手动关开定位服务，再验证地图。' });
    } catch { return json({ ok: false, error: '配置存储失败，未确认保存，请勿当作成功' }, 503); }
  },
};
