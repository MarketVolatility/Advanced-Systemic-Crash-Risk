import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
/** Check embedded JSON against its declared TS shape before it becomes executable output. */
export function checkBuildContracts(template:string,datasets:ReadonlyMap<string,unknown>):void{
 const path=resolve('src/runtime/build-data-check.ts');
 const code=[...datasets].map(([name,value])=>'const checked_'+name+':typeof '+name+' = '+JSON.stringify(value)+'; void checked_'+name+';').join('\n');
 const configuration:unknown=JSON.parse(readFileSync('tsconfig.json','utf8'));
 if(typeof configuration!=='object'||configuration===null)throw Error('Invalid TypeScript configuration');
 const config=ts.parseJsonConfigFileContent(configuration,ts.sys,'.');
 const host=ts.createCompilerHost(config.options),getSourceFile=host.getSourceFile.bind(host);
 host.getSourceFile=(file,languageVersion,onError,shouldCreateNewSourceFile)=>resolve(file)===path?ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true):getSourceFile(file,languageVersion,onError,shouldCreateNewSourceFile);
 const program=ts.createProgram([...config.fileNames,path],config.options,host);
 const diagnostics=ts.getPreEmitDiagnostics(program);
 if(diagnostics.length)throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:file=>file,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
 const tags=new Map([...template.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bid="([^"]+)"/g)].map(match=>[match[2],match[1]?.toLowerCase()]));
 const dom=ts.createSourceFile('dom.ts',readFileSync('src/runtime/dom.ts','utf8'),ts.ScriptTarget.Latest,true);
 const typeTags:Record<string,readonly string[]>={HTMLInputElement:['input'],HTMLTextAreaElement:['textarea'],HTMLSelectElement:['select'],HTMLButtonElement:['button'],HTMLDialogElement:['dialog'],HTMLDetailsElement:['details'],HTMLFormElement:['form'],HTMLTableElement:['table'],HTMLTableSectionElement:['thead','tbody','tfoot'],HTMLCanvasElement:['canvas'],SVGSVGElement:['svg']};
 for(const statement of dom.statements)if(ts.isInterfaceDeclaration(statement)&&statement.name.text==='DashboardElements')for(const member of statement.members){
  if(!ts.isPropertySignature(member)||!member.type||!member.name||!ts.isStringLiteral(member.name))throw Error('Unsupported dashboard element contract');
  const id=member.name.text,kind=member.type.getText(dom),tag=tags.get(id);
  if(!tag)throw Error('Missing declared template element: '+id);
  if(kind!=='HTMLElement'&&!typeTags[kind]?.includes(tag))throw Error('Template element type mismatch: '+id+' ('+kind+' versus '+tag+')');
 }
 console.log('PASS: embedded dataset types and required template element contracts.');
}
