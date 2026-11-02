/* BUILD:DATA:momentumDiagnostics */
function momentumForDate(day:string){const row=momentumDiagnostics.filter(r=>r.date<=day).at(-1);return row&&(Date.parse(day)-Date.parse(row.date))/86400000<=4?row:null;}
function momentumClass(value:NumericInput,kind:string,distance?:NumericInput){if(!finiteNumber(value))return 'history-normal';const level=kind==='fx'?(value<=-3?2:value<=-1.5?1:0):(distance??0)<0?(value<=-5?2:value<=-3?1:0):0;return pointColor(level);}
function providerObject(value:unknown):Record<string,unknown>{
    if(!value||typeof value!=='object'||unknownArray(value))throw Error('Provide a JSON object.');
    return value as Record<string,unknown>;
}
function convertProviderData(payload:unknown){
    const data=providerObject(payload),asOf=data["asOf"];
    if(typeof asOf!=='string')throw Error('asOf must be a valid completed-session date, not a future date.');
    const m=providerObject(data["marketData"]),o=providerObject(data["optionsData"]),c=providerObject(data["creditData"]),f=providerObject(data["finraData"]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf+'T00:00:00Z').toISOString().slice(0,10)!==asOf||asOf>localCalendarDate(new Date()))throw Error('asOf must be a valid completed-session date, not a future date.');
    if(!m||!o||!c||!f)throw Error('Provide marketData, optionsData, creditData and finraData objects.');
    if([m,o,c].some(x=>x["asOf"]!==asOf))throw Error('Market, options and credit observations must share the declared asOf date.');
    if(c["spreadUnit"]!=='bp'||m["yieldUnit"]!=='percent'||m["yieldChangeUnit"]!=='bp'||m["volumeUnit"]!=='shares')throw Error('Required units: spreadUnit bp; yieldUnit percent; yieldChangeUnit bp; volumeUnit shares.');
    const rawObservations:unknown=m["trailing_20d_volumes_list"];
    if(!unknownArray(rawObservations)||rawObservations.length!==20)throw Error('Provide exactly 20 preceding sessions as {date,volume} objects.');
    const observations:{date:string;volume:number}[]=[];
    const seen=new Set<string>();let previous='';
    for(const item of rawObservations as unknown[]){const r=providerObject(item);if(typeof r["date"]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r["date"])||!Number.isFinite(Date.parse(r["date"]))||r["date"]>=asOf||r["date"]<=previous||seen.has(r["date"])||!finiteNumber(r["volume"])||r["volume"]<=0)throw Error('Volume history must contain 20 distinct, ascending prior-session dates and positive volumes.');previous=r["date"];seen.add(r["date"]);observations.push({date:r["date"],volume:r["volume"]});}
    if(Date.parse(asOf)-Date.parse(requiredValue(observations[0]).date)>45*86400000)throw Error('Volume history is too old to represent the preceding 20 sessions.');
    const debt=f["total_debt_balance_usd"];
    if(f["debtUnit"]!=='USD'&&f["debtUnit"]!=='USD million')throw Error('Declare finraData.debtUnit as USD or USD million.');
    if(debt!=null&&!finiteNumber(debt))throw Error('Debt must be a number or null.');
    if(debt!=null&&(typeof f["publishedAt"]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(f["publishedAt"])||!Number.isFinite(Date.parse(f["publishedAt"]))||f["publishedAt"]>asOf))throw Error('Debt requires a publication date no later than asOf.');
    const raw=[o["current_vix"],o["vix_daily_change"],o["vix_5d_change"],c["high_yield_oas"],c["hy_oas_5d_delta"],c["hy_oas_20d_delta"],c["bbb_oas"],m["us_10y_yield"],m["yield_20d_delta"],m["sp500_dist_50dma"],m["sp500_dist_200dma"],m["wti_crude_price"],m["wti_20d_change"],m["ice_move_index"],m["forex_usd_jpy"],m["sp500_breadth"],m["breadth_20d_delta"],o["vix3m_vix_spread"],m["sp500_close"],f["published_month"],debt==null?null:debt/(f["debtUnit"]==='USD'?1e6:1),f["debt_yoy_percentage"],f["debt_3m_percentage"],m["current_session_volume"],observations.reduce((n,r)=>n+r.volume,0)/20,m["sp500_1d_pct"],m["forex_usd_jpy_3d_pct"]??null,m["sp500_high"]??null,m["sp500_low"]??null,m["nasdaq_close"]??null,m["nasdaq100_close"]??null,m["cp_date"]??null,m["cp_financial"]??null,m["cp_nonfinancial"]??null,m["cp_treasury"]??null];
    raw.forEach((v,i)=>{if(v===null)return;if(!Number.isFinite(v))throw Error('Missing or nonnumeric field: '+requiredValue(inputColumns[i])[1]);});
    const values:MarketValues={};inputColumns.forEach(([key],i)=>{values[key]=nullableNumber(raw[i]);});
    const error=validateForcedInputs(values);if(error)throw Error(error);
    if((finiteNumber(values.sp500)&&values.sp500<=0)||(finiteNumber(values.vix)&&values.vix<0)||(finiteNumber(values.jpy)&&values.jpy<=0)||(finiteNumber(values.breadth)&&(values.breadth<0||values.breadth>100)))throw Error('Price, VIX, USDJPY or breadth is outside its valid range.');
    if(values.margin_month!=null&&String(values.margin_month)>asOf.slice(0,7).replace('-',''))throw Error('Debt reference month cannot be after the observation date.');
    return {asOf,values,csv:raw.map(v=>v===null?'null':String(v)).join(',')};
}
function yenMomentumPoints(change:NumericInput){return DashboardCore.yenMomentumPoints(change??0);}
function jpyMomentum(values:MarketValues,day?:string){
    if(Object.hasOwn(values,'jpy3d'))return finiteNumber(values.jpy3d)?values.jpy3d:null;
    const date=day??(currentEntryTime?localCalendarDate(new Date(currentEntryTime)):localCalendarDate(new Date()));
    return momentumForDate(date)?.jpy3d??null;
}

