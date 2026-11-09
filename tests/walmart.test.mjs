import test from 'node:test';
import assert from 'node:assert/strict';
import {walmartOrderDate, walmartOrdersUrl} from '../lib/walmart.ts';

test('imports Walmart millisecond timestamps and ISO dates', () => {
  const timestamp = Date.parse('2026-11-08T18:30:00Z');
  for (const value of [timestamp, String(timestamp), '2026-11-08T18:30:00Z', '2026-11-08']) {
    assert.equal(walmartOrderDate(value), '2026-11-08');
  }
  for (const value of [undefined, null, '', 'invalid', {}, 1e20]) {
    assert.equal(walmartOrderDate(value), null);
  }
});

test('first page uses the requested date range', () => {
  const url = walmartOrdersUrl('2026-08-12T00:00:00Z');
  assert.equal(url.searchParams.get('createdStartDate'), '2026-08-12T00:00:00Z');
  assert.equal(url.searchParams.get('limit'), '200');
});

test('query-string pagination preserves encoded cursor values', () => {
  for (const cursor of ['?limit=200&nextCursor=abc%2Bdef%3D', '?nextCursor=abc%2Bdef%3D&limit=200']) {
    const url = walmartOrdersUrl('unused', cursor);
    assert.equal(url.searchParams.get('nextCursor'), 'abc+def=');
    assert.equal(url.searchParams.get('createdStartDate'), null);
    assert.equal(url.origin, 'https://marketplace.walmartapis.com');
  }
});

test('opaque cursors are preserved and malformed pagination fails visibly', () => {
  assert.equal(walmartOrdersUrl('unused', 'abc+def=').searchParams.get('nextCursor'), 'abc+def=');
  assert.throws(() => walmartOrdersUrl('unused', '?limit=200'), /missing nextCursor/);
});


test('explicit fulfillment filters include WFS on first and subsequent pages', () => {
  assert.equal(walmartOrdersUrl('since').searchParams.get('shipNodeType'), 'SellerFulfilled');
  for (const cursor of ['', '?limit=200&nextCursor=abc%2Bdef%3D']) {
    const url = walmartOrdersUrl('since', cursor, 'WFSFulfilled');
    assert.equal(url.searchParams.get('shipNodeType'), 'WFSFulfilled');
  }
});
