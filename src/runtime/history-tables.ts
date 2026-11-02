const historyOverrideFields:[keyof HistoryOverrides,string,number|null][]=[['composite','Composite Crash Risk Score',50],['scoredCpDate','Scored CP date',null],['cpPoints','CP added points',3],['nasdaqMomentum','Nasdaq 100 relative momentum',null],['nasdaqPoints','Nasdaq added points',3]];
function parseHistoryOverrides(inputs:Partial<Record<keyof HistoryOverrides,HTMLInputElement>>,existing:HistoryOverrides,day:string):HistoryOverrides{
    const result={...existing};
    for(const [key,label,max] of historyOverrideFields){
        const input=requiredValue(inputs[key]),raw=input.value.trim();
        if(!raw){delete result[key];continue;}
        if(raw===input.defaultValue&&!Object.hasOwn(result,key))continue;
        if(key==='scoredCpDate'){
            const d=new Date(raw+'T12:00:00');
            if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(d.getTime())||localCalendarDate(d)!==raw||raw>day)throw Error('Scored CP date must be a valid date no later than the entry date.');
            result[key]=raw;
        }else if(key==='composite'||key==='cpPoints'||key==='nasdaqPoints'){
            const m=raw.match(/^(\d+)(?:\s*[–-]\s*(\d+))?$/);
            if(!m||Number(m[1])>Number(m[2]??m[1])||Number(m[2]??m[1])>requiredValue(max))throw Error(label+' must be a whole number or range from 0 to '+max+'.');
            result[key]={low:Number(m[1]),high:Number(m[2]??m[1])};
        }else{const n=Number(raw);if(!Number.isFinite(n))throw Error(label+' must be a finite number.');result[key]=n;}
    }
    return result;
}
function historyOverrideInput(key:keyof HistoryOverrides,label:string,computed:string,entry:DisplayEntry,host:HTMLElement,inputs:Partial<Record<keyof HistoryOverrides,HTMLInputElement>>,max:number|null){
    const override=entry.historyOverrides?.[key];
    const display=override===undefined?computed:(typeof override==='object'?analysisRange(override):String(override));
    host.replaceChildren();const input=document.createElement('input');input.type=key==='scoredCpDate'?'date':'text';
    input.value=display==='—'?'':display;input.defaultValue=input.value;
    if(key==='nasdaqMomentum'&&!input.value){
        input.placeholder='Unavailable';
        const day=entry.observationDate||localCalendarDate(new Date(entry.savedAt||Date.now()));
        const reason=model50Inputs(entry.values,day).momentumReason||'No matched equity history for this session.';
        input.setAttribute('aria-description',reason);
        const note=document.createElement('small');note.textContent=reason;host.appendChild(note);
    }
    let color='history-normal';
    if(max!==null){const m=input.value.match(/^(\d+)$/);if(m){const n=Number(m[1]);color=max===50?(n>=16?'history-red':n>=5?'history-amber':'history-normal'):(n>=3?'history-red':n>0?'history-amber':'history-normal');}}
    input.className=(key==='scoredCpDate'?'history-date-input':'history-value-input')+' '+color;
    input.setAttribute('aria-label',label+' for '+(entry.savedAt||'unsaved entry'));
    input.title=(entry.values.equitySessionDate?'Equity observation session: '+entry.values.equitySessionDate+'. ':'')+(override===undefined?'Calculated value.':'Manual history-table override.')+' Edit then Save; clear to restore automatic calculation. Dashboard/chart scores still use the model.';
    host.title=input.title;host.appendChild(input);inputs[key]=input;
}

