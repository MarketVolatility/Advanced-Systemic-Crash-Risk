interface AccountBackup {
 format:'crash-risk-account-backup-v1';createdAt:string;owner:string;email:string;
 snapshot:Snapshot;recovery:Record<string,string>;fredKey:string|null;layout:string|null;
 instructions:string;
}
let accountBackupBusy=false;
async function createAccountBackup():Promise<AccountBackup>{
 const owner=historyOwner;if(!owner)throw Error('Sign in before backing up your account.');
 const snapshot=localSnapshot(owner);validateSyncSnapshot(snapshot);
 const recovery=await recoveryBackups(owner);
 if(owner!==historyOwner)throw Error('Account changed; backup cancelled.');
 if(snapshotFingerprint(snapshot)!==snapshotFingerprint(localSnapshot(owner)))throw Error('Saved data changed during backup. Try again.');
 return {format:'crash-risk-account-backup-v1',createdAt:new Date().toISOString(),owner,email:requiredElement('loggedInEmail').textContent||'',snapshot,recovery,fredKey:localStorage.getItem(fredKeyStorage()),layout:localStorage.getItem('crash-risk-platform-layout'),instructions:'Keep this private file and a copy of index.html outside browser/cloud storage. Sign in or register a new account, then use Sync & backups > Restore Account. Saved browser data, documents, recovery copies, FRED key and layout are included. Unsaved edits and cloud-only changes not loaded into this browser are excluded: sync before backup if needed. Passwords and login sessions are excluded. Recreating a deleted authentication service requires its administrator; this file cannot recreate that service. After restore, review the data and use Sync now or Overwrite cloud with local to repopulate cloud storage.'};
}
function parseAccountBackup(text:string):AccountBackup{
 const file=providerObject(parseJson(text));
 if(file["format"]!=='crash-risk-account-backup-v1'||typeof file["owner"]!=='string'||!file["owner"]||typeof file["createdAt"]!=='string'||!Number.isFinite(Date.parse(file["createdAt"]))||typeof file["email"]!=='string')throw Error('Select a valid Backup Account JSON file.');
 const snapshot=providerObject(file["snapshot"]);
 for(const key of Object.keys(snapshotKeys('')))if(!Object.hasOwn(snapshot,key))throw Error('Incomplete backup: missing '+key+'.');
 validateCompleteSnapshot(snapshot);
 if(!file["recovery"]||typeof file["recovery"]!=='object'||unknownArray(file["recovery"]))throw Error('Incomplete backup: missing recovery records.');
 const recovery:Record<string,string>={};
 for(const [key,value] of Object.entries(providerObject(file["recovery"]))){
  if(!(key.startsWith('crash-risk-recovery-v1:'+file["owner"]+':')||key==='crash-risk-history-backup-v1:'+file["owner"])||typeof value!=='string')throw Error('Invalid recovery record.');
  recovery[key]=value;
 }
 if(file["fredKey"]!==null&&typeof file["fredKey"]!=='string')throw Error('Invalid FRED key.');
 if(file["layout"]!==null&&!['desktop','mobile'].includes(String(file["layout"])))throw Error('Invalid layout setting.');
 return {...file,format:'crash-risk-account-backup-v1',owner:file['owner'],createdAt:file['createdAt'],email:file['email'],snapshot,recovery,fredKey:file['fredKey'],layout:nullableString(file['layout']),instructions:typeof file['instructions']==='string'?file['instructions']:''};
}
async function backupAccount(){
 if(accountBackupBusy)return;accountBackupBusy=true;
 try{
  const backup=await createAccountBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='crash-risk-account-'+backup.createdAt.replaceAll(':','-')+'.json';document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  setAppFeedback('accountBackupStatus','Account backup download started. Keep this private file and index.html somewhere outside this browser.');
 }catch(error){setAppFeedback('accountBackupStatus','Backup failed: '+errorMessage(error),'error');}finally{accountBackupBusy=false;}
}
async function restoreAccountData(backup:AccountBackup,owner:string){
 backup=parseAccountBackup(JSON.stringify(backup));
 if(!owner||historyOwner!==owner)throw Error('Sign in to the destination account first.');
 if(cloudOverwritePending||manualSyncPending||syncChoiceResolve||syncPushPending)throw Error('Finish the current sync operation before restoring.');
 stopAutoSync();syncReadyOwner=null;syncChoiceDeferred=true;
 const previous=await createAccountBackup();
 await saveRecoverySnapshot(owner,'before-account-restore-'+Date.now(),previous);
 if(historyOwner!==owner)throw Error('Account changed; restore cancelled.');
 const key=fredKeyStorage(),oldKey=localStorage.getItem(key),oldLayout=localStorage.getItem('crash-risk-platform-layout');
 try{
  // Add recovery records under unique names so existing archives cannot be overwritten.
  const tag='account-import-'+Date.now()+':';
  for(const [source,value] of Object.entries(backup.recovery)){
   const suffix=source.startsWith('crash-risk-recovery-v1:')?source.slice(('crash-risk-recovery-v1:'+backup.owner+':').length):'previous-market-history';
   const target='crash-risk-recovery-v1:'+owner+':'+tag+suffix;
   if(window.indexedDB)await recoveryDatabase('readwrite',store=>store.put({key:target,value}));else localStorage.setItem(target,value);
  }
  if(historyOwner!==owner)throw Error('Account changed; restore cancelled.');
  if(backup.fredKey===null)localStorage.removeItem(key);else localStorage.setItem(key,backup.fredKey);
  if(backup.layout===null)localStorage.removeItem('crash-risk-platform-layout');else localStorage.setItem('crash-risk-platform-layout',backup.layout);
  await applyRestoredLocalSnapshot(owner,backup.snapshot);
 }catch(error){
  if(oldKey===null)localStorage.removeItem(key);else localStorage.setItem(key,oldKey);
  if(oldLayout===null)localStorage.removeItem('crash-risk-platform-layout');else localStorage.setItem('crash-risk-platform-layout',oldLayout);
  throw error;
 }
 loadEntryHistory(owner);renderDashboard();
 if(backup.layout==='desktop'||backup.layout==='mobile')setPlatformLayout(backup.layout);
}
async function restoreAccount(input:HTMLInputElement){
 const file=input.files?.[0],owner=historyOwner;input.value='';if(!file||accountBackupBusy)return;accountBackupBusy=true;
 try{
  const backup=parseAccountBackup(await file.text());
  if(!owner||owner!==historyOwner)throw Error('Sign in to the destination account first.');
  if(!confirm('Restore account data from '+backup.createdAt+' ('+backup.email+') into '+requiredElement('loggedInEmail').textContent+'? This replaces saved dashboard data in this browser. A recovery copy is kept first. Cloud sync stays paused.'))return;
  await restoreAccountData(backup,owner);
  setAppFeedback('accountBackupStatus','Account data restored. Review the histories, then use Sync now or Overwrite cloud with local to restore cloud storage. Automatic sync is paused.');
 }catch(error){setAppFeedback('accountBackupStatus','Account restore failed: '+errorMessage(error),'error');}finally{accountBackupBusy=false;}
}
