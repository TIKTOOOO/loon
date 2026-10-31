import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { parseMap } from '../src/parse.js';
import { wgs84ToGcj02 } from '../src/vendor/wloc-parse.js';

const unexpectedFetch = () => { throw Error('Unexpected network'); };
test('Apple selected pin abroad is unchanged; mixed share text supported', async () => {
  const p = await parseMap('Apple Park https://maps.apple.com/?ll=37.334643,-122.008972&name=Apple%20Park', 'auto', unexpectedFetch);
  assert.equal(p.latitude, 37.334643); assert.equal(p.longitude, -122.008972);
  assert.equal(p.name, 'Apple Park'); assert.equal(p.source, 'apple');
});
test('Apple place coordinate and Amap long link convert mainland once', async () => {
  const gcj = wgs84ToGcj02(39.9, 116.4);
  for (const url of [`https://maps.apple.com/place?coordinate=${gcj.lat},${gcj.lon}&name=Test`,
    `https://uri.amap.com/marker?position=${gcj.lon},${gcj.lat}&name=Test`,
    `https://www.amap.com/?p=B000,${gcj.lat},${gcj.lon},Test,Beijing`]) {
    const p = await parseMap(url, 'auto', unexpectedFetch);
    assert.ok(Math.abs(p.latitude - 39.9) < 0.00001);
    assert.ok(Math.abs(p.longitude - 116.4) < 0.00001);
  }
});
test('Apple Hong Kong and Taiwan stay WGS84; explicit WGS84 avoids double conversion', async () => {
  for (const [lat, lng] of [[22.284774, 114.159437], [25.033626, 121.564215]]) {
    const p = await parseMap(`https://maps.apple.com/?ll=${lat},${lng}`, 'auto', unexpectedFetch);
    assert.equal(p.latitude, lat); assert.equal(p.longitude, lng);
  }
  const p = await parseMap('https://maps.apple.com/?ll=39.900001,116.400001', 'wgs84', unexpectedFetch);
  assert.equal(p.latitude, 39.900001); assert.equal(p.longitude, 116.400001);
});
test('Amap short link expands with bounded redirect and source checks', async () => {
  let calls = 0;
  const p = await parseMap('地点分享 https://surl.amap.com/abc。', 'auto', async (url, opts) => {
    calls++; assert.equal(opts.redirect, 'manual'); assert.ok(opts.signal);
    return new Response(null, { status: 302, headers: { location: 'https://www.amap.com/?q=37.334643,-122.008972,Test' } });
  });
  assert.equal(calls, 1); assert.equal(p.source, 'amap');
});
test('Apple short link and canonical selected point page are parsed', async () => {
  const p = await parseMap('https://maps.apple/p/abc', 'auto', async () => new Response(
    '<link rel="canonical" href="https://maps.apple.com/place?coordinate=37.334643,-122.008972&amp;name=Apple%20Park">'));
  assert.equal(p.latitude, 37.334643); assert.equal(p.name, 'Apple Park');
});
test('Reject invalid hosts and every unsafe redirect, no arbitrary page decimals', async () => {
  for (const url of ['https://evil.test/?ll=39.9,116.4', 'https://maps.apple.com.evil.test/?ll=39.9,116.4',
    'https://maps.apple.com@127.0.0.1/?ll=39.9,116.4', 'https://maps.apple.com:8443/?ll=39.9,116.4']) {
    await assert.rejects(parseMap(url, 'auto', unexpectedFetch));
  }
  await assert.rejects(parseMap('https://surl.amap.com/abc', 'auto', async () => new Response(null, {
    status: 302, headers: { location: 'https://evil.test/?q=39.9,116.4' },
  })));
  await assert.rejects(parseMap('https://maps.apple.com/?sll=39.9,116.4', 'auto', async () => new Response('unrelated 39.900000,116.400000')));
});
test('Redirect loops, timeouts and oversized pages fail', async () => {
  let calls = 0;
  await assert.rejects(parseMap('https://surl.amap.com/loop', 'auto', async () => {
    calls++; return new Response(null, { status: 302, headers: { location: '/loop' } });
  }));
  assert.equal(calls, 5);
  await assert.rejects(parseMap('https://surl.amap.com/timeout', 'auto', async () => { throw new DOMException('timeout', 'TimeoutError'); }));
  await assert.rejects(parseMap('https://maps.apple.com/place', 'auto', async () => new Response('x'.repeat(262145))));
});
function fixture(failWrite = false) {
  let stored = null, writes = 0;
  const env = { TOKEN: 'test-only-secret', LOC_KV: { get: async () => stored, put: async (_, data) => {
    if (failWrite) throw Error('KV unavailable'); stored = data; writes++;
  } } };
  async function request(path, data, token = env.TOKEN) {
    const r = await app.fetch(new Request('https://example.test' + path, {
      method: data === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    }), env);
    return { status: r.status, body: await r.json() };
  }
  return { env, request, writes: () => writes, stored: () => stored };
}
test('Auth, parse-only and bad input never modify coordinates', async () => {
  const f = fixture();
  assert.equal((await f.request('/set', { lat: 1, lng: 2 }, 'wrong')).status, 403);
  assert.equal((await f.request('/api/parse', { text: 'https://maps.apple.com/?ll=37.334643,-122.008972' })).body.ok, true);
  for (const data of [{ lat: null, lng: 2 }, { lat: '', lng: 2 }, { lat: 91, lng: 2 }, { lat: 1, lng: 181 }]) {
    assert.equal((await f.request('/set', data)).status, 400);
  }
  assert.equal((await f.request('/enable', {})).status, 400); assert.equal(f.writes(), 0);
});
test('Save, read, disable, and invalid parse retain prior saved coordinates', async () => {
  const f = fixture();
  const saved = await f.request('/set', { lat: 37.33, lng: -122.01 });
  assert.equal(saved.body.status, 'saved'); assert.ok(saved.body.revision);
  assert.equal((await f.request('/loc.json')).body.latitude, 37.33);
  const previous = f.stored();
  assert.equal((await f.request('/api/parse', { text: 'invalid' })).status, 422);
  assert.equal(f.stored(), previous);
  assert.equal((await f.request('/enable', { enabled: false })).body.enabled, false);
  assert.equal((await f.request('/loc.json')).body.longitude, -122.01);
});
test('KV failure cannot claim save success; malformed JSON and oversized input rejected', async () => {
  const f = fixture(true);
  const r = await f.request('/set', { lat: 1, lng: 2 });
  assert.equal(r.status, 503); assert.equal(r.body.ok, false); assert.equal(f.writes(), 0);
  for (const data of ['{', 'x'.repeat(10001)]) {
    const response = await app.fetch(new Request('https://example.test/set', { method: 'POST',
      headers: { Authorization: 'Bearer test-only-secret' }, body: data }), f.env);
    assert.equal(response.status, 400);
  }
});
