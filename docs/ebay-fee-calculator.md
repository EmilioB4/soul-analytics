# eBay fee calculator

The eBay navigation now has a Fee calculator tab sharing the WFS calculator’s responsive layout. It is an in-memory planning tool for a single item, single domestic US/USD order; it neither fetches live fee quotes nor changes imported accounting.

Defaults follow eBay’s [US no-Store / Starter Store schedule for most categories](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822), checked November 22, 2026. Final value percentage applies to item price plus buyer shipping plus buyer sales tax, with an editable first-tier threshold and excess rate. Automatic per-order fee switches from $0.30 to $0.40 above $10 and can be overridden for exemptions. Tax is excluded from seller revenue.

[Promoted Listings General](https://www.ebay.com/help/selling/ebay-advertising/promoted-listings/suggested-ad-rates?id=5839) is estimated on the total sale including tax and shipping, assuming an attributed sale. Organic scenarios use zero; CPC campaigns use entered ad spend. Shipping-label costs, packaging, listing upgrades, surcharge percentage, taxes on seller fees and other costs are separate entries. Enter postage once whether bought through eBay or externally.

Rates vary by category, Store plan, promotions and geography. This two-tier model does not automatically implement all category exceptions, seller discounts or international shipping fee bases. Use applicable rates/blended rates and explicit costs for those cases. ROI uses product purchase cost; margin uses seller revenue excluding tax. Break-even purchase price equals revenue less entered selling/shipping costs. No tax-on-fees or unentered expenses are silently assumed.
