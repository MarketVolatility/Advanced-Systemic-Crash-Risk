/* BUILD:DATA:fundingReference */
// FRED keys are scoped to this browser/account, never included in account snapshots.
let fredLiveData:FredData|null=null,fredFetchBusy=false,fredRequestGeneration=0;
function fredKeyStorage(){return 'crash-risk-fred-key-v1:'+historyOwner;}
function fredDataStorage(){return 'crash-risk-fred-data-v1:'+historyOwner;}
function fredMessage(text:string){setAppFeedback('fredFetchStatus',text);}
function validateFredData(value:unknown):FredData{
    const data=providerObject(value);
    if(!data||data["version"]!==1||data["source"]!=='FRED'||JSON.stringify(data["series"])!=='["DCPF3M","DCPN3M","DTB3"]'||!unknownArray(data["rows"])||!data["rows"].length||data["rows"].length>10000||typeof data["fetchedAt"]!=='string'||!finiteNumber(Date.parse(data["fetchedAt"])))throw Error('Invalid FRED response.');
    const clean:FredData["rows"]=[];let previous='';
    for(const row of data["rows"]){if(!unknownArray(row)||row.length!==4||typeof row[0]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row[0])||!finiteNumber(Date.parse(row[0]))||new Date(row[0]).toISOString().slice(0,10)!==row[0]||row[0]<=previous||row[0]>new Date().toISOString().slice(0,10)||row.slice(1).some(n=>n!==null&&(!finiteNumber(n)||n< -10||n>100)))throw Error('Invalid FRED observations.');clean.push([row[0],nullableNumber(row[1]),nullableNumber(row[2]),nullableNumber(row[3])]);previous=row[0];}
    if(![1,2,3].every(i=>clean.some(row=>finiteNumber(row[i]))))throw Error('Incomplete FRED response.');
    return {version:1,source:'FRED',series:['DCPF3M','DCPN3M','DTB3'],fetchedAt:new Date(data["fetchedAt"]).toISOString(),rows:clean};
}
function loadFredPreferences(){
    fredRequestGeneration++;fredLiveData=null;
    const input=requiredElement('fredApiKey');if(!input)return;input.value='';
    try{if(historyOwner){input.value=localStorage.getItem(fredKeyStorage())||'';const raw=localStorage.getItem(fredDataStorage());if(raw)fredLiveData=validateFredData(parseJson(raw));}}
    catch{fredMessage('Saved FRED data or key could not be loaded. Paste your key to fetch again.');return;}
    fredMessage(fredLiveData?'Saved FRED observations loaded; fetched '+displayUpdateTime(fredLiveData.fetchedAt)+'.':input.value?'Key saved on this browser. Select Fetch latest data.':'Paste your FRED key, then select Fetch latest data.');
}
function saveFredKey(){
    if(!historyOwner){fredMessage('Sign in before saving a key.');return;}
    const key=requiredElement('fredApiKey').value.trim();if(!/^[a-z0-9]{32}$/.test(key)){fredMessage('Enter your 32-character FRED API key.');return;}
    try{localStorage.setItem(fredKeyStorage(),key);fredMessage('Key saved on this browser for your account. It is not included in cloud sync.');}catch{fredMessage('Browser storage is unavailable. You can still fetch using the entered key.');}
}
function forgetFredKey(){try{localStorage.removeItem(fredKeyStorage());}catch{}requiredElement('fredApiKey').value='';fredMessage('Key removed from this browser. Downloaded observations are retained.');}
async function fetchFredLiveData(){
    if(fredFetchBusy)return;
    const key=requiredElement('fredApiKey').value.trim();if(!historyOwner){fredMessage('Sign in before fetching.');return;}if(!/^[a-z0-9]{32}$/.test(key)){fredMessage('Paste a valid 32-character FRED API key first.');return;}
    const owner=historyOwner,generation=fredRequestGeneration,button=requiredElement('fredFetchButton');fredFetchBusy=true;button.disabled=true;fredMessage('Fetching the latest published CP and Treasury rates from FRED…');
    try{
        const {data,error}=await getAuthClient().auth.getSession();if(error||!data?.session?.access_token)throw Error('SIGN_IN_REQUIRED');
        const response=await fetch(SUPABASE_URL+'/functions/v1/fred-cp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token,apikey:SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({apiKey:key}),signal:AbortSignal.timeout(60000)});
        let payload:Record<string,unknown>;try{payload=providerObject(await response.json());}catch{throw Error('CONNECTOR_UNAVAILABLE');}
        if(!response.ok){if(response.status===404)throw Error('CONNECTOR_UNAVAILABLE');if(response.status===401)throw Error('SIGN_IN_REQUIRED');throw Error(['FRED_KEY_REJECTED','FRED_RATE_LIMIT','FRED_UNAVAILABLE','INVALID_DATA','CONNECTOR_CONFIGURATION'].includes(String(payload["error"]))?String(payload["error"]):'CONNECTOR_UNAVAILABLE');}
        const checked=validateFredData(payload);if(owner!==historyOwner||generation!==fredRequestGeneration)return;
        let saved=true;try{localStorage.setItem(fredDataStorage(),JSON.stringify(checked));}catch{saved=false;}
        fredLiveData=checked;renderDashboard();renderHistoricalStudies();
        const latest=checked.rows.filter(r=>finiteNumber(r[1])&&finiteNumber(r[2])).at(-1);
        fredMessage('Updated '+checked.rows.length+' dated observations. Latest paired CP date: '+(latest?.[0]||'unavailable')+'. Spreads, charts and alerts recalculated. '+(saved?'Data saved and queued for account sync.':'Visible for this session; browser storage could not save it.'));
    }catch(error){
        if(owner!==historyOwner||generation!==fredRequestGeneration)return;
        const messages:Record<string,string>={SIGN_IN_REQUIRED:'Sign in again, then retry.',FRED_KEY_REJECTED:'FRED rejected the key. Check your FRED account and try again.',FRED_RATE_LIMIT:'FRED rate limit reached. Wait before trying again.',INVALID_DATA:'FRED returned incomplete or invalid data. Existing data was retained.',FRED_UNAVAILABLE:'FRED is temporarily unavailable. Existing data was retained.',CONNECTOR_CONFIGURATION:'The Supabase FRED connector needs configuration.',CONNECTOR_UNAVAILABLE:'The FRED connector is not deployed or could not be reached. Open the connector setup instructions below.'};
        fredMessage(messages[errorMessage(error)]||'Could not complete the FRED request. Check the connection and connector setup. Existing data was retained.');
    }finally{fredFetchBusy=false;button.disabled=false;}
}

// Release versions are immutable. User corrections append a new version with a new availability time.
let fundingRecords:FundingRecord[]=[], fundingEdit:string|null|undefined=null;
type FundingField='observationDate'|'publishedAt'|'balance'|'testBalance'|'testEvidence'|'source';
const fundingFields:[FundingField,string,string][]=[['observationDate','Observation date','date'],['publishedAt','Publication date/time (UTC; ISO 8601)','text'],['balance','Balance outstanding (USD million)','number'],['testBalance','Explicitly identified tests outstanding (USD million; blank if unknown)','number'],['testEvidence','Official test evidence URL (required for adjustment)','url'],['source','Official release URL','url']];
function fundingDisplayRecords(){return [...fundingReference,...fundingRecords];}
function fundingAvailability(r:FundingRecord){return Date.parse((r.reference?r.savedAt:r.publishedAt)??'');}

// Separate, account-scoped Fed observations; never used by crash scoring.
const fedFields:[keyof FedRecord,string,string][]=[['observedAt','Snapshot timestamp (ISO, timezone)','text'],['meetingDate','Decision date','date'],['targetLower','Target lower (%)','number'],['targetUpper','Target upper (%)','number'],['hike','Hike (%)','number'],['hold','Hold (%)','number'],['cut','Cut (%)','number'],['comparisonAt','5-session comparison timestamp','text'],['hikeChange5d','Hike 5-session change (pp)','number'],['holdChange5d','Hold 5-session change (pp)','number'],['cutChange5d','Cut 5-session change (pp)','number'],['source','Probability source (HTTPS)','url'],['calendarSource','Official calendar (HTTPS)','url'],['notes','Notes / methodology','text'],['publishedAt','Report published (ISO, timezone)','text']];
let fedWatchRows:FedRecord[]=[],fedPage=0,fedSort:keyof FedRecord='observedAt',fedDirection=-1,fedDirty=new Set<number>();
function fedWatchKey(){return 'crash-risk-fed-watch-v1:'+historyOwner;}
function validateFedWatch(value:unknown):FedRecord{
 const r=providerObject(value);
 if(!r||typeof r!=='object'||unknownArray(r))throw Error('Paste one Fed JSON object.');
 const timestamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&finiteNumber(Date.parse(v));
 for(const k of ['observedAt','publishedAt'] as const)if(r[k]!=null&&(!timestamp(r[k])||Date.parse(r[k])>Date.now()))throw Error(k+' must have a valid timezone and be no later than now, or be null if unknown.');
 if(typeof r["meetingDate"]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r["meetingDate"])||!finiteNumber(Date.parse(r["meetingDate"]))||new Date(r["meetingDate"]).toISOString().slice(0,10)!==r["meetingDate"])throw Error('A valid decision date is required.');
 for(const k of ['targetLower','targetUpper','hike','hold','cut'])if(typeof r[k]!=='number'||!finiteNumber(r[k])||r[k]<0||r[k]>100)throw Error(k+' must be a verified number from 0 to 100.');
 if(Number(r["targetLower"])>Number(r["targetUpper"]))throw Error('Target lower must not exceed target upper.');
 if(Math.abs(Number(r["hike"])+Number(r["hold"])+Number(r["cut"])-100)>1e-9)throw Error('Hike, hold and cut must total 100%.');
 for(const k of ['source','calendarSource']){let u;try{u=new URL(String(r[k]));}catch{throw Error(k+' must be a supporting HTTPS URL.');}if(u.protocol!=='https:'||u.username||u.password)throw Error(k+' must be a supporting HTTPS URL.');if(k==='calendarSource'&&!['www.federalreserve.gov','federalreserve.gov'].includes(u.hostname))throw Error('Use the official Federal Reserve calendar URL.');}
 const changes=['hikeChange5d','holdChange5d','cutChange5d'];
 if(r["comparisonAt"]!=null){if(!timestamp(r["observedAt"])||!timestamp(r["comparisonAt"])||Date.parse(r["comparisonAt"])>=Date.parse(r["observedAt"]))throw Error('Comparison timestamp must precede this observation.');for(const k of changes)if(typeof r[k]!=='number'||!finiteNumber(r[k])||Math.abs(r[k])>100)throw Error('All three comparison changes must be verified numbers.');if(Math.abs(changes.reduce((a,k)=>a+Number(r[k]),0))>1)throw Error('Comparison changes must net to approximately zero.');for(const [i,k] of ['hike','hold','cut'].entries())if(Number(r[k])-Number(r[requiredValue(changes[i])])<-.5||Number(r[k])-Number(r[requiredValue(changes[i])])>100.5)throw Error('Comparison implies an invalid prior probability.');}
 else if(changes.some(k=>r[k]!=null))throw Error('Comparison changes require a verified comparison timestamp.');
 if(r["notes"]!=null&&typeof r["notes"]!=='string')throw Error('Notes must be text.');
 return {meetingDate:r['meetingDate'],observedAt:nullableString(r['observedAt']),publishedAt:nullableString(r['publishedAt']),targetLower:checkedNumber(r['targetLower']),targetUpper:checkedNumber(r['targetUpper']),hike:checkedNumber(r['hike']),hold:checkedNumber(r['hold']),cut:checkedNumber(r['cut']),comparisonAt:nullableString(r['comparisonAt']),hikeChange5d:nullableNumber(r['hikeChange5d']),holdChange5d:nullableNumber(r['holdChange5d']),cutChange5d:nullableNumber(r['cutChange5d']),source:checkedString(r['source']),calendarSource:checkedString(r['calendarSource']),notes:r['notes']==null?'':checkedString(r['notes'])};
}
function loadFedWatch(){
 fedWatchRows=[];fedPage=0;fedSort='observedAt';fedDirection=-1;fedDirty.clear();
 for(const id of ['fedPrompt','fedPaste'] as const)requiredElement(id).value='';
 try{const rows=parseJson(localStorage.getItem(fedWatchKey())||'[]');if(!unknownArray(rows))throw Error('Invalid history');fedWatchRows=rows.map(validateFedWatch);setAppFeedback('fedStatus','');}catch(e){setAppFeedback('fedStatus','Fed history could not be loaded: '+errorMessage(e));}
 renderFedWatch();
}
function persistFedWatch(rows:FedRecord[]){localStorage.setItem(fedWatchKey(),JSON.stringify(rows));fedWatchRows=rows;}
function fedLeaveEdits(){return !fedDirty.size||confirm('Discard unsaved edits on this Fed history page?');}
function fedSameObservation(a:FedRecord,b:FedRecord){return a.meetingDate===b.meetingDate&&a.observedAt===b.observedAt&&(a.observedAt!=null||(a.publishedAt??null)===(b.publishedAt??null)&&a.source===b.source);}
function fedTimingLabel(r:FedRecord){return r.observedAt?'Snapshot time supplied':r.publishedAt?'Report time only — snapshot time unverified':'Timing unverified — review required';}
function fedSortedRows(){return fedWatchRows.map((r,i)=>({r,i})).sort((a,b)=>{const x=fedSort==='observedAt'?(a.r.observedAt??a.r.publishedAt):a.r[fedSort],y=fedSort==='observedAt'?(b.r.observedAt??b.r.publishedAt):b.r[fedSort];if(x==null||x==='')return y==null||y===''?0:1;if(y==null||y==='')return -1;const v=fedSort.endsWith('At')?Date.parse(String(x))-Date.parse(String(y)):typeof x==='number'?x-Number(y):String(x).localeCompare(String(y));return v*fedDirection||Date.parse(b.r.observedAt??'')-Date.parse(a.r.observedAt??'');});}
function renderFedWatch(){
 const head=requiredElement('fedHead'),body=requiredElement('fedBody'),pager=requiredElement('fedPager');head.replaceChildren();body.replaceChildren();pager.replaceChildren();fedDirty.clear();
 const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.className='secondary history-date-save';b.textContent=label;b.onclick=fn;return b;};
 const hr=document.createElement('tr');const deleteHead=document.createElement('th');deleteHead.textContent='Delete';hr.appendChild(deleteHead);const action=document.createElement('th');action.textContent='Actions';hr.appendChild(action);
 for(const [k,label] of fedFields){const th=document.createElement('th');th.scope='col';th.setAttribute('aria-sort',fedSort===k?(fedDirection===1?'ascending':'descending'):'none');th.appendChild(button(label,()=>{if(!fedLeaveEdits())return;fedDirection=fedSort===k?-fedDirection:1;fedSort=k;fedPage=0;renderFedWatch();}));hr.appendChild(th);}head.appendChild(hr);
 const rows=fedSortedRows(),pages=Math.max(1,Math.ceil(rows.length/50));fedPage=Math.min(fedPage,pages-1);
 for(const [label,page] of [['First',0],['Previous',fedPage-1],['Next',fedPage+1],['Last',pages-1]] as [string,number][]){const b=button(label,()=>{if(!fedLeaveEdits())return;fedPage=page;renderFedWatch();});b.disabled=page<0||page>=pages||page===fedPage;pager.appendChild(b);}
 pager.appendChild(button('Latest first',()=>{if(!fedLeaveEdits())return;fedSort='observedAt';fedDirection=-1;fedPage=0;renderFedWatch();}));const info=document.createElement('span');info.textContent=` Page ${fedPage+1} of ${pages} · ${rows.length} saved observations`;pager.appendChild(info);
 for(const {r,i} of rows.slice(fedPage*50,fedPage*50+50)){
 const tr=document.createElement('tr'),td=document.createElement('td'),inputs:Partial<Record<keyof FedRecord,HTMLInputElement>>={};tr.appendChild(td);
 const del=button('×',async()=>{if(!fedLeaveEdits()||!confirm('Delete this Fed observation?'))return;try{await archiveDeletedRows('fed',[r]);persistFedWatch(fedWatchRows.filter(v=>v!==r));renderFedWatch();setAppFeedback('fedStatus','Fed observation deleted successfully.','success');}catch(e){setAppFeedback('fedStatus','Not deleted: '+errorMessage(e));}});del.className='history-delete';del.setAttribute('aria-label','Delete Fed observation '+r.observedAt);const deleteCell=document.createElement('td');deleteCell.appendChild(del);tr.insertBefore(deleteCell,td);
 td.appendChild(button('Save',()=>{try{const raw:Record<string,unknown>={};fedFields.forEach(([k,,type])=>raw[k]=type==='number'?(requiredValue(inputs[k]).value.trim()===''?null:Number(requiredValue(inputs[k]).value)):requiredValue(inputs[k]).value.trim()||null);const row=validateFedWatch(raw);if(fedWatchRows.some((v,j)=>j!==i&&fedSameObservation(v,row)))throw Error('An observation for this timestamp and meeting already exists.');const next=fedWatchRows.slice();next[i]=row;persistFedWatch(next);Object.assign(r,row);timing.textContent=fedTimingLabel(row);fedDirty.delete(i);setAppFeedback('fedStatus','Fed row saved. Sorting is applied when the table is refreshed.');}catch(e){setAppFeedback('fedStatus','Not saved: '+errorMessage(e));}}));const timing=document.createElement('div');timing.className='table-note';timing.textContent=fedTimingLabel(r);td.appendChild(timing);
 for(const [k,label,type] of fedFields){const cell=document.createElement('td'),input=document.createElement('input');input.type=type;if(type==='number')input.step='any';input.className=type==='number'?'history-value-input history-normal':'history-date-input';input.style.minWidth=type==='number'?'100px':'180px';input.value=String(r[k]??'');input.setAttribute('aria-label',label+' for '+r.observedAt);input.oninput=()=>fedDirty.add(i);inputs[k]=input;cell.appendChild(input);tr.appendChild(cell);}body.appendChild(tr);
 }
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=fedFields.length+2;td.textContent='No Fed observations saved. Generate a prompt above to begin.';tr.appendChild(td);body.appendChild(tr);}
}
function generateFedPrompt(){requiredElement('fedPrompt').value=`Research the next Federal Reserve interest-rate decision and latest market-implied outcome probabilities published as of ${new Date().toISOString()}. Browse sources. Return only one JSON object with these fields:
{"observedAt":null,"publishedAt":null,"meetingDate":null,"targetLower":null,"targetUpper":null,"hike":null,"hold":null,"cut":null,"comparisonAt":null,"hikeChange5d":null,"holdChange5d":null,"cutChange5d":null,"source":"","calendarSource":"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm","notes":""}
Use the official Federal Reserve FOMC calendar for the next decision date (final meeting day), and the latest published Federal Reserve implementation note for the current target range. Link that target-range source in notes. Target bounds and probabilities are percentages. Use CME FedWatch https://www.cmegroup.com/fedwatch and its methodology https://www.cmegroup.com/tools-information/quikstrike/cme-fedwatch-tool-user-guide.html for probabilities. Prefer the most recent completed US trading-session snapshot and state that session in notes. If inaccessible, a timestamped attributable secondary report may be used, clearly identified with its own source URL; never describe it as a directly verified CME snapshot.
Aggregate all target-rate outcomes above the CURRENT target range into hike, the unchanged range into hold, and all lower ranges into cut. Hike, hold and cut must each be a verified numeric percentage from 0 to 100 inclusive, and the total of the three must be 100%. All three numbers are required for a complete, saveable observation. Verify the complete outcome breakdown; do not return a partial breakdown as complete or adjust verified values to force the total to 100%. These are market-implied probabilities, not a forecast of a crash. Use one source snapshot and the same next meeting for all three figures; do not combine timestamps or providers. observedAt must be the verified source snapshot timestamp in ISO 8601 with explicit timezone, not retrieval time or a guessed timestamp. If the snapshot timestamp cannot be verified, use observedAt:null. Put a verified article publication timestamp in publishedAt (ISO 8601 with explicit timezone), or null if unavailable. Never substitute article time for snapshot time. Records without snapshot timestamps are saved with an explicit timing-unverified label. meetingDate is YYYY-MM-DD. Do not use future releases or stale probabilities for a meeting that has already occurred.
If verified historical probabilities exist exactly five completed US trading sessions earlier for the SAME meeting and provider, put that snapshot timestamp in comparisonAt and give current minus prior hike/hold/cut probability changes in percentage points. Identify both snapshots and the five-session match in notes. If not fully verified, all four comparison fields must be null. Do not substitute a calendar week or switch meetings.
Use null for unavailable numbers or timestamps; do not invent or infer missing observations, with this specific exception: if two verified aggregate probabilities from the same source snapshot and meeting total 100% at their reported precision, return numeric 0 for the remaining outcome and identify it in notes as the calculated residual at reported precision. For example, hold 72.9% plus hike 27.1% implies cut 0%. Do not default other unavailable values to zero or change verified values to force a total of 100%. Include plain HTTPS supporting URLs in source and calendarSource; put methodology, limitations and additional supporting URLs in notes. No Markdown fences or text outside the JSON. Missing decision date, target range, probabilities or supporting URLs will remain unsaved for review. Missing timestamps alone may be saved, explicitly labelled as unverified; leave all comparison fields null if observedAt is null.`;}
async function copyFedPrompt(){if(!requiredElement('fedPrompt').value)generateFedPrompt();try{await navigator.clipboard.writeText(requiredElement('fedPrompt').value);setAppFeedback('fedStatus','Prompt copied.');}catch{setAppFeedback('fedStatus','Select and copy the prompt manually.');}}
function importFedWatch(){try{const row=validateFedWatch(parseJson(requiredElement('fedPaste').value.trim()));if(fedWatchRows.some(r=>fedSameObservation(r,row)))throw Error('This observation already exists. Edit its saved row instead.');if(!fedLeaveEdits())return;persistFedWatch([...fedWatchRows,row]);fedPage=0;fedSort='observedAt';fedDirection=-1;renderFedWatch();setAppFeedback('fedStatus','Fed observation saved. '+fedTimingLabel(row)+'.');}catch(e){setAppFeedback('fedStatus','Not saved: '+errorMessage(e));}}

