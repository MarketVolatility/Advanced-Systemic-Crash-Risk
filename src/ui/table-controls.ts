import {applyTableComparisons} from './table-comparisons';

// Presentation-only controls; no market values or account storage are changed.
const tableColumnVisibility=new WeakMap<HTMLTableElement,Set<number>>();
function applyTableColumnControls(table: HTMLTableElement){
    applyTableComparisons(table);
    const top=table.tHead?.rows[0]||table.rows[0];
    if(!top)return;
    const hidden=tableColumnVisibility.get(table) ?? new Set<number>();
    tableColumnVisibility.set(table,hidden);
    let offset=0;
    for(const cell of top.cells){
        const start=offset,span=cell.colSpan||1;offset+=span;
        let button=cell.querySelector<HTMLButtonElement>('.column-visibility-toggle');
        if(!button){
            const label=(cell.textContent||'').trim()||'Column '+(start+1);
            button=document.createElement('button');button.type='button';button.className='column-visibility-toggle';button.dataset["columnLabel"]=label;
            button.addEventListener('click',event=>{
                event.preventDefault();event.stopPropagation();
                const collapse=!hidden.has(start);
                for(let i=start;i<start+span;i++)collapse?hidden.add(i):hidden.delete(i);
                applyTableColumnControls(table);
            });
            if(getComputedStyle(cell).position==='static')cell.style.position='relative';
            cell.classList.add('column-toggle-header');cell.appendChild(button);
        }
        const collapsed=hidden.has(start);
        button.textContent=collapsed?'+':'−';
        button.title=(collapsed?'Show ':'Hide ')+button.dataset["columnLabel"];
        button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded',String(!collapsed));
    }
    // Track occupied columns for rowspans as well as grouped/empty-state colspans.
    const occupied:number[]=[];
    for(const row of table.rows){
        let col=0;
        for(const cell of row.cells){
            while((occupied[col]??0)>0)col++;
            const span=cell.colSpan||1;
            const collapsed=Array.from({length:span},(_,i)=>col+i).every(i=>hidden.has(i));
            cell.classList.toggle('column-is-collapsed',collapsed);
            if(cell.rowSpan>1)for(let i=col;i<col+span;i++)occupied[i]=cell.rowSpan;
            col+=span;
        }
        for(let i=0;i<occupied.length;i++)if((occupied[i]??0)>0)occupied[i]=(occupied[i]??0)-1;
    }
}
export function initializeTableControls():void {
    const pending=new Set<HTMLTableElement>();let scheduled=false;
    const observer=new MutationObserver(records=>{
        for(const record of records){
            // Ignore our own button labels. Rebuilt headers and rows are handled below.
            if(record.target instanceof Element && record.target.closest('.column-visibility-toggle'))continue;
            const table=record.target instanceof Element ? record.target.closest('table') : null;if(table)pending.add(table);
            for(const node of record.addedNodes)if(node instanceof Element){
                if(node instanceof HTMLTableElement)pending.add(node);
                node.querySelectorAll('table').forEach(t=>pending.add(t));
            }
        }
        if(!pending.size||scheduled)return;
        scheduled=true;requestAnimationFrame(()=>{
            scheduled=false;observer.disconnect();
            try{for(const table of pending)if(table.isConnected)applyTableColumnControls(table);}
            finally{pending.clear();observer.observe(document.body,{childList:true,subtree:true});}
        });
    });
    document.addEventListener('input',event=>{const target=event.target;if(target instanceof Element){const table=target.closest('table');if(table)applyTableComparisons(table);}});
    document.querySelectorAll('table').forEach(applyTableColumnControls);
    observer.observe(document.body,{childList:true,subtree:true});
}