function customHistoryLabel(label:unknown){
    const text=typeof label==='string'?label.trim():'';
    return /^(current(?: \(unsaved\))?|past|historical reference)$/i.test(text)?'':text;
}
function updateEntryDateTime(entry:DisplayEntry,dateText:string,timeText:string,values:MarketValues=entry.values,historyOverrides:HistoryOverrides=entry.historyOverrides||{},entryLabel=entry.entryLabel){
    if(validateForcedInputs(values)){alert(validateForcedInputs(values));return false;}
    if(!validSnapshot(values)){ alert("Use a number or null for every indicator."); return false; }
    if(!historyOwner || (!entryHistory.some(row=>row===entry)&&!entry.reference&&entry.savedAt)) return false;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(timeText)){
        alert('Enter a complete date and time.'); return false;
    }
    const [year,month,day]=dateText.split('-').map(Number) as [number,number,number];
    const [hour,minute,second=0]=timeText.split(':').map(Number) as [number,number,number?];
    const date=new Date(0);
    date.setFullYear(year,month-1,day); date.setHours(hour,minute,second,0);
    if(year<1 || !Number.isFinite(date.getTime()) || date.getFullYear()!==year || date.getMonth()!==month-1 || date.getDate()!==day || date.getHours()!==hour || date.getMinutes()!==minute || date.getSeconds()!==second){
        alert('Enter a valid local date and time.'); return false;
    }
    const replacement:HistoryEntry={...entry,savedAt:date.toISOString(),updatedAt:new Date().toISOString(),values:{...values},historyOverrides,entryLabel:customHistoryLabel(entryLabel)||undefined};
    if(entry.reference){replacement.sourceReferenceDate=entry.observationDate;delete replacement.reference;delete replacement.observationDate;delete replacement.id;}
    const updated=(entryHistory.some(row=>row===entry)?entryHistory.map(row=>row===entry?replacement:row):[replacement,...entryHistory]).sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));
    try { writeMarketHistory(JSON.stringify(updated)); }
    catch(error){ alert('The entry could not be saved to browser storage. The original entry has been kept.'); return false; }
    entryHistory=updated;
    historyStorageError='';
    if(entryHistory.length){
        currentEntryTime=requiredValue(entryHistory[0]).savedAt;
        currentData={...requiredValue(entryHistory[0]).values};
        
    }
    renderDashboard();
    return true;
}
function historyRisk(key:MetricKey,value:NumericInput,values:MarketValues={}){
    if(key==='jpy')return {className:'history-normal',points:0,max:0};
    const config = metricConfig[key], bounds = metricPointRange(key,{...values,[key]:value??null}), points = bounds.low;
    return {className:bounds.low!==bounds.high ? 'history-normal' : points === 0 ? 'history-normal' : points >= config.maxPoints ? 'history-red' : 'history-amber', points, max:config.maxPoints};
}
async function copyQuickPastePrompt(){
    const prompt=(requiredElement('quickPastePrompt').textContent||'').replace(/\s+/g,' ').trim();
    const status=requiredElement('copyPromptStatus');
    try {
        if(!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(prompt);
        setAppFeedback(status,'Prompt copied.','success');
    } catch(error){
        const selection=window.getSelection();
        const range=document.createRange();range.selectNodeContents(requiredElement('quickPastePrompt'));
        selection?.removeAllRanges();selection?.addRange(range);
        status.textContent='Automatic copy unavailable. Prompt selected — press Ctrl+C or Command+C.';
    }
}
function baseCompositeScore(values:MarketValues){
    return historyColumns.reduce((total,[key])=>total+metricPoints(key,values),0);
}
function chartWindow(range:string,now=new Date()){
    const start=new Date(now);
    if(range==='1w') start.setDate(start.getDate()-7);
    else {
        const months=({'1m':1,'3m':3,'6m':6,'9m':9,'1y':12,'2y':24,'3y':36,'4y':48,'5y':60} as Record<string,number>)[range] || 3;
        const day=start.getDate(); start.setDate(1); start.setMonth(start.getMonth()-months);
        const last=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();start.setDate(Math.min(day,last));
    }
    return {start,end:new Date(now)};
}
const regimeCharts:Record<string,{maximum:number;keys:ScoredKey[];forced?:boolean}> = {"volatilityChart": {"maximum": 10, "keys": ["vix", "vix_chg", "vix_5d", "move", "vix_term"]}, "creditChart": {"maximum": 14, "keys": ["hy", "hy_5d", "hy_20d", "bbb", "cp_stress"]}, "macroChart": {"maximum": 8, "keys": ["yield", "yield_20d", "wti", "wti_20d"]}, "equityChart": {"maximum": 12, "keys": ["dma50", "dma200", "breadth", "breadth_20d", "leadership"]},"forcedChart":{"maximum":6,"keys":["jpy"],"forced":true}};
type ChartScorer=((values:MarketValues,day?:string)=>number)&{range?:(values:MarketValues,day?:string)=>RiskRange};
function chartEntries(range:string,now=new Date(),scoreFor:ChartScorer=compositeScore){
    const {start,end}=chartWindow(range,now);
    return {start,end,points:historyDisplayEntries().filter(row=>Date.parse(row.savedAt)>=start.getTime() && Date.parse(row.savedAt)<=end.getTime())
        .map(row=>({time:Date.parse(row.savedAt),score:scoreFor(row.values,localCalendarDate(new Date(row.savedAt))),high:scoreFor.range?scoreFor.range(row.values,localCalendarDate(new Date(row.savedAt))).high:scoreFor===compositeScore?compositeRange(row.values,localCalendarDate(new Date(row.savedAt))).high:scoreFor===forcedCategoryScore?forcedCategoryRange(row.values,localCalendarDate(new Date(row.savedAt))).high:scoreFor(row.values)})).sort((a,b)=>a.time-b.time)};
}
function setAllChartRanges(range:string){
    if(!['1w','1m','3m','6m','9m','1y','2y','3y','4y','5y'].includes(range)) return;
    const chartIds=['riskChart',...Object.keys(regimeCharts)];
    chartIds.forEach(id=>{ requiredValue(document.querySelector<HTMLSelectElement>('#'+id+'Range')).value=range; });
    chartIds.forEach(id=>renderRiskChart(id));
    requiredElement('fundingRange').value=range;requiredElement('liquidityRange').value=range;renderFunding();renderLiquidityDiagnostics();
}
function renderRiskChart(chartId='riskChart'){
    const config=regimeCharts[chartId];
    const maximum=config ? config.maximum : 50;
    const amber=config ? Math.ceil(maximum*0.34) : 5;
    const red=config ? Math.ceil(maximum*0.67) : 16;
    const scoreFor:ChartScorer=config?.forced ? forcedCategoryScore : config ? (values,day)=>historicalScoreRange(values,config.keys,day).low : compositeScore;
    if(config&&!config.forced)scoreFor.range=(values,day)=>historicalScoreRange(values,config.keys,day);
    const svg=requiredValue(document.querySelector<SVGSVGElement>('#'+chartId));
    const {start,end,points}=chartEntries(requiredValue(document.querySelector<HTMLSelectElement>('#'+chartId+'Range')).value,new Date(),scoreFor);
    svg.replaceChildren();
    const add=(tag:string,attrs:Record<string,string|number>,text?:string|number)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=String(text);svg.appendChild(el);return el;};
    const left=55,right=865,top=24,bottom=282;
    const x=(t:number)=>left+(t-start.getTime())/(end.getTime()-start.getTime())*(right-left),y=(n:number)=>bottom-n/maximum*(bottom-top);
    ([[0,amber,'#ffffff'],[amber,red,'#f59e0b'],[red,maximum,'#ef4444']] as [number,number,string][]).forEach(([lo,hi,color])=>add('rect',{x:left,y:y(hi),width:right-left,height:y(lo)-y(hi),fill:color,opacity:.05}));
    (config ? Array.from({length:maximum+1},(_,i)=>i) : [0,5,10,16,23,31,50]).forEach(n=>{add('line',{x1:left,x2:right,y1:y(n),y2:y(n),stroke:'#334155'});add('text',{x:left-12,y:y(n)+4,fill:'#94a3b8','text-anchor':'end','font-size':12},n);});
    for(let i=0;i<=4;i++){
        const t=start.getTime()+(end.getTime()-start.getTime())*i/4;
        add('text',{x:x(t),y:bottom+25,fill:'#94a3b8','font-size':11,'text-anchor':i===0?'start':i===4?'end':'middle'},new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}));
    }
    add('text',{x:left,y:15,fill:'#94a3b8','font-size':12},'Score (0–'+maximum+')');
    if(points.some(p=>p.high!==p.score))add('polygon',{points:[...points.map(p=>x(p.time)+','+y(p.score)),...points.slice().reverse().map(p=>x(p.time)+','+y(p.high))].join(' '),fill:'#60a5fa',opacity:.18});
    if(points.length>1)add('polyline',{points:points.map(p=>x(p.time)+','+y(p.score)).join(' '),fill:'none',stroke:'#60a5fa','stroke-width':2});
    points.forEach(p=>{
        const label=new Date(p.time).toLocaleString()+' — score '+p.score+(p.high!==p.score?'–'+p.high:'')+' / '+maximum;
        const dot=add('circle',{cx:x(p.time),cy:y(p.score),r:4,fill:p.score>=red?'#ef4444':p.score>=amber?'#f59e0b':'#fff',tabindex:0,'aria-label':label});
        const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=label;dot.appendChild(title);
        dot.onfocus=()=>{requiredValue(document.getElementById(chartId+'Summary')).textContent=label;};
    });
    drawSp500Overlay(svg,sp500ChartPoints(start,end),x);
    requiredValue(document.getElementById(chartId+'Summary')).textContent=points.length ? points.length+' history entries (saved + reference) · Latest score in this range: '+requiredValue(points.at(-1)).score+(requiredValue(points.at(-1)).high!==requiredValue(points.at(-1)).score?'–'+requiredValue(points.at(-1)).high:'')+' / '+maximum : 'No history entries in this time range. Select a wider range or save an entry.';
}

