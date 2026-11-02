import {readFileSync,writeFileSync} from 'node:fs';
const dir='historical-data/requests/2026-11-02/';
type Obj=Record<string,unknown>;
function isObj(v:unknown):v is Obj {return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function obj(v:unknown):Obj {if(!isObj(v))throw Error('Expected object');return v;}
function arr(v:unknown):unknown[]{if(!Array.isArray(v))throw Error('Expected array');return v;}
function num(v:unknown):number {if(typeof v!=='number'||!Number.isFinite(v))throw Error('Expected finite number');return v;}
function str(v:unknown):string {if(typeof v!=='string')throw Error('Expected string');return v;}
function at<T>(a:readonly T[],i:number):T {const v=a.at(i);if(v===undefined)throw Error(`Missing index ${i}`);return v;}
function read(f:string):string{return readFileSync(dir+f,'utf8');}
function json(f:string):unknown{return JSON.parse(read(f));}
type Point={date:string;value:number};
function csv(f:string,col=1):Point[]{return read(f).trim().split(/\r?\n/).slice(1).flatMap(line=>{const cells=line.split(',');const value=cells[col],date=cells[0];return date&&value&&value!=='.'&&Number.isFinite(Number(value))?[{date,value:Number(value)}]:[];});}
function cboe(f:string):Point[]{return csv(f,4).map(p=>{const [m,d,y]=p.date.split('/');return {...p,date:`${y}-${m}-${d}`};});}
function yahoo(f:string){const result=obj(at(arr(obj(obj(json(f))['chart'])['result']),0)),meta=obj(result['meta']),q=obj(at(arr(obj(result['indicators'])['quote']),0));const times=arr(result['timestamp']);const missing:string[]=[];const values=times.flatMap((t,i)=>{const date=new Date(num(t)*1000).toISOString().slice(0,10);if(['open','high','low','close','volume'].some(k=>at(arr(q[k]),i)===null)){missing.push(date);return [];}return [{date,open:num(at(arr(q['open']),i)),high:num(at(arr(q['high']),i)),low:num(at(arr(q['low']),i)),value:num(at(arr(q['close']),i)),volume:num(at(arr(q['volume']),i))}];});return {meta,values,missing,invalid:values.filter(p=>p.low>p.open||p.low>p.value||p.high<p.open||p.high<p.value)};}
const spx=yahoo('spx.json'),fx=yahoo('fx.raw'),move=yahoo('move.raw');
const equity=spx.values.filter(p=>p.date<='2026-10-30');
const holidays=new Set(['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07']);
function sessions(start:string,end:string,bond=false):string[]{const out:string[]=[];for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000){const d=new Date(t),date=d.toISOString().slice(0,10);if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!holidays.has(date)&&(!bond||date!=='2026-10-12'))out.push(date);}return out;}
function checkWindow(points:Point[],bond=false):void {const dates=sessions(at(points,0).date,at(points,-1).date,bond);if(JSON.stringify(dates)!==JSON.stringify(points.map(p=>p.date)))throw Error('Incomplete calendar window');}
const last=at(equity,-1),ma50=equity.slice(-50),ma200=equity.slice(-200),vol=equity.slice(-21,-1);checkWindow(ma200);checkWindow(vol);if(ma50.length!==50||ma200.length!==200||vol.length!==20||spx.invalid.length)throw Error('Equity validation failed');
const mean=(p:Point[]):number=>p.reduce((s,v)=>s+v.value,0)/p.length;
const pct=(a:number,b:number):number=>(a/b-1)*100;
const vix=cboe('vix.raw'),vix3m=cboe('vix3m.raw');checkWindow(vix.slice(-6));
const hy=csv('BAMLH0A0HYM2.csv').filter(p=>sessions(p.date,p.date,true).length),bbb=csv('BAMLC0A4CBBB.csv');checkWindow(hy.slice(-21),true);
const breadth=arr(obj(json('breadth.raw'))['data']).map(v=>{const r=obj(v);return {date:str(r['date']),value:num(r['spx_pct_above_50d']),members:r['spx_members']};}).filter(p=>p.date<='2026-10-30');checkWindow(breadth.slice(-21));
const treasury=[...read('treasury.raw').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...(m[1]??'').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>(c[1]??'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim())).filter(c=>c.some(v=>/^10\/\d\d\/2026$/.test(v)));
const finra=[...read('finra-sheet.xml').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].slice(0,17).map(m=>(m[1]??'').replace(/<[^>]*>/g,' '));
const data={spx:{meta:spx.meta,last,previous:at(equity,-2),ma50:{start:at(ma50,0).date,end:last.date,count:ma50.length,mean:mean(ma50),distance:pct(last.value,mean(ma50))},ma200:{start:at(ma200,0).date,end:last.date,count:ma200.length,mean:mean(ma200),distance:pct(last.value,mean(ma200))},volume:{start:at(vol,0).date,end:at(vol,-1).date,count:vol.length,mean:vol.reduce((s,p)=>s+p.volume,0)/20},daily:pct(last.value,at(equity,-2).value),recent:equity.slice(-4)},vix:{last:at(vix,-1),prior:at(vix,-2),lag5:at(vix,-6),day:pct(at(vix,-1).value,at(vix,-2).value),five:pct(at(vix,-1).value,at(vix,-6).value),vix3m:at(vix3m,-1)},hy:{last:at(hy,-1),lag5:at(hy,-6),lag20:at(hy,-21)},bbb:at(bbb,-1),fx:{meta:fx.meta,recent:fx.values.slice(-7),invalid:fx.invalid},move:{meta:move.meta,recent:move.values.slice(-3),invalid:move.invalid},breadth:{last:at(breadth,-1),lag20:at(breadth,-21)},funding:['DCPF3M','DCPN3M','DTB3'].map(id=>({id,recent:csv(id+'.csv').slice(-3)})),wti:csv('DCOILWTICO.csv').slice(-24),treasury,finra};
writeFileSync(dir+'calculations.json',JSON.stringify(data,null,2));
const bond=treasury.map(c=>{const [m,d,y]=at(c,0).split('/');return {date:`${y}-${m}-${d}`,value:Number(at(c,-3))};});checkWindow(bond,true);
const fxCompleted=fx.values.filter(p=>p.date>='2026-10-27'&&p.date<='2026-10-30');checkWindow(fxCompleted);if(fxCompleted.length!==4||fxCompleted.some(p=>p.low>p.value||p.high<p.value||p.low>p.open||p.high<p.open))throw Error('FX window invalid');
const b=at(bond,-1),blag=at(bond,-21),v=at(vix,-1),h=at(hy,-1),f=at(fxCompleted,-1);
const wtiEstimatedChange=pct(105.51,99.77); // Sourced endpoints; assumes one published October 28 observation in the lag window.
const row=[v.value,data.vix.day,data.vix.five,h.value*100,(h.value-at(hy,-6).value)*100,(h.value-at(hy,-21).value)*100,at(bbb,-1).value*100,b.value,(b.value-blag.value)*100,data.spx.ma50.distance,data.spx.ma200.distance,105.51,wtiEstimatedChange,100.2,f.value,at(breadth,-1).value,at(breadth,-1).value-at(breadth,-21).value,at(vix3m,-1).value-v.value,last.value,202609,1480054,pct(1480054,1126494),pct(1480054,1502072),last.volume,data.spx.volume.mean,data.spx.daily,pct(f.value,at(fxCompleted,0).value),last.high,last.low,25437,28384.85,20261029,4.05,4.09,4,20261030,20261029,20261013,20261029].map(n=>Number(n.toFixed(4)));
// Price fields use their provider's published precision rather than float32 storage noise.
for(const i of [18,27,28])row[i]=Number(num(row[i]).toFixed(2));row[14]=Number(num(row[14]).toFixed(3));
if(row.length!==39||row.some(n=>!Number.isFinite(n))||row[31]!==Math.max(num(row[36]),num(row[37]),num(row[38])))throw Error('Row contract failed');
writeFileSync(dir+'paste-row.txt',row.join(',')+'\n');
console.log(JSON.stringify({row:row.join(','),treasury:{last:b,lag20:blag},fx:fxCompleted,breadthMetadata:Object.fromEntries(Object.entries(obj(json('breadth.raw'))).filter(([k])=>k!=='data')),missing:{spx:spx.missing,fx:fx.missing},wtiEstimatedChange},null,2));
