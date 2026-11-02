function errorMessage(error:unknown):string {
 if(typeof error==='object'&&error!==null&&'message' in error&&typeof error.message==='string')return error.message;
 return String(error);
}
function finiteNumber(value:unknown):value is number {return Number.isFinite(value);}
/** JSON and array boundaries remain unknown until the relevant validator checks them. */
function parseJson(text:string):unknown {return JSON.parse(text);}
function unknownArray(value:unknown):value is unknown[] {return Array.isArray(value);}
function checkedString(value:unknown):string {if(typeof value!=='string')throw Error('Expected text.');return value;}
function checkedNumber(value:unknown):number {if(!finiteNumber(value))throw Error('Expected a finite number.');return value;}
function nullableString(value:unknown):string|null {return value==null?null:checkedString(value);}
function nullableNumber(value:unknown):number|null {return value==null?null:checkedNumber(value);}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!unknownArray(value);}
function optionalTextFields(value:Record<string,unknown>,keys:readonly string[]):boolean{return keys.every(key=>value[key]===undefined||typeof value[key]==='string');}
/** Fail explicitly if a required structural invariant is broken; never synthesize a data value. */
function requiredValue<T>(value:T|null|undefined):T {if(value===null||value===undefined)throw Error('Required value is missing.');return value;}
