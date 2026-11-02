const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const els={};class El{constructor(){this.children=[];this.style={};this.value='';}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(){}}
let saved,fail=false;const alerts=[];
const c={window:{},document:{getElementById:id=>els[id]??(els[id]=new El()),createElement:()=>new El(),addEventListener(){}},localStorage:{setItem:(_,v)=>{if(fail)throw Error('quota');saved=JSON.parse(v);}},alert:m=>alerts.push(m)};
vm.createContext(c);vm.runInContext(script,c);vm.runInContext('renderDashboard=()=>{};historyOwner="test";',c);
const inputs=()=>Object.fromEntries(['composite','scoredCpDate','cpPoints','nasdaqMomentum','nasdaqPoints'].map(key=>[key,{value:'',defaultValue:''}]));
let x=inputs();x.composite.value='12–15';x.scoredCpDate.value='2026-09-21';x.cpPoints.value='2';x.nasdaqMomentum.value='-6.2';x.nasdaqPoints.value='3';
const parsed=c.parseHistoryOverrides(x,{},'2026-09-29');assert.equal(parsed.composite.low,12);assert.equal(parsed.nasdaqMomentum,-6.2);
x.cpPoints.value='4';assert.throws(()=>c.parseHistoryOverrides(x,{},'2026-09-29'),/0 to 3/);x.cpPoints.value='2';x.scoredCpDate.value='2026-02-30';assert.throws(()=>c.parseHistoryOverrides(x,{},'2026-09-29'),/valid date/);
assert.equal(Object.keys(c.parseHistoryOverrides(inputs(),parsed,'2026-09-29')).length,0);
x=inputs();x.composite.value=x.composite.defaultValue='15';assert.equal(Object.keys(c.parseHistoryOverrides(x,{},'2026-09-29')).length,0);
const entry=vm.runInContext('({savedAt:"2026-09-28T12:00:00Z",values:{...defaultData}})',c);c.entry=entry;vm.runInContext('entryHistory=[entry];currentEntryTime=entry.savedAt;',c);
assert.equal(c.updateEntryDateTime(entry,'2026-09-28','12:00:00',entry.values,parsed,'Reviewed'),true);assert.equal(saved[0].historyOverrides.cpPoints.low,2);assert.equal(saved[0].entryLabel,'Reviewed');
const ref=vm.runInContext('marketHistoryReference.at(-1)',c);assert.equal(c.updateEntryDateTime(ref,'2026-09-24','12:00:00',ref.values,parsed,'Personal reference'),true);assert.equal(saved.find(r=>r.entryLabel==='Personal reference').reference,undefined);assert.equal(ref.reference,true);
const before=JSON.stringify(saved);fail=true;assert.equal(c.updateEntryDateTime(ref,'2026-09-24','12:00:00',ref.values,{},'Failed'),false);assert.equal(JSON.stringify(saved),before);fail=false;
const host=new El(),controls={};c.historyOverrideInput('composite','Total','8',saved[0],host,controls,50);assert.equal(host.children.length,1);
console.log('PASS: score/range/date validation, reset-to-calculated, untouched computed values, persistence, editable reference copies, storage failure.');
