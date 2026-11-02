import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir, lstat} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stampFile=resolve(root,'node_modules/.check-passed');
export async function publishFiles():Promise<string[]> {
 const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0');
 const files:string[]=[];
 for(const name of [...new Set(names)].filter(Boolean).sort()){
  const stat=await lstat(resolve(root,name)).catch(()=>null);
  if(stat===null)continue;
  if(!stat.isFile())throw Error('Cannot publish non-regular file: '+name);
  files.push(name);
 }
 return files;
}
async function fingerprint():Promise<string>{
 const hash=createHash('sha256');
 for(const name of await publishFiles()){
  if(name==='CHANGELOG.md'||name==='README.md')continue;
  hash.update(name).update('\0').update(await readFile(resolve(root,name))).update('\0');
 }
 return hash.digest('hex');
}
export async function verifyStamp():Promise<boolean>{
 return await readFile(stampFile,'utf8').catch(()=>'')===await fingerprint();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2];
 if(mode==='write'){
  await mkdir(dirname(stampFile),{recursive:true});
  await writeFile(stampFile,await fingerprint());
 }else if(mode==='verify')process.exitCode=await verifyStamp()?0:1;
 else throw Error('Usage: node scripts/stamp.mts write|verify');
}
