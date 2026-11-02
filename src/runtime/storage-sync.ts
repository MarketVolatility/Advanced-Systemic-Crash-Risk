// --- Cross-device sync ---
// Never silently replace a different local history on refresh.
let syncIntervalHandle:ReturnType<typeof setInterval>|null = null;
let syncReadyOwner:string|null = null;
let syncBaseline:string|null = null;
async function awaitSyncRequest<T>(request:PromiseLike<T>,timeoutMs=15000):Promise<T>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([Promise.resolve(request),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Cloud request timed out. Local data is kept; try again later.')),timeoutMs);})]);}
    finally{clearTimeout(timer);}
}
function snapshotKeys(owner:string){return DashboardCore.snapshotKeys(owner);}
const largeStorageCache=new Map<string,string|null>();
function readAppStorage(key:string){return largeStorageCache.has(key)?largeStorageCache.get(key)??null:localStorage.getItem(key);}
async function writeAppStorage(key:string,value:string|null|undefined){
    if(key.startsWith('crash-risk-analysis-v1:')&&window.indexedDB){
        await recoveryDatabase('readwrite',store=>store.put({key,value}));
        largeStorageCache.set(key,value??null);
        localStorage.removeItem(key);
    }else if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,value);
}
async function initializeAccountStorage(owner:string){
    if(!window.indexedDB)return;
    const key='crash-risk-analysis-v1:'+owner,storedAnalysis=localStorage.getItem(key);
    if(storedAnalysis!==null){
        validateAnalysisHistory(parseJson(storedAnalysis));
        await recoveryDatabase('readwrite',store=>store.put({key,value:storedAnalysis}));
        const checked=await readRecoveryRecord(key);
        if(checked?.value!==storedAnalysis)throw Error('Analysis storage migration could not be verified. Original data kept.');
        if(localStorage.getItem(key)!==storedAnalysis)throw Error('Analysis changed during migration. Retry loading.');
        largeStorageCache.set(key,storedAnalysis);localStorage.removeItem(key);
    }else{
        const saved=await readRecoveryRecord(key);
        if(saved?.value!=null)validateAnalysisHistory(parseJson(saved.value));
        largeStorageCache.set(key,saved?.value??null);
    }
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('crash-risk-recovery-v1:'+owner+':')||k==='crash-risk-history-backup-v1:'+owner)keys.push(k);}
    for(const k of keys){
        const value=localStorage.getItem(k);if(value==null)continue;
        await recoveryDatabase('readwrite',store=>store.put({key:k,value}));
        const checked=await readRecoveryRecord(k);
        if(checked?.value===value&&localStorage.getItem(k)===value)localStorage.removeItem(k);
    }
}
function localSnapshot(owner:string):Snapshot{return Object.fromEntries(Object.entries(snapshotKeys(owner)).map(([field,key])=>[field,readAppStorage(key)||(field==='fredHistory'?null:'[]')])) as Snapshot;}
function validateSyncSnapshot(value:unknown):asserts value is Partial<Snapshot>{
    const data=providerObject(value);
    if(!data || typeof data!=='object')throw Error('Invalid cloud snapshot');
    for(const field of Object.keys(snapshotKeys('')) as (keyof Snapshot)[]){
        if(data[field]==null)continue;
        if(typeof data[field]!=='string')throw Error('Invalid '+field);
        const rows:unknown=parseJson(data[field]);
        if(field==='fredHistory'){validateFredData(rows);continue;}
        if(!unknownArray(rows))throw Error('Invalid '+field);
        if(field==='entryHistory' && rows.some(row=>!readableHistoryRow(row)))throw Error('Invalid market history; original copies preserved');
        if(field==='fedWatchHistory')rows.forEach(validateFedWatch);
        if(field==='fundingHistory')rows.forEach(validateFunding);
        if(field==='analysisHistory')validateAnalysisHistory(rows);
    }
}
function validateCompleteSnapshot(value:unknown):asserts value is Snapshot{
    validateSyncSnapshot(value);
    for(const key of Object.keys(snapshotKeys('')) as (keyof Snapshot)[]){if(value[key]!==null&&typeof value[key]!=='string')throw Error('Incomplete snapshot: '+key);}
}
function snapshotFingerprint(data?:Partial<Snapshot>|null){return JSON.stringify((Object.keys(snapshotKeys('')) as (keyof Snapshot)[]).map(k=>data?.[k]??(k==='fredHistory'?null:'[]')));}
// Persist only a compact digest, not another copy of large Word documents.
async function syncDigest(data?:Partial<Snapshot>|null){
    if(!globalThis.crypto?.subtle)return null;
    const bytes=new TextEncoder().encode(snapshotFingerprint(data));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
async function rememberSyncBaseline(owner:string,data?:Partial<Snapshot>|null){
    syncBaseline=snapshotFingerprint(data);
    try{const digest=await syncDigest(data);if(digest)localStorage.setItem('crash-risk-sync-baseline-v1:'+owner,digest);}catch{} // Sync success must survive optional metadata storage failure.
}
async function cloudMatchesSavedBaseline(owner:string,data?:Partial<Snapshot>|null){
    try{const saved=localStorage.getItem('crash-risk-sync-baseline-v1:'+owner);return !!saved&&saved===await syncDigest(data);}catch{return false;}
}
interface RecoveryRecord {key:string;value:string}
type RecoveryStore=Omit<IDBObjectStore,'get'|'getAll'>&{
 get(key:IDBValidKey):IDBRequest<unknown>;
 getAll():IDBRequest<unknown[]>;
};
function checkedRecoveryRecord(value:unknown):RecoveryRecord{
    if(!isRecord(value)||typeof value['key']!=='string'||typeof value['value']!=='string')throw Error('Invalid recovery record; original storage preserved.');
    return {key:value['key'],value:value['value']};
}
async function readRecoveryRecord(key:string):Promise<RecoveryRecord|undefined>{
    const value=await recoveryDatabase('readonly',store=>store.get(key));
    return value===undefined?undefined:checkedRecoveryRecord(value);
}
function recoveryDatabase<T>(mode:IDBTransactionMode,operation:(store:RecoveryStore)=>IDBRequest<T>):Promise<T>{
    return new Promise<T>((resolve,reject)=>{
        let db:IDBDatabase|undefined,transaction:IDBTransaction|undefined,finished=false;
        const finish=(outcome:{ok:true;result:T}|{ok:false;error:unknown})=>{if(finished)return;finished=true;clearTimeout(timer);if(db)db.close();outcome.ok?resolve(outcome.result):reject(outcome.error);};
        const fail=(error:unknown)=>finish({ok:false,error});
        const timer=setTimeout(()=>{try{transaction?.abort();}catch{}fail(Error('Backup storage timed out. Cloud was not overwritten.'));},15000);
        let request;
        try{request=window.indexedDB.open('crash-risk-recovery-v1',1);}catch(error){fail(error);return;}
        request.onupgradeneeded=()=>request.result.createObjectStore('snapshots',{keyPath:'key'});
        request.onerror=()=>fail(request.error||Error('Backup storage could not open.'));
        request.onblocked=()=>fail(Error('Backup storage is blocked by another tab. Close other dashboard tabs and retry.'));
        request.onsuccess=()=>{
            db=request.result;if(finished){db.close();return;}
            try{
                transaction=db.transaction('snapshots',mode);
                const result=operation(transaction.objectStore('snapshots'));
                transaction.oncomplete=()=>finish({ok:true,result:result.result});
                transaction.onerror=()=>fail(transaction?.error||Error('Backup could not be saved.'));
                transaction.onabort=()=>fail(transaction?.error||Error('Backup was cancelled.'));
            }catch(error){fail(error);}
        };
    });
}
async function saveRecoverySnapshot(owner:string,label:string,data:unknown){
    const key='crash-risk-recovery-v1:'+owner+':'+label;
    if(localStorage.getItem(key))return;
    const value=JSON.stringify({savedAt:new Date().toISOString(),data});
    if(window.indexedDB){
        const existing=await readRecoveryRecord(key);
        if(!existing)await recoveryDatabase('readwrite',store=>store.put({key,value}));
    }else localStorage.setItem(key,value);
}
async function recoveryBackups(owner:string){
    const backups:Record<string,string>={},prefix='crash-risk-recovery-v1:'+owner+':';
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)||key==='crash-risk-history-backup-v1:'+owner)backups[key]=requiredValue(localStorage.getItem(key));}
    if(window.indexedDB){
        const raw=await recoveryDatabase('readonly',store=>store.getAll());
        if(!unknownArray(raw))throw Error('Invalid recovery database; original storage preserved.');
        const records=raw.map(checkedRecoveryRecord);
        for(const record of records)if((record.key.startsWith(prefix)||record.key==='crash-risk-history-backup-v1:'+owner)&&!Object.hasOwn(backups,record.key))backups[record.key]=record.value;
    }
    return backups;
}
async function exportRecoveryData(){return exportCloudComparison();}
async function cloudComparisonData(){
    if(!historyOwner)throw Error('Sign in to export your saved copies.');
    const owner=historyOwner,prefix='crash-risk-recovery-v1:'+owner+':',candidates:{manual:boolean;label:string;savedAt:string;cloud:Partial<Snapshot>|null;localAtBackup:Partial<Snapshot>|null;cloudUpdatedAt:string|null}[]=[];
    const backups=await recoveryBackups(owner);
    if(historyOwner!==owner)throw Error('Account changed; comparison cancelled.');
    for(const [key,value] of Object.entries(backups)){
        if(!key.startsWith(prefix))continue;
        const label=key.slice(prefix.length);
        const manual=label.startsWith('before-manual-overwrite-');
        if(!manual&&!['cloud-before-conflict','cloud-first-seen','cloud-conflict'].includes(label))continue;
        try{
            const record=providerObject(parseJson(value)),savedAt=checkedString(record['savedAt']);
            if(!Number.isFinite(Date.parse(savedAt)))continue;
            const data=providerObject(record['data']),cloud=manual?data['cloud']:data,localAtBackup=manual?data['local']:null;
            if(cloud!=null)validateSyncSnapshot(cloud);
            if(localAtBackup!=null)validateSyncSnapshot(localAtBackup);
            candidates.push({manual,label,savedAt,cloud:cloud??null,localAtBackup:localAtBackup??null,cloudUpdatedAt:manual?nullableString(data['cloudUpdatedAt']):null});
        }catch{/* Preserve unreadable backups, but do not present them as verified copies. */}
    }
    // Prefer the last pre-overwrite cloud copy, even after a later successful sync.
    candidates.sort((a,b)=>Number(b.manual)-Number(a.manual)||Date.parse(b.savedAt)-Date.parse(a.savedAt));
    const last=candidates[0];
    const decode=(snapshot:Partial<Snapshot>|null|undefined)=>snapshot==null?null:Object.fromEntries(Object.entries(snapshot).map(([key,value])=>{try{return [key,typeof value==='string'?parseJson(value):value];}catch{return [key,{unreadableRaw:value}];}}));
    return {
        format:'crash-risk-cloud-local-comparison-v1',exportedAt:new Date().toISOString(),
        instructions:'Compare currentLocal with lastPreservedCloud and, if present, localAtBackup. Also inspect recoveryBackups (raw saved JSON strings) for additional recoverable records. List missing rows, differing values, dates and record counts for every dataset. If no cloud copy is preserved, say that comparison is unavailable; never treat null as an empty cloud dataset. Do not assume the newest timestamp proves correctness; do not invent missing records or apply changes.',
        recoveryBackups:backups,
        backup:{savedAt:last?.savedAt??null,cloudUpdatedAt:last?.cloudUpdatedAt??null,kind:last?(last.manual?'Cloud before last manual overwrite':'Last preserved cloud snapshot'):'No preserved cloud snapshot',cloudRecordExisted:last?.cloud!=null},
        currentLocal:decode(localSnapshot(historyOwner)),
        lastPreservedCloud:decode(last?.cloud),localAtBackup:decode(last?.localAtBackup)
    };
}
async function downloadCloudComparison(comparison?:Awaited<ReturnType<typeof cloudComparisonData>>){
    comparison=comparison||await cloudComparisonData();
    const blob=new Blob([JSON.stringify(comparison,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='crash-risk-local-cloud-comparison-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(link);
    try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    return comparison;
}
async function exportCloudComparison(){
    const status=requiredElement('syncStatus');
    try{
        const comparison=await downloadCloudComparison();
        setAppFeedback(status,'Backup download requested: current local data and '+Object.keys(comparison.recoveryBackups).length+' recovery backups. '+(comparison.backup.savedAt?'Preserved cloud copy: '+new Date(comparison.backup.savedAt).toLocaleString()+'.':'No cloud copy has been preserved yet; local backup is included.'),'success');
    }catch(error){setAppFeedback(status,errorMessage(error));}
}
let syncChoiceResolve:((choice:string)=>void)|null=null;
let syncChoiceDeferred=false;
function finishSyncChoice(choice:string){
    const resolve=syncChoiceResolve;syncChoiceResolve=null;
    requiredElement('syncChoicePanel').close();
    if(resolve)resolve(choice);
}
function syncCopySummary(snapshot?:Partial<Snapshot>|null){
    let newest=0,marketCount=0;
    for(const field of Object.keys(snapshotKeys('')) as (keyof Snapshot)[]){
        try{const rows=parseJson(snapshot?.[field]||'null');if(!unknownArray(rows))continue;
            if(field==='entryHistory')marketCount=rows.length;
            for(const row of rows)if(isRecord(row))for(const key of ['updatedAt','savedAt','createdAt','fetchedAt']){const value=row[key];const stamp=typeof value==='string'?Date.parse(value):NaN;if(Number.isFinite(stamp))newest=Math.max(newest,stamp);}
        }catch{}
    }
    return marketCount+' market rows; latest recorded timestamp: '+(newest?new Date(newest).toLocaleString()+' ('+new Date(newest).toISOString()+')':'unavailable');
}
type CloudRow={data:Snapshot;updated_at:string|null};
interface SyncResult {ok:boolean;reason?:string;found?:boolean;loadedCloud?:boolean;localPending?:boolean;keptLocal?:boolean}
async function chooseSyncCopy(owner:string,local:Snapshot,remote:CloudRow|null){
    if(syncChoiceResolve||syncChoiceDeferred)throw Error('Sync is waiting for your choice. Select Sync now when ready.');
    requiredElement('syncChoiceLocal').textContent='Browser copy\n'+syncCopySummary(local);
    const uploaded=Date.parse(remote?.updated_at??'');
    requiredElement('syncChoiceCloud').textContent='Cloud copy\n'+syncCopySummary(remote?.data)+'\nCloud uploaded: '+(Number.isFinite(uploaded)?new Date(uploaded).toLocaleString()+' ('+new Date(uploaded).toISOString()+')':'unavailable');
    const choice=await new Promise<string>(resolve=>{syncChoiceResolve=resolve;requiredElement('syncChoicePanel').showModal();});
    if(choice==='later'){syncChoiceDeferred=true;throw Error('Nothing replaced. Select Sync now to choose a copy later.');}
    if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local))throw Error('Browser data changed while choosing. Please compare the updated copies again.');
    const {data:fresh,error}=await awaitSyncRequest(getAuthClient().from('user_app_data').select('data,updated_at').eq('user_id',owner).maybeSingle());
    if(error)throw error;
    if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local)||snapshotFingerprint(fresh?.data)!==snapshotFingerprint(remote?.data)||fresh?.updated_at!==remote?.updated_at)throw Error('Data changed while choosing. No copy replaced; compare again.');
    await saveRecoverySnapshot(owner,'before-sync-choice-'+Date.now(),{local,cloud:remote?.data,cloudUpdatedAt:remote?.updated_at});
    if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local))throw Error('Browser data changed during backup. No copy replaced.');
    return choice;
}
let syncPushPending:Promise<SyncResult>|null=null;
function pushSnapshotToCloud(){
    if(syncPushPending)return syncPushPending;
    syncPushPending=performSnapshotPush().finally(()=>{syncPushPending=null;});
    return syncPushPending;
}
async function performSnapshotPush():Promise<SyncResult>{
    try{
        if(!window.supabase)return {ok:false,reason:'Supabase not initialized'};
        const owner=historyOwner,client=getAuthClient();
        const {data:userData}=await awaitSyncRequest(client.auth.getUser());
        if(!owner||userData?.user?.id!==owner||historyOwner!==owner)return {ok:false,reason:'Account changed; sync cancelled'};
        if(syncReadyOwner!==owner)return {ok:false,reason:'Sync paused to protect saved data. Export local and cloud backup for AI comparison before resolving the local/cloud difference.'};
        const local=localSnapshot(owner);validateSyncSnapshot(local);
        const {data:remote,error:readError}=await awaitSyncRequest(client.from('user_app_data').select('data,updated_at').eq('user_id',owner).maybeSingle());
        if(readError)return {ok:false,reason:readError.message};
        if(historyOwner!==owner)return {ok:false,reason:'Account changed; sync cancelled'};
        if(remote?.data && snapshotFingerprint(remote.data)!==syncBaseline){
            validateSyncSnapshot(remote.data);
            if(snapshotFingerprint(local)===syncBaseline || await cloudMatchesSavedBaseline(owner,local)){
                await saveRecoverySnapshot(owner,'local-before-conflict',local);
                await saveRecoverySnapshot(owner,'cloud-before-conflict',remote.data);
                if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local))return {ok:false,reason:'Local data changed during cloud load; automatic sync will retry.'};
                await applyRestoredLocalSnapshot(owner,{...local,...remote.data});
                await rememberSyncBaseline(owner,remote.data);
                loadEntryHistory(owner);renderDashboard();
                return {ok:true,loadedCloud:true};
            }
            const choice=await chooseSyncCopy(owner,local,remote);
            if(choice==='cloud'){
                await applyRestoredLocalSnapshot(owner,{...local,...remote.data});
                await rememberSyncBaseline(owner,remote.data);loadEntryHistory(owner);renderDashboard();
                return {ok:true,loadedCloud:true};
            }
            await saveRecoverySnapshot(owner,'cloud-before-auto-upload',remote.data);
        }
        if(historyOwner!==owner)return {ok:false,reason:'Account changed; sync cancelled'};
        const table=client.from('user_app_data');
        const payload={user_id:owner,data:local,updated_at:new Date().toISOString()};
        // Compare-and-swap prevents a concurrent device from being overwritten.
        let request=remote?table.update(payload).eq('user_id',owner):table.insert(payload);
        if(remote)request=remote.updated_at==null?request.is('updated_at',null):request.eq('updated_at',remote.updated_at);
        const {data:written,error}=await awaitSyncRequest(request.select('user_id'));
        if(error)return {ok:false,reason:errorMessage(error)};
        if(!written?.length)return {ok:false,reason:'Cloud changed during this upload. No data overwritten; automatic sync will retry.'};
        await rememberSyncBaseline(owner,local);return {ok:true};
    }catch(error){return {ok:false,reason:errorMessage(error)};}
}
async function pullSnapshotFromCloud():Promise<SyncResult>{
    syncReadyOwner=null;
    try{
        if(!window.supabase)return {ok:false,reason:'Supabase not initialized'};
        const owner=historyOwner,client=getAuthClient();
        const {data:userData}=await awaitSyncRequest(client.auth.getUser());
        if(!owner||userData?.user?.id!==owner||historyOwner!==owner)return {ok:false,reason:'Account changed; load cancelled'};
        const {data,error}=await awaitSyncRequest(client.from('user_app_data').select('data,updated_at').eq('user_id',owner).maybeSingle());
        if(error)return {ok:false,reason:errorMessage(error)};
        if(historyOwner!==owner)return {ok:false,reason:'Account changed; load cancelled'};
        const local=localSnapshot(owner);validateSyncSnapshot(local);
        if(data?.data){
            validateSyncSnapshot(data.data);
            const keys=snapshotKeys(owner);
            // A saved empty array is intentional (e.g. deleting the last row), not a new device.
            // Never replace an established browser's saved copy merely because cloud differs.
            const hasLocalCopy=Object.values(keys).some(key=>readAppStorage(key)!==null);
            const differs=snapshotFingerprint(local)!==snapshotFingerprint(data.data);
            if(hasLocalCopy && differs && await cloudMatchesSavedBaseline(owner,local)){
                // This device is unchanged since the confirmed sync; cloud has advanced.
                await saveRecoverySnapshot(owner,'local-before-conflict',local);
                await saveRecoverySnapshot(owner,'cloud-before-conflict',data.data);
                if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local))return {ok:false,reason:'Local data changed during cloud load; automatic sync will retry.'};
                await applyRestoredLocalSnapshot(owner,{...local,...data.data});
                await rememberSyncBaseline(owner,data.data);syncReadyOwner=owner;
                return {ok:true,found:true};
            }
            if(hasLocalCopy && differs && !(await cloudMatchesSavedBaseline(owner,data.data))){
                const choice=await chooseSyncCopy(owner,local,data);
                if(choice==='cloud'){
                    await applyRestoredLocalSnapshot(owner,{...local,...data.data});
                    await rememberSyncBaseline(owner,data.data);syncReadyOwner=owner;
                    return {ok:true,found:true};
                }
            }
            if(hasLocalCopy){
                if(differs){
                    await saveRecoverySnapshot(owner,'local-before-conflict',local);
                    await saveRecoverySnapshot(owner,'cloud-before-conflict',data.data);
                }
                if(historyOwner!==owner)return {ok:false,reason:'Account changed; load cancelled'};
                syncBaseline=snapshotFingerprint(data.data);syncReadyOwner=owner;
                return {ok:true,found:true,localPending:differs,keptLocal:true};
            }
            await saveRecoverySnapshot(owner,'before-cloud-load',local);
            await saveRecoverySnapshot(owner,'cloud-first-seen',data.data);
            if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==snapshotFingerprint(local))return {ok:false,reason:'Account or local data changed during backup; cloud load cancelled. Retry Sync now.'};
            for(const [field,key] of Object.entries(keys) as [keyof Snapshot,string][])if(data.data[field]!=null && (!local[field]||local[field]==='[]'))await writeAppStorage(key,data.data[field]);
        }
        await rememberSyncBaseline(owner,data?.data);syncReadyOwner=owner;
        return {ok:true,found:!!data?.data};
    }catch(error){return {ok:false,reason:errorMessage(error)};}
}

