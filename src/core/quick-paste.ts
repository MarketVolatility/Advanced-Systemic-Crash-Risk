import {requiredValue} from './defined';
import { INPUT_KEYS } from './types';
import type { MarketValues } from './types';
export type PasteResult = { ok: true; values: MarketValues } | { ok: false; error: string };
/** Four observation dates follow the 35 market fields; persisted keys stay unchanged. */
export function parseQuickPasteValues(text: string): PasteResult {
  const items = text.trim().replace(/^\[|\]$/g, '').split(',').map(v => v.trim());
  if (![26,27,29,31,35,39].includes(items.length)) return {ok:false,error:'Provide 39 comma-separated values: 35 market fields followed by equity, financial CP, nonfinancial CP and Treasury bill dates (YYYYMMDD).'};
  const values: MarketValues = {};
  for (const [i, raw] of items.slice(0,35).entries()) {
    const key = INPUT_KEYS[i];
    if (!key) return {ok:false,error:'Unexpected field.'};
    if (raw.toLowerCase() === 'null') { values[key] = null; continue; }
    if (!raw || !Number.isFinite(Number(raw))) return {ok:false,error:'Use a number or null for each field. Leave no empty fields.'};
    values[key] = Number(raw);
  }
  if (values.sp500 != null && values.sp500 <= 0) return {ok:false,error:'S&P 500 close must be positive.'};
  for (const [key,label] of [['nasdaq','Nasdaq Composite close'],['nasdaq100','Nasdaq 100 close']] as const) {
    if (values[key] != null && values[key] <= 0) return {ok:false,error:label+' must be positive.'};
  }
  if(items.length===39){
    const dates=items.slice(35);
    for(const raw of dates){
      const iso=raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8);
      if(!/^\d{8}$/.test(raw)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)return {ok:false,error:'All four dates must be real calendar dates in YYYYMMDD format.'};
    }
    const equity=requiredValue(dates[0]);
    values.equitySessionDate=equity.slice(0,4)+'-'+equity.slice(4,6)+'-'+equity.slice(6,8);
    values.cp_financial_date=Number(dates[1]);
    values.cp_nonfinancial_date=Number(dates[2]);
    values.cp_treasury_date=Number(dates[3]);
    if(values.cp_date!==Math.max(...dates.slice(1).map(Number)))return {ok:false,error:'Field 32 must equal the latest of the three CP/Treasury dates in fields 37–39.'};
  }
  return {ok:true,values};
}
export function validEquityDate(session: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session) || !Number.isFinite(Date.parse(session))) return false;
  const date = new Date(session+'T12:00:00Z');
  return date.toISOString().slice(0,10) === session && session <= today && ![0,6].includes(date.getUTCDay());
}
