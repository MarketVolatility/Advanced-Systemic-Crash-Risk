// Shared contextual rules. Each component retains its original maximum budget.
function metricPoints(key:MetricKey,values:MarketValues,day?:string):number {
 const v=values[key];
 if(key==='jpy'){const n=jpyMomentum(values,day);return finiteNumber(n)?yenMomentumPoints(n):0;}
 if(key==='vix_term'||key==='wti_20d'||key==='breadth_20d')return DashboardCore.contextualPoints(key,values);
 // Scalar rules historically receive null/undefined and use JS comparison semantics.
 return metricConfig[key].calc(Number(v));
}
let model50Cache:ModelSources|null=null;
function model50Sources():ModelSources {
 if(model50Cache&&model50Cache.entries===entryHistory&&model50Cache.count===entryHistory.length&&model50Cache.fred===fredLiveData)return model50Cache;
 const cp=liquidityHistoryRows().filter((r):r is CPObservation & CPScore=>finiteNumber(r.sector)&&finiteNumber(r.financialBill));
 const momentum=relativeMomentumRows(),quotes=appEquityRows();
 return model50Cache={entries:entryHistory,count:entryHistory.length,fred:fredLiveData,cp,momentum,
 sp:new Map(quotes.map(r=>[r.date,r.sp500])),nd:new Map(quotes.map(r=>[r.date,r.nasdaq100])),
 studySessions:new Map(historicalMonths.flatMap(m=>m.rows.map(r=>[r.date,r.observationDate]))),indices:new Map(momentum.map((r,i)=>[r.date,i]))};
}
function cpStaleNote(values:MarketValues,day:string):string {
 const cp=model50Inputs(values,day).cp;if(!cp)return '';
 const dates=cp.dates||[cp.date,cp.date,cp.date];
 return (cp.mixedDates?'Mixed-date CP spreads: financial '+dates[0]+', nonfinancial '+dates[1]+', Treasury '+dates[2]+'. These are not same-session spreads. ':'')+(cp.stale?'CP data is stale: oldest observation '+dates.slice().sort()[0]+' ('+cp.ageDays+' calendar days old). ':'')+((cp.mixedDates||cp.stale)?'Score uses these rates; CP contributes '+cpStressPoints(cp.sector,cp.financialBill)+' / 3 points.':'');
}
function cpStressPoints(sector:NumericInput,bill:NumericInput):number{return DashboardCore.cpStressPoints(Number(sector),Number(bill));}
function leadershipPoints(momentum:NumericInput):number{return DashboardCore.leadershipPoints(Number(momentum));}
interface ModelInputs {cp:CPScore|null|undefined;momentum:number|null;session:string|null;momentumReason?:string;baseDate?:string}
function model50Inputs(values:MarketValues,day=localCalendarDate(new Date())):ModelInputs {
 const src=model50Sources(),explicit=finiteNumber(values.cp_date);
 let manual:CPScore|null=null;
 if(explicit&&!validateLiquidityInputs(values)){
  // validateLiquidityInputs checks all three rates and all observation dates.
  const dates=cpObservationDates(values).map(requiredValue);
  manual={date:requiredValue(dates.slice().sort().at(-1)),dates,mixedDates:mixedCpDates(values),sector:Math.round((requiredValue(values.cp_financial)-requiredValue(values.cp_nonfinancial))*1e8)/1e6,financialBill:Math.round((requiredValue(values.cp_financial)-requiredValue(values.cp_treasury))*1e8)/1e6};
 }
 let left=0,right=src.cp.length;
 while(left<right){const mid=(left+right)>>1;if(requiredValue(src.cp[mid]).date<=day)left=mid+1;else right=mid;}
 let cp:CPScore|null|undefined=explicit?manual:src.cp[left-1];
 if(cp&&cp.date>day)cp=null;
 if(cp){const ageDays=Math.floor((Date.parse(day)-Date.parse(cp.dates?.slice().sort()[0]||cp.date))/86400000);cp={...cp,ageDays,stale:ageDays>7};}
 const studySession=src.studySessions.get(day);
 let session=values.equitySessionDate||studySession||matchedEquitySession(values,day)||day;
 if(session>day)return {cp,momentum:null,session:null,momentumReason:'Equity session is after this entry date.'};
 let close=values.sp500??src.sp.get(session),ndx=values.nasdaq100??src.nd.get(session);
 if(!(finiteNumber(close)&&close>0&&finiteNumber(ndx)&&ndx>0)&&[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay())){
  const latest=src.momentum.findLast(r=>r.date<=day);if(latest){session=latest.date;close=src.sp.get(session);ndx=src.nd.get(session);}
 }
 if(!(finiteNumber(close)&&close>0&&finiteNumber(ndx)&&ndx>0))return {cp,momentum:null,session,momentumReason:'Supply same-session S&P 500 and Nasdaq 100 closes.'};
 const prior=src.momentum.filter(r=>r.date<session),base=prior.at(-20);
 if(!base)return {cp,momentum:null,session,momentumReason:'Need 20 earlier matched index observations; '+prior.length+' available.'};
 // Momentum rows include only positive finite paired closes, so this date is in both maps.
 const momentum=DashboardCore.relativeMomentum({nasdaq100:ndx,sp500:close},{nasdaq100:requiredValue(src.nd.get(base.date)),sp500:requiredValue(src.sp.get(base.date))});
 return {cp,momentum,session,baseDate:base.date};
}
function metricPointRange(key:ScoredKey,values:MarketValues,day?:string):RiskRange {
 if(key==='cp_stress'||key==='leadership'){
  const input=model50Inputs(values,day);const points=key==='cp_stress'?(input.cp?cpStressPoints(input.cp.sector,input.cp.financialBill):null):(finiteNumber(input.momentum)?leadershipPoints(input.momentum):null);
  return points===null?{low:0,high:3}:{low:points,high:points};
 }
 if(key==='jpy'){const n=jpyMomentum(values,day);return finiteNumber(n)?{low:yenMomentumPoints(n),high:yenMomentumPoints(n)}:{low:0,high:2};}
 const candidates:Partial<Record<MetricKey,number[]>>={vix_term:[-1,0,1,1.5],vix_5d:[0,11],wti_20d:[0,10,20],wti:[80,90],yield:[4,4.5],breadth_20d:[-10,-4,0],breadth:[40,65]};
 const deps:MetricKey[]=key==='vix_term'?['vix_term','vix_5d']:key==='wti_20d'?['wti_20d','wti','yield']:key==='breadth_20d'?['breadth_20d','breadth']:[key];
 if(deps.length===1)return finiteNumber(values[key])?{low:metricPoints(key,values),high:metricPoints(key,values)}:{low:0,high:metricConfig[key].maxPoints};
 let states:MarketValues[]=[{...values}];
 deps.forEach(k=>{if(!finiteNumber(values[k]))states=states.flatMap(state=>requiredValue(candidates[k]).map(n=>({...state,[k]:n})));});
 const scores=states.map(state=>metricPoints(key,state));return {low:Math.min(...scores),high:Math.max(...scores)};
}
