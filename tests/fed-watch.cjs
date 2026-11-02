const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
class El{set value(v){this._value=String(v);}get value(){return this._value;}constructor(){this.children=[];this.attrs={};this.style={};this.value='';this.classList={add(){},remove(){}};}appendChild(e){this.children.push(e);}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(){this.children=[];}}
const els={},get=id=>els[id]??(els[id]=new El()),store=new Map();let fail=false;
const c={URL,window:{},document:{getElementById:get,createElement:()=>new El(),addEventListener(){},querySelectorAll:()=>[]},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>{if(fail)throw Error('full');store.set(k,v);}},confirm:()=>true};vm.createContext(c);vm.runInContext(script,c);
const run=s=>vm.runInContext(s,c),row={observedAt:'2026-09-01T20:00:00Z',meetingDate:'2026-09-16',targetLower:3,targetUpper:3.25,hike:20,hold:80,cut:0,comparisonAt:null,hikeChange5d:null,holdChange5d:null,cutChange5d:null,source:'https://www.cmegroup.com/fedwatch',calendarSource:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',notes:'Test fixture, not live data'};
run("historyOwner='test-a'");c.loadFedWatch();get('fedPaste').value=JSON.stringify(row);c.importFedWatch();assert.equal(run('fedWatchRows.length'),1);c.importFedWatch();assert.equal(run('fedWatchRows.length'),1);assert.match(get('fedStatus').textContent,/already exists/);
for(const patch of [{hold:null},{hold:50},{observedAt:'2026-09-01'},{meetingDate:'2026-02-30'},{source:'javascript:alert(1)'},{hikeChange5d:5}])assert.throws(()=>c.validateFedWatch({...row,...patch}));
let tr=get('fedBody').children[0];tr.children[6].children[0].value='70';tr.children[6].children[0].oninput();tr.children[0].children[2].onclick();assert.equal(tr.children[6].children[0].value,'80');
tr.children[14].children[0].value='Edited';tr.children[0].children[1].onclick();assert.equal(run('fedWatchRows[0].notes'),'Edited');c.loadFedWatch();assert.equal(run('fedWatchRows[0].notes'),'Edited');
fail=true;get('fedPaste').value=JSON.stringify({...row,observedAt:'2026-09-02T20:00:00Z'});c.importFedWatch();assert.equal(run('fedWatchRows.length'),1);assert.match(get('fedStatus').textContent,/Not saved/);fail=false;
run("historyOwner='test-b'");c.loadFedWatch();assert.equal(run('fedWatchRows.length'),0);run("historyOwner='test-a'");c.loadFedWatch();assert.equal(run('fedWatchRows.length'),1);
c.fixture=row;run("fedWatchRows=Array.from({length:121},(_,i)=>({...fixture,observedAt:new Date(Date.UTC(2026,0,1+i)).toISOString()}))");c.renderFedWatch();assert.equal(get('fedBody').children.length,50);assert.equal(get('fedBody').children[0].children[1].children[0].value,'2026-05-01T00:00:00.000Z');get('fedPager').children[3].onclick();assert.equal(get('fedBody').children.length,21);
c.generateFedPrompt();assert.match(get('fedPrompt').value,/five completed US trading sessions/);assert.ok(html.indexOf('id="fedWatchPanel"')>html.indexOf('id="dashboardRiskCharts"'));assert.equal(JSON.parse(c.localSnapshot('test-a').fedWatchHistory)[0].notes,'Edited');
console.log('PASS Fed import, validation, duplicates, edit/cancel, persistence, account isolation, storage failure, newest-first and bounded pagination.');
// Missing snapshot timestamps must remain null and save with an explicit warning.
run("historyOwner='test-missing-time'");c.loadFedWatch();
get('fedPaste').value=JSON.stringify({...row,observedAt:null});c.importFedWatch();
assert.equal(run('fedWatchRows.length'),1);assert.equal(run('fedWatchRows[0].observedAt'),null);
assert.match(get('fedStatus').textContent,/Timing unverified/);c.loadFedWatch();assert.equal(run('fedWatchRows.length'),1);
assert.match(get('fedBody').children[0].children[0].children[3].textContent,/review required/);
get('fedPaste').value=JSON.stringify({...row,observedAt:null,publishedAt:'2026-09-02T12:00:00Z'});c.importFedWatch();
assert.equal(run('fedWatchRows.length'),2);assert.equal(run('fedSortedRows()[0].r.publishedAt'),'2026-09-02T12:00:00Z');
assert.match(get('fedBody').children[0].children[0].children[3].textContent,/Report time only/);
assert.throws(()=>c.validateFedWatch({...row,observedAt:null,comparisonAt:'2026-08-24T20:00:00Z',hikeChange5d:0,holdChange5d:0,cutChange5d:0}));
assert.throws(()=>c.validateFedWatch({...row,publishedAt:'2099-01-01T00:00:00Z'}));
c.generateFedPrompt();assert.match(get('fedPrompt').value,/Missing timestamps alone may be saved/);
console.log('PASS missing snapshot time saves and reloads as unverified; report time stays separate, sorts correctly, and cannot validate snapshot comparisons.');
