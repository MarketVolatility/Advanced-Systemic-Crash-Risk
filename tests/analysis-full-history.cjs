(async()=>{
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
class El{constructor(){this.value='';this.children=[];this.style={};}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(){}scrollIntoView(){}focus(){}select(){}}
const els={},get=id=>els[id]??(els[id]=new El()),storage=new Map();let fail=false;
const c={window:{confirm:()=>true},document:{getElementById:get,createElement:()=>new El(),addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');storage.set(k,v);}},navigator:{clipboard:{writeText:async()=>{}}}};
vm.createContext(c);vm.runInContext(script,c);
vm.runInContext("historyOwner='alice';loadAnalyses();currentEntryTime='2026-09-24T12:00:00Z';",c);

const full=await c.analysisFullHistoryPrompt();
assert.match(full,/ENTIRE HISTORY TABLE/);assert.match(full,/2021-09-27/);
assert.match(full,/1254 rows/);assert.match(full,/\[GREEN\]/);assert.match(full,/\[DARK PINK\]/);
vm.runInContext(`historyDisplayEntries=()=>[
 {savedAt:'2026-10-15T12:00:00Z',values:{...defaultData,vix:15,breadth:30},historyOverrides:{composite:7}},
 {savedAt:'2026-10-15T10:00:00Z',values:{...defaultData,vix:16,breadth:40},historyOverrides:{composite:8}},
 {savedAt:'2026-10-14T10:00:00Z',values:{...defaultData,vix:16,breadth:40}}
];`,c);
const text=await c.analysisFullHistoryPrompt();assert.match(text,/3 rows/);
const header=text.split('\n').find(l=>l.startsWith('Entry\t')).split('\t');
const lines=text.split('\n').filter(l=>l.includes('Personal saved entry')).map(l=>l.split('\t'));
assert.equal(lines.length,3);
assert.equal(lines[0][header.indexOf('VIX (Index)')],'15 [GREEN]');
assert.equal(lines[0][header.findIndex(h=>h.startsWith('Breadth')&&h.includes('%'))],'30 [DARK PINK]');
assert.equal(lines[0][header.indexOf('Composite Crash Risk Score')],'7 [GREEN]');
assert.equal(lines[1][header.indexOf('VIX (Index)')],'16');
assert.equal(lines[2][header.indexOf('VIX (Index)')],'16');
console.log('PASS: complete 1254-row history, older pages, all same-day entries, manual scores, green/pink and unchanged tags.');
})().catch(e=>{console.error(e);process.exitCode=1});
