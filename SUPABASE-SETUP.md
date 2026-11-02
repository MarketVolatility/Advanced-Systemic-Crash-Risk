# Sign-up and sign-in without email confirmation

1. In Supabase, open Authentication > Sign In / Providers > Email.
2. Turn OFF Confirm email and save. Keep email/password sign-in and new sign-ups enabled.
3. Upload index.html to the GitHub Pages publishing location for marketvolatility/advance-login.
4. Open https://marketvolatility.github.io/advance-login/ and sign up or sign in.

The page now contains only sign-up and sign-in forms, plus logout. A successful registration opens the dashboard immediately when Supabase returns a session. It does not send a separate verification request. Verification screens, resend controls, email callbacks, and password-reset screens are removed.

The HTML cannot change Supabase server settings. If Confirm email remains enabled, Supabase may still send a confirmation email and withhold a session; the page displays a configuration error instead of granting access.

Existing accounts: try signing in after the setting change. If a previously unconfirmed account remains blocked, inspect that account in Supabase Authentication > Users; do not delete existing users or their data as a workaround.

Reference: https://supabase.com/docs/guides/auth/general-configuration
