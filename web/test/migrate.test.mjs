import test from 'node:test';
import assert from 'node:assert/strict';

test('migrate: old saved keys are copied to the new names once, nothing is overwritten', async () => {
  const data = new Map([['openCourt.settings', '{"court":3}'], ['openCourt.progress', '{"wins":2}'], ['loxford.progress', '{"wins":9}'], ['other', 'x']]);
  globalThis.localStorage = {
    get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); },
  };
  await import('../game/migrate.js');
  assert.equal(data.get('loxford.settings'), '{"court":3}');
  assert.equal(data.get('loxford.progress'), '{"wins":9}'); // an existing new value wins
  assert.equal(data.get('openCourt.settings'), '{"court":3}'); // the old copy is left alone
  delete globalThis.localStorage;
});