function renderEntryHistory(){
    renderRiskChart();
    requiredElement('historyTimezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
    requiredElement('historyNotice').textContent = historyStorageError || (entryHistory.length ? entryHistory.length+' saved entries.' : (historyPreviewHidden ? 'No saved entries. Save an update to add a row.' : 'No saved entries yet. Current values are unsaved samples.'));
    renderHistoryTable('history',historyColumns,'Composite Crash Risk Score',50,false);
    renderRiskChart('volatilityChart');
    renderRiskChart('creditChart');
    renderRiskChart('macroChart');
    renderRiskChart('equityChart');
    renderRiskChart('forcedChart');
    renderForcedSelling();
    renderFunding();
    renderLiquidityDiagnostics();
}
function model50Cells(values:MarketValues,day?:string){
    const input=model50Inputs(values,day),cp=metricPointRange('cp_stress',values,day),nd=metricPointRange('leadership',values,day);
    const points=(r:RiskRange)=>r.low===r.high?String(r.low):r.low+'–'+r.high;
    const color=(r:RiskRange)=>r.low!==r.high?'history-normal':r.low>=3?'history-red':r.low>0?'history-amber':'history-normal';
    return [{text:input.cp?.mixedDates?'Mixed dates':input.cp?.date||'—',className:'history-normal'},
        {text:points(cp),className:color(cp)},
        {text:finiteNumber(input.momentum)?input.momentum.toFixed(4):'—',className:color(nd)},
        {text:points(nd),className:color(nd)}];
}
const model50Headers=['Scored CP date','CP added points (0–3)','Nasdaq 100 relative momentum (%)','Nasdaq added points (0–3)'];
// Compare with the immediately preceding chronological entry, including across pages.
function historyChangeDirection(key:string,current:unknown,previous:unknown){
    if(!finiteNumber(current)||!finiteNumber(previous)||Math.abs(current-previous)<1e-8)return '';
    const higherBetter=['breadth','breadth_20d','dma50','dma200','vix_term','sp500','nasdaq','nasdaq100','sp_high','sp_low','sp500_chg','jpy3d','nasdaqMomentum'];
    const lowerBetter=['composite','cpPoints','nasdaqPoints','vix','vix_chg','vix_5d','hy','hy_5d','hy_20d','bbb','yield','yield_20d','wti','wti_20d','move','margin_debt','margin_yoy','margin_3m'];
    const sign=higherBetter.includes(key)?1:lowerBetter.includes(key)?-1:0;
    return !sign?'':(current-previous)*sign>0?'history-improved':'history-worsened';
}
function historyComparisonValues(entry:DisplayEntry|undefined,displayMode=false):Record<string,unknown>{
    if(!entry)return {};
    const day=entry.observationDate||localCalendarDate(new Date(entry.savedAt||Date.now()));
    const bounds=compositeRange(entry.values,day),cells=model50Cells(entry.values,day);
    const values:Record<string,unknown>={...(!entry.reference?forcedInputsForDate(day):{}),...entry.values};
    values["composite"]=displayMode?analysisRange(bounds):bounds.low===bounds.high?bounds.low:null;
    for(let i=1;i<historyOverrideFields.length;i++){
        const key=requiredValue(historyOverrideFields[i])[0],text=requiredValue(cells[i-1]).text;
        values[key]=displayMode?text:text!==''&&Number.isFinite(Number(text))?Number(text):null;
    }
    Object.assign(values,entry.historyOverrides||{});
    if(!Number.isFinite(values["sp500"])&&!entry.reference)values["sp500"]=sp500ForDate(day)?.close??null;
    for(const [key] of marketColumns)values[key]=marketForDate(key,day,entry.values)?.close??null;
    return values;
}
function applyHistoryChangeOutline(cell:HTMLElement,key:string,current:unknown,previous:unknown,previousDate:string){
    cell.dataset["comparisonExplicit"]='true';
    if(cell.dataset["comparisonTitle"]){cell.title=cell.title.replace(cell.dataset["comparisonTitle"],'');delete cell.dataset["comparisonTitle"];}
    const input=cell.querySelector('input');
    if(input&&!input.dataset["comparisonBound"]){input.dataset["comparisonBound"]='true';input.addEventListener('input',()=>applyHistoryChangeOutline(cell,key,input.value.trim()===''?null:Number(input.value),previous,previousDate));}
    cell.classList.remove('history-improved','history-worsened');
    const cls=historyChangeDirection(key,current,previous);
    if(!cls)return;
    cell.className+=(cell.className?' ':'')+cls;
    cell.dataset["comparisonTitle"]=(cell.title?' · ':'')+(cls==='history-improved'?'Improved':'Worsened')+' versus preceding entry ('+previousDate+'): '+previous+' → '+current+'. Direction follows the dashboard risk convention.';
    cell.title+=cell.dataset["comparisonTitle"];
}
const historyPageSize=50;
const historyPages:Record<string,{page:number;owner?:string|null;current?:string|null;dirty?:boolean}>=Object.create(null);
function renderHistoryTable(prefix:string,columns:[MetricKey,string,string][],scoreLabel:string,maximum:number,isRegime:boolean){
    const head = requiredValue(document.getElementById(prefix+'Head')); head.replaceChildren();
    const heading = document.createElement('tr');
    ['Delete','Entry','Date','Time',scoreLabel+' (0–'+maximum+')',...model50Headers,'S&P 500 close',...marketColumns.map(c=>c[1]),...liquidityColumns.map(c=>c[1]+' ('+c[2]+')'),...[...columns,...forcedColumns].map(([,label,unit])=>label+' ('+unit+')')].forEach(label=>{
        const th=document.createElement('th'); th.scope='col'; th.textContent=label; heading.appendChild(th);
    }); head.appendChild(heading);
    const body = requiredValue(document.getElementById(prefix+'Body')); body.replaceChildren();
    const newestEntries = historyDisplayEntries();
    const entries:DisplayEntry[] = currentEntryTime || historyPreviewHidden ? newestEntries : [{savedAt:null,values:currentData},...newestEntries];
    const state=historyPages[prefix]||(historyPages[prefix]={page:0});
    if(state.owner!==historyOwner || state.current!==currentEntryTime){state.page=0;state.owner=historyOwner;state.current=currentEntryTime;}
    const pages=Math.max(1,Math.ceil(entries.length/historyPageSize));
    state.page=Math.max(0,Math.min(state.page,pages-1));
    const start=state.page*historyPageSize;
    const pager=document.getElementById(prefix+'Pager');
    if(pager){
        pager.replaceChildren();
        const go=(page:number)=>{if(state.dirty&&!confirm('Discard unsaved edits on this history page?'))return;state.page=page;renderHistoryTable(prefix,columns,scoreLabel,maximum,isRegime);};
        for(const [label,page] of [['Newest',0],['Previous',state.page-1],['Next',state.page+1],['Oldest',pages-1]] as [string,number][]){
            const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=page<0||page>=pages||page===state.page;button.onclick=()=>go(page);pager.appendChild(button);
        }
        const status=document.createElement('span');status.textContent=' Rows '+(entries.length?start+1:0)+'–'+Math.min(start+historyPageSize,entries.length)+' of '+entries.length+' · Page '+(state.page+1)+' of '+pages+' · All rows remain editable. ';pager.appendChild(status);
        const jump=document.createElement('input');jump.type='date';jump.className='history-date-input';jump.setAttribute('aria-label','Find history date');pager.appendChild(jump);
        const find=document.createElement('button');find.type='button';find.textContent='Go to date';find.onclick=()=>{if(!jump.value)return;const index=entries.findIndex(r=>(r.observationDate||localCalendarDate(new Date(r.savedAt||Date.now())))<=jump.value);go(Math.floor((index<0?entries.length-1:index)/historyPageSize));};pager.appendChild(find);
    }
    state.dirty=false;
    body.oninput=()=>{state.dirty=true;};
    const comparisonCache=new Map<DisplayEntry,Record<string,unknown>>();
    entries.slice(start,start+historyPageSize).forEach((entry,index)=>{
        const isCurrent = !entry.reference && !historyPreviewHidden && (entry.savedAt===currentEntryTime || !entry.savedAt);
        const tr=document.createElement('tr'); if(isCurrent) tr.className='history-current';
        const deleteCell=document.createElement('td');
        const deleteButton=document.createElement('button');
        deleteButton.type='button'; deleteButton.className='history-delete'; deleteButton.textContent='×';
        const deleteLabel='Delete '+(entry.savedAt ? new Date(entry.savedAt).toLocaleString() : 'unsaved current row');
        deleteButton.title=deleteLabel; deleteButton.setAttribute('aria-label',deleteLabel);
        deleteButton.onclick=()=>deleteHistoryEntry(entry);
        if(entry.reference){deleteCell.textContent='Reference';}else deleteCell.appendChild(deleteButton); tr.appendChild(deleteCell);
        const date=entry.savedAt ? new Date(entry.savedAt) : new Date();
        const dateText=entry.reference?requiredValue(entry.observationDate):date ? [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-') : '—';
        const timeText=date ? [date.getHours(),date.getMinutes(),date.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':') : '—';
        const entryCell=document.createElement('td');
        entryCell.textContent=entry.reference?'Historical reference':isCurrent ? (date ? 'Current' : 'Current (unsaved)') : 'Past';
        const labelInput=document.createElement('input');labelInput.type='text';labelInput.className='history-date-input';labelInput.value=customHistoryLabel(entry.entryLabel)||entryCell.textContent;labelInput.setAttribute('aria-label','Entry label');entryCell.replaceChildren();entryCell.appendChild(labelInput);tr.appendChild(entryCell);
        const numberInputs:Partial<Record<InputKey,HTMLInputElement>>={},overrideInputs:Partial<Record<keyof HistoryOverrides,HTMLInputElement>>={};
        const dateCell=document.createElement('td'),timeCell=document.createElement('td');
        if(date){
            const dateInput=document.createElement('input');
            dateInput.type='date'; dateInput.value=dateText; dateInput.min='0001-01-01'; dateInput.max='9999-12-31';
            dateInput.className='history-date-input'; dateInput.setAttribute('aria-label','Entry date for '+dateText+' '+timeText);
            const timeInput=document.createElement('input');
            timeInput.type='time'; timeInput.step='1'; timeInput.value=timeText;
            timeInput.className='history-date-input'; timeInput.setAttribute('aria-label','Entry time for '+dateText+' '+timeText);
            const saveButton=document.createElement('button');
            saveButton.type='button'; saveButton.textContent='Save'; saveButton.className='history-date-save';
            saveButton.title='Save this entry’s date, time and indicator values';
            saveButton.onclick=()=>{
                // Editing the saved timestamp never replaces explicitly displayed market inputs.
                const values={...entry.values};
                for(const [key] of columns){
                    const raw=requiredValue(numberInputs[key]).value.trim();
                    if(raw && !Number.isFinite(Number(raw))){ alert('Use a number, or leave unavailable indicators blank.'); return; }
                    values[key]=raw?Number(raw):null;
                }
                for(const [key] of forcedColumns){const raw=requiredValue(numberInputs[key]).value.trim();values[key]=raw===''?null:Number(raw);}
                const spRaw=requiredValue(numberInputs.sp500).value.trim();
                if(spRaw && (!Number.isFinite(Number(spRaw)) || Number(spRaw)<=0)){alert('S&P 500 close must be a positive number, or blank if unavailable.');return;}
                values.sp500 = spRaw ? Number(spRaw) : null;
                for(const [key,label] of marketColumns){const raw=requiredValue(numberInputs[key]).value.trim();if(raw&&(!Number.isFinite(Number(raw))||Number(raw)<=0)){alert(label+' must be positive.');return;}values[key]=raw?Number(raw):null;}
                for(const [key] of liquidityColumns){const raw=requiredValue(numberInputs[key]).value.trim();values[key]=raw===''?null:Number(raw);}
                let overrides;try{overrides=parseHistoryOverrides(overrideInputs,entry.historyOverrides||{},dateInput.value);}catch(error){alert(errorMessage(error));return;}
                updateEntryDateTime(entry,dateInput.value,timeInput.value,values,overrides,labelInput.value.trim());
            };
            dateCell.appendChild(dateInput); timeCell.appendChild(timeInput); timeCell.appendChild(saveButton);
        } else { dateCell.textContent=entry.reference?dateText:'—'; timeCell.textContent=entry.reference?'Daily close':'—'; }
        tr.appendChild(dateCell); tr.appendChild(timeCell);
        const score = compositeScore(entry.values,date ? dateText : localCalendarDate(new Date()));
        const scoreCell = document.createElement('td');
        const bounds=compositeRange(entry.values,date ? dateText : localCalendarDate(new Date()));
        scoreCell.textContent = bounds.low===bounds.high ? String(bounds.low) : bounds.low+'–'+bounds.high;
        scoreCell.className = bounds.low!==bounds.high ? 'history-normal' : score >= (isRegime ? maximum*0.67 : 16) ? 'history-red' : score >= (isRegime ? maximum*0.34 : 5) ? 'history-amber' : 'history-normal';
        scoreCell.title = 'Score out of 50. A range means new inputs are unavailable.';
        historyOverrideInput('composite','Composite Crash Risk Score',scoreCell.textContent,entry,scoreCell,overrideInputs,50);
        tr.appendChild(scoreCell);
        model50Cells(entry.values,date?dateText:localCalendarDate(new Date())).forEach((cell,i)=>{const td=document.createElement('td');const [key,label,max]=requiredValue(historyOverrideFields[i+1]);historyOverrideInput(key,label,cell.text,entry,td,overrideInputs,max);tr.appendChild(td);});
        const spCell=document.createElement('td');spCell.className='history-normal';
        const sp:{date:string;close:number;manual?:boolean}|null=finiteNumber(entry.values.sp500) ? {date:dateText,close:entry.values.sp500,manual:!entry.reference} : entry.reference?null:sp500ForDate(date ? dateText : localCalendarDate(new Date()));
        if(date){const input=document.createElement('input');input.type='number';input.step='.01';input.min='.01';input.value=sp ? sp.close.toFixed(2) : '';input.defaultValue=input.value;input.className='history-value-input history-normal';input.setAttribute('aria-label','S&P 500 close for '+dateText);numberInputs.sp500=input;spCell.appendChild(input);}
        else spCell.textContent=sp ? sp.close.toFixed(2) : '';
        spCell.title=sp ? (sp.manual ? 'User-entered S&P 500 close for ' : 'Sourced S&P 500 close for ')+sp.date : 'S&P 500 unavailable; enter a closing level if known';
        tr.appendChild(spCell);
        for(const [key,label] of marketColumns){
            const td=document.createElement('td');td.className='history-normal';const quote=marketForDate(key,date?dateText:localCalendarDate(new Date()),entry.values);
            td.title=quote?label+' · session '+quote.date:'Unavailable';
            if(date){const input=document.createElement('input');input.type='number';input.step='.01';input.min='.01';input.className='history-value-input history-normal';input.value=quote?quote.close.toFixed(2):'';input.defaultValue=input.value;input.setAttribute('aria-label',label+' for '+dateText);numberInputs[key]=input;td.appendChild(input);}else td.textContent=quote?quote.close.toFixed(2):'';
            tr.appendChild(td);
        }
        for(const [key,label] of liquidityColumns){const td=document.createElement('td');const input=document.createElement('input');input.type='number';input.step=key==='cp_date'?'1':'any';input.className='history-value-input history-normal';input.value=String(entry.values[key]??'');input.setAttribute('aria-label',label+' for '+dateText);numberInputs[key]=input;td.appendChild(input);if(key!=='cp_date'){const note=document.createElement('div');note.className='table-note';note.textContent='Observed: '+(liquidityDate(entry.values[`${key}_date`]??entry.values.cp_date)||'Unavailable');td.appendChild(note);}tr.appendChild(td);}
        columns.forEach(([key])=>{
            const value=entry.values[key], risk=historyRisk(key,value,entry.values),td=document.createElement('td');
            if(date){
                const input=document.createElement('input'); input.type='number'; input.step='any'; input.value=Number.isFinite(value)?String(value):'';
                input.className='history-value-input '+risk.className;
                input.setAttribute('aria-label',key+' for '+dateText+' '+timeText);
                input.oninput=()=>{
                    const edited={...entry.values};columns.forEach(([k])=>{const text=numberInputs[k]?.value.trim();edited[k]=text?Number(text):null;});columns.forEach(([k])=>{requiredValue(numberInputs[k]).className='history-value-input '+(Number.isFinite(edited[k])?historyRisk(k,edited[k],edited).className:'history-normal');});
                };
                numberInputs[key]=input; td.appendChild(input);
            } else { td.textContent=Number.isFinite(value)?String(value):''; td.className=risk.className; }
            td.title=key==='jpy'?'USDJPY level is reference only. Risk comes from the separate 3-session change.':risk.points+' / '+risk.max+' risk points'; tr.appendChild(td);
        });
        const inferred=forcedInputsForDate(date ? dateText : localCalendarDate(new Date()));
        forcedColumns.forEach(([key,label])=>{const td=document.createElement('td');const value=entry.reference?entry.values[key]:entry.values[key]??inferred[key];if(date){const input=document.createElement('input');input.type='number';input.step='any';input.value=Number.isFinite(value)?String(value):'';input.defaultValue=input.value;input.className='history-value-input '+forcedFieldRisk(key,{...inferred,...entry.values},dateText);input.setAttribute('aria-label',label+' for '+dateText);input.oninput=()=>{const values={...inferred,...entry.values};forcedColumns.forEach(([k])=>{const raw=numberInputs[k]?.value.trim();values[k]=raw?Number(raw):null;});forcedColumns.forEach(([k])=>{requiredValue(numberInputs[k]).className='history-value-input '+forcedFieldRisk(k,values,dateText);});};numberInputs[key]=input;td.appendChild(input);}else {td.textContent=Number.isFinite(value)?String(value):'';td.className=forcedFieldRisk(key,{...inferred,...entry.values},date?dateText:localCalendarDate(new Date()));}td.title='Color follows the related currency-momentum, margin or selling-volume risk rule; missing data stays white.';tr.appendChild(td);});
        const previousEntry=entries[start+index+1];
        if(previousEntry){
            if(!comparisonCache.has(previousEntry))comparisonCache.set(previousEntry,historyComparisonValues(previousEntry));
            const previous=requiredValue(comparisonCache.get(previousEntry)),previousDate=previousEntry.observationDate||new Date(previousEntry.savedAt||Date.now()).toLocaleString();
            for(const [key,input] of Object.entries({...numberInputs,...overrideInputs})){
                const raw=String(input.value??'').trim(),value=raw!==''?Number(raw):null;
                applyHistoryChangeOutline(input.parentNode as HTMLElement,key,value,previous[key],previousDate);
            }
        }
        body.appendChild(tr);
    });
}

function getStatus(points:number,maxPoints:number){

    if(points === 0)
        return ["Green","status-green"];

    if(points >= maxPoints)
        return ["Red","status-red"];

    return ["Amber","status-amber"];
}


/* =========================================================
   RENDER TABLE
   ========================================================= */
