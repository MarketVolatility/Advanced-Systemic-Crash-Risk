(async()=>{
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
class El{constructor(){this.value='';this.children=[];this.style={};}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(){}scrollIntoView(){}focus(){}select(){}}
const els={},get=id=>els[id]??(els[id]=new El()),storage=new Map();let fail=false;
const c={window:{confirm:()=>true},document:{getElementById:get,createElement:()=>new El(),addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');storage.set(k,v);}},navigator:{clipboard:{writeText:async()=>{}}}};
vm.createContext(c);vm.runInContext(script,c);
vm.runInContext("historyOwner='alice';loadAnalyses();currentEntryTime='2026-09-24T12:00:00Z';",c);
await c.generateAnalysisPrompt();
const rows=()=>JSON.parse(storage.get('crash-risk-analysis-v1:alice'));
assert.equal(rows().length,1);assert.equal(rows()[0].categories.reduce((n,r)=>n+r.low,0),rows()[0].total.low);
assert.ok(get('analysisPrompt').value.includes('2026-09-24'));
const original=JSON.stringify(rows()[0].total);
vm.runInContext('currentData.vix=99',c);
get('analysisResponse').value='<script>alert("untrusted response")</script>\nAnalysis';await c.saveAnalysisResponse();
assert.equal(JSON.stringify(rows()[0].total),original);
c.loadAnalyses();c.openAnalysis(rows()[0].id);assert.equal(get('analysisResponse').value,rows()[0].response);
vm.runInContext("historyOwner='bob';loadAnalyses()",c);assert.equal(get('analysisResponse').value,'');assert.equal(vm.runInContext('analysisRecords.length',c),0);
vm.runInContext("historyOwner='alice';loadAnalyses()",c);c.openAnalysis(rows()[0].id);get('analysisResponse').value='unsaved';fail=true;await c.saveAnalysisResponse();assert.notEqual(rows()[0].response,'unsaved');assert.match(get('analysisStatus').textContent,/could not save/);fail=false;
await c.generateAnalysisPrompt();assert.equal(rows().length,2);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
console.log('PASS: prompt snapshot/category totals, immutable scores, response round-trip, account isolation, quota failure, repeated requests, unique HTML IDs.');
// The historical example is guidance only; each generated request keeps current scores.
const latest=rows()[0];
assert.ok(latest.questions.includes('Contextual Risk Assessment'));
assert.ok(latest.questions.includes('Forced Selling /6'));
assert.ok(latest.prompt.includes(vm.runInContext('analysisReferenceWriteup',c)));
assert.ok(latest.prompt.includes('BEGIN HISTORICAL REFERENCE WRITE-UP'));
assert.ok(latest.prompt.includes('END HISTORICAL REFERENCE WRITE-UP'));
assert.ok(latest.prompt.includes('it does not use SOFR'));
assert.ok(latest.prompt.includes('not account-level proximity to maintenance margins'));
assert.ok(latest.prompt.includes('Replace every example value, date, score and status'));
assert.ok(latest.prompt.includes('1. Executive Summary'));
assert.ok(latest.prompt.includes('7. Strategic Conclusion'));
assert.equal(latest.values.vix,99);
assert.ok(latest.prompt.includes('Snapshot Score | Category Ceiling | First Available (09-16)'));
assert.ok(!latest.prompt.includes('VIX Level (14.21)')); // Previous example removed.
assert.ok(latest.prompt.includes('BEGIN HISTORICAL REFERENCE WRITE-UP — 00 260929 Analysis Executive Summary.docx'));
assert.ok(latest.prompt.includes('"vix": 99')); // Actual snapshot still supplied separately.
c.loadAnalyses();
get('analysisQuestions').value='Explain credit first, then discuss the remaining categories.';
await c.generateAnalysisPrompt();
assert.equal(rows()[0].questions,get('analysisQuestions').value);
assert.ok(rows()[0].prompt.includes(vm.runInContext('analysisReferenceWriteup',c)));
console.log('PASS: complete reference inclusion, accuracy guidance, current values separated from example, and editable questions retained.');
const selected=rows()[0].id,other=rows()[1].id;
get('analysisResponse').value='keep my unsaved response';
c.window.confirm=()=>false;await c.deleteAnalysis(selected);assert.equal(rows().length,3);
c.window.confirm=()=>true;fail=true;await c.deleteAnalysis(selected);assert.equal(rows().length,3);assert.equal(get('analysisResponse').value,'keep my unsaved response');fail=false;
await c.deleteAnalysis(other);assert.equal(rows().length,2);assert.equal(get('analysisResponse').value,'keep my unsaved response');assert.equal(vm.runInContext('activeAnalysisId',c),selected);
await c.deleteAnalysis(selected);assert.equal(rows().length,1);assert.equal(vm.runInContext('activeAnalysisId',c),null);assert.equal(get('analysisResponse').value,'');assert.equal(get('analysisPrompt').value,'');
c.loadAnalyses();assert.equal(vm.runInContext('analysisRecords.length',c),1);
const deleteButton=get('analysisHistoryBody').children[0].children[9].children[1];assert.equal(deleteButton.textContent,'×');await deleteButton.onclick();assert.equal(rows().length,0);
assert.equal(get('analysisHistoryBody').children[0].children[0].colSpan,11);
console.log('PASS: delete cancellation, storage failure, active/other-row deletion, reload persistence, row button and empty state.');
assert.ok(html.indexOf('id="analysisPanel"')<html.indexOf('<summary>Score Bands</summary>'));
assert.ok(html.includes('href="#analysisPromptControls">AI Analysis'));
await c.generateAnalysisPrompt();assert.equal(get('lastAnalysisTitle').textContent,'Last analysis — none saved yet');
get('analysisResponse').value='Latest completed analysis';await c.saveAnalysisResponse();
assert.match(get('lastAnalysisTitle').textContent,/^Last analysis on /);assert.equal(get('lastAnalysisResponse').textContent,'Latest completed analysis');
await c.generateAnalysisPrompt();assert.equal(get('lastAnalysisResponse').textContent,'Latest completed analysis');
await c.deleteAnalysis(rows().find(r=>r.response).id);assert.equal(get('lastAnalysisTitle').textContent,'Last analysis — none saved yet');
console.log('PASS: panel placement, prompt navigation target, latest completed response, pending requests, and deleted latest response.');
Object.assign(c,{TextEncoder,TextDecoder,Blob,DataView,Uint8Array,DecompressionStream});
(async()=>{
 const responseOnly=await c.analysisSavedResponseBlob({prompt:'SECRET PROMPT',response:'Saved report text'}).arrayBuffer();
 const responseXml=await c.analysisDocxXml(responseOnly);
 assert.ok(responseXml.includes('Saved report text'));assert.ok(!responseXml.includes('SECRET PROMPT'));assert.ok(!responseXml.includes('AI Analysis Prompt'));
 c.atob=x=>Buffer.from(x,'base64').toString('binary');
 const originalBytes=Buffer.from('original imported Word bytes');
 const originalDownload=await c.analysisSavedResponseBlob({response:'Saved report',word:{base64:originalBytes.toString('base64')}}).arrayBuffer();
 assert.deepEqual(Buffer.from(originalDownload),originalBytes);
 const buffer=await c.analysisWordBlob('Prompt & <test> — 中文','Response\nSecond line').arrayBuffer();
 const xml=await c.analysisDocxXml(buffer);
 assert.ok(xml.includes('Prompt &amp; &lt;test&gt; — 中文'));assert.ok(xml.includes('crash-risk-response'));assert.ok(xml.includes('Second line'));
 // Exercise a compressed document entry as produced by Word.
 const zlib=require('zlib'),data=Buffer.from(xml),compressed=zlib.deflateRawSync(data),name=Buffer.from('word/document.xml');
 const local=Buffer.alloc(30+name.length);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt16LE(name.length,26);name.copy(local,30);
 const central=Buffer.alloc(46+name.length);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);name.copy(central,46);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,10);end.writeUInt32LE(local.length+compressed.length,16);
 const archive=Buffer.concat([local,compressed,central,end]);
 assert.equal(await c.analysisDocxXml(archive.buffer.slice(archive.byteOffset,archive.byteOffset+archive.byteLength)),xml);
 await assert.rejects(c.analysisDocxXml(new ArrayBuffer(30)),/valid .docx/);
 console.log('PASS: Word export XML escaping and response tag, ZIP round-trip, compressed Word document import, invalid-file rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
// Editable metadata and scores remain bounded and internally consistent.
c.loadAnalyses();let editRow=get('analysisHistoryBody').children[0],record=rows()[0];
// Inputs are immediately editable, matching the main History table.
editRow.children[2].children[0].value='51';await editRow.children[9].children.find(b=>b.textContent==='Save').onclick();assert.equal(rows()[0].total.high,record.total.high);assert.match(get('analysisStatus').textContent,/maximum/);
editRow.children[2].children[0].value='5';for(let i=3;i<8;i++)editRow.children[i].children[0].value='1';
await editRow.children[9].children.find(b=>b.textContent==='Save').onclick();assert.equal(rows()[0].total.low,5);assert.ok(rows()[0].originalSnapshot);assert.ok(rows()[0].editedAt);
assert.equal(c.analysisCellColor({low:0,high:0},50),'history-normal');assert.equal(c.analysisCellColor({low:5,high:5},50),'history-amber');assert.equal(c.analysisCellColor({low:16,high:16},50),'history-red');assert.equal(c.analysisCellColor({low:0,high:14},14),'history-normal');
const {xml2js}=require('/Users/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js');
class RichNode{
 constructor(name,text=''){this.localName=name?.split(':').pop();this.children=[];this.attrs={};this.style={};this._text=text;}
 appendChild(n){this.children.push(n);return n;}replaceChildren(){this.children=[];this._text='';}setAttribute(k,v){this.attrs[k]=v;}getAttributeNS(_,k){return this.attrs['w:'+k]??this.attrs[k]??null;}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this.children=[];this._text=v;}
 getElementsByTagNameNS(_,name){return this.children.flatMap(c=>[...(c.localName===name?[c]:[]),...c.getElementsByTagNameNS(_,name)]);}getElementsByTagName(name){return this.getElementsByTagNameNS('',name);}
}
c.DOMParser=class{parseFromString(xml){const convert=n=>{const el=new RichNode(n.name,n.text||'');el.attrs=n.attributes||{};for(const sub of n.elements||[])el.appendChild(convert(sub));return el;};return convert(xml2js(xml));}};
const previousCreate=c.document.createElement;c.document.createElement=n=>new RichNode(n);c.document.createTextNode=t=>new RichNode('#text',t);
const word={xml:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Risk &amp; analysis</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Score 5</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',text:'Risk & analysis\nScore 5',base64:'UEs=',name:'report.docx'};
const host=new RichNode('div');c.renderWordAnalysis(host,word,word.text);assert.equal(host.children[0].localName,'h1');assert.equal(host.children[0].children[0].style.fontWeight,'bold');assert.equal(host.children[1].localName,'table');assert.ok(host.textContent.includes('Risk & analysis'));
c.document.createElement=previousCreate;
c.openAnalysis(rows()[0].id);c.testWord=word;vm.runInContext('analysisWordDraft=testWord',c);get('analysisResponse').value=word.text;await c.saveAnalysisResponse();assert.equal(rows()[0].word.xml,word.xml);
c.loadAnalyses();c.openAnalysis(rows()[0].id);assert.equal(vm.runInContext('analysisWordDraft.name',c),'report.docx');
get('analysisResponse').value='Edited plain text';c.refreshAnalysisPreview();await c.saveAnalysisResponse();assert.equal(rows()[0].word,null);
console.log('PASS: editable rows and sum validation, risk colours/ranges, Word headings/bold/tables, formatted persistence and text-edit fallback.');
const standardizedRow=get('analysisHistoryBody').children[0];
assert.equal(standardizedRow.children.length,11);
assert.equal(standardizedRow.children[0].children[0].className,'history-date-input');
assert.ok(standardizedRow.children[2].children[0].className.startsWith('history-value-input history-'));
assert.ok(!standardizedRow.children[2].className);
assert.equal(standardizedRow.children[10].children[0].textContent,'Word');
assert.ok(standardizedRow.children[9].children.some(b=>b.textContent==='Save'));
assert.ok(!standardizedRow.children[9].children.some(b=>b.textContent==='Edit'));
assert.ok(html.includes('.analysis-document *{color:#cbd5e1!important;background-color:transparent!important}'));
assert.ok(html.includes('id="lastAnalysisDownload"'));
assert.ok(!html.includes('background:#153f32'));
console.log('PASS: shared history inputs, risk text only, direct Save controls, dedicated download column and display-only dark Word theme.');
vm.runInContext(`entryHistory=[{savedAt:'2026-09-24T18:00:00',values:{...defaultData,vix:99}},{savedAt:'2026-09-24T12:00:00',values:{...defaultData,vix:10}}]`,c);
const fortnight=c.analysisRecentScores('2026-09-24');assert.equal(fortnight.length,14);assert.equal(fortnight[0].day,'2026-09-11');assert.equal(fortnight.at(-1).day,'2026-09-24');assert.equal(fortnight.at(-1).source,'Personal saved entry');assert.ok(fortnight.at(-1).savedAt.includes('18:00'));
for(const row of fortnight.filter(r=>r.total)){assert.equal(row.total.low,row.categories.reduce((n,r)=>n+r.low,0));assert.equal(row.total.high,row.factors.reduce((n,r)=>n+r.high,0));}
const gap=c.analysisRecentScores('2100-01-01');assert.ok(gap.every(r=>r.total===null));assert.ok(c.analysisRecentScorePrompt(gap).includes('Unavailable'));
assert.ok(c.analysisRecentScorePrompt(fortnight).includes('INDICATOR CONTRIBUTIONS'));
await c.generateAnalysisPrompt();assert.equal(rows()[0].recentScores.length,14);assert.ok(rows()[0].prompt.includes('LAST 14 CALENDAR DAYS OF RISK SCORES'));
assert.ok(fortnight.at(-1).values && fortnight.at(-1).derived);
const rawPrompt=c.analysisRecentScorePrompt(fortnight);
assert.ok(rawPrompt.includes('RAW RISK-FACTOR HISTORY'));
assert.ok(rawPrompt.includes(JSON.stringify(fortnight.at(-1).values,null,2).split('\n')[1].trim()));
assert.ok(rows()[0].prompt.includes('professional Word document (.docx)'));
assert.ok(rows()[0].prompt.includes('reply with the complete formatted analysis directly'));
assert.ok(rows()[0].prompt.includes('rolling-window base effects'));
assert.ok(rows()[0].prompt.includes('next observation that would confirm or weaken'));
console.log('PASS: 14 calendar dates, latest personal entry precedence, subset/indicator sums, missing dates and generated prompt inclusion.');

})().catch(e=>{console.error(e);process.exitCode=1});