function fundingKey(){return 'crash-risk-funding-v1:'+historyOwner;}
function fundingNumber(n:NumericInput){return n===null||n===undefined?'—':n.toLocaleString(undefined,{maximumFractionDigits:3});}
function validateFunding(value:unknown):FundingRecord{
    const r=providerObject(value);
    if(typeof r["observationDate"]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r["observationDate"])||!finiteNumber(Date.parse(r["observationDate"]))||new Date(r["observationDate"]).toISOString().slice(0,10)!==r["observationDate"])throw Error('A valid observation date is required.');
    if(typeof r["publishedAt"]!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(r["publishedAt"])||!finiteNumber(Date.parse(r["publishedAt"])))throw Error('Publication time must include its timezone, e.g. 2026-09-17T20:30:00Z.');
    if(Date.parse(r["publishedAt"])<Date.parse(r["observationDate"])||Date.parse(r["publishedAt"])>Date.now())throw Error('Publication must follow the observation and cannot be in the future.');
    if(!finiteNumber(r["balance"])||r["balance"]<0)throw Error('Balance must be a nonnegative number in USD millions.');
    if(r["testBalance"]!==null&&(!finiteNumber(r["testBalance"])||r["testBalance"]<0||r["testBalance"]>r["balance"]))throw Error('Tests must be null or between zero and the raw balance.');
    function official(s:unknown):s is string{if(typeof s!=='string')return false;try{const u=new URL(s);return u.protocol==='https:'&&['fred.stlouisfed.org','alfred.stlouisfed.org','www.federalreserve.gov','www.newyorkfed.org'].includes(u.hostname);}catch{return false;}}
    if(!official(r["source"]))throw Error('Use an HTTPS Fed, NY Fed, FRED or ALFRED source URL.');
    if(r["testBalance"]!==null&&!official(r["testEvidence"]))throw Error('A test adjustment, including verified zero, requires an official evidence URL.');
    if(!optionalTextFields(r,['id','supersedes','savedAt'])||(r['reference']!==undefined&&typeof r['reference']!=='boolean'))throw Error('Invalid funding record metadata.');
    return {...r,observationDate:r['observationDate'],publishedAt:new Date(r['publishedAt']).toISOString(),balance:r['balance'],testBalance:r['testBalance'],testEvidence:checkedString(r['testEvidence']),source:r['source'],...(typeof r['savedAt']==='string'?{savedAt:r['savedAt']}:{}),...(typeof r['id']==='string'?{id:r['id']}:{}),...(typeof r['supersedes']==='string'?{supersedes:r['supersedes']}:{}),...(typeof r['reference']==='boolean'?{reference:r['reference']}:{})};
}
function fundingVersionsAt(records:FundingRecord[],time:number){
    const m=new Map<string,FundingRecord>();records.filter(r=>fundingAvailability(r)<=time).sort((a,b)=>a.reference!==b.reference?(a.reference?-1:1):fundingAvailability(a)-fundingAvailability(b)).forEach(r=>m.set(r.observationDate,r));
    return [...m.values()].sort((a,b)=>a.observationDate.localeCompare(b.observationDate));
}
function fundingChange(r:FundingRecord,records:FundingRecord[],time:number){
    const prevDate=new Date(Date.parse(r.observationDate)-7*86400000).toISOString().slice(0,10);
    const p=fundingVersionsAt(records,time).find(v=>v.observationDate===prevDate);
    return p?r.balance-p.balance:null;
}
function loadFunding(){
    fundingRecords=[];fundingEdit=null;
    try{const raw=localStorage.getItem(fundingKey());const list=raw?parseJson(raw):[];if(!unknownArray(list))throw Error('Invalid history');fundingRecords=list.map(validateFunding);}
    catch(e){const s=requiredElement('fundingStatus');if(s)s.textContent='Funding history could not load: '+errorMessage(e);}
    renderFunding();
}
function persistFunding(next:FundingRecord[]){
    if(!historyOwner)throw Error('Sign in before saving funding history.');
    localStorage.setItem(fundingKey(),JSON.stringify(next));fundingRecords=next;renderFunding();
}
function fundingId(){return 'funding-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
function resetFundingForm(){
    fundingEdit=null;
    requiredElement('fundingQuickPaste').value='';
    requiredElement('fundingCancelEdit').hidden=true;
    setAppFeedback('fundingQuickStatus','');
}
function editFunding(r:FundingRecord){
    fundingEdit=r.id;
    const raw=Object.fromEntries(fundingFields.map(([k])=>[k,r[k]??(k==='testBalance'?null:'')]));
    raw["publishedAt"]=new Date().toISOString();
    requiredElement('fundingQuickPaste').value=JSON.stringify(raw,null,2);
    requiredElement('fundingCancelEdit').hidden=false;
    setAppFeedback('fundingQuickStatus','Editing '+r.observationDate+'. Update the JSON and select Parse and Update. The original release is retained; the correction takes effect when saved.','warning');
    requiredElement('fundingQuickPaste').focus();
}
async function deleteFunding(r:FundingRecord){if(!confirm('Delete the funding observation '+r.observationDate+' and all its saved versions?'))return;try{await archiveDeletedRows('funding',fundingRecords.filter(v=>v.observationDate===r.observationDate));persistFunding(fundingRecords.filter(v=>v.observationDate!==r.observationDate));resetFundingForm();setAppFeedback('fundingStatus','Funding observation deleted successfully.','success');}catch(e){setAppFeedback('fundingStatus',errorMessage(e));}}
function importFunding(){
    try{const data=parseJson(requiredElement('fundingImport').value);if(!unknownArray(data)||data.length>10000)throw Error('Provide an array of at most 10,000 releases.');
        const next=[...fundingRecords];let count=0;
        data.forEach(raw=>{const checked=validateFunding(raw);const r=Object.fromEntries(fundingFields.map(([k])=>[k,checked[k]])) as Pick<FundingRecord,FundingField>;r.publishedAt=checked.publishedAt;
            const old=next.find(v=>v.observationDate===r.observationDate&&v.publishedAt===r.publishedAt);
            if(old){if(fundingFields.some(([k])=>(old[k]??'')!==(r[k]??'')))throw Error('Conflicting values for an existing publication. Edit the row to preserve its original version.');return;}
            next.push({...r,id:fundingId(),savedAt:new Date().toISOString()});count++;
        });persistFunding(next);setAppFeedback('fundingStatus',count+' new release versions imported. Publication timestamps and test evidence are supplied by the importer; verify them against originals.');
    }catch(e){setAppFeedback('fundingStatus','Nothing imported: '+errorMessage(e));}
}
function exportFunding(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(fundingRecords,null,2)],{type:'application/json'}));a.href=url;a.download='dollar-funding-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fundingPrompt(){requiredElement('fundingPrompt').value='Research Fed SWPT weekly dollar liquidity swap balances for the past year through today. Return ONLY a JSON array with observationDate (YYYY-MM-DD), publishedAt (exact first-publication timestamp with timezone), balance (USD millions), testBalance (USD millions or null), testEvidence (official URL or empty string), source (official release URL). Preserve separate revisions with their actual publication times. Use original Fed H.4.1 releases or ALFRED vintages and NY Fed operation results. Never use an observation date as a publication date. If exact availability cannot be verified, omit that release and explain outside the JSON. testBalance must include only explicitly identified operational-test transactions outstanding on the observation date, using settlement and maturity dates. Use null unless full reconciliation, including a verified zero, is possible. Do not infer tests from transaction size, invent values, or return risk scores. Review sources before importing.';}
async function copyFundingPrompt(){try{if(!requiredElement('fundingPrompt').value)fundingPrompt();await navigator.clipboard.writeText(requiredElement('fundingPrompt').value);setAppFeedback('fundingStatus','Prompt copied.');}catch{setAppFeedback('fundingStatus','Select and copy the prompt manually; clipboard access is unavailable.');}}
function renderFunding(){
    renderFreshness();
    const lastSaved=fundingRecords.map(r=>r.savedAt).filter(Boolean).sort().at(-1);const stamp=requiredElement("dollarUpdateTime");if(stamp)stamp.textContent=lastSaved?"Last saved update: "+displayUpdateTime(lastSaved):"Last saved update: none — embedded reference history only.";
    const body=requiredElement('fundingRows');if(!body)return;
    const time=Date.now();
    const records=fundingDisplayRecords();
    const visible=fundingVersionsAt(records,time),latest=visible.at(-1),fresh=latest&&time-Date.parse(latest.observationDate)<=14*86400000;
    requiredElement('fundingSummary').textContent=latest?'As of '+new Date(time).toLocaleString()+': '+fundingNumber(latest.balance)+' USD m · Weekly change '+fundingNumber(fundingChange(latest,records,time))+' USD m · Observation '+latest.observationDate+' · Published '+(latest.publishedAt||'time unverified; retrospective reference')+' · '+(fresh?'Observation within 14 days':'Observation older than 14 days')+' · '+(latest.testBalance===null?'Test adjustment unverified':'Test adjustment supplied; verify evidence'):'No published funding entries available at this time. Add or import verified releases below.';
    body.replaceChildren();[...visible].sort((a,b)=>b.observationDate.localeCompare(a.observationDate)).forEach(r=>{
        const tr=document.createElement('tr');tr.dataset["comparisonDate"]=r.observationDate;const cell=(text:string)=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);return td;};
        const del=document.createElement('button');del.textContent='×';del.className='history-delete';del.setAttribute('aria-label','Delete funding observation '+r.observationDate);del.onclick=()=>deleteFunding(r);if(r.reference)cell('Reference');else cell('').appendChild(del);
        const edit=document.createElement('button');edit.textContent='Edit';edit.onclick=()=>editFunding(r);if(r.reference)cell('Read-only');else cell('').appendChild(edit);
        [r.savedAt??'',r.observationDate,r.publishedAt||'Unverified · reference vintage',fundingNumber(r.balance),fundingNumber(fundingChange(r,records,time)),fundingNumber(r.testBalance),fundingNumber(r.testBalance===null?null:r.balance-r.testBalance),r.testBalance===null?'Unverified':'Evidence supplied'].forEach(cell);
        const sources=cell('');[r.source,r.testEvidence].filter(Boolean).forEach(url=>{const a=document.createElement('a');a.href=url;a.textContent=url===r.source?' Release ':' Tests ';a.target='_blank';a.rel='noopener';sources.appendChild(a);});
        const equities=marketValuesForDay(r.observationDate);
        const sp=finiteNumber(equities?.sp500)&&equities.sp500>0?{date:r.observationDate,close:equities.sp500}:sp500ForDate(r.observationDate);
        const quotes=[sp,...marketColumns.map(([key])=>marketForDate(key,r.observationDate,equities))];
        quotes.forEach(quote=>{const td=cell(fundingNumber(quote?.close));td.title=quote?'Equity session '+quote.date:'No saved or embedded equity close for this observation date';});body.appendChild(tr);
    });renderFundingChart(time);
}
function renderFundingChart(time:number){
    const svg=requiredElement('fundingChart');svg.replaceChildren();const {start,end}=chartWindow(requiredElement('fundingRange').value||'3m',new Date(time));
    const a=+start,b=+end,x=(t:number)=>60+(t-a)/(b-a)*850;
    const records=fundingDisplayRecords(),visible=fundingVersionsAt(records,time);
    const points=visible.map(r=>({t:Date.parse(r.observationDate),r,change:fundingChange(r,records,time)})).filter(p=>p.t>=a&&p.t<=b);
    const max=Math.max(1,...points.map(p=>p.r?.balance||0)),y=(n:number)=>230-n/max*195;const changes=points.filter(p=>p.t>a&&p.t<b&&p.change!==null);const cm=Math.max(1,...changes.map(p=>Math.abs(requiredValue(p.change))));
    const add=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;};
    add('text',{x:60,y:18,fill:'#94a3b8'},'Balance (USD million)');add('text',{x:60,y:280,fill:'#94a3b8'},'Weekly change (USD million)');
    for(let i=0;i<5;i++){const n=max*i/4;add('line',{x1:60,x2:910,y1:y(n),y2:y(n),stroke:'#334155'});add('text',{x:52,y:y(n)+4,fill:'#94a3b8','text-anchor':'end','font-size':11},fundingNumber(n));const t=a+(b-a)*i/4;add('text',{x:x(t),y:408,fill:'#94a3b8','text-anchor':i===0?'start':i===4?'end':'middle','font-size':11},new Date(t).toISOString().slice(0,10));}
    add('line',{x1:60,x2:910,y1:335,y2:335,stroke:'#94a3b8'});
    points.forEach((p,i)=>{if(!p.r)return;const expiry=Date.parse(p.r.observationDate)+14*86400000;if(p.t>expiry)return;const stop=Math.min(points[i+1]?.t??b,expiry);add('path',{d:'M '+x(p.t)+' '+y(p.r.balance)+' H '+x(stop),stroke:'#60a5fa','stroke-width':2,fill:'none'});const prev=points[i-1];if(prev?.r&&p.t<=Date.parse(prev.r.observationDate)+14*86400000)add('line',{x1:x(p.t),x2:x(p.t),y1:y(prev.r.balance),y2:y(p.r.balance),stroke:'#60a5fa'});const dot=add('circle',{cx:x(p.t),cy:y(p.r.balance),r:3,fill:'#60a5fa',tabindex:0});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=p.r.observationDate+' | published '+(p.r.publishedAt||'unverified (reference vintage)')+' | '+p.r.balance+' USD m';dot.appendChild(title);});
    changes.forEach(p=>{const h=Math.abs(requiredValue(p.change))/cm*45;const bar=add('rect',{x:x(p.t)-3,y:requiredValue(p.change)>=0?335-h:335,width:6,height:Math.max(1,h),fill:'#b58b51',tabindex:0});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=new Date(p.t).toISOString()+' | weekly change '+p.change+' USD m';bar.appendChild(title);});
    drawSp500Overlay(svg,sp500ChartPoints(start,end),t=>60+(t-a)/(b-a)*805,{top:35,bottom:230,right:865,legendY:435});
    if(!points.some(p=>p.r))add('text',{x:300,y:120,fill:'#94a3b8'},'No published data in this period');
}
document.addEventListener('DOMContentLoaded',renderFunding);
function generateFundingQuickPrompt(){
    const asOf=new Date().toISOString();
    requiredElement('fundingQuickPrompt').value=`Research the latest published Federal Reserve central-bank dollar liquidity swap balance (SWPT, weekly Wednesday level) available as of ${asOf}. Browse official sources. Return ONLY one valid JSON object, without Markdown fences, commentary or computed risk scores, with exactly these six keys:
{"observationDate":"YYYY-MM-DD","publishedAt":"ISO 8601 timestamp with explicit timezone","balance":null,"testBalance":null,"testEvidence":"","source":""}
Use balance in USD MILLIONS, not billions; use a JSON number without thousands separators. observationDate is the Wednesday measured, while publishedAt is the verified publication timestamp for this exact data vintage. Do not substitute the observation date, retrieval time or a guessed time for publication. Use the latest release actually published by the cutoff, not a future scheduled release. Match the balance to that release and retain the actual revision publication time if using a revision.
Use https://fred.stlouisfed.org/series/SWPT and original Federal Reserve H.4.1 releases or ALFRED vintages. source must link to an official supporting page on fred.stlouisfed.org, alfred.stlouisfed.org, www.federalreserve.gov or www.newyorkfed.org using HTTPS.
For testBalance, reconcile only transactions explicitly identified as operational-readiness tests in https://www.newyorkfed.org/markets/desk-operations/central-bank-liquidity-swap-operations that remained outstanding on observationDate, using settlement and maturity dates. Report their total in USD millions only if full reconciliation is verified, with an official HTTPS testEvidence URL. Otherwise use testBalance:null and testEvidence:"". Zero requires verified evidence that no operational tests were outstanding; never infer tests from small size.
Do not invent unavailable numbers or dates. If balance, observationDate, or exact publication timestamp cannot be verified, return null for that field and the official source URL if available. The app will keep incomplete responses unsaved for review. Do not include weekly change: the app calculates it from saved prior-week history.
REQUIRED RESPONSE FORMAT — illustrative example only; this is a historical format example, not necessarily the latest release. Replace its values with researched data or the permitted null/empty string:
{"observationDate":"2026-09-16","publishedAt":"2026-09-17T20:31:00Z","balance":94,"testBalance":null,"testEvidence":"","source":"https://fred.stlouisfed.org/series/SWPT"}
FINAL OUTPUT CHECK: Return only the JSON object, preferably on one line. The first character must be { and the last character must be }. Do not write an introduction such as "Only", "Here is", or "Paste this". Do not use Markdown code fences, headings, bullets, citation markers, or any text before or after the object. Put the supporting source URL inside source, not outside the JSON. Use a plain URL string, never Markdown link syntax such as [label](URL). Use double quotes for keys and strings; numbers and null must not be quoted. Do not copy the illustrative values as current data.`;
}
async function copyFundingQuickPrompt(){
    generateFundingQuickPrompt();
    try{await navigator.clipboard.writeText(requiredElement('fundingQuickPrompt').value);setAppFeedback('fundingQuickStatus','Prompt copied. Paste it into your AI, then paste its JSON response below.');}
    catch{setAppFeedback('fundingQuickStatus','Clipboard unavailable. Select and copy the prompt above manually.');}
}
function fillFundingFromAI(){
    const status=requiredElement('fundingQuickStatus');
    try{
        let text=requiredElement('fundingQuickPaste').value.trim();
        if(/^```(?:json)?\s*[\s\S]*\s*```$/i.test(text))text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
        const raw=providerObject(parseJson(text));
        if(!raw||unknownArray(raw)||typeof raw!=='object')throw Error('Paste one JSON object for the latest release. Use bulk import for a history array.');
        const keys=fundingFields.map(([k])=>k);
        if(keys.some(k=>!Object.hasOwn(raw,k))||Object.keys(raw).some(k=>!keys.some(key=>key===k)))throw Error('The response must contain exactly observationDate, publishedAt, balance, testBalance, testEvidence and source.');
        if(raw['observationDate']===null||raw['publishedAt']===null||raw['balance']===null)throw Error('The AI could not verify the observation date, publication timestamp or balance. Research those missing fields before saving.');
        const r=validateFunding(raw);
        const now=new Date().toISOString();
        if(fundingEdit){
            const old=fundingRecords.find(v=>v.id===fundingEdit);
            if(!old)throw Error('Entry changed. Start editing again.');
            if(r.observationDate!==old.observationDate)throw Error('A correction must keep the original observation date.');
            r.publishedAt=now;r.supersedes=old.id;
        }
        const existing=fundingRecords.find(v=>v.observationDate===r.observationDate&&v.publishedAt===r.publishedAt);
        if(existing){
            if(fundingFields.some(([k])=>(existing[k]??'')!==(r[k]??'')))throw Error('Conflicting values for an existing publication. Use Edit on that row to save a correction.');
            setAppFeedback(status,'This funding release is already saved. No duplicate added.','success');return;
        }
        r.id=fundingId();r.savedAt=now;
        persistFunding([...fundingRecords,r]);
        resetFundingForm();
        setAppFeedback(status,'Funding entry saved successfully to the table. Queued for normal account sync.','success');
    }catch(e){setAppFeedback(status,'Not saved: '+errorMessage(e),'error');}
}
document.addEventListener('DOMContentLoaded',generateFundingQuickPrompt);
