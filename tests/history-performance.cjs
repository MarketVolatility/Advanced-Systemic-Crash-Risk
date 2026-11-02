const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(process.env.DASHBOARD_FILE||'index.html','utf8');const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
class El{constructor(tag){this.tag=tag;this.dataset={};this.className='';this.title='';this.children=[];this.attrs={};this.value='3m';this.style={};this.classList={add(){},remove(){}};}addEventListener(){}appendChild(e){e.parentNode=this;this.children.push(e);}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(){this.children=[];}querySelector(){const e=new El('svg');this.appendChild(e);return e;}}
const els={};const get=id=>els[id]??(els[id]=new El(id));let ready,alerts=[],saved;
const c={window:{},document:{getElementById:get,createElement:t=>new El(t),createElementNS:(_,t)=>new El(t),addEventListener:(_,fn)=>ready=fn,querySelectorAll:()=>[]},alert:m=>alerts.push(m),capture:v=>saved=v,Intl,localStorage:{setItem:()=>{}}};vm.createContext(c);vm.runInContext(script,c);



vm.runInContext("currentEntryTime='2026-09-24T12:00:00Z'",c);
const started=performance.now();
c.renderHistoryTable('history',vm.runInContext('historyColumns',c),'Composite',50,false);
function countInputs(el){return (el.tag==='input'?1:0)+el.children.reduce((sum,e)=>sum+countInputs(e),0);}
console.log(JSON.stringify({milliseconds:Math.round(performance.now()-started),rows:get('historyBody').children.length,inputs:countInputs(get('historyBody'))}));
if(process.env.DASHBOARD_FILE)process.exit(0);
assert.equal(get('historyBody').children.length,50);
const oldest=get('historyPager').children[3];oldest.onclick();
assert.equal(get('historyBody').children.length,4);
assert.equal(get('historyBody').children.at(-1).children[2].children[0].value,'2021-09-27');
c.confirm=()=>false;get('historyBody').oninput();get('historyPager').children[0].onclick();assert.equal(get('historyBody').children.length,4);
c.confirm=()=>true;get('historyPager').children[0].onclick();assert.equal(get('historyBody').children.length,50);
get('historyPager').children[5].value='2023-05-15';get('historyPager').children[6].onclick();
assert.ok(get('historyBody').children.some(r=>r.children[2].children[0].value==='2023-05-15'));
assert.equal(c.historyDisplayEntries().length,1254);
const prior=c.relativeMomentumRows();assert.equal(prior,c.relativeMomentumRows());
vm.runInContext("entryHistory=[{savedAt:'2026-09-24T12:00:00Z',values:{...marketHistoryReference.at(-1).values,nasdaq100:32000}}]",c);
assert.notEqual(prior,c.relativeMomentumRows());assert.equal(c.marketValuesForDay('2026-09-24').nasdaq100,32000);
console.log('PASS: bounded editable rows, oldest/date navigation, unsaved-edit guard, full historical data retained, market cache invalidation.');

assert.equal(c.historyChangeDirection('vix',15,16),'history-improved');
assert.equal(c.historyChangeDirection('hy',320,310),'history-worsened');
assert.equal(c.historyChangeDirection('breadth',40,35),'history-improved');
assert.equal(c.historyChangeDirection('sp500',7000,7100),'history-worsened');
assert.equal(c.historyChangeDirection('vix',15,15),'');
assert.equal(c.historyChangeDirection('vix',null,15),'');
assert.equal(c.historyChangeDirection('volume',100,200),'');
assert.equal(c.historyChangeDirection('cp_date',20261015,20261014),'');
assert.equal(c.historyChangeDirection('composite',8,12),'history-improved');
assert.equal(c.historyChangeDirection('nasdaqMomentum',-2,-1),'history-worsened');
assert.ok(get('historyBody').children.some(row=>row.children.some(cell=>/history-improved|history-worsened/.test(cell.className))));
console.log('PASS: directional outlines, neutral and missing cells, unchanged values and rendered history cells.');
