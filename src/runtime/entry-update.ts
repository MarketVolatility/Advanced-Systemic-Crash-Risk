// Match saved closes to a verified session, independently of the browser's timezone.
let equitySessionLookup: Map<string,{date:string;nasdaq:number|undefined}[]>|null=null;
function matchedEquitySession(values: MarketValues,day: string){
    if(!(finiteNumber(values.sp500)&&values.sp500>0&&finiteNumber(values.nasdaq100)&&values.nasdaq100>0))return null;
    if(!equitySessionLookup){
        const sp=new Map(sp500Daily),nd=new Map(nasdaqDaily.nasdaq);
        equitySessionLookup=new Map();
        for(const [date,close] of nasdaqDaily.nasdaq100){
            if(!sp.has(date))continue;
            const key=requiredValue(sp.get(date)).toFixed(2)+'|'+close.toFixed(2);
            const rows=equitySessionLookup.get(key)||[];
            rows.push({date,nasdaq:nd.get(date)});equitySessionLookup.set(key,rows);
        }
    }
    const rows=equitySessionLookup.get(values.sp500.toFixed(2)+'|'+values.nasdaq100.toFixed(2))||[];
    return rows.findLast((r)=>r.date<=day&&Date.parse(day)-Date.parse(r.date)<=4*86400000&&(!finiteNumber(values.nasdaq)||Math.abs(values.nasdaq-requiredValue(r.nasdaq))<.011))?.date||null;
}
function entryEquityDay(row: HistoryEntry){const day=row.observationDate||localCalendarDate(new Date(row.savedAt));return row.values.equitySessionDate||matchedEquitySession(row.values,day)||day;}
let appEquityCache: {entries:HistoryEntry[];count:number;rows:EquityObservation[]}|null=null;
function appEquityRows(entries: HistoryEntry[]=entryHistory){
    if(entries===entryHistory&&appEquityCache?.entries===entries&&appEquityCache.count===entries.length)return appEquityCache.rows;
    const rows=new Map<string,EquityObservation>();
    for(const [day,close] of sp500Daily)rows.set(day,{date:day,sp500:close});
    for(const [key,series] of ([['nasdaq',nasdaqDaily.nasdaq],['nasdaq100',nasdaqDaily.nasdaq100]] as const))for(const [day,close] of series){const row=rows.get(day)||{date:day};row[key]=close;rows.set(day,row);}
    for(const row of marketHistoryReference){const day=entryEquityDay(row),source:MarketValues=rows.get(day)||{},merged:EquityObservation={...row.values,date:day};for(const key of (['sp500','nasdaq','nasdaq100'] as const))if(finiteNumber(source[key]))merged[key]=source[key];rows.set(day,merged);}
    for(const row of [...entries].sort((a,b)=>Date.parse(a.updatedAt||a.savedAt)-Date.parse(b.updatedAt||b.savedAt))){
        const day=entryEquityDay(row),old=rows.get(day)||{date:day};const next={...old};
        for(const key of (['sp500','nasdaq','nasdaq100','sp_high','sp_low','volume','volume_avg','sp500_chg','dma50','dma200'] as const))if(finiteNumber(row.values[key]))next[key]=row.values[key];
        rows.set(day,next);
    }
    const result=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
    if(entries===entryHistory)appEquityCache={entries,count:entries.length,rows:result};
    return result;
}
function prepareCompositeUpdate(values: MarketValues,day: string,now: string){
    const next={...values},notices=[],equities=appEquityRows().filter(r=>r.date<=day);
    const supplied=(['sp500','nasdaq','nasdaq100'] as const).filter(k=>finiteNumber(next[k]));
    // Fill missing indexes only from a matching dated group, never unrelated sessions.
    const match=equities.filter(r=>(!next.equitySessionDate||r.date===next.equitySessionDate)&&supplied.every(k=>finiteNumber(r[k])&&Math.abs(r[k]-requiredValue(next[k]))<.011)&&(['sp500','nasdaq','nasdaq100'] as const).every(k=>finiteNumber(r[k]))).at(-1);
    const sameDay=equities.find(r=>r.date===(next.equitySessionDate||day));
    const source=match||(sameDay&&supplied.every(k=>!finiteNumber(sameDay[k])||Math.abs(sameDay[k]-requiredValue(next[k]))<.011)?sameDay:null);
    if(source){
        for(const k of (['sp500','nasdaq','nasdaq100'] as const))if(!finiteNumber(next[k]))next[k]=source[k]??null;
        next.equitySessionDate=source.date;
        if(!supplied.length)for(const k of (['sp_high','sp_low','volume','volume_avg','sp500_chg','dma50','dma200'] as const))next[k]=source[k]??null;
        notices.push('Equity fields refreshed from '+source.date+'.');
    }
    for(const k of (['sp500','nasdaq','nasdaq100'] as const))if(!finiteNumber(next[k]))next[k]=null;
    if(hasSeparateCpDates(next)&&!validateLiquidityInputs(next)){next.cp_date=Math.max(...cpObservationDates(next).map(d=>Number(requiredValue(d).replaceAll('-',''))));notices.push('CP rates retained with their individual observation dates.');return {values:next,notices};}
    const candidate={savedAt:now,cpCheckedAt:now,values:next};
    const cp=liquidityHistoryRows([...entryHistory,candidate]).filter(r=>r.date<=day&&[r.financial,r.nonfinancial,r.treasury].every(finiteNumber)).at(-1);
    if(cp){Object.assign(next,{cp_date:Number(cp.date.replaceAll('-','')),cp_financial:cp.financial,cp_nonfinancial:cp.nonfinancial,cp_treasury:cp.treasury});notices.push('Matched CP rates refreshed from '+cp.date+'.');}
    else for(const [k] of liquidityColumns)next[k]=null;
    return {values:next,notices};
}
function reconcileCompositeEntries(entries: HistoryEntry[]){
    const cp=new Map(liquidityHistoryRows(entries).map(r=>[r.date,r]));
    const equities=new Map(appEquityRows(entries).map(r=>[r.date,r]));let corrected=0,cleared=0;
    const rows=entries.map(row=>{
        const values={...row.values},overrides={...row.historyOverrides};let changed=false;
        const rate=hasSeparateCpDates(values)?null:cp.get(liquidityDate(values.cp_date)||'');
        if(rate&&[rate.financial,rate.nonfinancial,rate.treasury].every(finiteNumber))for(const [k,n] of ([['cp_financial',rate.financial],['cp_nonfinancial',rate.nonfinancial],['cp_treasury',rate.treasury]] as const))if(values[k]!==n){values[k]=n;changed=true;}
        const quote=equities.get(entryEquityDay(row));
        if(quote)for(const k of (['sp500','nasdaq','nasdaq100','sp_high','sp_low','volume','volume_avg','sp500_chg','dma50','dma200'] as const))if(finiteNumber(quote[k])&&values[k]!==quote[k]){values[k]=quote[k];changed=true;}
        for(const [key] of historyOverrideFields)if(Object.hasOwn(overrides,key)){delete overrides[key];cleared++;changed=true;}
        if(!changed)return row;
        corrected++;
        return {...row,values,historyOverrides:overrides,reconciledAt:new Date().toISOString()};
    });
    return {rows,corrected,cleared};
}

