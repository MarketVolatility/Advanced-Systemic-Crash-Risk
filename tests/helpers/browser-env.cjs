// Fill browser APIs absent from the original lightweight VM test doubles.
const vm=require('node:vm');
const original=vm.createContext;
vm.createContext=function(context={},...args){
  if(context.document){
    const doc=context.document;
    doc.documentElement??={dataset:{}};
    doc.querySelector??=()=>({content:'',style:{},dataset:{}});
    doc.querySelectorAll??=()=>[];
    doc.getElementById??=()=>null;
    context.window??={};
    context.window.matchMedia??=()=>({matches:false,addEventListener(){}});
    context.window.dispatchEvent??=()=>{};
    context.window.addEventListener??=()=>{};
    context.Event??=class Event{constructor(type){this.type=type;}};
  }
  return original.call(vm,context,...args);
};
