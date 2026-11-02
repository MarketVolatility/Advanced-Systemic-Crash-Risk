const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const els={};class El{constructor(){this.children=[];this.style={};this.value='';}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(){}}
let stored,fail=false;const alerts=[];const c={window:{},document:{getElementById:id=>els[id]??(els[id]=new El()),createElement:()=>new El(),addEventListener(){}},localStorage:{setItem:(_,v)=>{if(fail)throw Error('quota');stored=JSON.parse(v);}},alert:m=>alerts.push(m)};
vm.createContext(c);vm.runInContext(script,c);vm.runInContext('renderDashboard=()=>{};historyOwner="test";',c);
const data=vm.runInContext('({...marketHistoryReference.at(-1).values,cp_date:20260921,cp_financial:4.07,cp_nonfinancial:4.08,cp_treasury:4.02})',c);
c.data=data;vm.runInContext(`entryHistory=[{savedAt:'2026-09-24T12:00:00Z',values:{...data,cp_financial:5},historyOverrides:{cpPoints:{low:3,high:3},composite:{low:40,high:40}}}];`,c);
c.commitEntry(data,'2026-09-24');assert.equal(stored.length,2);assert.ok(stored.every(r=>r.values.cp_financial===4.07));assert.ok(stored.every(r=>!r.historyOverrides?.cpPoints));assert.equal(c.liquidityHistoryRows().find(r=>r.date==='2026-09-21').financial,4.07);
const current=vm.runInContext('currentData',c);assert.equal(c.metricPointRange('cp_stress',current,'2026-09-24').low,0);
// A later complete stored CP date supersedes older incoming observations as a group.
vm.runInContext(`fredLiveData={fetchedAt:'2099-01-01T00:00:00Z',rows:[['2026-09-23',4.5,4.1,4.0]]};`,c);
c.commitEntry(data,'2026-09-24');assert.equal(stored[0].values.cp_date,20260923);assert.equal(stored[0].values.cp_financial,4.5);assert.equal(stored[0].values.cp_nonfinancial,4.1);
// Same session price corrections agree in saved history and leadership diagnostics.
vm.runInContext('fredLiveData=null',c);c.commitEntry({...data,sp500:7800,sp_high:7900,nasdaq100:31000},'2026-09-24');assert.ok(stored.filter(r=>c.entryEquityDay(r)==='2026-09-24').every(r=>r.values.sp500===7800));
const momentum=c.relativeMomentumRows().find(r=>r.date==='2026-09-24').momentum;assert.equal(c.model50Inputs(stored[0].values,'2026-09-24').momentum,momentum);
const before=JSON.stringify(stored),beforeEntries=vm.runInContext('entryHistory',c);fail=true;c.commitEntry(data,'2026-09-24');assert.equal(JSON.stringify(stored),before);assert.equal(vm.runInContext('entryHistory',c),beforeEntries);
console.log('PASS: CP group refresh, same-date reconciliation, stale override reset, same-session equity fallback, shared leadership calculation and atomic storage failure.');
