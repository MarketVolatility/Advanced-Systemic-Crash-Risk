import {spawnSync} from 'node:child_process';
const suites=['scoring-contract','history-overrides','recovery-storage','history-performance','sync-preservation','analysis-full-history','composite-reconciliation'];
for(const suite of suites){
 const result=spawnSync(process.execPath,['--require','./tests/helpers/browser-env.cjs',`tests/${suite}.cjs`],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
const preload=new URL('../tests/helpers/strict-runtime.mts',import.meta.url).href;
const result=spawnSync('python3',['tests/test_momentum.py'],{stdio:'inherit',env:{...process.env,NODE:process.execPath,NODE_OPTIONS:[process.env['NODE_OPTIONS']??'','--import='+preload].join(' ').trim()}});
process.exit(result.status||0);
