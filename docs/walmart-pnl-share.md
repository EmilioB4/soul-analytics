# Walmart PNL share card

Walmart Overview → Share PNL opens the same Soul summary modal and theme choices used for TikTok, and plays the existing `/sounds/share-pnl-camera-flash.mp3` at the same volume. Download PNG exports a 1600 × 900 image named `soul-walmart-pnl-<dates>.png`. No database migration, environment variable or new audio file is required.

The Walmart card takes a snapshot of the selected date range and fulfillment filter. It displays gross merchandise sales, the dashboard's estimated profit, distinct imported orders, original units sold, and the top three product/fulfillment contributions. The contribution function is shared with the Walmart product table so the card does not introduce another fee/profit formula. Footer labels retain estimated-fee, unavailable-profit and incomplete-refund status. The all-imported-dates view derives its start from the earliest included New York sale date, falling back to the end date for an empty dataset.

The existing TikTok defaults, themes, renderer, PNG size and filename are retained. Only the Walmart card supplies its own labels and footer. The shared modal now sits above dashboard notices so those notices cannot block download controls.

The export uses only the signed-in dashboard's already loaded data; it makes no new reporting request and stores no financial data in localStorage. Theme preferences continue to be stored locally. Product photos use existing bundled LEGO images where known and a placeholder otherwise. Images are generated and downloaded in the browser rather than uploaded to a service.

Validation includes card data/partial-state/ranking tests and browser checks for selected-filter totals, MP3 playback, theme changes, actual PNG download, mobile layout and a TikTok export regression. Browser checks use synthetic dashboard data; production marketplace credentials are not used.