/* BUILD:DATA:sp500Ranges */
function sessionRangeForDate(day:string){const close=sp500ForDate(day);return close?sp500Ranges[close.date]??{}:{};}
function sellingVolumeRange(v:MarketValues){return DashboardCore.sellingVolumeRange(v);}
function renderGroupedFactors(tbody:HTMLElement,values:MarketValues,day?:string){
    tbody.replaceChildren();const f=forcedPoints(values,day);
    const categoryNames:Record<string,string>={volatilityChart:'Volatility Regime',creditChart:'Credit Regime',macroChart:'Macro Shock',equityChart:'Equity Structure',forcedChart:'Forced Selling'};
    for(const [id,category] of Object.entries(regimeCharts)){
        const heading=document.createElement('tr');heading.className='factor-category';const th=document.createElement('th');th.colSpan=4;th.scope='colgroup';th.textContent=categoryNames[id]+' · Maximum '+category.maximum+' points';heading.appendChild(th);tbody.appendChild(heading);
        const factors=category.keys.map(key=>{const extra=(key==='cp_stress'||key==='leadership')?model50Inputs(values,day):null;const val=key==='cp_stress'?(extra?.cp?cpStressPoints(extra.cp.sector,extra.cp.financialBill):null):key==='leadership'?extra?.momentum:key==='jpy'?jpyMomentum(values,day):values[key];return {name:metricConfig[key].name,value:finiteNumber(val)?metricConfig[key].format(val)+(key==='jpy'?'%':''):'Unavailable',...metricPointRange(key,values,day),max:metricConfig[key].maxPoints};});
        if(category.forced)factors.push({name:'Margin leverage pressure',value:f.leverage===null?'Unavailable':String(f.leverage),low:f.leverage??0,high:f.leverage??2,max:2},{name:'Selling volume pressure',value:f.pressure===null?'Incomplete':String(f.pressure),low:f.pressureLow,high:f.pressureHigh,max:2});
        factors.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}));
        for(const factor of factors){const row=document.createElement('tr');const score=factor.low===factor.high?String(factor.low):factor.low+'–'+factor.high;const color=factor.low!==factor.high?'history-normal':factor.low===0?'history-normal':factor.low===factor.max?'history-red':'history-amber';for(const text of [factor.name,factor.value,factor.low!==factor.high?'Incomplete':factor.low===0?'Calm':factor.low===factor.max?'Stressed':'Watch',score+' / '+factor.max]){const td=document.createElement('td');td.textContent=text;td.className=color;row.appendChild(td);}tbody.appendChild(row);}
    }
}
