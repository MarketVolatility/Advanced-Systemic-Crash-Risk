import type { EquityPair, MomentumRow } from './types';
export function relativeMomentum(current: Pick<EquityPair,'sp500'|'nasdaq100'>, base: Pick<EquityPair,'sp500'|'nasdaq100'>): number {
  return 100 * ((current.nasdaq100/current.sp500)/(base.nasdaq100/base.sp500)-1);
}
/** Inputs are unique dated observations from the existing source/entry merge. */
export function matchedMomentumRows(quotes: readonly ({date:string;sp500?:number|null;nasdaq100?:number|null})[], today: string): MomentumRow[] {
  const matched = quotes.filter((r):r is EquityPair => r.date <= today && typeof r.sp500 === 'number' && Number.isFinite(r.sp500) && r.sp500 > 0 && typeof r.nasdaq100 === 'number' && Number.isFinite(r.nasdaq100) && r.nasdaq100 > 0 && ![0,6].includes(new Date(r.date+'T12:00:00Z').getUTCDay()));
  return matched.map((row,i) => {
    const base = i >= 20 ? matched[i-20] : undefined;
    return {date:row.date,sp500:row.sp500,baseDate:base?.date ?? null,matchedCount:Math.min(i+1,21),momentum:base ? relativeMomentum(row,base) : null};
  });
}
