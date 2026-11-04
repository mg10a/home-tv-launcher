const {test} = require('node:test');
const assert = require('node:assert/strict');
const {shoppingSnapshot} = require('../family-shopping.js');

test('failed reads keep the last list visible and flag it stale', () => {
  const value = shoppingSnapshot({state:'read_failed',attributes:{
    last_success:'2026-11-04T12:00:00Z',
    items:[{name:'Apples',quantity:'2',completed:false}]
  }}, Date.parse('2026-11-04T12:01:00Z'));
  assert.equal(value.items[0].name, 'Apples');
  assert.equal(value.hasSnapshot, true);
  assert.equal(value.stale, true);
});
test('empty successful list differs from missing or malformed data', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const attributes = {last_success:'2026-11-04T12:00:00Z',items:[]};
  assert.equal(shoppingSnapshot({state:'ok',attributes}, now).hasSnapshot, true);
  assert.equal(shoppingSnapshot({state:'ok',attributes}, now).stale, false);
  assert.equal(shoppingSnapshot({state:'ok',attributes:{...attributes,items:[null]}}, now).hasSnapshot, false);
  assert.equal(shoppingSnapshot(null, now).hasSnapshot, false);
});
test('untrusted shopping links cannot leave Samsung Food', () => {
  const value = shoppingSnapshot({attributes:{source_url:'https://evil.example/shopping-list'}});
  assert.equal(value.url, 'https://app.samsungfood.com/shopping-list');
});
test('unchanged ok state becomes stale when updates stop', () => {
  const value = shoppingSnapshot({state:'ok',attributes:{
    last_success:'2026-11-04T12:00:00Z',items:[]
  }}, Date.parse('2026-11-04T12:36:00Z'));
  assert.equal(value.stale, true);
});
