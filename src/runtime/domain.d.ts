type NumericInput = number | null | undefined;
type RiskRange = import('../core/types').ScoreRange;
type InputKey = import('../core/types').InputKey;
type MetricKey = import('../core/types').MetricKey;
type ScoredKey = MetricKey | 'cp_stress' | 'leadership';
type HistoryOverrides = { composite?: RiskRange; scoredCpDate?: string; cpPoints?: RiskRange; nasdaqMomentum?: number; nasdaqPoints?: RiskRange };
interface HistoryEntry {
 savedAt:string; values:MarketValues; id?:string; reference?:boolean; observationDate?:string;
 updatedAt?:string; entryLabel?:string|undefined; sourceReferenceDate?:string|undefined; historyOverrides?:HistoryOverrides; cpCheckedAt?:string; reconciledAt?:string;
}
interface EquityObservation extends MarketValues { date:string }
interface CPObservation {
 date:string; financial:number|null; nonfinancial:number|null; treasury:number|null;
 sector:number|null; financialBill:number|null; nonfinancialBill:number|null;
 live?:boolean; manual?:boolean; dates?:string[]; mixedDates?:boolean; ageDays?:number; stale?:boolean;
}
interface CPScore {date:string;sector:number;financialBill:number;dates?:string[];mixedDates?:boolean;ageDays?:number;stale?:boolean;}
interface ChartPoint {date:string;time:number;close:number|null;manual?:boolean}
interface OverlayOptions {top?:number;bottom?:number;right?:number;legendY?:number;dashes?:boolean}
interface FundingRecord {
 id?:string; supersedes?:string|undefined; observationDate:string; publishedAt:string|null; balance:number; testBalance:number|null;
 testEvidence:string; source:string; savedAt?:string; reference?:boolean;
}
interface FedRecord {
 meetingDate:string; observedAt:string|null; publishedAt:string|null; targetLower:number;targetUpper:number;
 hike:number;hold:number;cut:number;comparisonAt:string|null;hikeChange5d:number|null;holdChange5d:number|null;cutChange5d:number|null;
 source:string;calendarSource:string;notes:string;
}
interface WordDocument {text:string;base64:string;name:string;xml?:string;styles?:string|null;numbering?:string|null}
interface AnalysisCategory extends RiskRange {name:string;maximum:number}
interface AnalysisRecord {
 id:string;createdAt:string;day:string;entryTime:string|null;total:RiskRange;categories:AnalysisCategory[];values:MarketValues;
 questions:string;prompt:string;response:string;responseSavedAt:string|null;word?:WordDocument|null; editedAt?:string; originalSnapshot?:Pick<AnalysisRecord,"createdAt"|"day"|"total"|"categories"|"responseSavedAt">;
 recentScores?:unknown[];
}
interface FredData {version:number;source:string;series:string[];fetchedAt:string;rows:[string,number|null,number|null,number|null][]}
interface ModelSources {
 entries:HistoryEntry[];count:number;fred:FredData|null;cp:(CPObservation & CPScore)[];
 momentum:import('../core/types').MomentumRow[];
 sp:Map<string,NumericInput>;nd:Map<string,NumericInput>;studySessions:Map<string,string>;indices:Map<string,number>;
}

type DisplayEntry=Omit<HistoryEntry,"savedAt">&{savedAt:string|null};
