/* BUILD:DATA:sp500Daily */
/* BUILD:DATA:nasdaqDaily */

function marketForDate(key: 'nasdaq'|'nasdaq100',day: string,values?: MarketValues){
    if(values&&finiteNumber(values[key])&&values[key]>0)return {date:day,close:values[key]};
    const rows=nasdaqDaily[key];if(!rows||day>localCalendarDate(new Date()))return null;
    let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(requiredValue(rows[mid])[0]<=day)lo=mid+1;else hi=mid;}
    const r=rows[lo-1];return r&&Date.parse(day)-Date.parse(r[0])<=4*86400000?{date:r[0],close:r[1]}:null;
}
function marketCells(day: string,values?: MarketValues){return marketColumns.map(([key])=>{const q=marketForDate(key,day,values);return '<td class="history-normal" title="'+(q?'Session '+q.date:'Unavailable')+'">'+(q?q.close.toFixed(2):'—')+'</td>';}).join('');}
let marketLookupCache: {rows:EquityObservation[];byDate:Map<string,EquityObservation>}|null=null;
function marketValuesForDay(day: string){const rows=appEquityRows();if(marketLookupCache?.rows!==rows)marketLookupCache={rows,byDate:new Map(rows.map(r=>[r.date,r]))};return marketLookupCache.byDate.get(day);}

function sp500ForDate(day: string){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || day>localCalendarDate(new Date()))return null;
    let lo=0,hi=sp500Daily.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(requiredValue(sp500Daily[mid])[0]<=day)lo=mid+1;else hi=mid;}
    const row=sp500Daily[lo-1];
    if(!row || (Date.parse(day+'T00:00:00Z')-Date.parse(row[0]+'T00:00:00Z'))/86400000>4)return null;
    return {date:row[0],close:row[1]};
}
function localCalendarDate(date: Date){
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
// All index overlays share one rebased scale; actual closes remain in tooltips and tables.
function drawSp500Overlay(svg: SVGElement,points: ChartPoint[],x: (time:number)=>number,options: OverlayOptions={}){
    const add=(tag: string,attrs: { [s: string]: unknown; }|ArrayLike<unknown>,text?: string)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;};
    const top=options.top??24,bottom=options.bottom??282,right=options.right??865,legendY=options.legendY??332;
    const aligned=points.map(p=>({...p,quotes:marketColumns.map(([key])=>{const q=marketForDate(key,p.date,marketValuesForDay(p.date));return q&&q.date===p.date?q:null;})}));
    const baseline=aligned.find(p=>finiteNumber(p.close)&&p.close>0&&p.quotes.every(q=>q&&q.date===p.date));
    if(!baseline){add('text',{x:55,y:legendY,fill:'#94a3b8','font-size':11},'No common session for three-index comparison');return;}
    type AlignedPoint=typeof aligned[number];
    const defs:[string,string,(p:AlignedPoint)=>NumericInput,number][]=[['S&P 500','#34d399',(p)=>p.close,requiredValue(baseline.close)],['Nasdaq Composite','#d946ff',(p)=>p.quotes[0]?.close,requiredValue(baseline.quotes[0]).close],['Nasdaq 100','#00bfff',(p)=>p.quotes[1]?.close,requiredValue(baseline.quotes[1]).close]];
    const selected=aligned.filter(p=>p.time>=baseline.time);
    const numbers=defs.flatMap(d=>selected.map(p=>d[2](p)).filter(finiteNumber).map(n=>n/d[3]*100));const min=Math.min(...numbers),max=Math.max(...numbers),pad=Math.max((max-min)*.08,1),low=min-pad,high=max+pad,y=(n:number)=>bottom-(n-low)/(high-low)*(bottom-top);
    add('text',{x:right,y:15,fill:'#cbd5e1','font-size':11,'text-anchor':'end'},'Indexes · first common session = 100');
    for(let i=0;i<=4;i++){const n=low+(high-low)*i/4;add('text',{x:right+8,y:y(n)+4,fill:'#cbd5e1','font-size':11},n.toFixed(1));}
    defs.forEach(([label,color,get,base],i)=>{
        let segment: string[]=[];const flush=()=>{if(segment.length)add('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':1.8,'stroke-dasharray':i===2?'2 4':options.dashes&&i===1?'7 4':'none'});segment=[];};
        selected.forEach(p=>{const close=get(p);if(!finiteNumber(close)){flush();return;}const n=close/base*100;segment.push(x(p.time)+','+y(n));const dot=add('circle',{cx:x(p.time),cy:y(n),r:2,fill:color});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=p.date+' · '+label+' close '+close.toFixed(2)+' · rebased '+n.toFixed(2);dot.appendChild(title);});flush();
        add('text',{x:55+i*255,y:legendY,fill:color,'font-size':11},label+' · '+baseline.date+' = 100');
    });
}
function sp500ChartPoints(start: Date,end: Date){
    const byDate=new Map<string,ChartPoint>(sp500Daily.map(([date,close])=>[date,{date,close,time:new Date(date+'T00:00:00').getTime()}]));
    for(const [date] of nasdaqDaily.nasdaq)if(!byDate.has(date))byDate.set(date,{date,close:null,time:new Date(date+'T00:00:00').getTime()});
    // The most recent saved entry for a calendar date overrides that day's sourced close.
    historyDisplayEntries().sort((a,b)=>Date.parse(a.savedAt)-Date.parse(b.savedAt)).forEach(row=>{
        if(Date.parse(row.savedAt)>end.getTime())return;
        const date=entryEquityDay(row);
        byDate.set(date,{date,close:finiteNumber(row.values.sp500)&&row.values.sp500>0?row.values.sp500:byDate.get(date)?.close??null,time:new Date(date+'T00:00:00').getTime(),manual:true});
    });
    return [...byDate.values()].filter(p=>p.time>=start.getTime()&&p.time<=end.getTime()).sort((a,b)=>a.time-b.time);
}

