# eBay overview graph and active listings

The overview now contains a daily Sales / Estimated profit graph. Date hover, a keyboard-accessible date slider and an expandable data table expose actual daily values. Days without activity are zero; unavailable profit is null and never drawn as zero. Daily series uses the same posting dates, matched order revenue, net transaction movements and entered costs as the accounting summary. All profit points remain unavailable while the period's accounting review is incomplete. Bank transfers are excluded from both totals and graph.

Active **Listings** is a separate eBay dashboard tab with product image, title, asking price, available quantity and a link to the listing. It reads the authenticated seller's GetMyeBaySelling ActiveList, including items created in Seller Hub, rather than assuming Inventory API products represent all listings. Pages contain up to 50 items; Previous/Next and Refresh listings fetch current eBay data. Active listings are independent of the accounting reporting period.

Auctions are labelled with current bid/starting price. Variations show min–max when eBay returns their prices in one currency. Missing prices and quantities are unavailable, not zero. Images are restricted to eBay's image/static CDNs, upgraded to HTTPS where needed; missing or failed images have a clear placeholder. Sold, unsold and scheduled items are not included. This is a read-only view; it does not create/edit listings.

The large eBay connection panel has been removed from Overview entirely. Connection, reconnect and disconnect controls remain only in Settings → Connections. The repeated literal America/New_York labels are removed from eBay and Walmart reporting lines. Daily-summary schedule wording now uses Eastern time. Date calculations and scheduled times are unchanged.

## Setup

No new SQL, credentials, Vercel variables or listing-storage migration are needed for this update. Existing accounting setup remains required for financial summaries/graphs.

Existing users may need to reconnect once in **Settings → Connections** for the standard eBay `https://api.ebay.com/oauth/api_scope` permission used by Trading API listing reads. New connections request it automatically alongside existing order/identity/finance scopes. Refresh requests preserve the original authorization's granted scopes instead of trying to expand them silently. A listing permission failure directs the user to Connections.

## Privacy and failure handling

The endpoint verifies an admitted Soul user and obtains that owner's seller token server-side. It accepts only a validated page number, not another seller ID. No tokens, buyer/high-bidder identities, raw XML or private notes are exposed or stored. Listings are fetched on demand and are not persisted, so no additional account-deletion storage is introduced. Responses are private/no-store; URLs, method, Trading API name and site are fixed server-side. XML response size, timeout, pagination and identifiers are checked. DTD/entity declarations are rejected before parsing with fast-xml-parser. Errors and raw provider bodies are not logged.

A real hosted listing request still needs verification after deployment/reconnection. Automated API and browser checks use synthetic accounts, payloads and images; they do not verify eBay permissions for a real seller.

## Sources and validation

- [Official GetMyeBaySelling reference](https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/GetMyeBaySelling.html)
- [Official ActiveList guide](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/my-ebay-selling.html)
- [eBay OAuth and refresh scope behavior](https://developer.ebay.com/develop/guides/sell/authorization)

Run `node --experimental-strip-types --test tests/*.test.mjs` and `npm run build`. Listing tests cover sanitization, XML failures/entity rejection, unsafe images, currency/price ranges, auctions and owner binding. Series tests reconcile daily sums to accounting, calendar boundaries and unavailable profit. Browser checks cover desktop/mobile graph controls, images and fallback, pagination and Connections-only seller controls.

## Daily sales below the overview graph

Sales of the day lists paid orders by New York order-creation day, independent of the financial posting-date totals above. It defaults to today, supports date selection and pages of 25 orders, and shows exact listing images, quantity, seller SKU, order ID, time and order total. Order totals include buyer shipping and exclude sales tax/fees/refund adjustments; refunded statuses are labeled. Page subtotals are labeled when multiple pages exist.

The authenticated daily-sales endpoint filters every database query by verified owner and connected account. It accepts a day/page, never an image URL or seller ID. Order imports now preserve the exact numeric legacy listing ID in their existing JSON payload, so no SQL is needed. Select Sync eBay once after deployment to refresh older imports with this metadata. Image lookup uses read-only GetItem calls for those owned order-line listing IDs, including sold/ended listings when eBay retains their images; no title matching or arbitrary pictures are used. Unavailable images do not hide sales. Only eBay CDN images are accepted.

Requests are bounded by per-call timeouts, a shared lookup deadline, four concurrent lookups and 128 KiB XML limits. Responses are private/no-store, and tokens/raw provider bodies are not exposed. No new listing storage or deletion migration is introduced. These calls retrieve images on demand/refresh rather than adding recurring background jobs.

Validation includes inclusive rolling periods, current-day snapshot coverage, optional packaging and summary/graph consistency, exact image matching, authorization, day bounds, pagination and failure fallbacks. Browser fixtures verify saving product and postage costs produces profit with the packaging exclusion note, and daily image/order rows appear below the chart on desktop and mobile. No live seller account or production writes are exercised.
