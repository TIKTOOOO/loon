const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../location-spoofer.js'), 'utf8');
function execute({ response, enabled = false, cached = true, argumentObject = false, store, remoteData, remoteStatus = 200, deferred = false }) {
  let done, requests = 0, pending; const logs = [], writes = [];
  const args = { enabled: String(enabled), debug: 'true', latitude: '37.33', longitude: '-122.01',
    configUrl: 'https://example.test/loc.json?token=DO_NOT_LOG_ME' };
  const context = { Uint8Array, ArrayBuffer, Date, console: { log: (line) => logs.push(line) },
    $loon: {}, $argument: argumentObject ? args : new URLSearchParams(args).toString(),
    $request: { url: 'https://gs-loc.apple.com/clls/wloc', headers: { 'Accept-Encoding': 'gzip' } },
    $persistentStore: { read: (key) => store ? store.get(key) : key === 'location_spoofer_remote_cfg' && cached ? JSON.stringify({
      ts: Date.now(), url: args.configUrl, data: { enabled: true, latitude: 40, longitude: 116 },
    }) : null, write: (value, key) => { writes.push({ value, key }); if (store) store.set(key, value); return true; } },
    $httpClient: { get: (_, cb) => {
      requests++;
      const finish = () => remoteData === undefined ? cb('contains DO_NOT_LOG_ME') : cb(null, { status: remoteStatus }, JSON.stringify(remoteData));
      if (deferred) pending = finish; else finish();
    } },
    $done: (result) => { done = result; },
  };
  if (response) context.$response = { body: new Uint8Array([1, 2, 3]), headers: {} };
  vm.runInNewContext(source, context);
  return { get done() { return done; }, requests, logs, writes, flush: () => pending() };
}
test('Local disable wins over enabled remote cache, both Loon argument representations', () => {
  for (const response of [true, false]) for (const argumentObject of [true, false]) {
    const r = execute({ response, argumentObject });
    assert.equal(JSON.stringify(r.done), '{}'); assert.equal(r.requests, 0);
    assert.ok(r.logs.some(line => line.includes('pass-through')));
    assert.ok(r.logs.every(line => !line.includes('DO_NOT_LOG_ME')));
  }
});
test('Fetch failure logs do not expose config credentials', () => {
  const r = execute({ response: true, enabled: true, cached: false });
  assert.equal(r.requests, 1);
  assert.ok(r.logs.every(line => !line.includes('DO_NOT_LOG_ME')));
});
test('Wait for remote refresh before done, then persist value under the correct Loon key', () => {
  const store = new Map();
  const r = execute({ response: true, enabled: true, store, remoteData: { enabled: false, latitude: 1, longitude: 2 }, deferred: true });
  assert.equal(r.done, undefined); r.flush();
  assert.equal(JSON.stringify(r.done), '{}');
  assert.equal(r.writes[0].key, 'location_spoofer_remote_cfg');
  assert.equal(JSON.parse(store.get('location_spoofer_remote_cfg')).data.enabled, false);
  const offline = execute({ response: true, enabled: true, store });
  assert.equal(JSON.stringify(offline.done), '{}');
  assert.ok(offline.logs.some(line => line.includes('source=remote-cache, enabled=false')));
});
test('Fresh remote disable overrides enabled cache during the same request', () => {
  const r = execute({ response: true, enabled: true, cached: true, remoteData: { enabled: false } });
  assert.equal(JSON.stringify(r.done), '{}');
  assert.ok(r.logs.some(line => line.includes('source=remote-fetch, enabled=false')));
});
test('Remote HTTP errors or invalid JSON config without cache pass through instead of using a default fake location', () => {
  for (const scenario of [{ remoteData: { error: 'wrong token' }, remoteStatus: 403 },
    { remoteData: { enabled: true, latitude: null, longitude: 180 } }, { remoteData: {} }, {}]) {
    const r = execute({ response: true, enabled: true, cached: false, ...scenario });
    assert.equal(JSON.stringify(r.done), '{}'); assert.equal(r.writes.length, 0);
    assert.ok(r.logs.some(line => line.includes('source=remote-unavailable, enabled=false')));
  }
});
