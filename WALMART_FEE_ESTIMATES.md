# Conservative pending-fee reserves

Walmart Overview now deducts recorded fees **and** labeled estimates for missing fee components before settlement. Estimates are computed when displaying data; they are never inserted into the actual fee ledger. As actual charges arrive, the matching component/covered units stop receiving an estimate. No manual reversal or duplicate estimated ledger entries are needed.

## Planning defaults

- Referral: 20% of order merchandise revenue.
- WFS fulfillment: $8/unit.
- Prep: $2/unit.
- Inbound: $1/unit.
- Storage: $1/unit.
- Extra cushion: 20% on the four per-unit costs.

For a $100, one-unit WFS sale, the initial reserve is $34.40. These are deliberately padded assumptions, **not official Walmart tariff rates, quotes, or guaranteed maximums**. Fulfillment depends on shipping weight, dimensions and surcharges; prep/storage/inbound depend on actual services and time. Large/oversize and long-stored items need reviewed SKU overrides. Seller-fulfilled sales receive a referral reserve only; postage and other outside charges are separate.

Default flat costs are not inferred from retail prices. Higher positive observed fee rates for the same SKU/fulfillment method can raise order-reserve floors; the cushion applies to observed unit rates as well. A zero configured component disables that planning reserve when the charge genuinely does not apply. It never hides an actual posted charge.

## Replacement and matching

- Components are referral, fulfillment, prep, inbound and storage. A referral fee does not mark fulfillment/prep/storage as settled.
- Exact purchase-order/line/SKU matching covers the units reported by the fee row's Ship Qty/Quantity. With no valid reported quantity, a fee covers at most one unit. Multiple rows of the same category use maximum reported coverage rather than adding potentially overlapping quantities.
- Missing quantities, partial shipments and ambiguous multi-product orders can therefore retain extra reserves conservatively. Review source reports and SKU assumptions when coverage remains uncertain.
- Credits lower recorded costs but do not independently mark the original fee as posted. Fee taxes/return-processing costs count as actuals without falsely clearing a base fee reserve.
- Shared or ambiguous actual fees remain unallocated actual costs. Their positive amounts reduce matching category reserves dollar-for-dollar, proportionally across eligible planning entries, to avoid counting the same cost twice. This does not invent an actual per-order allocation.
- Estimates use the same selected sale-date and fulfillment filters as order profit. Account-level actual costs retain the existing posting-date/All-view rules.
- Unknown settlement transactions still suppress profit until classified. Missing COGS or inaccessible actual-fee data also keep profit unavailable. No settlement report is required when the actual-fee tables are readable and no charges have posted yet.
- Advertising, outside seller postage, unusual/unrecognized fees and external prep/freight still need their actual costs imported. Existing manual fees must not duplicate automatically imported charges. Returned inventory does not automatically reverse COGS.

## Example

With $100 revenue and $30 COGS:

| Data received | Actual fees | Remaining reserve | Estimated profit |
| --- | ---: | ---: | ---: |
| No settlement yet | $0 | $34.40 | $35.60 |
| Referral charge of $15 arrives | $15 | $14.40 | $40.60 |
| Referral $15, fulfillment $5, prep $1, inbound $1, storage $0.50 arrive | $22.50 | $0 | $47.50 |

The lower actual costs replace estimates instead of being added on top of them.

## Settings and setup

Expand **Fee estimates & conservative assumptions** in Walmart Overview or the WFS tab. Save global defaults or a SKU override. These settings are private to the owner and shared across devices after saving.

Run the updated `supabase/walmart_wfs_inventory.sql` to create `walmart_fee_assumptions` along with the WFS tables. The script is rerunnable. Defaults work if saved-assumption setup is missing, with a visible default-reserve label; saving custom rules requires setup. Existing actual-fee, sales and COGS tables are preserved.

The WFS listing-profit preview uses configured base planning assumptions and saved/linked purchase-lot costs. Order-level profit additionally applies higher observed fee floors where history can be matched.

Sources reviewed for context, not represented as the configured quote:
- https://marketplace.walmart.com/walmart-fulfillment-services-pricing
- https://developer.walmart.com/us-marketplace/reference/getavailablev1reconreportasjson-1

## Validation

Tests cover pre-settlement reserves, component replacement, partial quantities, credits, fee taxes, shared-charge offsets, ambiguous lines, observed-history floors, SKU overrides and authenticated settings writes. Chromium verified the real overview changing from $34.40 estimated fees to $15 referral plus $14.40 pending reserves, then $22.50 actual/$0 estimated as all sample components arrived. The WFS browser check verified the in-stock-only view, listing price/value, missing-price labels, restock suggestions, settings save and mobile panel containment. Live seller prices and fee totals still need comparison with Walmart after deployment.
