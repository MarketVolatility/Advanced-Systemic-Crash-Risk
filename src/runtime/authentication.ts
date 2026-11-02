function showAuthStep(id: string){
    document.querySelectorAll('.auth-step').forEach(el => el.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('.auth-message').forEach(el => { el.textContent = ''; el.className = 'auth-message'; });
}
function setAuthMessage(id: string, message: string, type: string=''){
    const el = document.getElementById(id);
    if(el){ el.textContent = message; el.className = 'auth-message ' + type; }
}
function authError(error: unknown){
    const detail={message:errorMessage(error)};
    const code=typeof error==='object' && error!==null && 'code' in error ? error.code : undefined;
    if(code === 'email_not_confirmed') return 'Email confirmation is still required by the server. The site owner must disable Confirm email in Supabase’s Email provider settings.';
    if(/load failed|failed to fetch|network|fetch failed/i.test(detail.message || ''))
        return 'Cannot reach the authentication service. Check your internet connection and try again.';
    return detail.message || 'Authentication failed. Please try again.';
}
async function authAction(event: SubmitEvent, messageId: string, action: (auth:AuthApi)=>Promise<void>){
    event.preventDefault();
    const button = event.currentTarget instanceof HTMLFormElement ? event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]') : null;
    if(button?.disabled) return false;
    if(button) button.disabled = true;
    setAuthMessage(messageId, 'Please wait…');
    try { await action(getAuthClient().auth); }
    catch(error){ setAuthMessage(messageId, authError(error), 'error'); }
    finally { if(button) button.disabled = false; }
    return false;
}
function lockDashboard(){
    if(syncChoiceResolve)finishSyncChoice('later');syncChoiceDeferred=false;
    stopAutoSync();syncReadyOwner=null;
    fredRequestGeneration++;fredLiveData=null;const fredInput=requiredElement('fredApiKey');if(fredInput)fredInput.value='';
    requiredElement('appShell').style.display = 'none';
    requiredElement('authOverlay').style.display = 'flex';
    requiredElement('loggedInEmail').textContent = '';
}
async function openDashboard(user: AuthUser|null){
    stopAutoSync();syncReadyOwner=null;
    if(!user?.id) throw new Error('No authenticated user was returned. Please sign in again.');
    requiredElement('loggedInEmail').textContent = user.email || '';
    requiredElement('authOverlay').style.display = 'none';
    requiredElement('appShell').style.display = 'block';
    document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(el => { el.value = ''; });
    try {
    await initializeAccountStorage(user.id);
    loadEntryHistory(user.id);
    renderDashboard(); // Show this device’s data before waiting for the network.

    const syncEl = requiredElement('syncStatus');
    if(syncEl){ syncEl.textContent = 'Checking for cloud data…'; syncEl.style.color = 'var(--text-muted)'; }
    const pullResult = await pullSnapshotFromCloud();
    if(pullResult.ok && pullResult.found){
        loadEntryHistory(user.id); // reload validated, non-conflicting cloud data
        if(syncEl){ syncEl.textContent = pullResult.localPending?'This device’s saved data was kept. Automatic sync will upload it; Sync now is also available.':pullResult.keptLocal?'This device’s saved data is in sync.':'Loaded your saved history from the cloud.'; syncEl.style.color = '#10b981'; }
    } else if(pullResult.ok && !pullResult.found){
        const initialPush=await pushSnapshotToCloud();
        if(syncEl){syncEl.textContent=initialPush.ok?'Saved this device’s history to the cloud.':'Sync paused: '+initialPush.reason;}
    } else {
        if(syncEl){ syncEl.textContent = `Cloud load paused: ${pullResult.reason}`; syncEl.style.color = '#f59e0b'; }
    }

    renderDashboard();
    if(historyOwner===user.id)startAutoSync();
    } catch(error){
        stopAutoSync();syncReadyOwner=null;
        requiredElement('totalScoreDisp').innerText='Unavailable';
        requiredElement('statusTermDisp').innerText='Dashboard could not load';
        requiredElement('scoreSubtext').innerText='Saved data may still be present. Export local and cloud backup for AI comparison before making changes.';
        const notice=requiredElement('syncStatus');
        if(notice){notice.textContent='Loading failed; sync paused: '+(error instanceof Error?errorMessage(error):String(error));notice.style.color='#f59e0b';}
    }
}
function handleRegister(event: SubmitEvent){
    return authAction(event, 'registerMessage', async auth => {
        const email = requiredElement('registerEmail').value.trim().toLowerCase();
        const password = requiredElement('registerPassword').value;
        if(password !== requiredElement('registerPassword2').value) throw new Error('Passwords do not match.');
        if(password.length < 8) throw new Error('Password must contain at least 8 characters.');
        const {data, error} = await auth.signUp({email, password});
        if(error) throw error;
        if(!data.session) throw new Error('Sign-up did not return a session. Disable Confirm email in Supabase’s Email provider settings, then try signing in.');
        await openDashboard(data.user);
    });
}
function handleLogin(event: SubmitEvent){
    return authAction(event, 'loginMessage', async auth => {
        const email = requiredElement('loginEmail').value.trim().toLowerCase();
        const {data, error} = await auth.signInWithPassword({email, password: requiredElement('loginPassword').value});
        if(error) throw error;
        if(!data.session) throw new Error('Sign-in did not return a session. Please try again.');
        await openDashboard(data.user);
    });
}
async function logoutUser(){
    stopAutoSync();
    lockDashboard();
    showAuthStep('loginStep');
    try {
        const {error} = await getAuthClient().auth.signOut({scope: 'local'});
        if(error) throw error;
        document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(el => { el.value = ''; });
    } catch(error){ setAuthMessage('loginMessage', 'Sign-out could not complete. ' + authError(error), 'error'); }
}
async function checkExistingSession(){
    try {
        const auth = getAuthClient().auth;
        const {data: {session}, error} = await auth.getSession();
        if(error) throw error;
        if(!session) return;
        const {data, error: userError} = await auth.getUser();
        if(userError) throw userError;
        await openDashboard(data.user);
    } catch(error){ setAuthMessage('loginMessage', authError(error), 'error'); }
}


