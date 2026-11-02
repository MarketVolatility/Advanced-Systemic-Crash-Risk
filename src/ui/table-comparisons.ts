import {requiredValue} from '../core/defined';
// Compare like-for-like numeric observations; never compare unrelated indicator rows.
const higherBetter = /breadth|above.*dma|vs.*dma|distance|term structure|3m.*1m|s&p.*close|nasdaq.*close|relative momentum|sp500|nasdaq100|sp_high|sp_low|dma50|dma200|vix_term|jpy3d|daily change|carry.*momentum/i;
const lowerBetter = /total.*50|volatility.*10|credit.*14|macro.*8|equity.*12|forced selling.*6|financial.*(?:nonfinancial|treasury)|score|points|minimum|maximum|vix|move|oas|yield|wti|margin|debt|spread|balance|weekly change|hike/i;
const nonMeasure = /date|time|month|year|ceiling|maximum possible|reference|source|entry|delete|restore|status/i;
function headerLabel(cell: HTMLTableCellElement): string {
    return cell.querySelector<HTMLButtonElement>('.column-visibility-toggle')?.dataset["columnLabel"] ?? cell.textContent ?? '';
}
function numericCell(cell: HTMLTableCellElement): number | null {
    const input=cell.querySelector<HTMLInputElement>('input');
    if(input && !['number','text'].includes(input.type))return null;
    const text=(input?.value ?? cell.textContent ?? '').trim().replaceAll(',','').replaceAll('−','-');
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*[%×]?$/.test(text))return null;
    const value=Number(text.replace(/[%×]$/,''));return Number.isFinite(value)?value:null;
}
function rowTime(row: HTMLTableRowElement,headers: string[]): number | null {
    if(row.dataset["comparisonDate"]){const t=Date.parse(row.dataset["comparisonDate"]);return Number.isFinite(t)?t:null;}
    for(let i=0;i<headers.length;i++){
        if(!/date|time|session/i.test(headers[i]??'')||/cp|deleted|published|publication|comparison|meeting|reference/i.test(headers[i]??''))continue;
        const cell=row.cells[i];if(!cell)continue;
        const text=cell.querySelector<HTMLInputElement>('input')?.value??cell.textContent??'';
        const match=text.match(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d\d:\d\d))?/);
        if(match){const t=Date.parse(match[0]);if(Number.isFinite(t))return t;}
    }
    return null;
}
export function applyTableComparisons(table: HTMLTableElement): void {
    const head=table.tHead?.rows[0];if(!head)return;
    const headers=[...head.cells].map(headerLabel);
    for(const body of table.tBodies){
        const rows=[...body.rows].map(row=>({row,time:rowTime(row,headers)})).filter((r):r is {row:HTMLTableRowElement;time:number}=>r.time!==null).sort((a,b)=>a.time-b.time);
        for(let r=0;r<rows.length;r++){
            const current=requiredValue(rows[r]),previous=rows[r-1];
            for(let c=0;c<current.row.cells.length;c++){
                const cell=requiredValue(current.row.cells[c]);
                // Explicit comparisons retain their full-history predecessor across pagination.
                if(cell.dataset["comparisonExplicit"]==='true')continue;
                cell.classList.remove('history-improved','history-worsened');
                if(cell.dataset["comparisonTitle"]){cell.title=cell.title.replace(cell.dataset["comparisonTitle"],'');delete cell.dataset["comparisonTitle"];}
                const label=headers[c]??'';
                if(!previous||nonMeasure.test(label)||cell.colSpan!==1)continue;
                // A probability comparison must refer to the same FOMC meeting.
                const meeting=headers.findIndex(h=>/meeting|decision date/i.test(h));
                if(meeting>=0){const value=(row:HTMLTableRowElement)=>row.cells[meeting]?.querySelector<HTMLInputElement>('input')?.value??row.cells[meeting]?.textContent;if(value(current.row)!==value(previous.row))continue;}
                const older=previous.row.cells[c];if(!older)continue;
                const a=numericCell(cell),b=numericCell(older);if(a===null||b===null||Math.abs(a-b)<1e-8)continue;
                const direction=higherBetter.test(label)?1:lowerBetter.test(label)?-1:1;
                cell.classList.add((a-b)*direction>0?'history-improved':'history-worsened');
                const note=` · ${a>b?'Increased':'Decreased'} from ${b} to ${a} versus ${new Date(previous.time).toISOString().slice(0,10)}${!higherBetter.test(label)&&!lowerBetter.test(label)?'; numeric direction only, not a risk assessment':''}.`;
                cell.dataset["comparisonTitle"]=note;cell.title+=note;
            }
        }
    }
}
