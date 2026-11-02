from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'index.html').read_text()
names=['finiteNumber','requiredElement','matchedEquitySession','entryEquityDay','appEquityRows','relativeMomentumRows','model50Sources','model50Inputs','leadershipPoints','prepareCompositeUpdate','parseQuickPaste','historyOverrideInput']
import re
parts=[next(x for x in re.findall(r'<script[^>]*>([\s\S]*?)</script>',s) if 'var DashboardCore =' in x)]
for name in ['marketHistoryReference','sp500Daily','nasdaqDaily']:
 parts.append(next(x for x in s.splitlines() if x.startswith('const '+name+' = ')))
for name in names:
 start=s.index('function '+name+'(');a=s.index('{',start);depth=1;i=a+1
 while depth:
  if s[i]=='{':depth+=1
  elif s[i]=='}':depth-=1
  i+=1
 parts.append(s[start:i])
setup='''const assert=require('node:assert/strict');
let equitySessionLookup=null,appEquityCache=null,momentumRowsCache=null,model50Cache=null;
let entryHistory=[],historicalMonths=[],fredLiveData=null;
const localCalendarDate=d=>d.toISOString().slice(0,10);
const liquidityHistoryRows=()=>[];
const liquidityColumns=[];
const hasSeparateCpDates=()=>false;
const els={};const document={getElementById:id=>els[id]??(els[id]={value:''}),createElement:()=>({setAttribute(){}})};
let committed=null,feedback='';
const commitEntry=v=>committed=v;
const setAppFeedback=(id,text)=>feedback=text;
const alert=m=>{throw Error(m)};
const marketColumns=[['nasdaq','Nasdaq Composite'],['nasdaq100','Nasdaq 100']];
const inputColumns='vix,vix_chg,vix_5d,hy,hy_5d,hy_20d,bbb,yield,yield_20d,dma50,dma200,wti,wti_20d,move,jpy,breadth,breadth_20d,vix_term,sp500,margin_month,margin_debt,margin_yoy,margin_3m,volume,volume_avg,sp500_chg,jpy3d,sp_high,sp_low,nasdaq,nasdaq100,cp_date,cp_financial,cp_nonfinancial,cp_treasury'.split(',').map(k=>[k]);
'''
tests='''
const latest={sp500:7712.57,nasdaq:26424.82,nasdaq100:29490.28};
assert.equal(matchedEquitySession(latest,'2026-10-21'),'2026-10-20');
assert.equal(matchedEquitySession(latest,'2026-10-19'),null);
assert.equal(matchedEquitySession({...latest,nasdaq:1},'2026-10-21'),null);
entryHistory=[{savedAt:'2026-10-21T01:00:00Z',values:latest}];
assert.equal(entryEquityDay(entryHistory[0]),'2026-10-20');
assert.notEqual(appEquityRows().find(r=>r.date==='2026-10-21').sp500,latest.sp500);
const prepared=prepareCompositeUpdate(latest,'2026-10-21','2026-10-21T01:00:00Z');
assert.equal(prepared.values.equitySessionDate,'2026-10-20');
const result=model50Inputs(latest,'2026-10-21');
assert.equal(result.session,'2026-10-20');
assert.ok(Number.isFinite(result.momentum));
assert.equal(leadershipPoints(result.momentum),1);
const prior=model50Inputs({sp500:7690.73,nasdaq100:29529.35},'2026-10-20');
assert.ok(Number.isFinite(prior.momentum));
// Current paste resolves to Friday despite a Monday save date.
const friday={sp500:7623.68,nasdaq:25955.34,nasdaq100:28957.53};
assert.equal(matchedEquitySession(friday,'2026-10-26'),'2026-10-23');
const fridayResult=model50Inputs(friday,'2026-10-26');
assert.equal(fridayResult.session,'2026-10-23');
const spMap=new Map(sp500Daily),ndMap=new Map(nasdaqDaily.nasdaq100);
assert.ok(Math.abs(fridayResult.momentum-100*((28957.53/7623.68)/(ndMap.get('2026-09-25')/spMap.get('2026-09-25'))-1))<1e-10);
// New dated observations work before being saved or added to bundled history.
const future=model50Inputs({sp500:7700,nasdaq100:29000,equitySessionDate:'2026-10-26'},'2026-10-26');
assert.ok(Number.isFinite(future.momentum));assert.equal(future.session,'2026-10-26');
assert.equal(model50Inputs({sp500:7700,nasdaq100:29000,equitySessionDate:'2026-10-27'},'2026-10-26').momentum,null);
const rows=relativeMomentumRows();
assert.ok(rows.some(r=>r.date==='2026-10-12'));
assert.ok(!rows.some(r=>r.date==='2026-09-07'));
// A new quote must have a source date; the 35-field schema stays unchanged.
const paste=Array(35).fill(1);paste[18]=7701;paste[30]=29001;
document.getElementById('quickPasteInput').value=paste.join(',');
parseQuickPaste();assert.equal(committed,null);assert.match(feedback,/session date/);
document.getElementById('quickPasteEquityDate').value='2026-10-23';
parseQuickPaste();assert.equal(committed.equitySessionDate,'2026-10-23');
assert.equal(Object.keys(committed).length,36);
// Missing calculations have a visible placeholder, never a silent blank.
const host={children:[],replaceChildren(){this.children=[]},appendChild(e){this.children.push(e)}};
const inputs={};historyOverrideInput('nasdaqMomentum','Nasdaq momentum','—',{savedAt:'2026-10-23T12:00:00Z',values:{}},host,inputs,null);
assert.equal(inputs.nasdaqMomentum.placeholder,'Unavailable');
assert.ok(host.children.some(e=>e.textContent));
// A missing interior pair must be skipped, not invalidate every later window.
const synthetic=[];
for(let d=new Date('2026-08-03T12:00:00Z');synthetic.length<23;d.setUTCDate(d.getUTCDate()+1)){
 if([0,6].includes(d.getUTCDay()))continue;
 const i=synthetic.length;synthetic.push({date:d.toISOString().slice(0,10),sp500:100+i,nasdaq100:200+3*i});
}
synthetic[10].nasdaq100=null;
appEquityCache={entries:entryHistory,count:entryHistory.length,rows:synthetic};momentumRowsCache=null;model50Cache=null;
const sparse=relativeMomentumRows();
assert.equal(sparse.length,22);
assert.equal(sparse[19].momentum,null);
assert.equal(sparse[20].baseDate,synthetic[0].date);
assert.equal(sparse[21].baseDate,synthetic[1].date);
assert.ok(Math.abs(sparse[20].momentum-100*((263/121)/(200/100)-1))<1e-10);
const sparseScore=model50Inputs({sp500:121,nasdaq100:263,equitySessionDate:synthetic[21].date},synthetic[21].date);
assert.equal(sparseScore.momentum,sparse[20].momentum);
assert.equal(leadershipPoints(-3),1);assert.equal(leadershipPoints(-6),3);
console.log('Passed session matching, full paste, momentum, points and holiday regressions.');
'''
import subprocess, tempfile, os
with tempfile.TemporaryDirectory() as tmp:
 script=Path(tmp)/'momentum.cjs';script.write_text(setup+'\n'.join(parts)+tests)
 subprocess.run([os.environ.get('NODE','node'),str(script)],check=True)
