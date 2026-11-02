type HtmlElementKey = {[K in keyof DashboardElements]:DashboardElements[K] extends HTMLElement?K:never}[keyof DashboardElements];
function displayUpdateTime(value?:string|null){
    if(!value||!Number.isFinite(Date.parse(value)))return 'Not recorded';
    const d=new Date(value),pad=(n:number)=>String(n).padStart(2,'0');
    return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+', '+(d.getHours()%12||12)+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+' '+(d.getHours()<12?'AM':'PM');
}
function displayObservationDate(value?:string){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?requiredValue(value).slice(8,10)+'/'+requiredValue(value).slice(5,7)+'/'+requiredValue(value).slice(0,4):'Not available';}
function latestCpCheckTime(){
    // Entry timestamps may be edited; only explicit successful CP checks count.
    const times=[fredLiveData?.fetchedAt,...entryHistory.map(r=>r.cpCheckedAt)].filter((t):t is string=>!!t&&Number.isFinite(Date.parse(t)));
    return times.sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
}
function renderFreshness(){
    const host=requiredElement('overviewFreshness');if(!host)return;
    const today=localCalendarDate(new Date()),latest=liquidityHistoryRows().filter(r=>r.date<=today&&Number.isFinite(r.sector)).at(-1);
    const saved=fundingRecords.map(r=>r.savedAt).filter(Boolean).sort().at(-1);
    const lines=['Last Composite Risk Score Update: '+displayUpdateTime(currentEntryTime),'Last paired CP observation: '+displayObservationDate(latest?.date)+', checked on '+displayUpdateTime(latestCpCheckTime()),'Last dollar funding update: '+displayUpdateTime(saved)];
    host.replaceChildren();lines.forEach(text=>{const p=document.createElement('p');p.textContent=text;host.appendChild(p);});
}
function renderOpeningOverview(){
    renderSavedCpTable();
    const today=localCalendarDate(new Date());
    const cp=liquidityHistoryRows(),rotation=relativeMomentumRows();
    renderFreshness();
    const alerts=requiredElement('overviewAlerts');alerts.replaceChildren();
    requiredElement('compositeUpdateTime').textContent=currentEntryTime?'Current entry saved at: '+displayUpdateTime(currentEntryTime):'Last update: none — sample values.';
    requiredElement('cpUpdateTime').textContent='Last successful CP check / update: '+displayUpdateTime(latestCpCheckTime());
    const saved=fundingRecords.map(r=>r.savedAt).filter(Boolean).sort().at(-1);requiredElement('dollarUpdateTime').textContent=saved?'Last saved update: '+displayUpdateTime(saved):'Last saved update: none — embedded reference history only.';
    const definitions:[DiagnosticKey,string,DiagnosticRow[],'high'|'low'][]=[['sector','Financial vs nonfinancial CP',cp,'high'],['financialBill','Financial CP vs Treasury bills',cp,'high'],['nonfinancialBill','Nonfinancial CP vs Treasury bills',cp,'high'],['momentum','Nasdaq leadership',rotation,'low']];definitions.forEach(([key,label,rows,direction])=>{
        const r=diagnosticWatch(rows,key,today,direction),p=document.createElement('p');p.className='overview-alert'+(r.state==='watch'?' history-amber':'');
        p.textContent=label+': '+(r.state==='watch'?'WATCH':r.state==='not-triggered'?'No watch triggered — not a low-risk assurance':'Unavailable')+(r.date?' · '+r.date:'')+(r.state==='unavailable'?' · '+r.reason:'');alerts.appendChild(p);
    });
}
type CpEditKey='cp_financial_date'|'cp_financial'|'cp_nonfinancial_date'|'cp_nonfinancial'|'cp_treasury_date'|'cp_treasury';
const cpSavedView:{key:'savedAt'|CpEditKey;direction:number;page:number;dirty:boolean;owner:string|null}={key:'savedAt',direction:-1,page:0,dirty:false,owner:null};
function savedCpEntries(){
    return entryHistory.filter(r=>r.savedAt&&Number.isFinite(r.values?.cp_date)&&!validateLiquidityInputs(r.values));
}
function renderSavedCpTable(){
    const head=requiredElement('cpSavedHead'),body=requiredElement('cpSavedBody'),pager=requiredElement('cpSavedPager');
    if(!head||!body||!pager)return;
    if(cpSavedView.owner!==historyOwner){cpSavedView.owner=historyOwner;cpSavedView.page=0;}
    const columns:['savedAt'|CpEditKey,string][]=[['savedAt','Saved date and time'],['cp_financial_date','Financial observation (YYYYMMDD)'],['cp_financial','Financial CP (%)'],['cp_nonfinancial_date','Nonfinancial observation (YYYYMMDD)'],['cp_nonfinancial','Nonfinancial CP (%)'],['cp_treasury_date','Treasury observation (YYYYMMDD)'],['cp_treasury','Treasury bill (%)']];
    const rows=savedCpEntries().sort((a,b)=>{
        const key=cpSavedView.key,av=key==='savedAt'?Date.parse(a.savedAt):(a.values[key]??a.values.cp_date),bv=key==='savedAt'?Date.parse(b.savedAt):(b.values[key]??b.values.cp_date);
        return cpSavedView.direction*(Number(av)-Number(bv))||Date.parse(b.savedAt)-Date.parse(a.savedAt);
    });
    const change=(fn:()=>void)=>{if(cpSavedView.dirty&&!confirm('Discard unsaved CP table edits?'))return;fn();renderSavedCpTable();};
    head.replaceChildren();const heading=document.createElement('tr');
    columns.forEach(([key,label])=>{const th=document.createElement('th');th.scope='col';
        const button=document.createElement('button');button.type='button';button.className='cp-sort-label';button.textContent=label+(cpSavedView.key===key?(cpSavedView.direction<0?' ▼':' ▲'):'');
        th.setAttribute('aria-sort',cpSavedView.key===key?(cpSavedView.direction<0?'descending':'ascending'):'none');
        button.onclick=()=>change(()=>{cpSavedView.direction=cpSavedView.key===key?-cpSavedView.direction:-1;cpSavedView.key=key;cpSavedView.page=0;});th.appendChild(button);heading.appendChild(th);
    });const actionHead=document.createElement('th');actionHead.scope='col';actionHead.textContent='Actions';heading.appendChild(actionHead);const deleteHead=document.createElement('th');deleteHead.textContent='Delete';heading.appendChild(deleteHead);head.appendChild(heading);
    const size=50,pages=Math.max(1,Math.ceil(rows.length/size));cpSavedView.page=Math.min(cpSavedView.page,pages-1);cpSavedView.dirty=false;
    body.replaceChildren();body.oninput=()=>{cpSavedView.dirty=true;};
    rows.slice(cpSavedView.page*size,(cpSavedView.page+1)*size).forEach(entry=>{
        const tr=document.createElement('tr'),inputs:Partial<Record<CpEditKey,HTMLInputElement>>={};
        columns.forEach(([key,label])=>{const td=document.createElement('td');
            if(key==='savedAt')td.textContent=new Date(entry.savedAt).toLocaleString();
            else {const input=document.createElement('input');input.type='number';input.step=key.endsWith('_date')?'1':'any';input.className='history-value-input history-normal';input.value=String(entry.values[key]??(key.endsWith('_date')?entry.values.cp_date:null)??'');input.setAttribute('aria-label',label);inputs[key]=input;td.appendChild(input);}
            tr.appendChild(td);
        });
        const actions=document.createElement('td');
        const save=document.createElement('button');save.type='button';save.textContent='Save';save.className='history-date-save';save.onclick=()=>{
            const values={...entry.values};for(const [key,input] of Object.entries(inputs) as [CpEditKey,HTMLInputElement][]){if(!input.value.trim()){setAppFeedback('cpAiStatus','Supply the CP date and all three rates.','error');return;}values[key]=Number(input.value);}
            values.cp_date=Math.max(...cpRateKeys.map(k=>requiredValue(values[`${k}_date`])));const error=validateLiquidityInputs(values);if(error){setAppFeedback('cpAiStatus',error,'error');return;}
            const date=new Date(entry.savedAt),time=[date.getHours(),date.getMinutes(),date.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
            if(updateEntryDateTime(entry,localCalendarDate(date),time,values))setAppFeedback('cpAiStatus','CP values saved successfully to this table and History.','success');
        };
        actions.appendChild(save);tr.appendChild(actions);const deleteCell=document.createElement('td'),del=document.createElement('button');del.type='button';del.className='history-delete';del.textContent='×';del.setAttribute('aria-label','Delete shared CP and History entry');del.onclick=()=>deleteHistoryEntry(entry);deleteCell.appendChild(del);tr.appendChild(deleteCell);body.appendChild(tr);
    });
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=9;td.textContent='No saved CP entries yet. Apply a CP update to save one.';tr.appendChild(td);body.appendChild(tr);}
    pager.replaceChildren();for(const [label,delta] of [['Previous',-1],['Next',1]] as [string,number][]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=cpSavedView.page+delta<0||cpSavedView.page+delta>=pages;button.onclick=()=>change(()=>{cpSavedView.page+=delta;});pager.appendChild(button);}
    const count=document.createElement('span');count.textContent=' '+rows.length+' saved entries · Page '+(cpSavedView.page+1)+' of '+pages;pager.appendChild(count);
}
function generateCpPrompt(){
    requiredElement('cpAiPrompt').value='Research the latest individually verified observations available as of '+new Date().toISOString()+' for DCPF3M (90-day AA financial CP), DCPN3M (90-day AA nonfinancial CP), and DTB3 (3-month Treasury bill secondary-market discount rate). Check https://www.federalreserve.gov/releases/cp/ and https://www.federalreserve.gov/releases/h15/ as well as https://fred.stlouisfed.org/series/DCPF3M , https://fred.stlouisfed.org/series/DCPN3M and https://fred.stlouisfed.org/series/DTB3 . Return exactly six comma-separated numbers: financial observation YYYYMMDD, financial rate percent, nonfinancial observation YYYYMMDD, nonfinancial rate percent, Treasury bill observation YYYYMMDD, Treasury bill rate percent. Dates may differ. For each series use its latest verified numeric observation, retaining its actual observation date even if older. Never replace an observation date with publication or retrieval time. Do not substitute maturities, issuers, or Treasury constant-maturity yields; do not estimate or forward-date missing rates. If any rate/date cannot be verified, explain instead of inventing numbers.';
}
async function copyCpPrompt(){generateCpPrompt();try{await navigator.clipboard.writeText(requiredElement('cpAiPrompt').value);setAppFeedback('cpAiStatus','Prompt copied.');}catch{requiredElement('cpAiPrompt').select();setAppFeedback('cpAiStatus','Select and copy the prompt manually.');}}
function applyCpResponse(){
    if(!historyOwner||!currentEntryTime){setAppFeedback('cpAiStatus',"Sign in and save a researched composite entry first, or use Fetch latest data to update CP history independently.");return;}
    const raw=requiredElement('cpAiResponse').value.trim().split(',');const nums=raw.map(x=>Number(x.trim()));
    if(![4,6].includes(raw.length)||raw.some(x=>!x.trim())||!nums.every(Number.isFinite)){setAppFeedback('cpAiStatus','Use six numeric fields: financial date, rate, nonfinancial date, rate, Treasury date, rate. Four-field same-date input is also accepted.');return;}
    const values={...currentData,cp_date:nums.length===6?Math.max(requiredValue(nums[0]),requiredValue(nums[2]),requiredValue(nums[4])):requiredValue(nums[0]),cp_financial_date:requiredValue(nums[0]),cp_nonfinancial_date:nums.length===6?requiredValue(nums[2]):requiredValue(nums[0]),cp_treasury_date:nums.length===6?requiredValue(nums[4]):requiredValue(nums[0]),cp_financial:requiredValue(nums[1]),cp_nonfinancial:nums.length===6?requiredValue(nums[3]):requiredValue(nums[2]),cp_treasury:nums.length===6?requiredValue(nums[5]):requiredValue(nums[3])};const error=validateLiquidityInputs(values);
    if(error){setAppFeedback('cpAiStatus',error);return;}const inputError=validateForcedInputs(values);if(inputError){setAppFeedback('cpAiStatus',inputError);return;}if(!commitEntry(values)){setAppFeedback('cpAiStatus','CP update could not be saved. Existing entries have been kept.','error');return;}cpSavedView.key='savedAt';cpSavedView.direction=-1;cpSavedView.page=0;renderSavedCpTable();setAppFeedback('cpAiStatus','CP rates saved successfully to the table below and History. Check time refreshed; each rate retains its own observation date. Different-date spreads are labelled in the score notes.','success');
}
function openTroubleshootSync(){
    if(document.documentElement.classList.contains("workspace-enabled")){DashboardCore.showWorkspace("troubleshootSyncPanel");return;}
    const panel=requiredElement('troubleshootSyncPanel');
    closeOtherDashboardPanels(panel);panel.open=true;
    const heading=requiredElement('troubleshootSyncHeading');
    heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});
}
function closeOtherDashboardPanels(selected:Element|null){
    if(document.documentElement.classList.contains("workspace-enabled"))return;
    document.querySelectorAll<HTMLDetailsElement>('details.overview-details').forEach(panel=>{if(panel!==selected)panel.open=false;});
}
function handleDashboardToggle(event:Event){
    const panel=event.target;
    if(!(panel instanceof HTMLDetailsElement)||!panel.open)return;
    if(panel.classList.contains('overview-details'))closeOtherDashboardPanels(panel);
    else {
        // Keep ancestors open; only sibling disclosures compete within a section.
        const siblings=panel.parentElement?.children||[];
        for(const sibling of siblings)if(sibling!==panel&&sibling instanceof HTMLDetailsElement)sibling.open=false;
    }
}
function revealDashboardTarget(){
    if(DashboardCore.navigateWorkspace()){
        const id=location.hash.slice(1);
        if(id==='fundingQuickHeading')generateFundingQuickPrompt();
        if(id==='fedQuickHeading'&&!requiredElement('fedPrompt').value)generateFedPrompt();
        if(id==='cpUpdate'){generateCpPrompt();requiredElement('cpPromptDetails').open=true;}
        return;
    }
    const id=decodeURIComponent(location.hash.slice(1))||'dashboardOverview';
    const target=document.getElementById(id);if(!target)return;
    const selected=target.closest?target.closest<HTMLDetailsElement>('details.overview-details'):null;
    closeOtherDashboardPanels(selected);
    if(selected){selected.hidden=false;selected.open=true;}
    let node=target.parentElement;while(node){if(node instanceof HTMLDetailsElement){node.hidden=false;node.open=true;}node=node.parentElement;}
    document.querySelectorAll('.dashboard-nav a').forEach(a=>{if(a.getAttribute('href')==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    if(id==='fundingQuickHeading')generateFundingQuickPrompt();
    if(id==='fedQuickHeading'&&!requiredElement('fedPrompt').value)generateFedPrompt();
    if(id==='cpUpdate'){generateCpPrompt();requiredElement('cpPromptDetails').open=true;}
    target.scrollIntoView({block:'start'});
    if(id==='analysisPromptControls')requiredElement('analysisQuestions').focus({preventScroll:true});
}
document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('toggle',handleDashboardToggle,true);
    window.addEventListener('hashchange',revealDashboardTarget);
    document.querySelectorAll('#appShell a[href^="#"]').forEach(a=>a.addEventListener('click',()=>setTimeout(revealDashboardTarget,0)));
    revealDashboardTarget();
});

function renderDashboard(){
    if(requiredElement("restorePanel")?.open)renderRestoreTables();
    renderEntryHistory();

    const tbody =
        requiredElement("metricTableBody");

    const scoringDate=currentEntryTime?localCalendarDate(new Date(currentEntryTime)):localCalendarDate(new Date());
    const bounds=compositeRange(currentData,scoringDate);
    renderGroupedFactors(tbody,currentData,scoringDate);
    updateSummary(bounds.low,50);
    if(bounds.low!==bounds.high){requiredElement('totalScoreDisp').innerText=bounds.low+'–'+bounds.high+' / 50';requiredElement('statusTermDisp').innerText='Incomplete data';requiredElement('scoreSubtext').innerText='Missing inputs create a possible score range. Update the entry below.';}
    const cpNote=cpStaleNote(currentData,scoringDate);
    if(cpNote)requiredElement('scoreSubtext').innerText+=' '+cpNote;
    updateRegimes();
    renderOpeningOverview();

    requiredElement("lastCheckDate").innerText =
        "Last check: " +
        new Date().toLocaleDateString(
            "en-CA",
            {
                year:"numeric",
                month:"2-digit",
                day:"2-digit"
            }
        );
}


/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(score:number,max:number){

    requiredElement("totalScoreDisp")
        .innerText=`${score} / ${max}`;

    let text="Normal Risk";
    let cls="status-green";
    let scale="scale-normal";
    let sub="Few scoring thresholds are crossed; this does not establish safety.";

    if(score>=31){
        text="Systemic Risk";
        cls="status-purple";
        scale="scale-systemic";
        sub="A high concentration of stress signals; this does not prove a funding freeze or predict a crash.";

    }else if(score>=23){
        text="High Risk";
        cls="status-red";
        scale="scale-high-risk";
        sub="Many indicators cross stress thresholds; review liquidity needs and risk limits.";

    }else if(score>=16){
        text="High Stress";
        cls="status-red";
        scale="scale-high-stress";
        sub="Elevated measured stress; review exposures against your risk limits.";

    }else if(score>=10){
        text="Systemic Stress";
        cls="status-amber";
        scale="scale-systemic-stress";
        sub="Several indicators signal pressure; review the contributors and missing data.";

    }else if(score>=5){
        text="Correction Risk";
        cls="status-amber";
        scale="scale-watch";
        sub="Early threshold warnings; monitor subsequent observations.";
    }

    document
        .querySelectorAll(".matrix-row")
        .forEach(x=>x.classList.remove("active"));

    requiredValue(document.getElementById(scale))
        .classList.add("active");

    const status=
        requiredElement("statusTermDisp");

    status.innerText=text;
    status.className=
        `score-status ${cls}`;

    requiredElement("scoreSubtext")
        .innerText=sub;
}

/* =========================================================
   REGIME CLASSIFICATION
   ========================================================= */

function updateRegimes(){
    const day=currentEntryTime?localCalendarDate(new Date(currentEntryTime)):localCalendarDate(new Date());
    const mapping:Record<string,[HtmlElementKey,HtmlElementKey,string,string,string]>={volatilityChart:['volRegime','volDesc','Volatility contained.','Volatility rising.','Volatility stress.'],creditChart:['creditRegime','creditDesc','Credit markets calm.','Credit spreads widening.','Credit stress / systemic warning.'],macroChart:['macroRegime','macroDesc','Macro shock limited.','Rates/oil becoming restrictive.','Major macro shock.'],equityChart:['equityRegime','equityDesc','Equity structure healthy.','Equity breadth deteriorating.','Major equity technical stress.'],forcedChart:['forcedRegime','forcedDesc','Forced-selling pressure limited.','Carry-trade, leverage or volume pressure rising.','Elevated forced-selling pressure.']};
    for(const [key,config] of Object.entries(regimeCharts)){
        const [id,desc,...labels]=requiredValue(mapping[key]),range=config.forced?forcedCategoryRange(currentData,day):historicalScoreRange(currentData,config.keys,day);
        setRegime(id,desc,range.low,config.maximum,...labels);
        if(range.low!==range.high){requiredElement(id).textContent='INCOMPLETE '+range.low+'–'+range.high+' / '+config.maximum;requiredElement(id).style.color='var(--text-main)';requiredElement(desc).textContent='Unavailable inputs produce a possible score range.';}
    }
}

function setRegime(
    valueId:HtmlElementKey,
    descId:HtmlElementKey,
    score:number,
    max:number,
    greenText:string,
    amberText:string,
    redText:string
){

    const value=requiredElement(valueId);
    const desc=requiredElement(descId);

    value.className="signal-value";

    let label;
    let color;

    if(score >= max*0.67){
        label="STRESSED";
        color="var(--red)";
        desc.innerText=redText;

    }else if(score >= max*0.34){
        label="WATCH";
        color="var(--amber)";
        desc.innerText=amberText;

    }else{
        label="CALM";
        color="var(--green)";
        desc.innerText=greenText;
    }

    // Show the actual component score and its own maximum in the existing
    // regime cell. The five components together have a maximum of 50 points.
    value.innerHTML = `${label} <span class="regime-points">${score} / ${max}</span>`;
    value.style.color=color;
}


/* =========================================================
   MANUAL UPDATE
   ========================================================= */
