const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const storage=new Map();let remote=null,writes=0,choice='local',choiceHook=null;
const client={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from(){let mode='read',payload;const q={select(){if(mode==='read')return q;return Promise.resolve({data:[{user_id:'u'}],error:null}).then(r=>{remote={data:payload.data,updated_at:payload.updated_at};writes++;return r;});},eq(){return q},is(){return q},maybeSingle:async()=>({data:remote,error:null}),update(p){mode='write';payload=p;return q},insert(p){mode='write';payload=p;return q}};return q;}};
const el={style:{},value:'',close(){},showModal(){queueMicrotask(()=>{if(choiceHook)choiceHook();c.finishSyncChoice(choice);});},replaceChildren(){},appendChild(){},setAttribute(){}};
const c={crypto:require('crypto').webcrypto,TextEncoder,window:{supabase:{}},document:{addEventListener(){},getElementById:()=>el,createElement:()=>({...el})},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},alert(){},setTimeout,clearTimeout,setInterval(){},clearInterval(){}};
vm.createContext(c);vm.runInContext(script,c);c.client=client;vm.runInContext('getAuthClient=()=>client;historyOwner="u";loadAnalyses=()=>{};loadFredPreferences=()=>{};loadFunding=()=>{};loadFedWatch=()=>{};',c);
const row=vm.runInContext('({savedAt:"2026-10-09T12:00:00Z",values:{...defaultData}})',c);const key='crash-risk-history-v1:u';
(async()=>{
 await assert.rejects(c.awaitSyncRequest(new Promise(()=>{}),5),/timed out/);
 // Refresh preserves local data even with no baseline and an older/empty cloud copy.
 storage.set(key,JSON.stringify([row]));remote={data:{entryHistory:'[]'},updated_at:'old'};
 let r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(storage.get(key),JSON.stringify([row]));assert.equal(r.localPending,true);
 assert(storage.has('crash-risk-recovery-v1:u:local-before-conflict'));
 assert(storage.has('crash-risk-recovery-v1:u:cloud-before-conflict'));
 // Explicit local deletion must not resurrect cloud rows.
 storage.set(key,'[]');remote={data:{entryHistory:JSON.stringify([row])},updated_at:'older'};
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(storage.get(key),'[]');
 // Only a truly new device loads the cloud snapshot.
 for(const k of Object.values(c.snapshotKeys('u')))storage.delete(k);
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(storage.get(key),JSON.stringify([row]));
 // Local edits survive refresh when cloud has not changed since confirmed sync.
 const base={entryHistory:JSON.stringify([row])};await c.rememberSyncBaseline('u',base);
 const edited=JSON.stringify([row,{...row,savedAt:'2026-10-10T12:00:00Z'}]);
 storage.set(key,edited);remote={data:base,updated_at:'baseline'};
 vm.runInContext('syncBaseline=null;syncReadyOwner=null;',c);
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(r.localPending,true);assert.equal(storage.get(key),edited);
 let before=writes;await Promise.all([c.pushSnapshotToCloud(),c.pushSnapshotToCloud()]);assert.equal(writes,before+1);assert.equal(remote.data.entryHistory,edited);
 // Both sides edited: retain existing local-upload policy, preserving cloud first.
 storage.set(key,JSON.stringify([row,{...row,savedAt:'2026-10-12T12:00:00Z'}]));
 const bothEdited=storage.get(key);
 remote={data:base,updated_at:'other-device'};
 r=await c.pushSnapshotToCloud();assert.equal(r.ok,true);assert.equal(remote.data.entryHistory,bothEdited);
 assert(storage.has('crash-risk-recovery-v1:u:cloud-before-auto-upload'));
 // A simultaneous write still fails the compare-and-swap without disabling sync.
 const originalFrom=client.from;
 client.from=()=>{const q=originalFrom();const originalUpdate=q.update;q.update=function(p){originalUpdate(p);q.select=async()=>({data:[],error:null});return q;};return q;};
 r=await c.pushSnapshotToCloud();assert.equal(r.ok,false);assert.match(r.reason,/retry/);assert.equal(vm.runInContext('syncReadyOwner',c),'u');client.from=originalFrom;
 // Unvalidated cloud data never replaces a valid local history.
 remote={data:{entryHistory:'invalid json'},updated_at:'bad'};
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,false);assert.equal(storage.get(key),bothEdited);
 assert.equal(storage.get('crash-risk-sync-baseline-v1:u').length,64);
 // If only cloud advanced, refresh adopts it, even when row dates are unchanged.
 const cloudEdited={entryHistory:JSON.stringify([{...row,values:{...row.values,vix:22}}])};
 remote={data:cloudEdited,updated_at:'later'};
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(storage.get(key),cloudEdited.entryHistory);assert.equal(r.localPending,undefined);
 // The same rule applies during periodic sync, not only after refresh.
 vm.runInContext('renderDashboard=()=>{};',c);
 remote={data:base,updated_at:'newer'};before=writes;
 r=await c.pushSnapshotToCloud();assert.equal(r.ok,true);assert.equal(r.loadedCloud,true);assert.equal(writes,before);assert.equal(storage.get(key),base.entryHistory);
 // Unknown divergence offers a choice; cloud selection restores without upload.
 storage.set(key,edited);remote={data:cloudEdited,updated_at:'2026-10-14T05:00:00Z'};
 storage.delete('crash-risk-sync-baseline-v1:u');choice='cloud';
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,true);assert.equal(storage.get(key),cloudEdited.entryHistory);
 assert([...storage.keys()].some(k=>k.includes('before-sync-choice-')));
 // Cancel keeps both sides, and a changed cloud invalidates a previous choice.
 storage.set(key,edited);storage.delete('crash-risk-sync-baseline-v1:u');choice='later';
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,false);assert.equal(storage.get(key),edited);
 assert.equal(vm.runInContext('syncChoiceDeferred',c),true);
 vm.runInContext('syncChoiceDeferred=false;',c);choice='cloud';choiceHook=()=>{remote={data:base,updated_at:'changed-during-choice'};};
 r=await c.pullSnapshotFromCloud();assert.equal(r.ok,false);assert.match(r.reason,/changed while choosing/);assert.equal(storage.get(key),edited);choiceHook=null;
 assert.match(c.syncCopySummary(base),/2026-10-09T12:00:00.000Z/);
 console.log('PASS: explicit local/cloud choice, timestamp summary, backups, defer without overwrite, and stale choice rejection.');
 console.log('PASS: refresh retains local data without baseline, empty local history retained, new-device cloud restore, both-copy backups, pending local edits retained, coalesced uploads, automatic local upload over changed cloud with backup, concurrent-write protection, invalid cloud preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
