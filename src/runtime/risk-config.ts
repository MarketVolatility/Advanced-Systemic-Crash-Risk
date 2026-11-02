/* =========================================================
   RISK ENGINE
   =========================================================

   Maximum = 50 points

   The model deliberately gives more importance to:
   1. Credit deterioration
   2. Volatility acceleration
   3. Rates shock
   4. Oil shock
   5. Equity breadth
   6. Cross-asset confirmation

   A high score requires multiple markets to confirm stress.
*/

const metricConfig = Object.assign(DashboardCore.metricConfig,{
 cp_stress:{name:'Commercial-paper funding stress',maxPoints:3,format:(n:number)=>n.toFixed(0)+' points'},
 leadership:{name:'Nasdaq 100 / S&P 500 20-matched-observation momentum',maxPoints:3,format:(n:number)=>n.toFixed(2)+'%'}
});

