require('./browser-env.cjs');
const fs=require('node:fs'),vm=require('node:vm');
module.exports=function load(path='index.html'){
 const html=fs.readFileSync(path,'utf8');
 const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 const el=()=>({value:'',style:{},dataset:{},children:[],setAttribute(){},appendChild(n){this.children.push(n)},replaceChildren(){this.children=[]},classList:{add(){},remove(){},toggle(){}}});
 const els=new Map(),store=new Map();
 const context={console,window:{},document:{addEventListener(){},getElementById:id=>{if(!els.has(id))els.set(id,el());return els.get(id)},createElement:el},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},Intl,Date,URL,setTimeout,clearTimeout,alert:m=>{throw Error(m)},confirm:()=>true};
 vm.createContext(context);vm.runInContext(script,context);
 return {context,html,run:code=>vm.runInContext(code,context)};
};
