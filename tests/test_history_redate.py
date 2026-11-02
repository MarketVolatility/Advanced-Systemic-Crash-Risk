from pathlib import Path
import os,subprocess,tempfile,re
s=(Path(__file__).resolve().parents[1]/'index.html').read_text()
start=s.index('                // Editing the saved timestamp')
end=s.index('\n            };',start)
handler=s[start:end]
keys=['vix','vix_chg','vix_5d','hy','hy_5d','hy_20d','bbb','yield','yield_20d','dma50','dma200','wti','wti_20d','move','jpy','breadth','breadth_20d','vix_term','sp500','margin_month','margin_debt','margin_yoy','margin_3m','volume','volume_avg','sp500_chg','jpy3d','sp_high','sp_low','nasdaq','nasdaq100','cp_date','cp_financial','cp_nonfinancial','cp_treasury']
import json
code='''const assert=require('node:assert/strict');
const keys=KEYS;
const nums=[18.44,-7.7539,21.236,331,16,61,106,5.15,14,-0.1862,5.7049,108.21,6.6739,101.3,157.806,43.93,13.77,1.16,7690.73,202609,1480054,31.3859,-1.4658,4587260000,5193972000,0.4085,-0.3259,7731.18,7684.79,26430.89,29529.35,20261013,4.08,4.09,4.09];
const entry={values:Object.fromEntries(keys.map((k,i)=>[k,nums[i]]))};
const numberInputs=Object.fromEntries(keys.map((k,i)=>[k,{value:String(nums[i]),defaultValue:String(nums[i])}]));
const columns=keys.slice(0,18).map(k=>[k]),forcedColumns=keys.slice(19,29).map(k=>[k]),marketColumns=keys.slice(29,31).map(k=>[k]),liquidityColumns=keys.slice(31).map(k=>[k]);
const dateText='2026-10-21',dateInput={value:'2026-10-20'},timeInput={value:'08:00:00'},labelInput={value:''},overrideInputs={};
const parseHistoryOverrides=()=>({});const alert=m=>{throw Error(m)};
let saved;
const updateEntryDateTime=(entry,date,time,values)=>{saved=values;assert.equal(date,'2026-10-20')};
function save(){HANDLER}
save();assert.deepEqual(saved,entry.values);
numberInputs.volume.value='123';save();assert.equal(saved.volume,123);
numberInputs.jpy3d.value='';save();assert.equal(saved.jpy3d,null);
console.log('Backdating preserves all 35 supplied fields; explicit edits and clearing still work.');
'''.replace('KEYS',json.dumps(keys)).replace('HANDLER',handler)
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)/'test.cjs';p.write_text(code);subprocess.run([os.environ.get('NODE','node'),str(p)],check=True)
 p.write_text('\n'.join(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)));subprocess.run([os.environ.get('NODE','node'),'--check',str(p)],check=True)
