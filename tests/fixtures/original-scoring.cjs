const metricConfig = {

vix: {
    name:"VIX Level",
    cat:"Equities / Volatility",
    maxPoints:2,
    calc:v => v >= 30 ? 2 : (v >= 25 ? 1 : 0),
    format:v => v.toFixed(2)
},

    vix_chg:{
        name:"VIX 1-Day Velocity",
        cat:"Equities / Volatility",
        maxPoints:2,
        calc:v => v >= 30 ? 2 : (v >= 15 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
    },

    vix_5d:{
        name:"VIX 5-Day Momentum",
        cat:"Equities / Volatility",
        maxPoints:2,
        calc:v => v >= 50 ? 2 : (v >= 25 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
    },

    hy:{
        name:"High Yield OAS",
        cat:"Credit",
        maxPoints:4,
        calc:v => v >= 500 ? 4 : (v >= 400 ? 3 : (v >= 325 ? 1 : 0)),
        format:v => v.toFixed(0) + " bp"
    },

    hy_5d:{
        name:"HY OAS 5-Day Widening",
        cat:"Credit Momentum",
        maxPoints:2,
        calc:v => v >= 25 ? 2 : (v >= 15 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(0) + " bp"
    },

    hy_20d:{
        name:"HY OAS 20-Day Widening",
        cat:"Credit Momentum",
        maxPoints:2,
        calc:v => v >= 50 ? 2 : (v >= 30 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(0) + " bp"
    },

    bbb:{
        name:"BBB OAS",
        cat:"Credit",
        maxPoints:3,
        calc:v => v >= 200 ? 3 : (v >= 160 ? 2 : (v >= 130 ? 1 : 0)),
        format:v => v.toFixed(0) + " bp"
    },

    yield:{
        name:"10-Year Treasury Yield",
        cat:"Rates",
        maxPoints:2,
        calc:v => v >= 5.25 ? 2 : (v >= 4.75 ? 1 : 0),
        format:v => v.toFixed(2) + "%"
    },

    yield_20d:{
        name:"10Y 20-Day Yield Change",
        cat:"Rates Momentum",
        maxPoints:2,
        calc:v => v >= 35 ? 2 : (v >= 20 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(0) + " bp"
    },

    dma50:{
        name:"S&P 500 vs 50-DMA",
        cat:"Equities / Technicals",
        maxPoints:2,
        calc:v => v <= -5 ? 2 : (v <= 0 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
    },

    dma200:{
        name:"S&P 500 vs 200-DMA",
        cat:"Equities / Technicals",
        maxPoints:2,
        calc:v => v <= -10 ? 2 : (v <= 0 ? 1 : 0),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
    },

    wti:{
        name:"WTI Crude",
        cat:"Commodities / Macro",
        maxPoints:2,
        calc:v => v >= 105 ? 2 : (v >= 90 ? 1 : 0),
        format:v => "$" + v.toFixed(2)
    },

    wti_20d:{
        name:"Oil Momentum / Yield Convergence",
        cat:"Commodities / Macro",
        maxPoints:2,
        calc:(v,context={}) => metricPoints('wti_20d',{...context,wti_20d:v}),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
    },


move:{
    name:"MOVE Bond Volatility",
    cat:"Rates / Volatility",
    maxPoints:2,
    calc:v => v >= 140 ? 2 : (v >= 120 ? 1 : 0),
    format:v => v.toFixed(1)
},
    
    jpy:{
        name:"USDJPY 3-Session Carry-Unwind Momentum",
        cat:"FX / Liquidity",
        maxPoints:2,
        calc:v => yenMomentumPoints(v),
        format:v => v.toFixed(1)
    },

    breadth:{
        name:"S&P 500 Breadth > 50-DMA",
        cat:"Equities / Breadth",
        maxPoints:3,
        calc:v => v <= 30 ? 3 : (v <= 50 ? 2 : (v <= 60 ? 1 : 0)),
        format:v => v.toFixed(1) + "%"
    },

    breadth_20d:{
        name:"Breadth 20-Day Deterioration",
        cat:"Equities / Breadth Momentum",
        maxPoints:2,
        calc:(v,context={}) => metricPoints('breadth_20d',{...context,breadth_20d:v}),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1) + " pp"
    },

    vix_term:{
        name:"VIX 3M − 1M Term Structure",
        cat:"Volatility Structure",
        maxPoints:2,
        calc:(v,context={}) => metricPoints('vix_term',{...context,vix_term:v}),
        format:v => (v >= 0 ? "+" : "") + v.toFixed(1)
    }
};
function metricPoints(key,values,day){
    const v=values[key];
    if(key==='jpy'){const n=jpyMomentum(values,day);return Number.isFinite(n)?yenMomentumPoints(n):0;}
    if(key==='vix_term')return v<0?2:(v<1&&values.vix_5d>10)?2:v<1.5?1:0;
    if(key==='wti_20d'){const momentum=v>=20?2:v>=10?1:0;return Math.min(2,momentum+(values.wti>=90&&values.yield>=4.5?1:0));}
    if(key==='breadth_20d')return v<=-10?2:v<=-4&&values.breadth<65?1:0;
    return metricConfig[key].calc(v);
}
function cpStressPoints(sector,bill){return sector>=50||bill>=100?3:sector>=25||bill>=50?2:0;}
function leadershipPoints(momentum){return momentum<=-6?3:momentum<=-3?1:0;}
function yenMomentumPoints(change){return change<=-3?2:change<=-1.5?1:0;}
function sellingVolumeRange(v){
    const validRange=[v.sp500,v.sp_high,v.sp_low].every(Number.isFinite)&&v.sp_high>v.sp_low&&v.sp500>=v.sp_low&&v.sp500<=v.sp_high;
    const nearLow=validRange?(v.sp500-v.sp_low)/(v.sp_high-v.sp_low)<=.25:null;
    const negative=Number.isFinite(v.sp500_chg)?v.sp500_chg<0:null;
    const selling=negative===true||nearLow===true?true:negative===false&&nearLow===false?false:null;
    const ratio=Number.isFinite(v.volume)&&v.volume>0&&Number.isFinite(v.volume_avg)&&v.volume_avg>0?v.volume/v.volume_avg:null;
    const cap=ratio===null?2:ratio>=2?2:ratio>=1.5?1:0;
    if(cap===0||selling===false)return {low:0,high:0};
    if(selling===true&&ratio!==null)return {low:cap,high:cap};
    return {low:0,high:cap};
}
function snapshotKeys(owner){return {entryHistory:'crash-risk-history-v1:'+owner,fedWatchHistory:'crash-risk-fed-watch-v1:'+owner,fundingHistory:'crash-risk-funding-v1:'+owner,fredHistory:'crash-risk-fred-data-v1:'+owner,analysisHistory:'crash-risk-analysis-v1:'+owner};}
const jpyMomentum=v=>v.jpy3d;
module.exports={metricConfig,metricPoints,cpStressPoints,leadershipPoints,yenMomentumPoints,sellingVolumeRange,snapshotKeys};
