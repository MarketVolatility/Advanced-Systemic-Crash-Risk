import {setThemeChoice} from './theme';
interface Screen {id:string;title:string;target:string;}
interface Command {label:string;hint:string;run:()=>void;}
const shortcuts:Readonly<Record<string,string>>={d:'overview',u:'update',h:'history',c:'charts',r:'factors',f:'fed',b:'funding',p:'cp',a:'analysis',s:'studies',m:'methodology',e:'restore',y:'sync'};
function button(label:string,run:()=>void):HTMLButtonElement {const el=document.createElement('button');el.type='button';el.textContent=label;el.addEventListener('click',run);return el;}
export function initializeQuickJump(topbar:HTMLElement,screens:readonly Screen[],navigate:(target:string)=>void):void {
 const shell=document.getElementById('appShell');if(!shell)return;
 const dialog=document.createElement('dialog');dialog.id='quickJumpDialog';dialog.className='quick-jump';dialog.setAttribute('aria-label','Quick jump');
 const input=document.createElement('input');input.type='search';input.placeholder='Screen, action or market ticker';input.setAttribute('aria-label','Search screens, actions or market tickers');input.autocomplete='off';
 input.setAttribute('role','combobox');input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls','quickJumpResults');input.setAttribute('aria-autocomplete','list');
 const results=document.createElement('div');results.id='quickJumpResults';results.className='quick-jump-results';results.setAttribute('role','listbox');results.setAttribute('aria-label','Search results');
 const count=document.createElement('p');count.setAttribute('aria-live','polite');
 dialog.append(input,count,results,button('Close',()=>dialog.close()));shell.append(dialog);
 const help=document.createElement('dialog');help.id='shortcutHelp';help.setAttribute('aria-label','Keyboard shortcuts');
 const heading=document.createElement('h2');heading.textContent='Keyboard shortcuts';help.append(heading);
 for(const text of ['Ctrl+K / ⌘K / / — Quick jump','? — Show shortcuts','Escape — Close menu or dialog','Shortcuts are disabled while typing in a field.',...Object.entries(shortcuts).map(([key,id])=>'G then '+key.toUpperCase()+' — '+(screens.find(screen=>screen.id===id)?.title??id))]){const row=document.createElement('p');row.textContent=text;help.append(row);}
 help.append(button('Close',()=>help.close()));shell.append(help);
 let returnFocus:HTMLElement|null=null;
 for(const modal of [dialog,help]){
  modal.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
  modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
 }
 const commands:Command[]=screens.map(screen=>({label:screen.id==='overview'?'Dashboard · '+screen.title:screen.title,hint:'Screen',run:()=>navigate(screen.target)}));
 for(const value of ['auto','light','dark'] as const)commands.push({label:'Theme: '+value,hint:'Appearance',run:()=>setThemeChoice(value)});
 commands.push({label:'Sync now',hint:'Account',run:()=>document.getElementById('syncNowBtn')?.click()},{label:'Keyboard shortcuts',hint:'?',run:()=>help.showModal()});
 // This project has market diagnostics, not portfolio holdings. Keep ticker destinations explicit.
 for(const [label,target] of [['VIX · Volatility indicators','riskFactorsScreen'],['MOVE · Bond volatility','riskFactorsScreen'],['USDJPY · Carry-unwind momentum','riskFactorsScreen'],['SPX / S&P 500 · Risk charts','dashboardRiskCharts'],['NDX / Nasdaq 100 · Leadership','cpUpdate'],['COMP / Nasdaq Composite · Leadership','cpUpdate']] as const){
  commands.push({label,hint:'Market indicator',run:()=>{
   const focusIndicator=()=>requestAnimationFrame(()=>{const ticker=label.split(' ')[0]??'';const row=[...document.querySelectorAll<HTMLTableRowElement>('#metricTableBody tr')].find(item=>item.cells[0]?.textContent?.includes(ticker));if(row){row.tabIndex=-1;row.focus({preventScroll:true});row.scrollIntoView({block:'center'});}});
   if(target==='riskFactorsScreen'){
    if(location.hash==='#'+target){navigate(target);focusIndicator();return;}
    window.addEventListener('hashchange',focusIndicator,{once:true});
   }
   navigate(target);
  }});
 }
 let matches:Command[]=[],selected=0;
 function highlight():void {for(const [index,item] of [...results.children].entries())item.setAttribute('aria-selected',String(index===selected));const active=results.children[selected];if(active)input.setAttribute('aria-activedescendant',active.id);else input.removeAttribute('aria-activedescendant');}
 function run(command:Command):void {const origin=returnFocus;returnFocus=null;dialog.close();origin?.focus();command.run();}
 function render():void {
  const query=input.value.trim().toLowerCase();matches=commands.filter(command=>(command.label+' '+command.hint).toLowerCase().includes(query));selected=0;results.replaceChildren();count.textContent=matches.length?matches.length+' results':'No matching screens, actions or market tickers.';
  for(const [index,command] of matches.entries()){const item=document.createElement('div');item.id='quickJumpResult'+index;item.setAttribute('role','option');item.textContent=command.label+' — '+command.hint;item.addEventListener('click',()=>run(command));results.append(item);}highlight();
 }
 function canOpen():boolean {return !!shell&&!document.querySelector('dialog[open]')&&getComputedStyle(shell).display!=='none';}
 function rememberFocus():void {returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;}
 function openSearch():void {if(!canOpen())return;rememberFocus();input.value='';render();dialog.showModal();input.focus();}
 const search=button('Search',openSearch);search.id='quickJumpButton';search.title='Quick jump (Ctrl+K / ⌘K)';search.setAttribute('aria-keyshortcuts','Control+k Meta+k /');topbar.insertBefore(search,topbar.querySelector('.account-control'));
 input.addEventListener('input',render);
 input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selected=matches.length?(selected+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length:0;highlight();results.children[selected]?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'){event.preventDefault();const command=matches[selected];if(command)run(command);}});
 let prefixUntil=0;
 document.addEventListener('keydown',event=>{
  const target=event.target;
  if(event.isComposing||event.repeat||target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')){prefixUntil=0;return;}
  if(!canOpen()){prefixUntil=0;return;}
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='k'){event.preventDefault();prefixUntil=0;openSearch();return;}
  if(event.ctrlKey||event.metaKey||event.altKey){prefixUntil=0;return;}
  if(key==='/'||key==='?'){event.preventDefault();prefixUntil=0;if(key==='/')openSearch();else{rememberFocus();help.showModal();}return;}
  if(Date.now()<prefixUntil){prefixUntil=0;const screen=screens.find(item=>item.id===shortcuts[key]);if(screen){event.preventDefault();navigate(screen.target);}return;}
  if(key==='g')prefixUntil=Date.now()+1200;
 });
}
