import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
type Obj=Record<string,unknown>;
function isObj(v:unknown):v is Obj{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function obj(v:unknown):Obj{if(!isObj(v))throw Error('Expected object');return v;}
function arr(v:unknown):unknown[]{if(!Array.isArray(v))throw Error('Expected array');return v;}
function number(v:unknown):number{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Expected number');return v;}
function read(path:string):unknown{return JSON.parse(readFileSync(path,'utf8'));}
type Quote=[string,number];
function quotes(v:unknown):Quote[]{return arr(v).map(v=>{const r=arr(v),date=r[0];if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||r.length!==2)throw Error('Bad quote');return [date,number(r[1])];});}
function merge(old:Quote[],file:string,symbol:string):Quote[]{const r=obj(arr(obj(obj(read('historical-data/requests/2026-11-02/'+file))['chart'])['result'])[0]);if(obj(r['meta'])['symbol']!==symbol)throw Error('Wrong instrument');const q=obj(arr(obj(r['indicators'])['quote'])[0]);const fresh=arr(r['timestamp']).flatMap((t,i):Quote[]=>{const date=new Date(number(t)*1000).toISOString().slice(0,10);if(date<='2026-10-20'||date>'2026-10-30')return [];const close=number(arr(q['close'])[i]),open=number(arr(q['open'])[i]),high=number(arr(q['high'])[i]),low=number(arr(q['low'])[i]);if(low>close||high<close||low>open||high<open)throw Error('Invalid OHLC');return [[date,Number(close.toFixed(2))]];});if(fresh.length!==8)throw Error('Expected eight additional equity sessions');console.log(symbol,JSON.stringify(fresh));return [...new Map([...old,...fresh])].sort((a,b)=>a[0].localeCompare(b[0]));}
const sp=merge(quotes(read('src/data/sp500Daily.json')),'spx.json','^GSPC');
const nd=obj(read('src/data/nasdaqDaily.json'));
const nasdaq=merge(quotes(nd['nasdaq']),'ixic.json','^IXIC'),nasdaq100=merge(quotes(nd['nasdaq100']),'ndx.json','^NDX');
const integrity=obj(read('tests/fixtures/data-integrity.json'));
const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Refresh only the two intentionally changed dataset pins. The independent
// model-baseline fixture remains unchanged and must pass the scoring regression.
integrity['sp500Daily']=hash(sp);integrity['nasdaqDaily']=hash({nasdaq,nasdaq100});
writeFileSync('tests/fixtures/data-integrity.json',JSON.stringify(integrity,null,2)+'\n');
writeFileSync('src/data/sp500Daily.json',JSON.stringify(sp));writeFileSync('src/data/nasdaqDaily.json',JSON.stringify({nasdaq,nasdaq100}));
for(const file of ['package.json','package-lock.json']){const data=obj(read(file));data['version']='1.1.1';if(file==='package-lock.json')obj(obj(data['packages'])[''])['version']='1.1.1';writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
for(const [file,from,to] of [['src/ui/workspace.ts','Version 1.1.0','Version 1.1.1'],['src/index.template.html','embedded through October 20, 2026','embedded through October 30, 2026']]){if(!file||!from||!to)throw Error('Invalid replacement');writeFileSync(file,readFileSync(file,'utf8').replaceAll(from,to));}