function commitEntry(values: MarketValues,observationDate: string|null=null){
    if(!historyOwner){ alert('Please sign in before saving an entry.'); return; }
    const error=validateForcedInputs(values);if(error){alert(error);return;}
    const now=new Date().toISOString(),day=observationDate||localCalendarDate(new Date(now));
    const prepared=prepareCompositeUpdate(values,day,now);
    const finalError=validateForcedInputs(prepared.values);if(finalError||!validSnapshot(prepared.values)){alert(finalError||'Invalid composite inputs.');return;}
    const savedAt=observationDate?new Date(observationDate+'T12:00:00').toISOString():now;
    const candidate={savedAt,updatedAt:now,values:prepared.values,...(finiteNumber(values.cp_date)&&!validateLiquidityInputs(values)?{cpCheckedAt:now}:{})};
    const reconciled=reconcileCompositeEntries([candidate,...entryHistory]);
    try{writeMarketHistory(JSON.stringify(reconciled.rows));}
    catch(error){setAppFeedback('quickPasteStatus','Update could not be saved. Existing history kept.','error');setAppFeedback('compositeReconcileStatus','Update could not be saved. Existing history has been kept. '+errorMessage(error),'error');alert('Update could not be saved. Existing history has been kept. '+errorMessage(error));return;}
    entryHistory=reconciled.rows;currentEntryTime=savedAt;currentData={...requiredValue(entryHistory[0]).values};model50Cache=null;historyPreviewHidden=false;historyStorageError='';
    const period=document.querySelector<HTMLSelectElement>('#forcedPeriod');if(period)period.value='current';
    renderDashboard();
    const status=requiredElement('compositeReconcileStatus');
    if(status)setAppFeedback(status,'Data updated and saved successfully. '+prepared.notices.join(' ')+' Checked History against CP Funding & Leadership: '+reconciled.corrected+' rows reconciled; '+reconciled.cleared+' manual calculated-field overrides reset. Missing source data or fewer than 21 matched-session windows remain unavailable.','success');
    setAppFeedback('quickPasteStatus','Data updated and saved successfully.','success');
    return true;
}

