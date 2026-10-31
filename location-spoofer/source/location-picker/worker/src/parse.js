// TIKTOOOO 2026-10-31, AGPL-3.0. Conversion helpers derived from xepes0/wloc.
import { extractFromString, toWgs84, round6 } from './vendor/wloc-parse.js';

const HOSTS = new Map([
  ['maps.apple.com', 'apple'], ['maps.apple', 'apple'],
  ['amap.com', 'amap'], ['www.amap.com', 'amap'],
  ['uri.amap.com', 'amap'], ['ditu.amap.com', 'amap'],
  ['surl.amap.com', 'amap'], ['m.amap.com', 'amap'],
]);
export function checkedUrl(value, base) {
  let u;
  try { u = new URL(value, base); } catch { throw new Error('无效地图链接'); }
  if (!HOSTS.has(u.hostname) || !['http:', 'https:'].includes(u.protocol) ||
      u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) {
    throw new Error('仅支持苹果地图或高德地图的官方分享链接');
  }
  u.protocol = 'https:';
  u.port = '';
  return u;
}

function extract(u) {
  const source = HOSTS.get(u.hostname);
  // sll is a search viewport, not necessarily the selected place.
  const copy = new URL(u);
  copy.searchParams.delete('sll');
  const hit = extractFromString(copy.href, { allowBare: false });
  if (!hit || hit.src !== source) return null;
  return { ...hit, src: source, name: hit.name || u.searchParams.get('q') || '地图选点' };
}

async function cappedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > 256 * 1024) throw new Error('地图页面过大，请改用带坐标的分享链接');
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}

function fromBody(body, current) {
  const text = body.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  // Only follow explicit coordinate URLs, not arbitrary decimal pairs in HTML.
  for (const candidate of text.match(/https?:\/\/[^\s"'<>]+/g) || []) {
    try {
      const url = checkedUrl(candidate);
      if (HOSTS.get(url.hostname) !== HOSTS.get(current.hostname)) continue;
      const hit = extract(url);
      if (hit) return hit;
    } catch { /* Non-map assets are ignored, never fetched. */ }
  }
  return null;
}

export async function parseMap(text, datum = 'auto', fetcher = fetch) {
  if (typeof text !== 'string' || text.length > 8192) throw new Error('分享内容为空或过长');
  if (!['auto', 'wgs84', 'gcj02'].includes(datum)) throw new Error('未知坐标类型');
  const value = text.match(/https?:\/\/[^\s"'<>，。；）)]+/i)?.[0];
  if (!value) throw new Error('请从苹果地图或高德地图分享地点链接');
  let current = checkedUrl(value), hit = extract(current);
  const signal = AbortSignal.timeout(8000); // One deadline includes redirects and body reads.
  for (let redirects = 0; !hit && redirects <= 4; redirects++) {
    const response = await fetcher(current.href, { redirect: 'manual', signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === 4) throw new Error('地图链接跳转次数过多');
      current = checkedUrl(location, current);
      hit = extract(current);
    } else {
      if (!response.ok) { await response.body?.cancel(); throw new Error('地图服务暂时不可用'); }
      hit = fromBody(await cappedText(response), current);
      break;
    }
  }
  if (!hit) throw new Error('无法确定所选地点坐标，请用网页选点或分享带坐标的链接');
  const point = datum === 'wgs84' ? hit : toWgs84(hit.lat, hit.lon, datum === 'gcj02' ? 'amap' : hit.src);
  return { name: String(hit.name).slice(0, 200), source: hit.src,
    latitude: round6(point.lat), longitude: round6(point.lon), datum: 'wgs84', inputDatum: datum,
    notice: '自动转换遵循地图来源及地区规则；边界附近或位置有偏移时请在网页核对，勿重复转换。' };
}
