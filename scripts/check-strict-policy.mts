import ts from 'typescript';
import {readFileSync} from 'node:fs';
const requiredFlags=['strict','noUncheckedIndexedAccess','exactOptionalPropertyTypes','noPropertyAccessFromIndexSignature','useUnknownInCatchVariables','noUnusedLocals','noUnusedParameters','noImplicitReturns','noImplicitOverride'] as const;
const files=new Set<string>();
const failures:string[]=[];
for(const config of ['tsconfig.json','tsconfig.tools.json','tsconfig.browser.json']){
 const json:unknown=JSON.parse(readFileSync(config,'utf8'));
 if(typeof json!=='object'||json===null||Array.isArray(json))throw Error('Invalid configuration '+config);
 const parsed=ts.parseJsonConfigFileContent(json,ts.sys,'.');
 for(const flag of requiredFlags)if(parsed.options[flag]!==true)failures.push(config+': '+flag+' must be true');
 if(parsed.options.skipLibCheck!==false)failures.push(config+': skipLibCheck must be false');
 for(const file of parsed.fileNames)files.add(file);
}
for(const path of files){
 const text=readFileSync(path,'utf8'),source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
 const report=(node:ts.Node,message:string)=>failures.push(path+':'+(source.getLineAndCharacterOfPosition(node.getStart(source)).line+1)+': '+message);
 function visit(node:ts.Node):void{
  if(node.kind===ts.SyntaxKind.AnyKeyword)report(node,'Explicit any is prohibited');
  if(ts.isNonNullExpression(node)){
   const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line;
   if(!text.split('\n').slice(Math.max(0,line-2),line+1).some(value=>/\/\/.*invariant:/i.test(value)))report(node,'Non-null assertion needs a local invariant explanation');
  }
  if((ts.isAsExpression(node)||ts.isTypeAssertionExpression(node))&&ts.isCallExpression(node.expression)&&/^(?:JSON\.parse|parseJson)$/.test(node.expression.expression.getText(source)))report(node,'Validate parsed data instead of asserting its type');
  if((ts.isAsExpression(node)||ts.isTypeAssertionExpression(node))&&(ts.isAsExpression(node.expression)||ts.isTypeAssertionExpression(node.expression))&&node.expression.type.kind===ts.SyntaxKind.UnknownKeyword)report(node,'Double assertion through unknown is prohibited');
  if(process.argv.includes('--inventory')&&(ts.isNonNullExpression(node)||ts.isAsExpression(node)&&node.type.kind!==ts.SyntaxKind.TypeReference))console.log(path+':'+(source.getLineAndCharacterOfPosition(node.getStart(source)).line+1),node.getText(source).slice(0,140));
  ts.forEachChild(node,visit);
 }
 visit(source);
 // Inspect comments only, so explanatory strings and HTML step="any" are not false positives.
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,text);
 for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())if((token===ts.SyntaxKind.SingleLineCommentTrivia||token===ts.SyntaxKind.MultiLineCommentTrivia)&&/@ts-(?:ignore|expect-error|nocheck)\b/.test(scanner.getTokenText()))failures.push(path+': TypeScript suppression directive is prohibited');
}
if(failures.length)throw Error(failures.join('\n'));
console.log('PASS: strict compiler configuration and no-escape policy ('+files.size+' TypeScript files).');
