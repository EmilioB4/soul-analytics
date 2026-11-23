# WFS fee & shipping calculator

The Walmart navigation includes a responsive WFS calculator. Inputs stay in component memory until the user explicitly saves exact-SKU fee assumptions. No database migration or new credentials are required.

The US fee schedule was checked November 22, 2026 against Walmart’s [WFS fee guide](https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20(WFS)/WFS%20basics/WFS-fees). Weight includes retail packaging. Standard fulfillment compares actual and dimensional weight where required, adds 0.25 lb, rounds up, applies the published weight bands, and includes applicable apparel/hazmat/low-price/oversize surcharges. Big-and-bulky uses actual rounded weight with its separate tariff. The calculator rejects items outside the supported 500 lb/120 inch limits; Walmart eligibility still applies.

Storage uses volume × selected monthly rate × duration. Users must split scenarios spanning seasons or inventory-age tiers; it is not a daily inventory aging forecast. Prep/labeling and additional costs are entered explicitly. Referral is editable because categories and promotions vary. Sales tax is excluded.

Inbound shipping supports cost per unit or per actual pound. The sample $0.90/unit is an illustrative assumption, not a Walmart rate. Walmart’s [carrier quote API](https://developer.walmart.com/us-marketplace/reference/getcarrierratequotes) requires a prepared shipment ID and carrier quote type; a product’s weight alone cannot produce a live shipping quote. No shipments or bookings are created by this calculator.

The reference scenario ($73.99 sale, $39.42 cost, 3 lb calculated shipping weight, 0.20 cu ft, one standard storage month, $0.90 inbound) yields $17.60 fees, $56.39 received and $16.97 profit. Break-even purchase price is $56.39 with these assumptions; the friend-site screenshot’s $53.20 cannot be derived from its displayed charges.

Dashboard fee estimates currently use SKU overrides, matched settlement medians, then generic fallback settings (15% referral / $5.75 fulfillment). Do not replace all products’ rates with a 3 lb example. Saving this calculator’s exact-SKU assumption feeds the existing authenticated, owner-scoped fee endpoint. Actual posted charges continue to replace covered estimates. Other costs are scenario-only and must be zero before saving; inputs exclude tax, returns and ad charges unless entered. Saved SKU rates remain fixed until edited and should be updated if dimensions, prices, storage scenarios or published fees change.

Validation: calculator reference arithmetic, weight/size boundaries, surcharges, invalid inputs, inbound/storage behavior and integration with existing reserve replacement are covered in `tests/walmart-wfs-calculator.test.mjs`. No real provider calls, live account changes or shipping purchases occur in tests.

Inbound costs can also be entered as a shipment total divided by total shipment units. A zero input is treated as missing unless shipping is explicitly confirmed covered at no cost. Missing inbound costs are marked in the breakdown, profit is labeled before inbound, ROI/margin/break-even are withheld, and saving SKU assumptions is blocked. Fulfillment and storage calculations remain based on the published tariff.

The default inbound scenario is now $0.30 per rounded shipping pound, explicitly labeled as a planning estimate. The reference 3 lb example yields $0.90. Actual-weight, per-unit and shipment-total modes remain available. Breakdown labels show the referral percentage, WFS shipping weight, storage duration/volume and inbound rate. Optional zero prep/other rows are hidden.