function startAutoSync(){
    if(syncIntervalHandle) clearInterval(syncIntervalHandle);
    syncIntervalHandle = setInterval(async () => {
        if(!historyOwner||cloudOverwritePending||manualSyncPending||syncChoiceResolve||syncChoiceDeferred)return;
        if(syncReadyOwner!==historyOwner){await syncNow();return;}
        const result = await pushSnapshotToCloud();
        const el = requiredElement('syncStatus');
        if(el){
            el.textContent = result.ok ? `Auto-synced at ${new Date().toLocaleTimeString()}.` : `Sync failed: ${result.reason}`;
            el.style.color = result.ok ? 'var(--green)' : '#f59e0b';
        }
    }, 8 * 60 * 1000);
}

function stopAutoSync(){
    if(syncIntervalHandle){ clearInterval(syncIntervalHandle); syncIntervalHandle = null; }
}

async function applyRestoredLocalSnapshot(owner:string,snapshot:Snapshot){
    validateSyncSnapshot(snapshot);
    const keys=snapshotKeys(owner),previous:Record<string,string|null>={},written:string[]=[];
    for(const key of Object.values(keys))previous[key]=readAppStorage(key);
    try{
        for(const [field,key] of Object.entries(keys) as [keyof Snapshot,string][]){
            await writeAppStorage(key,snapshot[field]);
            written.push(key);
        }
    }catch(error){
        let rollbackFailed=false;
        for(const key of written.reverse())try{await writeAppStorage(key,previous[key]);}catch{rollbackFailed=true;}
        throw Error('Local storage could not be restored. Sync remains paused. '+(rollbackFailed?'Recover the preserved backup before continuing.':'Previous local data was kept; free browser storage outside this site and retry.')+' '+errorMessage(error));
    }
}
function compareRestoreSnapshot(local:Snapshot,imported:Snapshot){
    const canonical=(value:unknown)=>JSON.stringify(normalize(value));
    function normalize(value:unknown):unknown{
        if(unknownArray(value))return value.map(normalize);
        if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize((value as Record<string,unknown>)[key])]));
        return value;
    }
    const labels={entryHistory:'Market history',analysisHistory:'AI analyses',fundingHistory:'Funding records',fedWatchHistory:'Fed Watch',fredHistory:'FRED data'};
    const differences=[];
    for(const field of Object.keys(snapshotKeys('')) as (keyof Snapshot)[]){
        const a=local[field]==null?null:parseJson(local[field]),b=imported[field]==null?null:parseJson(imported[field]);
        if(canonical(a)===canonical(b))continue;
        const count=(value:unknown)=>{if(unknownArray(value))return value.length;if(value&&typeof value==='object'&&'rows' in value&&unknownArray(value.rows))return value.rows.length;return 0;};
        differences.push(labels[field]+': local '+count(a)+' records; imported '+count(b)+' records. Content differs.');
    }
    return differences;
}
function parseCloudRestore(text:string):Snapshot{
    const file=providerObject(parseJson(text));
    if(file['format']!=='crash-risk-cloud-local-comparison-v1')throw Error('Select a crash-risk-local-cloud-comparison JSON file.');
    const cloud=providerObject(file['lastPreservedCloud']);
    if(!cloud||typeof cloud!=='object'||unknownArray(cloud))throw Error('This file contains no previous cloud record to restore.');
    const snapshot:Partial<Snapshot>={};
    for(const field of Object.keys(snapshotKeys('')) as (keyof Snapshot)[]){
        if(!Object.hasOwn(cloud,field))throw Error('The previous cloud copy is incomplete: missing '+field+'.');
        if(field!=='fredHistory'&&!unknownArray(cloud[field]))throw Error('Invalid '+field+' in previous cloud copy.');
        snapshot[field]=cloud[field]===null?null:JSON.stringify(cloud[field]);
    }
    validateCompleteSnapshot(snapshot);
    return snapshot;
}
async function importCloudRestore(input:HTMLInputElement){
    const file=input.files?.[0],owner=historyOwner;input.value='';
    if(!file||cloudOverwritePending||manualSyncPending)return;
    try{
        if(!owner)throw Error('Sign in before restoring cloud data.');
        const snapshot=parseCloudRestore(await file.text());
        if(historyOwner!==owner)throw Error('Account changed; select the file again.');
        showCloudOverwrite(snapshot);
    }catch(error){setAppFeedback('syncStatus','Restore not started: '+errorMessage(error));}
}
let cloudOverwriteOriginalText:{explanation:string|null;agreement:string|null}|null=null;
let cloudOverwritePending=false,cloudOverwriteSelection:{owner:string;fingerprint:string;restoreSnapshot:Snapshot|null;differences:string[]}|null=null;
function showCloudOverwrite(restoreSnapshot:Snapshot|null=null){
    if(cloudOverwritePending)return;
    const panel=requiredElement('cloudOverwritePanel');
    const explanation=requiredElement('cloudOverwriteExplanation'),agreement=requiredElement('cloudOverwriteAgreement');
    if(!cloudOverwriteOriginalText)cloudOverwriteOriginalText={explanation:explanation.textContent,agreement:agreement.textContent};
    requiredElement('cloudOverwriteTitle').textContent=restoreSnapshot?'Restore previous cloud content from file':'Overwrite cloud with this device’s saved data';
    explanation.textContent=restoreSnapshot?'This restores the preserved cloud copy from your imported comparison file to the signed-in account. Your current local and cloud copies will be backed up and a comparison file downloaded first. The imported cloud copy will replace both cloud and local saved data, refresh the dashboard, and resume automatic sync.':cloudOverwriteOriginalText.explanation;
    agreement.textContent=restoreSnapshot?'Enter your account password and select Restore to confirm that this file contains the cloud data you want for this account.':cloudOverwriteOriginalText.agreement;
    requiredElement('cloudOverwriteSubmit').textContent=restoreSnapshot?'Verify password and restore cloud':'Verify password and overwrite cloud';
    requiredElement('cloudOverwritePassword').value='';
    setAppFeedback('cloudOverwriteStatus','');
    try{
        if(!historyOwner)throw Error('Sign in before replacing cloud data.');
        const snapshot=localSnapshot(historyOwner);validateSyncSnapshot(snapshot);
        if(restoreSnapshot)validateSyncSnapshot(restoreSnapshot);
        const rows=validatedMarketHistory(parseJson((restoreSnapshot||snapshot).entryHistory??'[]'));
        const differences=restoreSnapshot?compareRestoreSnapshot(snapshot,restoreSnapshot):[];
        cloudOverwriteSelection={owner:historyOwner,fingerprint:snapshotFingerprint(snapshot),restoreSnapshot,differences};
        setAppFeedback('cloudRestoreDifferences',restoreSnapshot?(differences.length?'Imported data differs from current local data:\n'+differences.join('\n')+'\nEnter your password and select Restore to approve replacing these differences.':'The imported copy matches current local data.'):'');
        requiredElement('cloudOverwriteSummary').textContent=rows.length+(restoreSnapshot?' market rows in the previous cloud copy':' saved market rows on this device')+(rows.length?' · Latest: '+new Date(Math.max(...rows.map(r=>Date.parse(r.savedAt)))).toLocaleString():'')+'.';
        if(!panel.open)panel.showModal();requiredElement('cloudOverwritePassword').focus();
    }catch(error){setAppFeedback('syncStatus',errorMessage(error));}
}
function hideCloudOverwrite(){
    if(cloudOverwritePending)return;
    cloudOverwriteSelection=null;
    requiredElement('cloudOverwritePassword').value='';
    requiredElement('cloudOverwritePanel').close();
}
async function overwriteCloudWithLocal(event:Event){
    event.preventDefault();
    if(cloudOverwritePending||manualSyncPending)return;
    const input=requiredElement('cloudOverwritePassword'),status=requiredElement('cloudOverwriteStatus');
    let password=input.value;input.value='';
    if(!password){setAppFeedback(status,'Enter your account password to confirm the overwrite.');return;}
    const selection=cloudOverwriteSelection;
    cloudOverwritePending=true;stopAutoSync();syncReadyOwner=null;
    for(const id of ['cloudOverwriteSubmit','cloudOverwriteCancel','syncNowBtn','overwriteCloudBtn','restoreCloudBtn'] as const)requiredElement(id).disabled=true;
    try{
        const owner=selection?.owner,client=getAuthClient();
        if(!owner||historyOwner!==owner)throw Error('Account changed. Reopen the confirmation.');
        const local=localSnapshot(owner);validateSyncSnapshot(local);
        if(snapshotFingerprint(local)!==selection.fingerprint)throw Error('Local data changed. Reopen the confirmation to review the latest copy.');
        setAppFeedback(status,'Verifying your password…');
        const {data:identity,error:identityError}=await awaitSyncRequest(client.auth.getUser());
        if(identityError||identity?.user?.id!==owner||!identity.user.email)throw Error('Please sign in again before replacing cloud data.');
        // Separate, memory-only authentication never replaces the dashboard session.
        const verified=requiredValue(window.supabase).createClient<DashboardDatabase>(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'crash-risk-overwrite-verification'}});
        const {data:login,error:loginError}=await awaitSyncRequest(verified.auth.signInWithPassword({email:identity.user.email,password}));
        password='';
        if(loginError||login?.user?.id!==owner||!login.session)throw Error('Password verification failed. No cloud data was replaced.');
        setAppFeedback(status,'Backing up the cloud copy and saving your local data…');
        const {data:remote,error:readError}=await awaitSyncRequest(verified.from('user_app_data').select('data,updated_at').eq('user_id',owner).maybeSingle());
        if(readError)throw readError;
        if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==selection.fingerprint)throw Error('Account or local data changed. Reopen the confirmation.');
        const label='before-manual-overwrite-'+Date.now()+'-'+Math.random().toString(36).slice(2);
        await saveRecoverySnapshot(owner,label,{local,cloud:remote?.data??null,cloudUpdatedAt:remote?.updated_at??null});
        await downloadCloudComparison(); // Request the recovery download before replacing the cloud record.
        if(historyOwner!==owner||snapshotFingerprint(localSnapshot(owner))!==selection.fingerprint)throw Error('Account or local data changed during backup. Reopen the confirmation.');
        const target=selection.restoreSnapshot||local;validateSyncSnapshot(target);
        const payload={user_id:owner,data:target,updated_at:new Date().toISOString()};
        const table=verified.from('user_app_data');
        let request=remote?table.update(payload).eq('user_id',owner):table.insert(payload);
        if(remote)request=remote.updated_at==null?request.is('updated_at',null):request.eq('updated_at',remote.updated_at);
        const {data:written,error:writeError}=await awaitSyncRequest(request.select('user_id'));
        if(writeError)throw writeError;
        if(!written?.length)throw Error('Cloud data changed during confirmation. Nothing was overwritten; review and retry.');
        if(historyOwner!==owner)throw Error('Cloud saved for the verified account; account changed, so automatic sync remains paused.');
        if(selection.restoreSnapshot){
            if(snapshotFingerprint(localSnapshot(owner))!==selection.fingerprint)throw Error('Cloud restored, but local data changed during the request. Local edits were kept; sync remains paused. Review and retry restoration.');
            await applyRestoredLocalSnapshot(owner,target);
            loadEntryHistory(owner);
            renderDashboard();
            await rememberSyncBaseline(owner,target);syncReadyOwner=owner;startAutoSync();
            cloudOverwriteSelection=null;
            setAppFeedback(status,'Previous cloud content restored to both cloud and this device. Dashboard refreshed; automatic sync resumed. A backup comparison download was requested.');
            setAppFeedback('syncStatus',status.textContent);
            return;
        }
        await rememberSyncBaseline(owner,local);syncReadyOwner=owner;startAutoSync();
        cloudOverwriteSelection=null;
        setAppFeedback(status,'Cloud replaced with your saved local copy. Automatic sync resumed. Comparison download requested for AI analysis. If it did not appear in Downloads, use Export local and cloud backup for AI comparison to retry.');
        setAppFeedback('syncStatus','Cloud replaced with local data. Automatic sync resumed.');
    }catch(error){
        syncReadyOwner=null;stopAutoSync();
        setAppFeedback(status,'Sync paused: '+errorMessage(error));
        setAppFeedback('syncStatus',status.textContent);
    }finally{
        password='';input.value='';cloudOverwritePending=false;
        for(const id of ['cloudOverwriteSubmit','cloudOverwriteCancel','syncNowBtn','overwriteCloudBtn','restoreCloudBtn'] as const)requiredElement(id).disabled=false;
    }
}
let manualSyncPending=false;
async function syncNow(){
    if(manualSyncPending||cloudOverwritePending)return;
    manualSyncPending=true;syncChoiceDeferred=false;
    const el=requiredElement('syncStatus');
    try{
        if(el){el.textContent='Checking cloud connection…';el.style.color='var(--text-muted)';}
        if(!historyOwner)throw Error('Sign in before syncing.');
        const owner=historyOwner;
        if(syncReadyOwner!==owner){
            const checked=await pullSnapshotFromCloud();
            if(!checked.ok)throw Error(checked.reason);
            if(historyOwner!==owner)throw Error('Account changed; sync cancelled');
            loadEntryHistory(owner);
            renderDashboard();
        }
        const result=await pushSnapshotToCloud();
        if(!result.ok)throw Error(result.reason);
        if(historyOwner!==owner)return;
        startAutoSync();
        if(el){el.textContent=`Synced at ${new Date().toLocaleTimeString()}. Automatic sync resumed.`;el.style.color='#10b981';}
    }catch(error){
        if(historyOwner)startAutoSync();
        if(el){el.textContent='Sync could not finish: '+errorMessage(error)+' Automatic sync will retry.';el.style.color='#f59e0b';}
    }finally{manualSyncPending=false;}
}
