export type ThemeChoice='auto'|'light'|'dark';
let choice:ThemeChoice='auto';
let device:MediaQueryList|undefined;
function applyTheme():void {
 document.documentElement.dataset['theme']=choice==='auto'?(device?.matches?'light':'dark'):choice;
 for(const control of document.querySelectorAll('[data-theme-choice]'))control.setAttribute('aria-pressed',String(control.getAttribute('data-theme-choice')===choice));
}
export function setThemeChoice(value:ThemeChoice):void {
 choice=value;
 try{localStorage.setItem('crash-risk-theme',value);}catch{/* Use the selected appearance even if storage is unavailable. */}
 applyTheme();
}
export function initializeTheme():void {
 device=window.matchMedia('(prefers-color-scheme: light)');
 try{const saved=localStorage.getItem('crash-risk-theme');if(saved==='light'||saved==='dark')choice=saved;}catch{/* Follow device. */}
 applyTheme();device.addEventListener('change',applyTheme);
 document.addEventListener('DOMContentLoaded',applyTheme);
}
export function themeControls():HTMLFieldSetElement {
 const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Theme';group.append(legend);
 for(const value of ['auto','light','dark'] as const){const control=document.createElement('button');control.type='button';control.textContent=value.charAt(0).toUpperCase()+value.slice(1);control.dataset['themeChoice']=value;control.setAttribute('aria-pressed',String(value===choice));control.addEventListener('click',()=>setThemeChoice(value));group.append(control);}
 return group;
}
