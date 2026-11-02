declare const fundingReference:({"id":string;"observationDate":string;"publishedAt":null;"balance":number;"testBalance":null;"testEvidence":string;"source":string;"savedAt":string;"reference":boolean})[];
declare const marketHistoryReference:HistoryEntry[];
declare const sp500Daily:[string,number][];
declare const sp500Ranges:Record<string,{sp500:number;sp_high:number;sp_low:number}>;
declare const nasdaqDaily:{nasdaq:[string,number][];nasdaq100:[string,number][]};
declare const momentumDiagnostics:({"date":string;"dma200":number;"dmaVelocity":number;"jpy3d":number|null;"fxDate":string|null})[];
declare const commercialPaperDaily:[string,number|null,number|null,number|null][];
declare const historicalMonths:{name:string;rows:{date:string;observationDate:string;sp500:number;values:MarketValues}[]}[];
declare const forcedData:{"margin":({"month":string;"debt":number;"yoy":null|number;"change3m":null|number;"assumedAvailable":string})[];"daily":({"date":string;"close":number;"volume":number;"average":number;"ratio":number;"pressure":number;"candidate":boolean})[]};




type MarketValues=import("../core/types").MarketValues;