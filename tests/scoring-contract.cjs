const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {context:c,run,html}=require('./helpers/load-dashboard.cjs')();
const original=require('./fixtures/original-scoring.cjs');
const core=c.DashboardCore;
const json=x=>JSON.parse(JSON.stringify(x));
// Pin all original stored data and all persisted account key names.
for(const [name,hash] of Object.entries(require('./fixtures/data-integrity.json'))){
 const raw=fs.readFileSync('src/data/'+name+'.json','utf8').trim();
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),hash,name+' source history changed');
 assert.deepEqual(json(run(name)),JSON.parse(raw),name+' bundled data changed');
}
for(const owner of ['user-a','user-b',''])assert.deepEqual(json(core.snapshotKeys(owner)),original.snapshotKeys(owner));
// Exhaustive samples around every scalar threshold, including original non-finite semantics.
for(const key of Object.keys(original.metricConfig)){
 for(const v of [-Infinity,NaN,null,undefined,...Array.from({length:2401},(_,i)=>(i-400)/4),Infinity]){
  for(const context of [{},{wti:90,yield:4.5,breadth:64.99,vix_5d:11},{wti:89.99,yield:4.49,breadth:65,vix_5d:10}]){
   assert.equal(core.metricConfig[key].calc(v,context),original.metricConfig[key].calc(v,context),key+' @ '+v);
  }
 }
}
for(const a of [0,24.99,25,49.99,50,99.99,100])for(const b of [0,49.99,50,99.99,100])assert.equal(core.cpStressPoints(a,b),original.cpStressPoints(a,b));
for(const a of [-10,-6,-5.999,-3,-2.999,-1.5,-1.499,0,5]){
 assert.equal(core.leadershipPoints(a),original.leadershipPoints(a));
 assert.equal(core.yenMomentumPoints(a),original.yenMomentumPoints(a));
}
for(const volume of [undefined,null,0,-1,149,150,199,200,300])for(const change of [undefined,null,-1,0,1])for(const close of [undefined,null,90,100,105,120,121]){
 const v={volume,volume_avg:100,sp500_chg:change,sp500:close,sp_high:120,sp_low:100};
 assert.deepEqual(json(core.sellingVolumeRange(v)),original.sellingVolumeRange(v));
}
const expected=require('./fixtures/model-baseline.json');
const actual=JSON.parse(run(`JSON.stringify([...historicalMonths.flatMap(m=>m.rows),...marketHistoryReference].map(row=>{
 const day=row.date||row.observationDate,values=row.values;
 return {day,total:compositeRange(values,day),categories:Object.values(regimeCharts).map(c=>c.forced?forcedCategoryRange(values,day):historicalScoreRange(values,c.keys,day)),inputs:model50Inputs(values,day)};
}))`));
assert.deepEqual(actual,expected,'Scoring output differs from the approved baseline');
const values='19.45,2.2070,-2.7014,340,17,67,111,5.00,-18,-0.9865,4.5584,104.27,8.7505,103.31,156.494,58.30,31.98,1.03,7623.68,202609,1480054,31.3859,-1.4658,5062330000,5191197500,-0.5187,-1.2799,7660.15,7612.07,25955.34,28957.53,20261013,4.08,4.09,4.09';
for(const count of [35]){const p=core.parseQuickPasteValues(values.split(',').slice(0,count).join(','));assert(p.ok);assert.equal(Object.keys(p.values).length,count);}
for(const invalid of ['',values+',1',values.replace('19.45','NaN'),values.replace('19.45','')])assert.equal(core.parseQuickPasteValues(invalid).ok,false);
assert.equal(core.validEquityDate('2026-02-30','2026-10-26'),false);
assert.equal(core.validEquityDate('2026-10-25','2026-10-26'),false);
assert.equal(core.validEquityDate('2026-10-27','2026-10-26'),false);
assert.equal(core.validEquityDate('2026-10-23','2026-10-26'),true);
// Every shell event is now bound through a checked TypeScript action.
const template=fs.readFileSync('src/index.template.html','utf8');
assert(!/\son(?:click|change|input|submit|toggle|cancel)=/.test(template),'Executable inline handler remains');
for(const match of template.matchAll(/data-on(?:click|change|input|submit|toggle|cancel)="([^"]+)"/g)){
 assert.equal(run('typeof dashboardActions['+JSON.stringify(match[1])+']'),'function','Missing action '+match[1]);
}
console.log('PASS: 1,894 original model snapshots, all source datasets, thresholds, storage keys, 35-value paste format and typed event bindings preserved.');
