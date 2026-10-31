const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../location-spoofer.js'), 'utf8');
function execute({ response, enabled = false, cached = true, argumentObject = false }) {
  let done, requests = 0; const logs = [];
  const args = { enabled: String(enabled), debug: 'true', latitude: '37.33', longitude: '-122.01',
    configUrl: 'https://example.test/loc.json?token=DO_NOT_LOG_ME' };
  const context = { Uint8Array, ArrayBuffer, Date, console: { log: (line) => logs.push(line) },
    $loon: {}, $argument: argumentObject ? args : new URLSearchParams(args).toString(),
    $request: { url: 'https://gs-loc.apple.com/clls/wloc', headers: { 'Accept-Encoding': 'gzip' } },
    $persistentStore: { read: (key) => key === 'location_spoofer_remote_cfg' && cached ? JSON.stringify({
      ts: Date.now(), url: args.configUrl, data: { enabled: true, latitude: 40, longitude: 116 },
    }) : null, write: () => true },
    $httpClient: { get: (_, cb) => { requests++; cb('contains DO_NOT_LOG_ME'); } },
    $done: (result) => { done = result; },
  };
  if (response) context.$response = { body: new Uint8Array([1, 2, 3]), headers: {} };
  vm.runInNewContext(source, context);
  return { done, requests, logs };
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
