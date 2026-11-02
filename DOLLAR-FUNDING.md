
## September 25, 2026 reference backfill

The single HTML file now embeds 40 FRED SWPT Wednesday observations from December 24, 2025 to September 23, 2026. December 24 provides the prior-week baseline for the nine-month window. Source download: https://fred.stlouisfed.org/graph/fredgraph.csv?id=SWPT&cosd=2025-12-17&coed=2026-09-25 . Local provenance is `historical-data/SWPT.csv` and `funding-history.json`.

Reference rows have unknown publication times and unverified test adjustments. They are read-only, separate from account storage, and always available from the HTML after loading. A user-saved version of the same observation takes precedence; the backfill never overwrites cloud or browser records. Exact-timestamp requirements for user imports remain unchanged. Only index.html is required for deployment.

The graph now uses observation dates and is explicitly retrospective, superseding the earlier publication-timeline description. This is not a point-in-time backtest. It shows weekly balance levels and differences with the exact preceding Wednesday. Default chart period is nine months, shared with the other chart controls. Embedded data is not automatically refreshed.
