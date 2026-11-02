

// Move existing nodes into native disclosures, retaining IDs, inputs and listeners.
const subsectionFoldState=new Map<string,boolean>();
export function makeSubsectionsExpandable(root: HTMLElement|null){
 if(!root?.querySelectorAll)return;
 const headings=[...root.querySelectorAll('h2,h3,h4')].filter(h=>!h.closest('summary')&&!h.classList.contains('section-heading'));
 // Work deepest-first so lower-level headings stay inside their parent topic.
 for(const heading of headings.reverse()){
  const parent=heading.parentElement;if(!parent)continue;
  const level=Number(heading.tagName.slice(1));
  const key=(root.id||'section')+':'+(heading.id||(heading.textContent||'').trim());
  const fold=document.createElement('details');fold.className='subsection-fold';fold.dataset["headingLevel"]=String(level);
  const summary=document.createElement('summary');
  parent.insertBefore(fold,heading);summary.appendChild(heading);fold.appendChild(summary);
  while(fold.nextSibling){
   const next=fold.nextSibling;
   const nextLevel=next instanceof HTMLElement?(next.matches('h2,h3,h4')?Number(next.tagName.slice(1)):Number(next.dataset?.["headingLevel"])||0):0;
   if(nextLevel&&nextLevel<=level)break;
   fold.appendChild(next);
  }
  fold.open=subsectionFoldState.get(key)===true;
  fold.addEventListener('toggle',()=>subsectionFoldState.set(key,fold.open));
 }
}
export function initializeSubsectionFolds(revealTarget:()=>void):void {
 for(const id of ['riskChartsPanel','forcedDiagnosticsPanel','cpLeadershipPanel','pastCrashesPanel','methodologyPanel'])makeSubsectionsExpandable(document.getElementById(id));
 // Navigation may have opened its target before the disclosures were installed.
 if(location.hash)revealTarget();
}

