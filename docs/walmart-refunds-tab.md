# Walmart refunds tab and P&L dropdown

The overview's Revenue, refunds and costs table now lives in a styled native details dropdown, closed initially. Its summary can be opened with mouse, touch or keyboard. The financial table and calculation inputs are preserved.

Walmart navigation gains Refunds & returns on desktop and mobile. This view has refund units, product refunds, confirmed returned-cost credit and record counts, plus the existing refund table and recoverable-cost controls. Its refresh action reads the same authenticated returns API. Overview retains a compact shortcut, and refund effects remain included in overview revenue, COGS, profit and the PNL share card.

Both views use the same Walmart component instance and filters, preserving the selected period/custom dates, fulfillment method and drafts when switching. Order/fee sync, sharing, charts and product tables stay on the overview. The refund view uses event-date calculations from the same existing refund accounting function. A view change does not alter ownership, database permissions or financial calculations.

No SQL migration or new environment setting is required. Validate with existing refund/accounting tests and browser interactions: P&L closed initially and accessible by keyboard, no refund table on overview, refund controls only on their tab, preserved date/fulfillment selection, and matching overview totals before/after recording a recoverable-cost credit. Provider/database responses in local browser validation are synthetic.
