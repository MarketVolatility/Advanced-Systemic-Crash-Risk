# Enable the webpage’s FRED fetch button

The page now follows the Portfolio Optimizer interaction: get key → paste → save → fetch. FRED needs an authenticated Supabase Edge Function because its observed API response lacks browser CORS headers. Do not use a public CORS proxy, because it would receive users' API keys.

## One-time owner deployment

Project: `epwuciybscjrteteneur`

1. Sign in to https://supabase.com/dashboard/project/epwuciybscjrteteneur/functions .
2. Create a new Edge Function named **fred-cp**, using the dashboard editor.
3. Replace its source with the complete contents of `functions/fred-cp/index.ts` in this folder. Deploy it. Keep JWT verification enabled; the function also verifies the user with Supabase Auth.
4. Supabase supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically. No FRED key is stored as a project secret; every signed-in user supplies their own.
5. Upload the updated root `index.html` to GitHub Pages. Sign in, use the FRED key link, paste the key, and select **Fetch latest data**.

CLI alternative from the project root, after installing and authenticating the Supabase CLI:

```sh
supabase login
supabase functions deploy fred-cp --project-ref epwuciybscjrteteneur
```

The function permits the GitHub Pages origin `https://marketvolatility.github.io`, local-file origin `null`, and localhost on port 8000. All data requests still require a valid signed-in user token. If moving the site to another domain, update the explicit allowed-origin list.

## Operation

The button fetches five years of DCPF3M, DCPN3M and DTB3 observations. It validates all series before replacing cached data, joins only identical observation dates, preserves missing values and recalculates the funding graphs and watch alerts. Saved manual CP values retain precedence. The request is manual, not a background daily timer.

Save key stores the key only in this browser, scoped to the signed-in account. Forget key removes it. It is excluded from cloud snapshots and passed in an HTTPS POST body to this project’s function, which forwards it only to FRED and never logs or persists it. Downloaded public rate data is cached locally and included in normal account sync. Cached data is available after reload; the key itself does not follow the user to another device.

The existing Python script remains an optional owner-side updater; visitors do not need it. The browser download updates cached data, not the HTML file on GitHub. Only index.html needs uploading to GitHub Pages; the connector is deployed separately to Supabase once.

## Verification status

Offline tests cover authentication checks, CORS headers, rate/date validation, missing series, sanitized errors, browser refresh, failed-request preservation and snapshot key exclusion by explicit field selection. A real end-to-end request requires deployment and a real user's FRED key. No connector deployment or live-key test was possible in this session: no Supabase deployment credentials were available.
