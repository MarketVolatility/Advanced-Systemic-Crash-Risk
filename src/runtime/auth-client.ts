// In Supabase Authentication > Sign In / Providers > Email, disable Confirm email.
// The SDK handles API keys and session refresh. Passwords are never stored here.
const SUPABASE_URL = "https://epwuciybscjrteteneur.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LS_5M61diqj3PMjviDKlbQ_pewHmTdC";
let authClient: import("@supabase/supabase-js").SupabaseClient<DashboardDatabase> | undefined;
function getAuthClient(){
    if(authClient) return authClient;
    if(!window.supabase) throw new Error('The sign-in library could not load. Check your connection and reload.');
    let storage;
    try { storage = window.sessionStorage; } catch (_) {}
    authClient = window.supabase.createClient<DashboardDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {storage, persistSession: !!storage, autoRefreshToken: true, detectSessionInUrl: false}
    });
    authClient.auth.onAuthStateChange(event => {
        if(event === 'SIGNED_OUT'){ stopAutoSync(); lockDashboard(); showAuthStep('loginStep'); }
    });
    return authClient;
}


