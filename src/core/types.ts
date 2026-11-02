/** The persisted v1 schema is unchanged; optional fields support older saved rows. */
export const INPUT_KEYS = [
  'vix','vix_chg','vix_5d','hy','hy_5d','hy_20d','bbb','yield','yield_20d',
  'dma50','dma200','wti','wti_20d','move','jpy','breadth','breadth_20d','vix_term',
  'sp500','margin_month','margin_debt','margin_yoy','margin_3m','volume','volume_avg',
  'sp500_chg','jpy3d','sp_high','sp_low','nasdaq','nasdaq100',
  'cp_date','cp_financial','cp_nonfinancial','cp_treasury'
] as const;
export type InputKey = typeof INPUT_KEYS[number];
export type MarketValues = Partial<Record<InputKey, number | null>> & {
  equitySessionDate?: string;
  cp_financial_date?: number;
  cp_nonfinancial_date?: number;
  cp_treasury_date?: number;
};
export interface ScoreRange { low: number; high: number }
export interface SavedEntry {
  savedAt: string;
  values: MarketValues;
  observationDate?: string;
  updatedAt?: string;
  historyOverrides?: Record<string, number | string | ScoreRange>;
  [additionalField: string]: unknown;
}
export type MetricKey = 'vix'|'vix_chg'|'vix_5d'|'hy'|'hy_5d'|'hy_20d'|'bbb'|
  'yield'|'yield_20d'|'dma50'|'dma200'|'wti'|'wti_20d'|'move'|'jpy'|'breadth'|'breadth_20d'|'vix_term';
export interface MetricDefinition {
  name: string;
  cat: string;
  maxPoints: number;
  calc: (value: number, context?: MarketValues) => number;
  format: (value: number) => string;
}
export interface EquityPair { date: string; sp500: number; nasdaq100: number }
export interface MomentumRow { date: string; sp500: number; baseDate: string | null; matchedCount: number; momentum: number | null }
export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
