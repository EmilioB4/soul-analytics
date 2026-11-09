// Walmart orderDate is normally Unix milliseconds; accept ISO dates as well.
export function walmartOrderDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  const input = typeof value === 'string' ? value.trim() : value;
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const numeric = typeof input === 'number' || /^\d+$/.test(input);
  const date = new Date(numeric ? Number(input) : input);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

// nextCursor may be a query string containing limit and an encoded cursor.
// Keep requests pinned to Walmart, and decode query values exactly once.
export function walmartOrdersUrl(since: string, cursor = '', shipNodeType: 'SellerFulfilled' | 'WFSFulfilled' = 'SellerFulfilled'): URL {
  const url = new URL('https://marketplace.walmartapis.com/v3/orders');
  url.searchParams.set('limit', '200');
  if (!cursor) url.searchParams.set('createdStartDate', since);
  else if (/^[?&]?(?:nextCursor|limit)=/.test(cursor)) {
    const params = new URLSearchParams(cursor.replace(/^[?&]/, ''));
    if (!params.get('nextCursor')) throw Error('Walmart pagination response is missing nextCursor.');
    for (const [key, value] of params) url.searchParams.set(key, value);
  } else url.searchParams.set('nextCursor', cursor);
  url.searchParams.set('shipNodeType', shipNodeType);
  return url;
}
