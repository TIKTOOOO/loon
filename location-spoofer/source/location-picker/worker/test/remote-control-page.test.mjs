import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PAGE } from '../src/page.js';

function fixture(mode = 'success') {
  const nodes = new Map(), requests = [];
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', disabled: false,
      addEventListener() {}, classList: { add() {}, remove() {} } });
    return nodes.get(id);
  } };
  const context = { document, URLSearchParams, location: { search: '?token=test-secret' },
    setTimeout() {}, navigator: {}, fetch: async (url, options) => {
      const path = url.split('?')[0], body = JSON.parse(options.body); requests.push({ path, body });
      if (mode === 'network') throw Error('offline');
      const result = path === '/api/parse'
        ? { ok: true, latitude: 3, longitude: 4, name: 'Test', source: 'apple' }
        : { ok: true, status: 'saved', enabled: path === '/set' };
      if (mode === 'unconfirmed') result.status = 'unknown';
      if (mode === 'wrong-state') result.enabled = !result.enabled;
      return { ok: mode !== 'http', status: mode === 'http' ? 503 : 200, json: async () => result };
    } };
  const script = PAGE.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/\nload\(\);\s*$/, '');
  vm.runInNewContext(script, context);
  Object.assign(context, { configLoaded: true, enabledState: true, saved: false,
    serverLocation: { latitude: 1, longitude: 2 }, WGS: { lat: 9, lng: 10 },
    marker: { setLatLng() {} }, map: { setView() {} } });
  return { context, requests, node: id => document.getElementById(id) };
}
test('Page stop is idempotent, preserves preview and never offers a re-enable toggle', async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) await f.context.stopModification();
  assert.equal(f.context.enabledState, false); assert.equal(f.context.saved, false);
  assert.equal(f.context.WGS.lat, 9); assert.equal(f.context.serverLocation.latitude, 1);
  assert.deepEqual(f.requests, Array(2).fill({ path: '/enable', body: { enabled: false } }));
  assert.equal(f.node('restorebtn').textContent, '停止修改');
  assert.match(f.node('info').textContent, /服务器已停止修改.*预览未保存/);
});
test('Save is the action that enables the preview, stop keeps coordinates, save enables again', async () => {
  const f = fixture(); f.context.enabledState = false;
  await f.context.commit(); assert.equal(f.context.enabledState, true); assert.equal(f.context.saved, true);
  assert.equal(f.context.serverLocation.latitude, 9);
  await f.context.stopModification(); assert.equal(f.context.enabledState, false);
  await f.context.commit(); assert.equal(f.context.enabledState, true);
  assert.deepEqual(f.requests.map(r => r.path), ['/set', '/enable', '/set']);
});
test('Parse changes only preview; active server state and saved position remain separate', async () => {
  const f = fixture(); await f.context.parseShare();
  assert.equal(f.context.WGS.lat, 3); assert.equal(f.context.saved, false);
  assert.equal(f.context.enabledState, true); assert.equal(f.context.serverLocation.latitude, 1);
  assert.deepEqual(f.requests.map(r => r.path), ['/api/parse']);
  assert.match(f.node('info').textContent, /服务器正在修改.*1\.000000.*预览未保存.*3\.000000/);
});
test('HTTP, network and unconfirmed responses never report successful save or stop', async () => {
  for (const mode of ['http', 'network', 'unconfirmed', 'wrong-state']) {
    const f = fixture(mode); await f.context.stopModification();
    assert.equal(f.context.enabledState, true); assert.match(f.node('toast').textContent, /停止失败/);
    assert.equal(f.node('restorebtn').disabled, false);
    f.context.enabledState = false; await f.context.commit();
    assert.equal(f.context.enabledState, false); assert.equal(f.context.saved, false);
    assert.match(f.node('toast').textContent, /保存失败/);
    assert.equal(f.node('savebtn').disabled, false);
  }
});
