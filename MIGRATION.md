# Dashboard source, build and verification

The application and development commands now use strict TypeScript. `index.html` remains the generated, self-contained deployment artifact: compiled JavaScript, CSS and the same nine embedded historical datasets. The original Supabase CDN SDK remains external. Edit `src/`, then rebuild; do not edit generated HTML.

## Development

Use Node.js 22.18+ (tested with Node 24), npm and Python 3 for the retained regression harness.

```sh
npm ci
npm run check
npm run preview
```

Preview at http://127.0.0.1:4173. For browser verification:

```sh
npx playwright install chromium
npm run test:browser
```

## Source layout

- `src/core/`: scoring, momentum, numeric-paste validation and storage-key contracts.
- `src/runtime/`: authentication, storage/sync/recovery, editable histories, analysis/Word documents, data updates and chart rendering. `load-order.json` lists only TypeScript. Shared global entry points retain compatibility with the original single-file app.
- `src/runtime/events.ts`: typed event bindings for the HTML shell. There are no executable inline event attributes.
- `src/ui/`: responsive workspace navigation, table and disclosure behavior.
- `src/index.template.html`, `src/styles/`: presentation. `workspace.css` provides the complete workspace theme.
- `src/data/`: unchanged source datasets; the build embeds each data marker after TypeScript transformation.
- `scripts/*.mts`: checked TypeScript build, preview and regression commands.
- `tests/browser.mts`: checked TypeScript browser workflow tests.

The compiler enables `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No application source uses `any`, `ts-ignore` or `ts-nocheck` to bypass conversion. Historical JavaScript originals and abandoned drafts are retained under `migration/strict-typescript/` solely for audit. Older JavaScript/Python regression harnesses and original scoring fixtures remain outside the shipped application; they intentionally test compatibility with the pre-migration app.

## Interface

Thirteen dedicated workspaces cover overview, updates, history, risk charts, factors, Fed watch, dollar funding, CP/leadership, analysis, historical studies, methodology, recovery and sync. All large surfaces use dark navy/teal backgrounds with light text. Sign-in, registration, forms and account dialogs share the dark theme. Desktop navigation becomes a keyboard-accessible mobile drawer. Existing control identities, inputs and actions are retained.

## Preserved contracts

No saved-data schema, storage key, historical dataset, score threshold or category ceiling changed. Unknown fields on legacy market records survive load/save. The 35-value input order and accepted older formats remain unchanged. Existing data reconciliation, manual history overrides, original Word attachments, IndexedDB backups and cloud conflict/overwrite protections remain supported. Unavailable inputs retain explicit unavailable states and score ranges; missing observations are not invented.

## Verification

`npm run check` verifies all compiler configurations, builds the single-file app and runs the compatibility suite:

- 1,894 original model snapshots, nine dataset hashes and bundled values, threshold/context rules, storage keys and paste formats.
- History editing, manual overrides, pagination, change outlines and bounded rendering.
- Recovery transactions, storage failures, sync conflicts, pending edits and concurrent-write protection.
- Complete-history analysis prompts, CP reconciliation and equity-session/holiday momentum.
- Every template action has a callable typed binding.

Browser tests use an isolated origin and mocked authentication, never production accounts. They cover all 13 routes, original control retention, sign-in, save/reload, legacy fields, momentum, mobile navigation and overflow. Additional workflows cover Fed/funding imports, Word export/import and recoverable analysis deletion. Screenshots are saved under `test-results/`.

Some older standalone suites retain pre-existing stale assumptions or incomplete DOM mocks and are excluded from `npm test`: cloud-overwrite, fed-watch, dashboard-regression, funding-history, analysis-history and model50. The missing pre-existing `supabase/functions/fred-cp/index.ts` also prevents the old FRED backend suite. No backend or live production service verification is claimed. Local changes have not been deployed.
