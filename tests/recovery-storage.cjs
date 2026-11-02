const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const records=new Map(),local=new Map();let failCommit=false,localWrites=0;
const indexedDB={open(){const request={};setTimeout(()=>{request.result={close(){},transaction(){const tx={error:null,abort(){tx.onabort?.()},objectStore(){const make=(result,commit)=>{const req={result};setTimeout(()=>{if(failCommit){tx.error=Error('IndexedDB quota exceeded');tx.onabort?.();}else{commit?.();tx.oncomplete?.();}},0);return req};return {get:key=>make(records.get(key)),getAll:()=>make([...records.values()]),put:record=>make(record.key,()=>records.set(record.key,record))}}};return tx}};request.onsuccess();},0);return request}};
const c={window:{indexedDB},document:{addEventListener(){}},localStorage:{get length(){return local.size},key:i=>[...local.keys()][i],getItem:k=>local.get(k)||null,removeItem:k=>local.delete(k),setItem(){localWrites++;throw Error('localStorage quota exceeded')}},setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(script,c);vm.runInContext('historyOwner="u";',c);
(async()=>{
 await c.saveRecoverySnapshot('u','before-manual-overwrite-1',{local:{entryHistory:'[]'},cloud:{entryHistory:'[]'},cloudUpdatedAt:'original'});assert.equal(localWrites,0);assert.equal(records.size,1);
 await c.saveRecoverySnapshot('u','before-manual-overwrite-1',{cloud:'must not replace first backup'});assert.equal(JSON.parse([...records.values()][0].value).data.cloudUpdatedAt,'original');
 const comparison=await c.cloudComparisonData();assert.equal(comparison.backup.cloudUpdatedAt,'original');assert.equal(comparison.lastPreservedCloud.entryHistory.length,0);
 await c.saveRecoverySnapshot('other','cloud-conflict',{});const backups=await c.recoveryBackups('u');assert.equal(Object.keys(backups).length,1);assert(Object.keys(backups).every(k=>k.includes(':u:')));
 failCommit=true;await assert.rejects(c.saveRecoverySnapshot('u','failed',{}),/quota/);assert(!records.has('crash-risk-recovery-v1:u:failed'));
 console.log('PASS: simulated IndexedDB backup succeeds with localStorage full, first copy preserved, comparison reads database, export isolates accounts, failed transactions reject.');
})().catch(e=>{console.error(e);process.exitCode=1});
