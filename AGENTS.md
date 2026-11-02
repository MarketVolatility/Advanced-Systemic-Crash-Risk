# Dashboard requirements

For every request pertaining to index.html, write application logic, build tooling and new tests only in strict TypeScript (.ts or .mts). Keep strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes enabled, and skipLibCheck disabled. Do not add JavaScript source or suppress type errors. HTML templates and CSS remain presentation assets; index.html is generated from the typed sources.

## Working approach

- Keep each task focused on the requested outcome. Avoid unrelated improvements and unnecessary investigation.
- Reuse verified findings and completed checks. Repeat checks only when relevant changes, a failure or an unresolved concern justify them; complete the required verification below.
- Keep progress updates and final responses concise, expanding when the user requests detail or a material limitation needs explanation.
- Stop once the requested work is implemented and verified. Record completion for continuation tasks so scheduled runs do not repeat finished work.

## Coding conventions

**Strict TypeScript, no escape hatches.** This policy applies to application sources, build tooling and new tests.

- Required compiler settings: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noPropertyAccessFromIndexSignature: true`, `useUnknownInCatchVariables: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noImplicitReturns: true`, `noImplicitOverride: true`, and `skipLibCheck: false`. Shared settings belong in `tsconfig.json`; tool and browser configurations must inherit them without weakening them.
- Do not use explicit or implicit `any`, `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck` in `src/` or new/modified TypeScript tooling and tests. Use `unknown` for untrusted or untyped values and narrow it through runtime checks, type guards or validated schemas before use. This includes parsed JSON, storage, network responses and caught errors.
- Do not bypass checks with double assertions such as `as unknown as T`, unchecked assertions that pretend external data has been validated, disabled compiler checks, or exclusions introduced merely to hide errors. Fix the types or validate the data instead.
- Non-null assertions (`!`) are allowed only when a concrete code invariant guarantees the value exists. Make that invariant evident at the use site, with a short explanation when needed; otherwise check the value explicitly. Logical negation (`!condition`) is unaffected.
- Resolve unused declarations, missing return paths and override errors without removing required behavior or suppressing diagnostics. Preserve scoring rules, saved-data contracts and account isolation during type fixes.
- All required flags are enabled in the three compiler configurations. The build runs `scripts/check-strict-policy.mts` to check configuration and prohibited syntax, plus `scripts/check-build-contracts.mts` to validate embedded datasets and declared template element types. Runtime boundary validation remains necessary: a syntax check alone cannot prove an assertion safe. See `handoffs/strict-typescript-audit-2026-10-31.md` for audited scope and verification.

## Data contracts

Preserve saved-data keys and scoring rules. Build index.html after source changes and run the relevant strict TypeScript checks and meaningful regression tests.

Quick Paste requests 39 numeric fields: the existing 35 market fields followed by equity session date, financial CP date, nonfinancial CP date and Treasury bill date, each YYYYMMDD. Import these into the existing four date boxes and saved observation-date fields. Field 32 must equal the latest of the three funding dates. Dates must be sourced, never estimated.

## Architecture

- Project root: `/Users/mike/Documents/ChatGPT/coding- adv login`. This project is the systemic/crash risk dashboard, not the separate portfolio optimizer.
- `src/index.template.html`: HTML shell, user-facing research prompts and declarative event attributes. `src/styles/{base,design,workspace}.css`: dark interface and table styling.
- `src/core/`: typed parsing, scoring, date/session and storage contracts. `src/ui/`: typed UI utilities.
- `src/runtime/`: browser application split into TypeScript files. `load-order.json` defines their shared-scope initialization order. `events.ts` binds named actions; `dom.ts` and the declaration files define browser contracts.
- `src/data/`: embedded reference datasets. `scripts/build.mts` bundles the core, transpiles runtime/UI entry points, embeds datasets/styles and checks script syntax/static IDs to generate `index.html`. Do not hand-edit the generated index.
- `storage-sync.ts`: account-scoped snapshots and cloud conflict handling. `account-backup.ts`: portable JSON backup/restore. Saved histories use localStorage; large analyses/documents and recovery copies also use IndexedDB. Use `readAppStorage`/`writeAppStorage` and existing account-key helpers instead of bypassing them.
- Supabase provides authentication and `user_app_data` snapshots. The index retains an external Supabase SDK dependency. Building locally does not deploy the site or backend.
- `historical-data/`: downloaded source evidence and calculation artifacts; `tests/`: regression and browser checks. Archived HTML, migration copies, `src/legacy`, and old handoffs are not authority for current behavior.

## Conventions and invariants

- Support the user's Auto/Light/Dark appearance selection; Auto follows the device. Dark appearance retains dark backgrounds and light text. Numeric comparison edges and severity fills belong inside the small value rectangles, not the outer table cells. Recovery tables follow the original table styling.
- Preserve the 50-point model, thresholds, missing-data ranges, saved-data format, and account isolation. Do not substitute zero for unknown inputs or silently overwrite a divergent cloud/local copy.
- The first 35 Quick Paste positions retain their meaning. Credit spreads are basis points; interest rates are percentages. Funding dates can differ. Do not force a common date; label asynchronous comparisons and stale observations.
- Research must use dated source evidence and completed sessions. Keep same-session equity OHLC/volume and same-date VIX/VIX3M groups together. Re-fetch histories to detect revisions. Label provisional data; do not fabricate values, finality, timestamps, or instrument identity.
- New logic/tooling/tests must be strict TypeScript. Existing `.cjs` and Python regression suites remain callable; their presence is not permission to introduce new JavaScript/Python implementation. HTML/CSS and generated JavaScript are expected output/assets.
- Account backups include saved local histories, documents, recovery records, FRED cache/key and layout; they exclude passwords, authentication sessions, unsaved edits and cloud-only changes not loaded locally. Restore into the signed-in account, including a newly registered account, with validation and pre-restore recovery. Keep sync paused until reviewed. Never imply a file recreates a deleted authentication service.
- Do not reset or clean unrelated work. Much of this workspace is untracked. No proactive subagents unless the user or applicable instructions request them.

## Build and verification

**Release reminder — update the version before delivering application changes.** Increment the version for each delivered functional/UI release (patch for fixes, minor for backward-compatible features), keep `package.json`, the root package metadata in `package-lock.json`, and the sidebar label in `src/ui/workspace.ts` consistent, then rebuild `index.html`. Verify the generated sidebar shows the new version and mention it in the delivery message. Do not increment for documentation-only changes or every intermediate build. Never edit the generated index by hand.

From the project root, use `npm run check` and, for behavior/UI changes, `npm run test:browser` when npm is available. `npm run build` runs all three strict configurations before generating the index. For documentation-only changes, verify content/links; no app rebuild is required.

This host's working Node executable is `/Users/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. If npm/Node are absent from PATH, use:

```sh
NODE_BIN=/Users/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit -p tsconfig.browser.json
"$NODE_BIN" scripts/build.mts
"$NODE_BIN" scripts/test.mts
PLAYWRIGHT_BROWSERS_PATH=/tmp/risk-dashboard-browsers "$NODE_BIN" tests/browser.mts
```

- `scripts/test.mts` runs scoring-contract, history-overrides, recovery-storage, history-performance, sync-preservation, analysis-full-history, composite-reconciliation, and momentum regressions.
- `tests/browser.mts` tests mocked authentication, 13 workspaces, mobile layout, 39-field date autofill/save/reload, Fed/funding imports, Word attachments, recovery and account restore into a different account. Some printed test labels still say 35 values; inspect assertions for actual coverage.
- Browser launch may require sandbox escalation. These tests do not validate live authentication, production cloud writes or deployment. `test-results/` contains screenshots.
- After relevant checks pass, do not repeat them without a new change or unresolved concern. Report limitations accurately and link the generated index when delivering application changes.

## Current handover

Read `handoffs/dashboard-2026-10-31.md` for the latest conversation state and completed work. Older `CODEX_HANDOFF.md` sections contain superseded CP, momentum and sync rules; current code and tests take precedence.

## Publishing

Follow [PUBLISHING-INSTRUCTIONS.md](PUBLISHING-INSTRUCTIONS.md) for this repository. Complete checks before requesting Publish/Not yet approval; every upload needs separate explicit approval. Use strict TypeScript publishing/stamp scripts, keep local/private files excluded, and retain dated exact upload copies. Do not check the live site after publishing unless asked.