function parseQuickPaste(){
    setAppFeedback('quickPasteStatus','');
    const parsed=DashboardCore.parseQuickPasteValues(requiredElement('quickPasteInput').value);
    if(!parsed.ok){alert(parsed.error);return;}
    const values=parsed.values;
    const suppliedDates=typeof values.equitySessionDate==='string';
    const session=suppliedDates?values.equitySessionDate:requiredElement('quickPasteEquityDate').value;
    const today=localCalendarDate(new Date());
    if(session){
        if(!DashboardCore.validEquityDate(session,today)){setAppFeedback('quickPasteStatus','Enter a valid completed equity session date, no later than today.','error');return;}
        const known=matchedEquitySession(values,today);
        if(known&&known!==session){setAppFeedback('quickPasteStatus','These closing prices match '+known+'. Use that equity session date.','error');return;}
        values.equitySessionDate=session;
    }else if(finiteNumber(values.sp500)&&values.sp500>0&&finiteNumber(values.nasdaq100)&&values.nasdaq100>0&&!matchedEquitySession(values,today)){
        setAppFeedback('quickPasteStatus','Enter the equity session date above so these new closing prices can be saved and Nasdaq momentum calculated.','error');return;
    }
    const dateText=(value:unknown)=>{const raw=String(value);return raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8);};
    const cpDates=suppliedDates?[values.cp_financial_date,values.cp_nonfinancial_date,values.cp_treasury_date].map(dateText):[requiredElement('quickPasteFinancialDate').value,requiredElement('quickPasteNonfinancialDate').value,requiredElement('quickPasteTreasuryDate').value];
    if(cpDates.some(Boolean)){
        if(cpDates.some(date=>!/^\d{4}-\d{2}-\d{2}$/.test(date))){setAppFeedback('quickPasteStatus','Enter all three CP/Treasury observation dates.','error');return;}
        cpRateKeys.forEach((key,index)=>{values[`${key}_date`]=Number(requiredValue(cpDates[index]).replaceAll('-',''));});
        values.cp_date=Math.max(...cpDates.map(date=>Number(date.replaceAll('-',''))));
        const cpError=validateLiquidityInputs(values);
        if(cpError){setAppFeedback('quickPasteStatus',cpError,'error');return;}
    }
    if(suppliedDates){
        requiredElement('quickPasteEquityDate').value=String(session);
        requiredElement('quickPasteFinancialDate').value=requiredValue(cpDates[0]);
        requiredElement('quickPasteNonfinancialDate').value=requiredValue(cpDates[1]);
        requiredElement('quickPasteTreasuryDate').value=requiredValue(cpDates[2]);
    }
    commitEntry(values);
}

/* =========================================================
   RESET
   ========================================================= */

function resetForm(){
    historyPreviewHidden = false;
    currentEntryTime = null;

    currentData={

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

    Object.entries(currentData).forEach(([key,value])=>{

        const input=
            document.getElementById("in_"+key);

        if(input instanceof HTMLInputElement)
            input.value=value==null?'':String(value);

    });

    
    renderDashboard();
}


/* =========================================================
   INITIALIZE
   ========================================================= */

window.onload=function(){
    checkExistingSession();
};

