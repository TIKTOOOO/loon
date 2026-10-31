// Remote-only control regression tests; filename retained for existing CI entrypoints.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const api = require('../location-spoofer.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../location-spoofer.js'), 'utf8');
const active = { enabled: true, latitude: 40, longitude: 116 };
const location = api.concatBytes([api.makeVarintField(1, api.coordToInt(22)), api.makeVarintField(2, api.coordToInt(113))]);
const realBody = api.buildAppleWLocResponse(api.makeLengthDelimitedField(2, api.makeLengthDelimitedField(2, location)));
function execute({ response = true, cached = false, argumentObject = false, store = new Map(),
  remoteData, remoteStatus = 200, deferred = false, configured = true, legacyEnabled, cacheAge = 1000 } = {}) {
  let done, requests = 0, pending; const logs = [], writes = [], timeouts = [];
  const args = { debug: 'true' };
  if (configured) args.configUrl = 'https://example.test/loc.json?token=DO_NOT_LOG_ME';
  if (legacyEnabled !== undefined) Object.assign(args, { enabled: String(legacyEnabled), latitude: '91', longitude: '-122.01' });
  if (cached) store.set('location_spoofer_remote_cfg', JSON.stringify({ ts: Date.now() - cacheAge, url: args.configUrl, data: active }));
  const context = { Uint8Array, ArrayBuffer, Date, console: { log: (line) => logs.push(line) },
    $loon: {}, $argument: argumentObject ? args : new URLSearchParams(args).toString(),
    $request: { url: 'https://gs-loc.apple.com/clls/wloc', headers: { 'Accept-Encoding': 'gzip' } },
    $persistentStore: { read: key => store.get(key), write: (value, key) => { writes.push({ value, key }); store.set(key, value); return true; } },
    $httpClient: { get: (options, cb) => {
      requests++; timeouts.push(options.timeout);
      const finish = () => remoteData === undefined ? cb('contains DO_NOT_LOG_ME') : cb(null, { status: remoteStatus }, JSON.stringify(remoteData));
      if (deferred) pending = finish; else finish();
    } }, $done: result => { done = result; },
  };
  if (response) context.$response = { body: realBody, headers: {} };
  vm.runInNewContext(source, context);
  return { get done() { return done; }, requests, timeouts, logs, writes, store, flush: () => pending() };
}
function pass(r) { assert.equal(JSON.stringify(r.done), '{}'); }
function modified(r, response) {
  if (response) {
    assert.equal(r.done.headers['X-Location-Spoofer-Target'], '40,116');
    const payload = api.extractAppleWLocPayload(r.done.body).payload;
    assert.ok(api.patchedPayloadSummary(payload).includes('40.00000000,116.00000000'));
  } else assert.equal(r.done.headers['Accept-Encoding'], 'identity');
}
test('No server means pass-through even with legacy enabled/manual arguments and cached data', () => {
  for (const response of [true, false]) for (const argumentObject of [true, false]) {
    const r = execute({ response, argumentObject, configured: false, legacyEnabled: true, cached: true });
    pass(r); assert.equal(r.requests, 0);
    assert.ok(r.logs.some(line => line.includes('source=remote-unconfigured')));
  }
});
test('Both phases wait for server state; enable prepares headers and rewrites actual coordinates', () => {
  for (const response of [true, false]) for (const argumentObject of [true, false]) {
    const r = execute({ response, argumentObject, remoteData: active, deferred: true, legacyEnabled: false });
    assert.equal(r.done, undefined); assert.deepEqual(r.timeouts, [3000]); r.flush(); modified(r, response);
    assert.equal(r.writes[0].key, 'location_spoofer_remote_cfg');
    assert.ok(r.logs.every(line => !line.includes('DO_NOT_LOG_ME')));
  }
});
test('Server stop overrides active cache in both phases and persists stopped state for offline requests', () => {
  for (const response of [true, false]) {
    const r = execute({ response, cached: true, remoteData: { enabled: false }, deferred: true });
    assert.equal(r.done, undefined); r.flush(); pass(r);
    assert.equal(JSON.parse(r.store.get('location_spoofer_remote_cfg')).data.enabled, false);
    const offline = execute({ response, store: r.store }); pass(offline);
    assert.ok(offline.logs.some(line => line.includes('source=remote-cache, enabled=false')));
  }
});
test('Valid five-minute active cache is used only on fetch failure in both phases', () => {
  for (const response of [true, false]) {
    const r = execute({ response, cached: true }); modified(r, response);
    assert.ok(r.logs.some(line => line.includes('source=remote-cache, enabled=true')));
    assert.equal(r.writes.length, 0);
  }
});
test('Expired or malformed cache cannot keep rewriting', () => {
  for (const response of [true, false]) {
    pass(execute({ response, cached: true, cacheAge: 300001 }));
    const store = new Map([['location_spoofer_remote_cfg', JSON.stringify({
      url: 'https://example.test/loc.json?token=DO_NOT_LOG_ME', data: active,
    })]]);
    pass(execute({ response, store }));
  }
});
test('Fresh save after stop enables both phases again', () => {
  for (const response of [true, false]) {
    const stopped = execute({ response, remoteData: { enabled: false } }); pass(stopped);
    modified(execute({ response, store: stopped.store, remoteData: active }), response);
  }
});
test('HTTP errors or invalid remote config without cache pass through and never leak credentials', () => {
  for (const response of [true, false]) for (const scenario of [
    { remoteData: { error: 'wrong token' }, remoteStatus: 403 },
    { remoteData: { enabled: true, latitude: null, longitude: 180 } },
    { remoteData: { latitude: 1, longitude: 2 } }, { remoteData: {} }, {},
  ]) {
    const r = execute({ response, ...scenario }); pass(r); assert.equal(r.writes.length, 0);
    assert.ok(r.logs.some(line => line.includes('source=remote-unavailable, enabled=false')));
    assert.ok(r.logs.every(line => !line.includes('DO_NOT_LOG_ME')));
  }
});
