import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, copyFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {root,publishFiles,verifyStamp} from './stamp.mts';
const repo='https://MarketVolatility@github.com/MarketVolatility/Advanced-Systemic-Crash-Risk.git';
const site='https://marketvolatility.github.io/Advanced-Systemic-Crash-Risk/';
function git(args:string[],cwd:string):string{
 return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['inherit','pipe','inherit']});
}
// Build/test the source before copying it. A clone preserves remote files/history and avoids resetting local work.
if(!await verifyStamp())execFileSync('npm',['run','check'],{cwd:root,stdio:'inherit'});
if(!await verifyStamp())throw Error('Checks did not produce a current stamp. Nothing uploaded.');
const files=await publishFiles();
await mkdir(resolve(root,'node_modules'),{recursive:true});
const stage=await mkdtemp(resolve(root,'node_modules/publish-'));
git(['clone','--quiet','--branch','main',repo,stage],root);
git(['config','credential.helper','osxkeychain'],stage);
git(['config','user.name','MarketVolatility'],stage);
git(['config','user.email','MarketVolatility@users.noreply.github.com'],stage);
for(const file of files){
 const destination=resolve(stage,file);
 await mkdir(dirname(destination),{recursive:true});
 await copyFile(resolve(root,file),destination);
}
git(['add','--',...files],stage);
const changes=git(['diff','--cached','--name-status'],stage);
if(!changes.trim())console.log('Nothing new to publish.');
else{
 console.log('Changed files:\n'+changes);
 const date=new Date().toISOString().replace(/[:.]/g,'-');
 git(['commit','--quiet','-m','Update '+date],stage);
 // Archive before pushing so a successful upload always has its exact local copy.
 const snapshot=resolve(root,'GitHub uploads',date+' publish');
 await mkdir(snapshot,{recursive:true});
 const archive=resolve(stage,'.git/published.tar');
 git(['archive','--format=tar','--output',archive,'HEAD'],stage);
 execFileSync('tar',['-xf',archive,'-C',snapshot]);
 try{git(['push','origin','HEAD:main'],stage);}
 catch(error){console.error('Upload failed. Snapshot is an unpublished candidate: '+snapshot);throw error;}
 console.log('Published: '+site+'\nSaved copy: '+snapshot+'\nCommit: '+git(['rev-parse','HEAD'],stage).trim());
}
