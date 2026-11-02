# Publishing this dashboard

Adapted from the user's ECG Analysis/PUBLISHING-INSTRUCTIONS.md. This project's strict TypeScript requirements take precedence over its JavaScript examples.

- Repository: https://github.com/MarketVolatility/Advanced-Systemic-Crash-Risk
- Saved GitHub login: MarketVolatility
- Site: https://marketvolatility.github.io/Advanced-Systemic-Crash-Risk/
- Check: `npm run check` (strict configurations, build and regressions, then fingerprint).
- Browser verification: `npm run test:browser` for application/UI changes. Version 1.1.1 already passed the full suite; publishing setup does not change UI.
- Never upload: credentials/.env, node_modules, local handoffs/research/output, old HTML copies, migration archives, .claude/.codex/.agents, zip archives, publish.command or GitHub uploads. See .gitignore.

## Every release

1. Complete the requested change and required checks before asking to publish. Update the application version for functional/UI changes per AGENTS.md.
2. Add a CHANGELOG.md entry marked `(not yet published)`.
3. Ask with Publish and Not yet choices. Never publish without a separate Publish selection or explicit publish instruction for this change.
4. After approval, change the changelog entry to `*(GitHub)*`, then run `GIT_TERMINAL_PROMPT=0 ./publish.command </dev/null`.
5. Report changed files, site and saved-copy folder. Do not check the live site afterwards unless asked.
6. If credentials fail, stop and ask the user to double-click publish.command once to sign in; never receive or handle their token.

The first interactive publish may be performed by the user with publish.command. Its thin shell launcher runs strict TypeScript scripts/publish.mts. The script verifies scripts/stamp.mts, rerunning checks if published non-document files changed. CHANGELOG.md and README.md are excluded from the check fingerprint.

Publishing uses a temporary clone of main under ignored node_modules, overlays the reviewed local files, commits and performs a normal push. It never resets this working folder, deletes unrelated remote files, or force-pushes. If remote main changes during upload, the normal push rejects it. Remote-only deletions require explicit implementation/review.

Each upload has an exact git archive under `GitHub uploads/<UTC timestamp> publish/`. The archive is created before pushing, ensuring a successful push has its copy; a failed push leaves a clearly reported unpublished candidate. Local saved account data is not part of the upload. GitHub Pages deployment is separate from a successful repository push.
