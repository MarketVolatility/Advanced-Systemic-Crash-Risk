const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
class El{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.value='3m';this.style={};this.classList={add(){},remove(){}};}appendChild(e){this.children.push(e);}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(){this.children=[];}querySelector(selector){this.queries??={};if(this.queries[selector])return this.queries[selector];const e=new El(selector==='svg'?'svg':'control');if(selector==='svg')this.appendChild(e);return this.queries[selector]=e;}}
const els={};const get=id=>els[id]??(els[id]=new El(id));let ready,alerts=[],saved;
const c={window:{},document:{getElementById:get,createElement:t=>new El(t),createElementNS:(_,t)=>new El(t),addEventListener:(_,fn)=>ready=fn,querySelectorAll:()=>[]},alert:m=>alerts.push(m),capture:v=>saved=v,Intl,localStorage:{setItem:()=>{}}};vm.createContext(c);vm.runInContext(script,c);



assert.equal(vm.runInContext('Object.values(regimeCharts).reduce((n,c)=>n+c.maximum,0)',c),50);
for(const [a,b,p] of [[24.99,49.99,0],[25,0,2],[0,50,2],[50,0,3],[0,100,3],[70,150,3]])assert.equal(c.cpStressPoints(a,b),p);
for(const [m,p] of [[-2.99,0],[-3,1],[-5.99,1],[-6,3],[-20,3]])assert.equal(c.leadershipPoints(m),p);
let r=c.metricPointRange('cp_stress',{cp_date:20260921,cp_financial:4.33,cp_nonfinancial:4.08,cp_treasury:4.02},'2026-09-24');assert.equal(r.low,2);assert.equal(r.high,2);
r=c.metricPointRange('cp_stress',{cp_date:20260921,cp_financial:5.08,cp_nonfinancial:4.08,cp_treasury:4.02},'2026-09-24');assert.equal(r.low,3);
r=c.metricPointRange('cp_stress',{cp_date:20260921,cp_financial:5.08,cp_nonfinancial:4.08,cp_treasury:4.02},'2026-09-20');assert.equal(r.low,0);assert.equal(r.high,3);
r=c.metricPointRange('cp_stress',{cp_date:20260921,cp_financial:5.08,cp_nonfinancial:4.08,cp_treasury:4.02},'2026-10-01');assert.equal(r.high,3);assert.equal(r.low,3);
r=c.metricPointRange('leadership',{},'2100-01-03');assert.equal(r.low,0);assert.equal(r.high,3);
for(const n of [0,4,5,9,10,15,16,22,23,30,31,50]){c.updateSummary(n,50);assert.equal(get('totalScoreDisp').innerText,n+' / 50');}
console.log('PASS: 50-point category budgets, CP and momentum boundaries, mutually exclusive CP points, stale/future/missing ranges and score denominator.');
// Every historical row and five-year reference entry uses the same 50-point sum.
vm.runInContext(`
for(const row of [...historicalMonths.flatMap(m=>m.rows),...marketHistoryReference]){
 const day=row.date||row.observationDate,v=row.values;
 const total=compositeRange(v,day);
 const categories=Object.values(regimeCharts).map(c=>c.forced?forcedCategoryRange(v,day):historicalScoreRange(v,c.keys,day));
 if(total.low!==categories.reduce((n,r)=>n+r.low,0)||total.high!==categories.reduce((n,r)=>n+r.high,0)||total.high>50)throw Error('Category mismatch '+day);
}
for(const month of historicalMonths)for(const row of month.rows){
 if(!Number.isFinite(model50Inputs(row.values,row.date).momentum))throw Error('Missing study momentum '+row.date);
}
`,c);
assert.ok(html.includes('CP added points (0–3)'));
assert.ok(html.includes('Nasdaq added points (0–3)'));
assert.ok(!/\/\s*44\b|0[–-]44\b|44-point/.test(html));
console.log('PASS: all 640 study dates and 1,254 reference entries sum to the five categories; full study momentum coverage; 50-point score scale.');

// Stale matched CP remains scored, with explicit age; missing/future rates stay unknown.
const staleCp={cp_date:20261006,cp_financial:4.07,cp_nonfinancial:4.04,cp_treasury:4.04};
assert.equal(c.metricPointRange('cp_stress',staleCp,'2026-10-14').high,0);
assert.match(c.cpStaleNote(staleCp,'2026-10-14'),/CP data is stale: 2026-10-06 \(8 calendar days old\)/);
assert.equal(c.cpStaleNote(staleCp,'2026-10-13'),'');
assert.equal(c.metricPointRange('cp_stress',staleCp,'2026-10-05').high,3);
assert.equal(c.metricPointRange('cp_stress',{...staleCp,cp_financial:null},'2026-10-14').high,3);
console.log('PASS: stale CP scoring and dated notice; fresh, future and missing guards.');

const periods=JSON.parse(vm.runInContext('JSON.stringify(historicalMonths.map(m=>[m.rows[0].date,m.rows.at(-1).date,m.rows.length]))',c));
assert.deepEqual(periods,[['2019-11-01','2020-05-31',213],['2008-05-01','2008-11-30',214],['1999-11-01','2000-05-31',213]]);
vm.runInContext(`for(const m of historicalMonths)for(const r of m.rows){
 if(r.observationDate>r.date)throw Error('Future session '+r.date);
 const a=historicalScoreRange(r.values,historyColumns.map(c=>c[0]),r.date),b=compositeRange(r.values,r.date);
 if(a.low!==b.low||a.high!==b.high)throw Error('Historical model mismatch '+r.date);
 if(r.date>='2020-05-01'&&(!Number.isFinite(r.values.move)||!Number.isFinite(r.values.vix_term)))throw Error('May coverage '+r.date);
}`,c);
console.log('PASS: requested full periods, 640 rows, May volatility coverage, no future sessions and matching current-model scores.');
c.renderHistoricalStudies();
const historicalPanels=get('historicalStudies').children;
assert.equal(historicalPanels.length,21);
for(let i=0;i<3;i++){
 assert.ok(historicalPanels[i*7].innerHTML.includes('Composite maximum<br>(0–50)'));
 assert.ok(historicalPanels[i*7+1].innerHTML.includes('Maximum 50 points'));
}
console.log('PASS: all three expanded tables and 18 historical charts render, with composite charts at 50 points.');

const panel=historicalPanels[1],start=panel.querySelector('#historical-0-0-start'),end=panel.querySelector('#historical-0-0-end');
start.value='2020-03';end.value='2020-03';start.onchange();
assert.match(panel.querySelector('#historical-0-0-status').textContent,/31 calendar dates · 2020-03-01 to 2020-03-31/);
const chart=panel.querySelector('svg');
assert.ok(chart.children.some(e=>e.tag==='polyline'&&e.attrs.stroke==='#00bfff'&&e.attrs['stroke-dasharray']==='2 4'));
assert.ok(chart.children.some(e=>e.tag==='polyline'&&e.attrs.stroke==='#d946ff'&&e.attrs['stroke-dasharray']==='7 4'));
start.value='2020-05';start.onchange();assert.equal(end.value,'2020-05');
assert.match(panel.querySelector('#historical-0-0-status').textContent,/2020-05-01 to 2020-05-31/);
end.value='2019-11';end.onchange();assert.equal(start.value,'2019-11');
assert.match(panel.querySelector('#historical-0-0-status').textContent,/30 calendar dates/);
console.log('PASS: per-chart month filters, reversed-range correction, and distinct index colors and patterns.');
