import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
type Obj=Record<string,unknown>;
function isRecord(value:unknown):value is Obj {return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function record(value:unknown):Obj {return isRecord(value)?value:{};}
function rows(path:string):Obj[]{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(line=>record(JSON.parse(line)));}
function files(path:string):string[]{return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(path,entry.name)):entry.name.endsWith('.jsonl')?[join(path,entry.name)]:[]);}
const project='/Users/mike/Documents/ChatGPT/coding- adv login';
const sources=[...files('/Users/mike/.codex/sessions'),...files('/Users/mike/.codex/archived_sessions')];
type Interval=readonly [number,number];
const start=Date.parse(process.argv[2]??'2026-10-31T01:24:53Z'),end=Date.parse(process.argv[3]??'2026-10-31T13:00:00Z');
if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Supply valid start and end timestamps');
function number(value:unknown):number|undefined{return typeof value==='number'&&Number.isFinite(value)?value:undefined;}
function merge(values:readonly Interval[]):Interval[]{const result:Interval[]=[];for(const [a,b] of [...values].sort((x,y)=>x[0]-y[0])){if(b<=a)continue;const last=result.at(-1);if(last&&a<=last[1])result[result.length-1]=[last[0],Math.max(last[1],b)];else result.push([a,b]);}return result;}
function length(values:readonly Interval[]):number{return merge(values).reduce((sum,[a,b])=>sum+b-a,0);}
function intersect(a:readonly Interval[],b:readonly Interval[]):Interval[]{return merge(a.flatMap(([x,y])=>b.map(([u,v]):Interval=>[Math.max(x,u),Math.min(y,v)])));}
function subtract(a:readonly Interval[],b:readonly Interval[]):Interval[]{let result=merge(a);for(const [x,y] of merge(b))result=result.flatMap(([u,v]):Interval[]=>y<=u||x>=v?[[u,v]]:[[u,Math.min(x,v)],[Math.max(y,u),v]].filter(([c,d])=>c!==undefined&&d!==undefined&&d>c).map(pair=>[pair[0]??0,pair[1]??0]));return result;}
const active:Interval[]=[],local:Interval[]=[],commandLifecycle:Interval[]=[],ai:Interval[]=[],other:Interval[]=[];let matchedSessions=0,excludedAutomationTurns=0,includedContinuationTurns=0,excludedReportingTurns=0,commandCount=0,missingCommandTiming=0,reportedTurnDurationMs=0;
const details:Obj[]=[];
for(const path of sources){
 const data=rows(path);if(!data.some(row=>row['type']==='session_meta'&&record(row['payload'])['cwd']===project))continue;
 const events=data.filter(row=>row['type']==='event_msg').map(row=>record(row['payload']));
 const excluded=new Set<string>(),heartbeat=new Set<string>(),reporting=new Set<string>();
 for(const event of events){const item=record(event['item']);if(item['type']!=='UserMessage')continue;const text=JSON.stringify(item['content'])??'',id=String(event['turn_id']);if(text.includes('<heartbeat>'))heartbeat.add(id);else if(/daily report.*usage|report.*local vs cloud|report again with actual|what is 1 nov report/i.test(text))reporting.add(id);}
 for(const id of heartbeat){const work=events.some(event=>String(event['turn_id'])===id&&record(event['item'])['type']==='CommandExecution'&&/scripts\/(?:build|test)\.mts|tests\/browser\.mts|typescript\/bin\/tsc/.test(JSON.stringify(record(event['item'])['command'])??''));if(!work)excluded.add(id);}
 const turns=new Map<string,Interval>();
 for(const event of events)if(event['type']==='task_complete'){
  const a=number(event['started_at']),b=number(event['completed_at']);if(a===undefined||b===undefined||b*1000<=start||a*1000>=end)continue;
  const id=String(event['turn_id']);
  details.push({kind:'task',id,start:new Date(a*1000).toISOString(),end:new Date(b*1000).toISOString(),durationMs:number(event['duration_ms'])??null,classification:excluded.has(id)?'excluded check-only':reporting.has(id)?'excluded reporting':heartbeat.has(id)?'continuation':'user work'});
  if(excluded.has(String(event['turn_id']))){excludedAutomationTurns++;continue;}
  if(reporting.has(String(event['turn_id']))){excludedReportingTurns++;continue;}
  if(heartbeat.has(String(event['turn_id'])))includedContinuationTurns++;
  // Keep the provider's duration separate: suspended turns can have a much longer timestamp span.
  if(a*1000>=start&&b*1000<=end)reportedTurnDurationMs+=number(event['duration_ms'])??0;
  turns.set(String(event['turn_id']),[Math.max(start,a*1000),Math.min(end,b*1000)]);
 }
 if(!turns.size)continue;matchedSessions++;active.push(...turns.values());
 for(const event of events){const turn=turns.get(String(event['turn_id']));if(!turn||event['type']!=='item_completed')continue;
  const item=record(event['item']),a=number(event['started_at_ms']),b=number(event['completed_at_ms']);if(a===undefined||b===undefined||b<a)continue;
  const window:Interval=[Math.max(start,turn[0],a),Math.min(end,turn[1],b)];
  if(item['type']==='CommandExecution'){
   commandLifecycle.push(window);
   const duration=record(item['duration']),secs=number(duration['secs']),nanos=number(duration['nanos']);
   if(secs===undefined||nanos===undefined){missingCommandTiming++;other.push(window);continue;}
   const elapsed=secs*1000+nanos/1e6;
   details.push({kind:'command',turnId:String(event['turn_id']),start:new Date(a).toISOString(),end:new Date(b).toISOString(),durationMs:elapsed,status:item['status'],command:item['command']});
   // Duration excludes approval latency; end-align it within the recorded command lifecycle.
   local.push([Math.max(start,turn[0],a,b-elapsed),Math.min(end,turn[1],b)]);commandCount++;
   if(b-elapsed>a)other.push([Math.max(start,turn[0],a),Math.min(end,turn[1],b-elapsed)]);
  }else if(item['type']==='Reasoning'||item['type']==='AgentMessage')ai.push(window);
  else if(item['type']!=='UserMessage')other.push(window);
 }
}
const localOnly=merge(local),otherOnly=subtract(other,localOnly),aiOnly=subtract(ai,[...localOnly,...otherOnly]);
const unknown=subtract(active,[...localOnly,...otherOnly,...aiOnly]);
const localMs=length(localOnly),aiMs=length(aiOnly),classified=localMs+aiMs;
if(process.argv.includes('--details'))console.log(JSON.stringify(details,null,2));
console.log(JSON.stringify({start:new Date(start).toISOString(),end:new Date(end).toISOString(),matchedSessions,excludedAutomationTurns,includedContinuationTurns,excludedReportingTurns,commandCount,missingCommandTiming,turnWallSpanMinutes:length(active)/60000,providerReportedTurnDurationMinutes:reportedTurnDurationMs/60000,commandLifecycleWallMinutes:length(commandLifecycle)/60000,localCommandRecordedDurationMinutes:localMs/60000,recordedAiResponseMinutes:aiMs/60000,otherToolOrApprovalMinutes:length(otherOnly)/60000,unclassifiedWithinCompletedTurnsMinutes:length(unknown)/60000,localPercentOfClassified:classified?localMs/classified*100:null,aiPercentOfClassified:classified?aiMs/classified*100:null,coveragePercentOfWallSpan:length(active)?classified/length(active)*100:null,overlapAiLocalMinutes:length(intersect(ai,localOnly))/60000,method:'Include automatic continuation that executes builds/tests/typechecks; exclude check-only heartbeats and identified reporting turns. Union timestamp intervals, counting overlap once. Show command lifecycle wall time separately from recorded execution duration; lifecycle can include suspension/delayed completion. Provider turn duration is separate from wall span and is not CPU or model compute. AI message/reasoning intervals are a lower-bound proxy, not full AI wait. Unclassified gaps cannot reliably be attributed to AI, idle, network, usage limits or suspension. Incomplete turns excluded.'},null,2));
