/* BUILD:DATA:commercialPaperDaily */
function cpSpreads(row:[string,number|null,number|null,number|null]):CPObservation{const difference=(a:NumericInput,b:NumericInput)=>finiteNumber(a)&&finiteNumber(b)?Math.round((a-b)*10000)/100:null;return {date:row[0],financial:row[1],nonfinancial:row[2],treasury:row[3],sector:difference(row[1],row[2]),financialBill:difference(row[1],row[3]),nonfinancialBill:difference(row[2],row[3])};}
function liquidityDate(n:NumericInput){const text=String(n);if(!/^\d{8}$/.test(text))return null;const d=text.slice(0,4)+'-'+text.slice(4,6)+'-'+text.slice(6);return Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null;}
const cpRateKeys=['cp_financial','cp_nonfinancial','cp_treasury'] as const;
function cpObservationDates(v:MarketValues){return cpRateKeys.map(k=>liquidityDate(v[`${k}_date`]??v.cp_date));}
function hasSeparateCpDates(v:MarketValues){return cpRateKeys.some(k=>v[`${k}_date`]!=null);}
function mixedCpDates(v:MarketValues){return new Set(cpObservationDates(v)).size>1;}
function validateLiquidityInputs(v:MarketValues){
    if(!liquidityColumns.some(([k])=>v[k]!=null)&&!hasSeparateCpDates(v))return null;
    if(cpObservationDates(v).some(d=>!d||d>localCalendarDate(new Date())))return 'Every rate needs a valid observation date (YYYYMMDD), not in the future.';
    if(!cpRateKeys.every(k=>finiteNumber(v[k])&&v[k]>=-10&&v[k]<=100))return 'Supply all three CP/Treasury rates in percent with their observation dates.';
    return null;
}
function liquidityHistoryRows(entries:HistoryEntry[]=entryHistory):CPObservation[]{
    const byDate=new Map<string,CPObservation>(commercialPaperDaily.map(r=>[r[0],cpSpreads(r)]));
    if(fredLiveData)fredLiveData.rows.forEach(r=>byDate.set(r[0],{...cpSpreads(r),live:true}));
    [...entries].sort((a,b)=>Date.parse(a.cpCheckedAt||a.updatedAt||a.savedAt)-Date.parse(b.cpCheckedAt||b.updatedAt||b.savedAt)).forEach(r=>{const v=r.values;if(v.cp_date==null||validateLiquidityInputs(v)||mixedCpDates(v))return;const date=requiredValue(liquidityDate(v.cp_date)),existing=byDate.get(date);if(existing?.live&&[existing.financial,existing.nonfinancial,existing.treasury].every(Number.isFinite)&&Date.parse(requiredValue(fredLiveData).fetchedAt)>Date.parse(r.cpCheckedAt||r.updatedAt||r.savedAt))return;byDate.set(date,{...cpSpreads([date,requiredValue(v.cp_financial),requiredValue(v.cp_nonfinancial),requiredValue(v.cp_treasury)]),manual:true});});
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
type MomentumRow=import('../core/types').MomentumRow;
let momentumRowsCache:{quotes:EquityObservation[];today:string;rows:MomentumRow[]}|null=null;
function relativeMomentumRows(){
    const quotes=appEquityRows(),today=localCalendarDate(new Date());
    if(momentumRowsCache?.quotes===quotes&&momentumRowsCache.today===today)return momentumRowsCache.rows;
    // Use unique matched observations, not a synthetic consecutive weekday calendar.
    // appEquityRows merges duplicate dates before this step.
    const rows=DashboardCore.matchedMomentumRows(quotes,today);
    momentumRowsCache={quotes,today,rows};return rows;
}
type DiagnosticKey='sector'|'financialBill'|'nonfinancialBill'|'momentum';
type DiagnosticRow={date:string}&Partial<Record<DiagnosticKey,number|null>>;
type DiagnosticResult={key:DiagnosticKey;exceptions:string[];baselineDays?:number;date?:string}&(
 {state:'unavailable';reason:string} | {state:'watch';value:number;threshold:number;previous:number;previousDate:string;count:number} | {state:'not-triggered';value:number;threshold:number;previous:number;previousDate:string;count:number});
function diagnosticWatch(rows:DiagnosticRow[],key:DiagnosticKey,day:string,direction:'high'|'low'):DiagnosticResult{
    const end=Date.parse(day),valid=rows.filter((r):r is DiagnosticRow&Record<DiagnosticKey,number>=>r.date<=day&&finiteNumber(r[key])).sort((a,b)=>a.date.localeCompare(b.date)),latest=valid.at(-1),exceptions:string[]=[];
    if(!latest)return {key,state:'unavailable',reason:'No valid observations',exceptions};
    const age=Math.floor((end-Date.parse(latest.date))/86400000);
    if(age>7)exceptions.push('Latest observation is '+age+' calendar days old; assessment describes that observation, not current conditions');
    let prior=valid.filter(r=>r.date<latest.date&&Date.parse(r.date)>=Date.parse(latest.date)-365*86400000),baselineDays=365;
    if(!prior.length){baselineDays=1827;prior=valid.filter(r=>r.date<latest.date&&Date.parse(r.date)>=Date.parse(latest.date)-baselineDays*86400000);if(prior.length)exceptions.push('No prior-year observations; using available history up to five years');}
    const previous=prior.at(-1);
    if(!previous)return {key,state:'unavailable',date:latest.date,reason:'No earlier valid observation to calculate a percentile and direction',exceptions};
    if(prior.length<60)exceptions.push('Limited sample: '+prior.length+' prior observations used instead of the preferred 60; percentile is less stable');
    const comparisonGap=Math.round((Date.parse(latest.date)-Date.parse(previous.date))/86400000);
    if(comparisonGap>7)exceptions.push('Direction compares with '+previous.date+', '+comparisonGap+' calendar days earlier (beyond the preferred 7 days)');
    if(direction==='low'){const index=rows.indexOf(latest);if(index<1||rows[index-1]!==previous)exceptions.push('Previous session momentum unavailable; direction uses the last valid observation on '+previous.date);}
    const sorted=prior.map(r=>r[key]).sort((a,b)=>a-b),threshold=requiredValue(sorted[Math.ceil(sorted.length*(direction==='high'?.9:.1))-1]),value=latest[key];
    const flagged=direction==='high'?value>0&&value>=threshold&&value>previous[key]:value<0&&value<=threshold&&value<previous[key];
    return {key,state:flagged?'watch':'not-triggered',date:latest.date,value,threshold,previous:previous[key],previousDate:previous.date,count:prior.length,baselineDays,exceptions};
}
function renderDiagnosticAlerts(cp:CPObservation[],rotation:MomentumRow[],end:string,historical:boolean){
    const definitions:[DiagnosticKey,string,string,'high'|'low',DiagnosticRow[]][]=[['sector','Financial minus nonfinancial CP','bp','high',cp],['financialBill','Financial CP minus Treasury bills','bp','high',cp],['nonfinancialBill','Nonfinancial CP minus Treasury bills','bp','high',cp],['momentum','Nasdaq leadership momentum','%','low',rotation]];
    const host=requiredElement('liquidityAlerts');host.hidden=!historical;host.replaceChildren();
    const heading=document.createElement('strong');heading.textContent=historical?'Watch conditions at study end · retrospective':'Current diagnostic watch alerts';host.appendChild(heading);
    definitions.forEach(([key,label,unit,direction,rows])=>{const result=diagnosticWatch(rows,key,end,direction),p=document.createElement('p');p.className=result.state==='watch'?'history-amber':'table-note';p.style.margin='8px 0';
        const latestValid=rows.filter(r=>r.date<=end&&Number.isFinite(r[key])).at(-1);const fiveYearCount=latestValid?rows.filter(r=>r.date<latestValid.date&&Date.parse(r.date)>=Date.parse(latestValid.date)-5*365.25*86400000&&Number.isFinite(r[key])).length:0;
        p.textContent=label+': '+(result.state==='watch'?'WATCH — '+result.value.toFixed(2)+' '+unit+' on '+result.date+'; '+(direction==='high'?'at or above the 90th-percentile boundary and rising':'at or below the 10th-percentile boundary and falling')+' (boundary '+result.threshold.toFixed(2)+' '+unit+', '+result.count+' prior observations).':result.state==='not-triggered'?'No watch condition triggered on '+result.date+'; this does not establish low risk.':result.reason+(result.date?' ('+result.date+')':'')+'; alert unavailable.')+' Five-year context: '+fiveYearCount+' valid prior observations; '+(result.baselineDays===1827?'five-year fallback baseline used.':'alert baseline is the preceding year.');host.appendChild(p);
    });
}
function renderLiquidityDiagnostics(){
    const sourceStatus=document.getElementById('cpDownloadStatus');if(sourceStatus){if(!sourceStatus.dataset["embedded"])sourceStatus.dataset["embedded"]=sourceStatus.textContent||'Embedded source downloaded September 25, 2026.';sourceStatus.textContent=fredLiveData?'FRED data fetched '+displayUpdateTime(fredLiveData.fetchedAt)+'.':sourceStatus.dataset["embedded"];}
    const host=requiredElement('liquidityDiagnosticRows');if(!host)return;
    const period=requiredElement('liquidityPeriod').value;
    const windows:Record<string,[string,string]>={'2020':['2019-11-01','2020-05-31'],'2008':['2008-05-01','2008-11-30'],'2000':['1999-11-01','2000-05-31']};
    const chosen=windows[period],range=chartWindow(requiredElement('liquidityRange').value||'9m');
    requiredElement('liquidityRange').disabled=!!chosen;
    const begin=chosen?chosen[0]:localCalendarDate(range.start),end=chosen?chosen[1]:localCalendarDate(range.end);
    renderOpeningOverview();
    const cp=liquidityHistoryRows(),cpMap=new Map(cp.map(r=>[r.date,r])),rotation=relativeMomentumRows(),rotationMap=new Map(rotation.map(r=>[r.date,r]));
    renderDiagnosticAlerts(cp,rotation,end,!!chosen);
    const dates=[...new Set([...cpMap.keys(),...rotationMap.keys()])].filter(d=>d>=begin&&d<=end).sort();
    const f=(n:NumericInput)=>finiteNumber(n)?n.toFixed(2):'—';
    const latest=cp.filter(r=>r.date<=end&&Number.isFinite(r.sector)).at(-1);
    requiredElement('liquiditySummary').textContent=latest?'Latest paired CP observation by period end: '+latest.date+' · financial minus nonfinancial '+f(latest.sector)+' bp · '+Math.max(0,Math.floor((Date.parse(end)-Date.parse(latest.date))/86400000))+' calendar days before period end. '+(latest.manual?'Saved input. ':latest.live?'FRED download. ':'Embedded source. ')+'No newer observation is implied. Missing dates remain unavailable.':'No paired CP observation available by period end.';
    host.innerHTML=[...dates].reverse().map(d=>{const r:Partial<CPObservation>=cpMap.get(d)||{},m:Partial<MomentumRow>=rotationMap.get(d)||{};return '<tr><td>'+d+'</td>'+[r.financial,r.nonfinancial,r.treasury,r.sector,r.financialBill,r.nonfinancialBill,m.momentum,m.sp500].map(n=>'<td class="history-normal">'+f(n)+'</td>').join('')+marketCells(d,marketValuesForDay(d))+'</tr>';}).join('');
    const plot=(id:string,series:DiagnosticRow[],defs:[DiagnosticKey,string,string][],label:string)=>{
        const svg=document.getElementById(id);if(!(svg instanceof SVGElement))return;svg.replaceChildren();const a=Date.parse(begin),b=Date.parse(end)+86400000,x=(t:number)=>55+(t-a)/(b-a)*810;
        const add=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;};
        const values=series.flatMap(r=>defs.map(d=>r[d[0]])).filter(finiteNumber),lo=Math.min(0,...values),hi=Math.max(1,...values),pad=Math.max((hi-lo)*.08,1),y=(n:number)=>282-(n-lo+pad)/(hi-lo+2*pad)*258;
        for(let i=0;i<5;i++){const n=lo+(hi-lo)*i/4;add('line',{x1:55,x2:865,y1:y(n),y2:y(n),stroke:'#334155'});add('text',{x:45,y:y(n)+4,fill:'#94a3b8','text-anchor':'end','font-size':11},n.toFixed(1));const t=a+(b-a)*i/4;add('text',{x:x(t),y:307,fill:'#94a3b8','font-size':10,'text-anchor':i===4?'end':i===0?'start':'middle'},new Date(t).toISOString().slice(0,10));}
        add('text',{x:55,y:15,fill:'#94a3b8','font-size':11},label);
        defs.forEach(([key,color,name])=>{let segment:string[]=[];const flush=()=>{if(segment.length)add('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':2});segment=[];};series.forEach(r=>{const v=r[key];if(!finiteNumber(v)){flush();return;}segment.push(x(Date.parse(r.date))+','+y(v));const dot=add('circle',{cx:x(Date.parse(r.date)),cy:y(v),r:2,fill:color});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=r.date+' · '+name+' '+v.toFixed(2);dot.appendChild(title);});flush();});
        if(!values.length)add('text',{x:55,y:75,fill:'#94a3b8'},'No verified observations in this window');
        add('line',{x1:55,x2:865,y1:y(0),y2:y(0),stroke:'#cbd5e1','stroke-dasharray':'5 5',opacity:.7});
        drawSp500Overlay(svg,sp500ChartPoints(new Date(begin+'T00:00:00'),new Date(end+'T23:59:59')),x,{legendY:353,dashes:true});
    };
    plot('cpDiagnosticChart',cp.filter(r=>r.date>=begin&&r.date<=end),[['sector','#60a5fa','Financial − nonfinancial bp']],'Financial − nonfinancial · bp');
    plot('cpFinancialChart',cp.filter(r=>r.date>=begin&&r.date<=end),[['financialBill','#c084fc','Financial − Treasury bp']],'Financial − Treasury · bp');
    plot('cpNonfinancialChart',cp.filter(r=>r.date>=begin&&r.date<=end),[['nonfinancialBill','#2dd4bf','Nonfinancial − Treasury bp']],'Nonfinancial − Treasury · bp');
    plot('rotationDiagnosticChart',rotation.filter(r=>r.date>=begin&&r.date<=end),[['momentum','#60a5fa','20-matched-observation relative momentum %']],'Relative momentum · %');
}
document.addEventListener('DOMContentLoaded',renderLiquidityDiagnostics);
