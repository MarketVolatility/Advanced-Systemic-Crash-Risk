import {initializeAccountMenu} from './account-menu';
import {initializeQuickJump} from './quick-jump';
/** Page-level composition. Existing data controls retain their identities and listeners. */
interface WorkspaceScreen {
 id:string;title:string;eyebrow:string;description:string;icon:string;target:string;
}
const screens:WorkspaceScreen[]=[
 {id:'overview',title:'Market overview',eyebrow:'MONITOR',description:'A coordinated view of volatility, credit, macro conditions, equity structure and selling pressure.',icon:'◫',target:'dashboardOverview'},
 {id:'update',title:'Update market data',eyebrow:'DATA WORKSPACE',description:'Research, validate and save your market observations. The 35-value input format is unchanged.',icon:'↥',target:'dashboardUpdate'},
 {id:'history',title:'Market history',eyebrow:'DATA WORKSPACE',description:'Review observations, compare changes and edit saved entries in one place.',icon:'▤',target:'dashboardHistory'},
 {id:'charts',title:'Risk charts',eyebrow:'EXPLORE',description:'Compare the model’s stress signals with market performance across your selected window.',icon:'⌁',target:'dashboardRiskCharts'},
 {id:'factors',title:'Risk factors',eyebrow:'EXPLORE',description:'Inspect each reading, its model status and its contribution to the composite score.',icon:'▥',target:'riskFactorsScreen'},
 {id:'fed',title:'Federal Reserve watch',eyebrow:'DIAGNOSTICS',description:'Track sourced policy expectations, decision dates and changes between verified snapshots.',icon:'◎',target:'fedQuickHeading'},
 {id:'funding',title:'Dollar funding',eyebrow:'DIAGNOSTICS',description:'Review swap-line observations and funding stress alongside the selling-pressure diagnostics.',icon:'⇄',target:'fundingHeading'},
 {id:'cp',title:'CP funding & leadership',eyebrow:'DIAGNOSTICS',description:'Monitor commercial-paper spreads and Nasdaq 100 relative momentum with explicit source dates.',icon:'↗',target:'cpUpdate'},
 {id:'analysis',title:'Analysis workspace',eyebrow:'RESEARCH',description:'Build a research request from your saved snapshot, import a response and retain its original document.',icon:'▧',target:'analysisPromptControls'},
 {id:'studies',title:'Historical studies',eyebrow:'RESEARCH',description:'Explore retrospective stress periods with the same scoring rules used by the dashboard.',icon:'◷',target:'pastCrashesPanel'},
 {id:'methodology',title:'Model & methodology',eyebrow:'REFERENCE',description:'Understand score bands, indicator definitions, source limitations and the model’s fixed rules.',icon:'≡',target:'dashboardMethodology'},
 {id:'restore',title:'Recovery centre',eyebrow:'ACCOUNT',description:'Review recoverable rows and restore the records you need.',icon:'↶',target:'restorePanel'},
 {id:'sync',title:'Sync & backups',eyebrow:'ACCOUNT',description:'Compare browser and cloud copies, export backups and resolve sync problems.',icon:'⟳',target:'troubleshootSyncPanel'}
];
const containers=new Map<string,HTMLElement>();
let mounted=false;
function element<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,text?:string):HTMLElementTagNameMap[K]{
 const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;
}
function movePanel(id:string,screen:string):void {
 const panel=document.getElementById(id),host=containers.get(screen);
 if(!panel||!host)return;
 if(panel instanceof HTMLDetailsElement){
  panel.removeAttribute('name');panel.classList.add('workspace-panel');
  const summary=panel.querySelector(':scope > summary');
  if(summary?.querySelector('button')){const actions=element('div','workspace-panel-actions');while(summary.firstChild)actions.append(summary.firstChild);panel.append(actions);panel.insertBefore(actions,summary.nextSibling);}
 }
 host.append(panel);
}
function addHeader(screen:WorkspaceScreen):HTMLElement {
 const header=element('div','workspace-page-heading');
 const label=element('p','workspace-eyebrow',screen.eyebrow);
 const title=element('h2','workspace-title',screen.title);title.id='screen-title-'+screen.id;title.tabIndex=-1;
 header.append(label,title,element('p','workspace-description',screen.description));return header;
}
export function initializeWorkspace():void {
 if(mounted)return;
 const shell=document.getElementById('appShell'),old=shell?.querySelector<HTMLElement>('.container');
 if(!shell||!old)return;
 mounted=true;document.documentElement.classList.add('workspace-enabled');
 const layout=element('div','workspace-layout'),sidebar=element('aside','workspace-sidebar');
 const brand=element('a','workspace-brand');brand.href='#dashboardOverview';
 brand.append(element('span','workspace-monogram','S'),element('span','workspace-brand-name','SYSTEMIC'));
 const brandNote=element('p','workspace-brand-note','Market risk monitor');
 const navigation=element('nav','workspace-navigation');navigation.setAttribute('aria-label','Workspaces');
 let group='';
 for(const screen of screens){
  if(group!==screen.eyebrow){group=screen.eyebrow;navigation.append(element('p','workspace-nav-group',group));}
  const link=element('a','workspace-nav-link');link.href='#'+screen.target;link.dataset["screen"]=screen.id;
  const icon=element('span','workspace-nav-icon',screen.icon);icon.setAttribute('aria-hidden','true');
  link.append(icon,element('span','',screen.title));navigation.append(link);
 }
 sidebar.append(brand,brandNote,navigation,element('p','workspace-sidebar-note','Version 1.1.1'));
 const content=element('div','workspace-content'),main=element('main','workspace-main');main.id='workspaceMain';
 for(const screen of screens){const section=element('section','workspace-screen');section.dataset["screen"]=screen.id;section.setAttribute('aria-labelledby','screen-title-'+screen.id);section.append(addHeader(screen));containers.set(screen.id,section);main.append(section);}
 const topbar=element('div','workspace-topbar'),menu=element('button','workspace-menu-button','☰ Workspaces');menu.type='button';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','workspaceSidebar');sidebar.id='workspaceSidebar';
 const mobile=window.matchMedia('(max-width:800px)');
 const updateNavigation=()=>{const expanded=layout.classList.contains('navigation-open');menu.setAttribute('aria-expanded',String(expanded));sidebar.inert=mobile.matches&&!expanded;};
 menu.addEventListener('click',()=>{layout.classList.toggle('navigation-open');updateNavigation();});
 mobile.addEventListener('change',updateNavigation);updateNavigation();
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layout.classList.contains('navigation-open')){layout.classList.remove('navigation-open');updateNavigation();menu.focus();}});
 const originalHeader=old.querySelector('header');
 topbar.append(menu,element('span','workspace-topbar-title','Systemic Risk Dashboard'));
 if(originalHeader){const actions=originalHeader.querySelector('.header-actions');if(actions)topbar.append(actions);const checked=originalHeader.querySelector('#lastCheckDate');if(checked)topbar.append(checked);originalHeader.remove();}
 content.append(topbar,main);layout.append(sidebar,content);shell.prepend(layout);
 // The original overview is the contiguous region before the analysis panel.
 const overviewStart=document.getElementById('dashboardOverview'),overviewEnd=document.getElementById('analysisPanel');
 if(overviewStart&&overviewEnd){let node:ChildNode|null=overviewStart;while(node&&node!==overviewEnd){const next:ChildNode|null=node.nextSibling;containers.get('overview')?.append(node);node=next;}}
 const factors=document.getElementById('metricTableBody')?.closest('details');if(factors){factors.id='riskFactorsScreen';movePanel(factors.id,'factors');}
 const scale=old.querySelector<HTMLDetailsElement>('.scale-card');if(scale){scale.id='scoreBandsScreen';movePanel(scale.id,'methodology');}
 // History previously shared the update accordion; it now has an independent workspace.
 const historyStart=document.getElementById('dashboardHistory');
 if(historyStart){let node:ChildNode|null=historyStart;while(node){const next:ChildNode|null=node.nextSibling;containers.get('history')?.append(node);node=next;}}
 for(const [id,screen] of [
 ['compositeUpdatePanel','update'],['riskChartsPanel','charts'],['fedWatchPanel','fed'],['forcedDiagnosticsPanel','funding'],['cpLeadershipPanel','cp'],['analysisPanel','analysis'],['pastCrashesPanel','studies'],['methodologyPanel','methodology'],['restorePanel','restore'],['troubleshootSyncPanel','sync']
 ] as const)movePanel(id,screen);
 old.querySelector('.dashboard-nav')?.remove();
 // Modal dialogs remain outside hidden screens so account-wide actions always work.
 for(const dialog of old.querySelectorAll('dialog'))shell.append(dialog);
 const footer=old.querySelector('footer');if(footer)content.append(footer);
 old.hidden=true;
 const overview=containers.get('overview');
 if(overview){const actions=element('div','workspace-overview-actions');for(const [label,target] of [['Update observations','dashboardUpdate'],['Explore history','dashboardHistory'],['Open risk charts','dashboardRiskCharts']] as const){const a=element('a','workspace-action-link',label+' →');a.href='#'+target;actions.append(a);}overview.insertBefore(actions,overview.querySelector('.overview-hero'));}
 navigation.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a')){layout.classList.remove('navigation-open');updateNavigation();}});
 window.addEventListener('hashchange',()=>navigateWorkspace());
 shell.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href^="#"]'))queueMicrotask(()=>navigateWorkspace());});
 initializeAccountMenu(topbar);
 initializeQuickJump(topbar,screens,showWorkspace);
 navigateWorkspace(false);
}
export function navigateWorkspace(focus=true):boolean {
 if(!mounted)return false;
 let id='dashboardOverview';try{id=decodeURIComponent(location.hash.slice(1))||id;}catch{ /* Ignore malformed external fragments. */ }
 const target=document.getElementById(id);
 const active=target?.closest<HTMLElement>('.workspace-screen')??containers.get('overview');if(!active)return false;
 for(const section of containers.values()){
  const selected=section===active;section.hidden=!selected;
  for(const panel of section.querySelectorAll<HTMLDetailsElement>('.workspace-panel'))panel.open=selected;
 }
 let parent=target?.parentElement;while(parent&&parent!==active){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
 for(const link of document.querySelectorAll<HTMLAnchorElement>('.workspace-nav-link')){if(link.dataset["screen"]===active.dataset["screen"])link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 const screen=screens.find(s=>s.id===active.dataset["screen"]);document.title=(screen?.title??'Overview')+' · Systemic';
 if(focus){active.querySelector<HTMLElement>('.workspace-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 return true;
}
export function showWorkspace(target:string):void {if(location.hash==='#'+target)navigateWorkspace();else location.hash=target;}
