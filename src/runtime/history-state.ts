/* =========================================================
   CURRENT DATA
   ========================================================= */

let currentData:MarketValues = {

    vix:15.72,
    vix_chg:8.19,
    vix_5d:12.4,

    hy:268,
    hy_5d:8,
    hy_20d:22,

    bbb:102,

    yield:4.80,
    yield_20d:18,

    dma50:1.2,
    dma200:7.6,

    wti:94.73,
    wti_20d:12.5,

    move:105.4,
    jpy:142.1,

    breadth:62.5,
    breadth_20d:-4.2,

    vix_term:1.8
};


/* =========================================================
   STATUS
   ========================================================= */


// History is keyed by authenticated user ID and stored only on this browser.
const historyColumns:[MetricKey,string,string][] = [["vix", "VIX", "Index"], ["vix_chg", "VIX 1D %", "%"], ["vix_5d", "VIX 5D %", "%"], ["hy", "HY OAS", "bp"], ["hy_5d", "HY OAS 5D bp change", "bp"], ["hy_20d", "HY OAS 20D bp change", "bp"], ["bbb", "BBB OAS", "bp"], ["yield", "10Y Yield", "%"], ["yield_20d", "10Y 20D bp change", "bp"], ["dma50", "S&P vs 50DMA", "%"], ["dma200", "S&P vs 200DMA", "%"], ["wti", "WTI", "USD/barrel"], ["wti_20d", "WTI 20D %", "%"], ["move", "MOVE", "Index"], ["jpy", "USDJPY", "JPY/USD"], ["breadth", "Breadth % >50DMA", "%"], ["breadth_20d", "Breadth 20D change", "pp"], ["vix_term", "VIX 3M-1M spread", "Index points"]];
const forcedColumns:[InputKey,string,string][] = [['margin_month','Margin debt reference month','YYYYMM'],['margin_debt','FINRA margin debt','USD million'],['margin_yoy','Margin debt YoY','%'],['margin_3m','Margin debt 3M change','%'],['volume','S&P reported volume','shares'],['volume_avg','Prior 20-session volume average','shares'],['sp500_chg','S&P 500 daily change','%'],['jpy3d','USDJPY 3-session change','%'],['sp_high','S&P 500 session high','Index'],['sp_low','S&P 500 session low','Index']];
const marketColumns:['nasdaq'|'nasdaq100',string,string][] = [['nasdaq','Nasdaq Composite close','Index'],['nasdaq100','Nasdaq 100 close','Index']];
const liquidityColumns:['cp_date'|'cp_financial'|'cp_nonfinancial'|'cp_treasury',string,string][] = [['cp_date','CP latest observation date','YYYYMMDD'],['cp_financial','90-day AA financial CP rate','%'],['cp_nonfinancial','90-day AA nonfinancial CP rate','%'],['cp_treasury','3-month Treasury bill rate','%']];
const inputColumns:[InputKey,string,string][] = [...historyColumns,['sp500','S&P 500 close','Index'],...forcedColumns,...marketColumns,...liquidityColumns];
/* BUILD:DATA:marketHistoryReference */
const defaultData = {...currentData};
let entryHistory:HistoryEntry[] = [];
let historyOwner:string|null = null;
let currentEntryTime:string|null = null;
let historyPreviewHidden = false;
let historyStorageError = '';
function historyDisplayEntries(){
    const savedDays=new Set(entryHistory.map(r=>localCalendarDate(new Date(r.savedAt))));
    const rates=new Map(liquidityHistoryRows().filter(r=>[r.financial,r.nonfinancial,r.treasury].every(Number.isFinite)).map(r=>[r.date,r]));
    const references=marketHistoryReference.filter(r=>!savedDays.has(r.observationDate??'')).map(r=>{const cp=rates.get(liquidityDate(r.values.cp_date)??'');return cp?{...r,values:{...r.values,cp_financial:cp.financial,cp_nonfinancial:cp.nonfinancial,cp_treasury:cp.treasury}}:r;});
    return [...entryHistory,...references].sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));
}
function historyKey(){ return 'crash-risk-history-v1:' + historyOwner; }
function writeMarketHistory(raw:string){
    if(historyReadBlocked)throw Error('Stored history needs recovery before saving');
    const previous=localStorage.getItem?.(historyKey());
    if(previous && previous!==raw && previous!=='[]')localStorage.setItem('crash-risk-history-backup-v1:'+historyOwner,previous);
    localStorage.setItem(historyKey(),raw);
}
let historyReadBlocked=false;
function validMarketValues(value:unknown):value is MarketValues{
    if(!isRecord(value))return false;
    return DashboardCore.INPUT_KEYS.every(key=>value[key]===undefined||value[key]===null||finiteNumber(value[key]))&&optionalTextFields(value,['equitySessionDate'])&&['cp_financial_date','cp_nonfinancial_date','cp_treasury_date'].every(key=>value[key]===undefined||finiteNumber(value[key]));
}
function validSnapshot(value:unknown):value is MarketValues{
    if(!validMarketValues(value))return false;
    const values=providerObject(value);
    return historyColumns.every(([key])=>Object.hasOwn(values,key)&&(values[key]===null||finiteNumber(values[key])))&&['sp500','nasdaq','nasdaq100'].every(key=>values[key]==null||(finiteNumber(values[key])&&values[key]>0));
}
function readableHistoryRow(value:unknown):value is HistoryEntry{
    if(!isRecord(value))return false;
    const row=value;
    if(typeof row['savedAt']!=='string'||!finiteNumber(Date.parse(row['savedAt']))||!validSnapshot(row['values'])||!optionalTextFields(row,['id','observationDate','updatedAt','entryLabel','sourceReferenceDate','cpCheckedAt','reconciledAt'])||(row['reference']!==undefined&&typeof row['reference']!=='boolean'))return false;
    const overrides=row['historyOverrides'];if(overrides===undefined)return true;if(!isRecord(overrides)||!optionalTextFields(overrides,['scoredCpDate'])||(overrides['nasdaqMomentum']!==undefined&&!finiteNumber(overrides['nasdaqMomentum'])))return false;
    return ['composite','cpPoints','nasdaqPoints'].every(k=>{const range=overrides[k];return range===undefined||isRecord(range)&&finiteNumber(range['low'])&&finiteNumber(range['high']);});
}
function validatedMarketHistory(value:unknown):HistoryEntry[]{if(!unknownArray(value)||!value.every(readableHistoryRow))throw Error('Invalid market history; original copies preserved');return value;}
function loadEntryHistory(userId:string){
    historyPreviewHidden = false;
    historyOwner = userId;
    loadAnalyses();
    loadFredPreferences();
    loadFunding();
    loadFedWatch();
    entryHistory = [];
    currentEntryTime = null;
    historyStorageError = '';historyReadBlocked=false;
    currentData = {...defaultData};
    try {
        const raw = localStorage.getItem(historyKey());
        const saved = raw ? parseJson(raw) : [];
        if(!unknownArray(saved))throw new Error('Invalid stored history');
        const readable=saved.filter(readableHistoryRow);
        if(readable.length!==saved.length){historyReadBlocked=true;historyStorageError='Some saved rows could not be read. Valid rows are shown; original storage is preserved. Export local and cloud backup for AI comparison before editing.';}
        entryHistory = readable.sort((a,b) => Date.parse(b.savedAt)-Date.parse(a.savedAt));
        if(entryHistory.length){ currentData = {...requiredValue(entryHistory[0]).values}; currentEntryTime = requiredValue(entryHistory[0]).savedAt; }
    } catch(error){ historyReadBlocked=true;historyStorageError = 'Saved history could not be loaded. Original storage is preserved; saving and sync are blocked. Export local and cloud backup for AI comparison.'; }
    
}
function saveEntry(observationDate:string|null=null,cpCheckedAt:string|null=null){
    historyPreviewHidden = false;
    if(!historyOwner || historyReadBlocked || !validSnapshot(currentData)) return;
    currentEntryTime = observationDate ? new Date(observationDate+'T12:00:00').toISOString() : new Date().toISOString();
    entryHistory.unshift({savedAt:currentEntryTime, values:{...currentData},...(cpCheckedAt?{cpCheckedAt}: {})});
    try { writeMarketHistory(JSON.stringify(entryHistory)); historyStorageError = ''; }
    catch(error){ historyStorageError = 'This update is visible but could not be saved to browser storage. Keep this page open to retain it.'; }
}
// Recoverable deletions use the existing large-file backup store, never duplicate Word files in localStorage.
let restoreBusy=false,restoreRenderVersion=0;
type RestoreMap={market:HistoryEntry;analysis:AnalysisRecord;fed:FedRecord;funding:FundingRecord};
type RestoreKind=keyof RestoreMap;
type RestoreRow=RestoreMap[RestoreKind];
interface RestoreItem {kind:RestoreKind;row:RestoreRow;deletedAt?:string;key?:string;current?:boolean}
const restorePages:Record<string,number>={};
function restoreActive<K extends RestoreKind>(kind:K):RestoreMap[K][]{const tables:{[P in RestoreKind]:RestoreMap[P][]}={market:entryHistory,analysis:analysisRecords,fed:fedWatchRows,funding:fundingRecords};return tables[kind];}
function restoreIdentity(kind:RestoreKind,row:RestoreRow){
    if(kind==='market'&&'savedAt' in row)return row.savedAt;
    if(kind==='analysis'&&'id' in row)return row.id;
    if(kind==='funding'&&'balance' in row)return row.id||row.observationDate+'|'+row.publishedAt;
    if(kind==='fed'&&'meetingDate' in row)return JSON.stringify([row.meetingDate,row.observedAt,row.publishedAt,row.source]);
    throw Error('Recovery record does not match its table.');
}
function validatedRestoreRow(kind:RestoreKind,value:unknown):RestoreRow{
    if(kind==='market')return requiredValue(validatedMarketHistory([value])[0]);
    if(kind==='analysis')return requiredValue(validateAnalysisHistory([value])[0]);
    return kind==='fed'?validateFedWatch(value):validateFunding(value);
}
async function archiveDeletedRows<K extends RestoreKind>(kind:K,rows:RestoreMap[K][]){
    if(!historyOwner)throw Error('Sign in before deleting rows.');
    const owner=historyOwner;
    await saveRecoverySnapshot(owner,'row-trash-'+Date.now()+'-'+Math.random().toString(36).slice(2),{kind,rows,deletedAt:new Date().toISOString()});
    if(owner!==historyOwner)throw Error('Account changed; deletion cancelled.');
}
async function writeRestoredRows(kind:RestoreKind,rows:RestoreRow[]){
    if(kind==='market'){
        const next=validatedMarketHistory(rows).slice().sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));writeMarketHistory(JSON.stringify(next));entryHistory=next;currentEntryTime=next[0]?.savedAt||null;currentData=next.length?{...requiredValue(next[0]).values}:{...defaultData};historyPreviewHidden=!next.length;model50Cache=null;renderDashboard();
    }else if(kind==='analysis'){const checked=validateAnalysisHistory(rows);if(!await persistAnalyses(checked))throw Error('Analysis storage could not be saved.');if(!checked.some(r=>r.id===activeAnalysisId)){activeAnalysisId=null;analysisWordDraft=null;requiredElement('analysisResponse').value='';refreshAnalysisPreview();}}
    else if(kind==='fed'){persistFedWatch(rows.map(validateFedWatch));renderFedWatch();}else persistFunding(rows.map(validateFunding));
}
async function restoreArchiveEntries(owner:string):Promise<RestoreItem[]>{
    const backups=await recoveryBackups(owner),items:RestoreItem[]=[];
    for(const [key,raw] of Object.entries(backups)){
        try{const record=providerObject(parseJson(raw)),d=providerObject(record['data']),kind=d['kind'];
            const metadata=typeof d['deletedAt']==='string'?{deletedAt:d['deletedAt'],key}:{key};
            if((key.includes(':row-trash-')||key.includes(':deleted-history-'))&&unknownArray(d['rows'])){
                const rows=d['rows'];
                if(kind==='market')validatedMarketHistory(rows).forEach(row=>items.push({kind,row,...metadata}));
                else if(kind==='analysis')validateAnalysisHistory(rows).forEach(row=>items.push({kind,row,...metadata}));
                else if(kind==='fed')rows.map(validateFedWatch).forEach(row=>items.push({kind,row,...metadata}));
                else if(kind==='funding')rows.map(validateFunding).forEach(row=>items.push({kind,row,...metadata}));
            }else if(key.includes(':deleted-history-')&&typeof d['entryHistory']==='string')validatedMarketHistory(parseJson(d['entryHistory'])).forEach(row=>items.push({kind:'market',row,...metadata}));
        }catch{}
    }return items;
}
async function removeArchiveRow(owner:string,kind:RestoreKind,row:RestoreRow){
    const entries=await restoreArchiveEntries(owner),id=restoreIdentity(kind,row);
    for(const key of new Set(entries.filter(x=>x.kind===kind&&restoreIdentity(kind,x.row)===id).map(x=>x.key).filter((key):key is string=>!!key))){
        const remaining=entries.filter(x=>x.key===key&&!(x.kind===kind&&restoreIdentity(kind,x.row)===id));
        const value=remaining.length?JSON.stringify({savedAt:new Date().toISOString(),data:{kind:requiredValue(remaining[0]).kind,rows:remaining.map(x=>x.row),deletedAt:requiredValue(remaining[0]).deletedAt}}):null;
        if(window.indexedDB){if(value)await recoveryDatabase('readwrite',store=>store.put({key,value}));else await recoveryDatabase('readwrite',store=>store.delete(key));}
        if(localStorage.getItem(key)!==null){if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);}
    }
}
async function restoreRowAction(kind:RestoreKind,row:RestoreRow,permanent=false){
    if(restoreBusy||!historyOwner)return;
    if(!confirm(permanent?'Permanently delete this row from its active table and Restore? It cannot be restored here. Separate backup files and older snapshots are unaffected.':'Restore this row to its original table?'))return;
    restoreBusy=true;const owner=historyOwner;
    try{
        const current=restoreActive(kind),id=restoreIdentity(kind,row),existing=current.find(r=>restoreIdentity(kind,r)===id);
        if(permanent){if(existing)await writeRestoredRows(kind,current.filter(r=>restoreIdentity(kind,r)!==id));}
        else if(existing)throw Error('An entry with the same identity already exists. No data was replaced.');
        else await writeRestoredRows(kind,[...current,validatedRestoreRow(kind,parseJson(JSON.stringify(row)))]);
        if(historyOwner!==owner)throw Error('Account changed; stopped.');
        await removeArchiveRow(owner,kind,row);await renderRestoreTables();setAppFeedback('restoreStatus',permanent?'Row permanently deleted from active data and Restore.':'Row restored successfully.','success');
    }catch(error){setAppFeedback('restoreStatus','Operation could not complete: '+errorMessage(error),'error');}finally{restoreBusy=false;}
}
async function renderRestoreTables(){
    const host=requiredElement('restoreTables');if(!host)return;const openTables=new Set([...host.children].filter((d):d is HTMLDetailsElement=>d instanceof HTMLDetailsElement&&d.open).map(d=>d.dataset["title"]));const owner=historyOwner,version=++restoreRenderVersion;host.replaceChildren();if(!owner)return;
    try{
        const archived=await restoreArchiveEntries(owner);if(owner!==historyOwner||version!==restoreRenderVersion)return;
        for(const [kind,title,cpOnly] of [['market','Market History'],['market','CP updates',true],['analysis','AI Analysis History'],['fed','Fed Interest Rate Watch'],['funding','Dollar Funding History']] as [RestoreKind,string,boolean?][]){
            const records=new Map<string,RestoreItem>();for(const item of archived.filter(x=>x.kind===kind))records.set(restoreIdentity(kind,item.row),item);
            for(const row of restoreActive(kind))records.set(restoreIdentity(kind,row),{kind,row,current:true});
            const items=[...records.values()].filter(x=>!cpOnly||finiteNumber(('values' in x.row?x.row.values:undefined)?.cp_date)).sort((a,b)=>restoreSortTime(b.row).localeCompare(restoreSortTime(a.row)));
            const flat=(row:RestoreRow):Record<string,unknown>=>{const values='values' in row?row.values:undefined;const rest:Record<string,unknown>={...row};delete rest["values"];return values?{...rest,...(kind==='market'&&'savedAt' in row&&'values' in row?historyComparisonValues(row,true):{}),...values}:{...row};};
            const fields=[...new Set(items.flatMap(x=>Object.keys(flat(x.row))))];
            const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title+' · '+items.length+' rows';details.dataset["title"]=title;details.open=openTables.has(title);details.appendChild(summary);host.appendChild(details);
            const pager=document.createElement('div');pager.className='table-note';details.appendChild(pager);const pageKey=title,pages=Math.max(1,Math.ceil(items.length/50));restorePages[pageKey]=Math.min(restorePages[pageKey]||0,pages-1);const page=restorePages[pageKey];
            for(const [label,delta] of [['Previous',-1],['Next',1]] as [string,number][]){const b=document.createElement('button');b.textContent=label;b.disabled=page+delta<0||page+delta>=pages;b.onclick=()=>{restorePages[pageKey]=page+delta;renderRestoreTables();};pager.appendChild(b);}pager.append(' Page '+(page+1)+' of '+pages);
            const wrap=document.createElement('div');wrap.className='data-table-scroll history-scroll';details.appendChild(wrap);const table=document.createElement('table');table.className='history-table';wrap.appendChild(table);const head=document.createElement('thead'),hr=document.createElement('tr');for(const label of ['Delete','Restore','Status','Deleted at',...fields]){const th=document.createElement('th');th.textContent=([...(typeof inputColumns!=='undefined'?inputColumns:[]),['savedAt','Saved date/time'],['createdAt','Request date/time'],['response','AI response'],['word','Original Word file'],['cp_financial_date','Financial CP observation date'],['cp_nonfinancial_date','Nonfinancial CP observation date'],['cp_treasury_date','Treasury observation date']].find(c=>c[0]===label)?.[1]||label);hr.appendChild(th);}head.appendChild(hr);table.appendChild(head);const body=document.createElement('tbody');table.appendChild(body);
            for(const [offset,item] of items.slice(page*50,page*50+50).entries()){
                const tr=document.createElement('tr');const cell=(text:string)=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);return td;};
                const del=document.createElement('button');del.className='history-delete';del.textContent='×';del.setAttribute('aria-label','Permanently delete '+title+' row');del.onclick=()=>restoreRowAction(kind,item.row,true);cell('').appendChild(del);
                const restore=document.createElement('button');restore.textContent='Restore';restore.className='secondary history-date-save';restore.disabled=!!item.current;restore.onclick=()=>restoreRowAction(kind,item.row);cell('').appendChild(restore);cell(item.current?'Existing':'Deleted');cell(item.deletedAt||'—');
                tr.dataset["comparisonDate"]=restoreSortTime(item.row);
                const prior=items[page*50+offset+1],previous=prior?flat(prior.row):{};
                const data=flat(item.row);for(const key of fields){const value=data[key],td=cell('');td.className='history-normal';
                    if(kind==='market'&&'values' in item.row&&'savedAt' in item.row){
                        const values=item.row.values,day=localCalendarDate(new Date(item.row.savedAt));
                        if(key==='composite'){const score=Number(value);td.className=typeof value==='string'&&/^\d+$/.test(value)?score>=16?'history-red':score>=5?'history-amber':'history-normal':'history-normal';}
                        else if(key==='cpPoints'||key==='nasdaqPoints'){const score=Number(value);td.className=typeof value==='string'&&/^\d+$/.test(value)?score>=3?'history-red':score>0?'history-amber':'history-normal':'history-normal';}
                        else if(historyColumns.some(([field])=>field===key))td.className=historyRisk(key as MetricKey,values[key as MetricKey],values).className;
                        else if(forcedColumns.some(([field])=>field===key))td.className=forcedFieldRisk(key as InputKey,values,day);
                        const number=(v:unknown)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):v;
                        applyHistoryChangeOutline(td,key,number(value),number(previous[key]),prior?restoreSortTime(prior.row):'');
                    }
                    if(value!=null&&(typeof value==='object'||String(value).length>200)){const d=document.createElement('details'),label=document.createElement('summary'),pre=document.createElement('pre');label.textContent='View complete '+key;d.ontoggle=()=>{if(d.open&&!pre.textContent)pre.textContent=typeof value==='object'?JSON.stringify(value,null,2):String(value);};pre.style.cssText='white-space:pre-wrap;max-width:600px;max-height:300px;overflow:auto';d.append(label,pre);td.appendChild(d);}else td.textContent=String(value??'—');}body.appendChild(tr);
            }if(!items.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='No saved or deleted rows.';tr.appendChild(td);body.appendChild(tr);}
        }
    }catch(error){setAppFeedback('restoreStatus','Could not load Restore: '+errorMessage(error),'error');}
}
async function deleteHistoryEntry(entry:DisplayEntry){
    const savedIndex = entry.savedAt ? entryHistory.findIndex(row=>row===entry) : -1;
    if(entry.savedAt && savedIndex < 0) return;
    const label = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : 'the unsaved current row';
    if(!window.confirm('Delete '+label+' from history? Saved rows can be restored in Restore at the end of the app.')) return;
    if(!entry.savedAt){
        historyPreviewHidden = true;
        renderEntryHistory();
        return;
    }
    const owner=historyOwner;
    try{
        await archiveDeletedRows('market',[entry as HistoryEntry]);
        if(historyOwner!==owner||!entryHistory.some(row=>row===entry))return;
    }catch(error){setAppFeedback('restoreStatus','Not deleted: recovery backup could not be saved. '+errorMessage(error),'error');alert('Not deleted: recovery backup could not be saved.');return;}
    const remaining = entryHistory.filter(row=>row!==entry);
    try { writeMarketHistory(JSON.stringify(remaining)); }
    catch(error){
        historyStorageError = 'The row could not be deleted from browser storage. It has been kept. Please try again.';
        renderEntryHistory();
        return;
    }
    const wasCurrent = currentEntryTime !== null && entryHistory.findIndex(row=>row===entry) === 0;
    entryHistory = remaining;
    historyStorageError = '';
    if(wasCurrent){
        currentEntryTime = remaining[0]?.savedAt || null;
        currentData = remaining.length ? {...requiredValue(remaining[0]).values} : {...defaultData};
        historyPreviewHidden = !remaining.length;
        
    }
    renderDashboard();
}

function restoreSortTime(row:RestoreRow):string {const r=row as Partial<HistoryEntry&AnalysisRecord&FedRecord>;return String(r.savedAt||r.createdAt||r.observedAt||'');}
