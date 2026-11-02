import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
(async()=>{
 const browser=await chromium.launch(process.env["BROWSER_EXECUTABLE"]?{executablePath:process.env["BROWSER_EXECUTABLE"]}:{});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://dashboard.test/')?route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8')}):route.fulfill({contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:{id:"migration-test",email:"test@example.com"}},error:null}),signInWithPassword:async()=>({data:{session:{},user:{id:"migration-test",email:"test@example.com"}},error:null}),signOut:async()=>({error:null})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:{message:"Offline browser test"}})})})};'}));
 await page.addInitScript(()=>{const observer=new MutationObserver(()=>{if(document.body){document.documentElement.dataset['themeAtBody']=document.documentElement.dataset['theme']??'missing';observer.disconnect();}});observer.observe(document,{childList:true,subtree:true});});
 await page.goto('http://dashboard.test/');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.emulateMedia({colorScheme:'light'});
 await page.waitForFunction(()=>document.documentElement.dataset['theme']==='light');
 await page.evaluate(()=>localStorage.setItem('crash-risk-theme','light'));
 await page.emulateMedia({colorScheme:'dark'});
 await page.reload();
 assert.equal(await page.locator('html').getAttribute('data-theme-at-body'),'light','Saved theme must apply before body presentation');
 await page.evaluate(()=>localStorage.removeItem('crash-risk-theme'));
 await page.reload();
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/signin.png'});
 assert(await page.locator('#authOverlay').isVisible());
 // Shared comparison styling: chronological rows, missing values and unrelated meetings.
 await page.evaluate(()=>{
  const table=document.createElement('table');table.id='comparisonFixture';
  table.innerHTML='<thead><tr><th>Date</th><th>VIX</th><th>S&amp;P 500 close</th><th>Missing</th><th>Total /50</th></tr></thead><tbody><tr><td>2026-10-27</td><td>17</td><td>7700</td><td>—</td><td>10</td></tr><tr><td>2026-10-26</td><td>19</td><td>7600</td><td>4</td><td>20</td></tr></tbody>';
  document.body.append(table);
 });
 await page.waitForFunction(()=>document.querySelectorAll('#comparisonFixture .history-improved').length===3);
 assert.equal(await page.locator('#comparisonFixture .history-worsened').count(),0);
 assert(!((await page.locator('#comparisonFixture tbody tr').first().locator('td').nth(3).getAttribute('class'))??'').includes('history-'));
 assert.equal(await page.locator('#comparisonFixture td.history-improved').first().evaluate(el=>getComputedStyle(el,'::after').getPropertyValue('inset')),'5px');
 await page.evaluate(()=>document.getElementById('comparisonFixture')?.remove());
 // Verify actual input borders inside the workspace, where theme specificity applies.
 await page.evaluate(()=>{
  const host=document.createElement('section');host.className='workspace-screen';host.id='comparisonInputFixture';
  host.innerHTML='<table class="history-table"><tbody><tr><td class="history-improved"><input class="history-amber" value="17"></td><td class="history-worsened"><input class="history-red" value="21"></td></tr></tbody></table>';
  document.body.append(host);
 });
 for(const [kind,color] of [['improved','rgb(53, 212, 154)'],['worsened','rgb(251, 113, 133)']]){
  const input=page.locator('#comparisonInputFixture .history-'+kind+' input');
  assert.equal(await input.evaluate(el=>getComputedStyle(el).borderTopColor),color);
  assert.equal(await input.evaluate(el=>getComputedStyle(el).borderTopWidth),'2px');
  await input.hover({force:true});
  assert.equal(await input.evaluate(el=>getComputedStyle(el).borderTopColor),color);
  await input.focus();
  assert.equal(await input.evaluate(el=>getComputedStyle(el).borderTopColor),color);
 }
 const tintInputs=page.locator('#comparisonInputFixture input');
 const fills=await tintInputs.evaluateAll(inputs=>inputs.map(input=>getComputedStyle(input).backgroundColor));
 const cellFills=await tintInputs.evaluateAll(inputs=>inputs.map(input=>{
  const cell=input.parentElement;if(!cell)throw Error('Fixture input must have a table cell');const actual=getComputedStyle(cell).backgroundColor;
  const original=input.getAttribute('class')??'';input.setAttribute('class','history-normal');
  const neutral=getComputedStyle(cell).backgroundColor;input.setAttribute('class',original);
  return {actual,neutral};
 }));
 assert(cellFills.every(({actual,neutral})=>actual===neutral),'Risk fill must not change the surrounding cell background');
 assert.notEqual(fills[0],fills[1],'Amber and red values must have distinct matching tints');
 assert(fills.every(fill=>fill!=='rgb(23, 39, 42)'),'Risk cells must have a tinted fill');
 await page.evaluate(()=>document.getElementById('comparisonInputFixture')?.remove());


 const staticIds=[...fs.readFileSync('src/index.template.html','utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>{const id=m[1];if(!id)throw Error('Missing captured ID');return id;});
 assert.deepEqual(await page.evaluate(ids=>ids.filter(id=>!document.getElementById(id)),staticIds),[],'Screen composition removed a control');
 // An isolated origin and mocked SDK ensure tests cannot touch real accounts.
 await page.evaluate(()=>{
  const record={savedAt:'2026-10-23T12:00:00Z',values:{...defaultData,sp500:7623.68,nasdaq:25955.34,nasdaq100:28957.53,equitySessionDate:'2026-10-23'},entryLabel:'Saved entry'};
  localStorage.setItem('crash-risk-history-v1:migration-test',JSON.stringify([record]));
 });
 await page.locator('#loginEmail').fill('test@example.com');
 await page.locator('#loginPassword').fill('isolated-test-password');
 await page.locator('#loginStep button[type=submit]').click();
 await page.waitForFunction(()=>entryHistory.length===1 && requiredElement('syncStatus').textContent?.includes('paused'));
 assert(await page.locator('#appShell').isVisible());
 // Existing actions remain, alongside explicitly requested theme/search controls; no Reset.
 assert.equal(await page.locator('#accountMenu button').count(),7);
 assert.equal(await page.locator('#accountMenu button').filter({hasText:/reset/i}).count(),0);
 await page.locator('#accountMenuButton').click();
 assert(await page.locator('#accountMenu #loggedInEmail').isVisible());
 await page.locator('#mobileLayoutBtn').click();
 assert.equal(await page.locator('html').getAttribute('data-platform'),'mobile');
 await page.locator('#desktopLayoutBtn').click();
 assert.equal(await page.locator('html').getAttribute('data-platform'),'desktop');
 await page.locator('[data-theme-choice="light"]').click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.screenshot({path:'test-results/light-overview.png'});
 await page.locator('[data-theme-choice="auto"]').click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.keyboard.press('Escape');
 assert(await page.locator('#accountMenu').isHidden());
 assert.equal(await page.locator('#accountMenuButton').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.signal-card').count(),5);
 assert.equal(await page.locator('.signal-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.signal-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
 const topbarBox=await page.locator('.workspace-topbar').boundingBox();
 assert(topbarBox&&topbarBox.height<=64,'Mobile top bar must remain one slim row');
 await page.locator('#accountMenuButton').click();
 assert(await page.locator('#accountMenu .logout-btn').isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'test-results/mobile-account-menu.png'});
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('#quickJumpButton').click();
 const searchInput=page.locator('#quickJumpDialog input');
 await searchInput.fill('VIX');
 await searchInput.press('Enter');
 await page.waitForFunction(()=>location.hash==='#riskFactorsScreen');
 await page.waitForFunction(()=>document.activeElement?.textContent?.includes('VIX'));
 await page.keyboard.press('g');await page.keyboard.press('d');
 await page.waitForFunction(()=>location.hash==='#dashboardOverview');
 await page.keyboard.press('Control+k');
 assert(await searchInput.isVisible());
 await searchInput.fill('no matching ticker xyz');
 assert.equal(await page.locator('#quickJumpResults [role=option]').count(),0);
 await searchInput.press('Escape');
 await page.keyboard.press('Meta+k');await searchInput.waitFor({state:'visible'});await searchInput.press('Escape');
 await searchInput.waitFor({state:'hidden'});
 await page.keyboard.press('/');await searchInput.waitFor({state:'visible'});
 await searchInput.fill('Theme: light');await searchInput.press('ArrowDown');await searchInput.press('Enter');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await searchInput.waitFor({state:'hidden'});
 await page.keyboard.press('?');await page.locator('#shortcutHelp').waitFor({state:'visible'});await page.keyboard.press('Escape');
 await page.keyboard.press('g');await page.keyboard.press('u');
 await page.waitForFunction(()=>location.hash==='#dashboardUpdate');
 await page.locator('#quickPasteInput').fill('');
 await page.locator('#quickPasteInput').pressSequentially('gd/?');
 assert.equal(await page.locator('#quickPasteInput').inputValue(),'gd/?');
 assert.equal(await page.locator('#quickJumpDialog').isVisible(),false);
 assert.equal(await page.evaluate(()=>location.hash),'#dashboardUpdate');
 await page.locator('#quickPasteInput').fill('');
 await page.locator('#accountMenuButton').click();await page.locator('[data-theme-choice="dark"]').click();await page.keyboard.press('Escape');
 await page.locator('.workspace-nav-link[data-screen="overview"]').click();
 assert(await page.evaluate(()=>Number.isFinite(model50Inputs(currentData,'2026-10-26').momentum)));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'test-results/desktop.png'});
 const nav=page.locator('.workspace-nav-link');
 assert.equal(await nav.count(),13);
 for(let i=0;i<await nav.count();i++){
  await nav.nth(i).click();
  await page.screenshot({path:'test-results/screen-'+i+'.png'});
  assert(await page.evaluate(()=>{const e=document.getElementById(location.hash.slice(1));return e && e.closest<HTMLElement>('.workspace-screen')?.hidden===false && (!e.matches('details')||e instanceof HTMLDetailsElement&&e.open)}));
 }
 await page.evaluate(()=>{
  requiredElement('quickPasteFinancialDate').value='2026-10-20';
  requiredElement('quickPasteNonfinancialDate').value='2026-10-20';
  requiredElement('quickPasteTreasuryDate').value='2026-10-20';
 });
 await page.evaluate(()=>{requiredElement('quickPasteInput').value='19.45,2.2070,-2.7014,340,17,67,111,5.00,-18,-0.9865,4.5584,104.27,8.7505,103.31,156.494,58.30,31.98,1.03,7623.68,202609,1480054,31.3859,-1.4658,5062330000,5191197500,-0.5187,-1.2799,7660.15,7612.07,25955.34,28957.53,20261027,4.08,4.09,4.09,20261023,20261026,20261013,20261027';requiredElement('quickPasteEquityDate').value='2026-10-22';parseQuickPaste()});
 assert.match((await page.locator('#quickPasteStatus').textContent())??'',/saved successfully/);
 assert.equal(await page.locator('#quickPasteEquityDate').inputValue(),'2026-10-23');
 assert.equal(await page.locator('#quickPasteFinancialDate').inputValue(),'2026-10-26');
 assert.equal(await page.locator('#quickPasteNonfinancialDate').inputValue(),'2026-10-13');
 assert.equal(await page.locator('#quickPasteTreasuryDate').inputValue(),'2026-10-27');
 const dateValidation=await page.evaluate(()=>{
  const fields=requiredElement('quickPasteInput').value.split(',');
  const invalid=fields.slice();invalid[37]='20260230';
  const mismatch=fields.slice();mismatch[31]='20261013';
  const missing=fields.slice();missing[35]='';
  return [invalid,mismatch,missing].map(row=>DashboardCore.parseQuickPasteValues(row.join(',')).ok);
 });
 assert.deepEqual(dateValidation,[false,false,false]);
 const savedState=await page.evaluate(()=>{const raw=localStorage.getItem(historyKey());return {raw,rows:validatedMarketHistory(parseJson(raw??'[]'))};});
 const saved=savedState.raw;
 assert.equal(savedState.rows.length,2);
 const firstSaved=savedState.rows[0];assert(firstSaved);
 const cpSaved=firstSaved.values;
 assert.equal(cpSaved.cp_financial_date,20261026);
 assert.equal(cpSaved.cp_nonfinancial_date,20261013);
 assert.equal(cpSaved.cp_treasury_date,20261027);
 assert.equal(cpSaved.cp_date,20261027);
 assert.equal(cpSaved.cp_financial,4.08);
 assert.equal(cpSaved.cp_nonfinancial,4.09);
 assert.equal(cpSaved.cp_treasury,4.09);
 assert(!(await page.locator('#quickPastePrompt').count()) || !(await page.locator('#quickPastePrompt').innerText()).includes('Use the latest verified common date for all three rates'));

 await page.reload();
 await page.evaluate(()=>{loadEntryHistory('migration-test');requiredElement('authOverlay').style.display='none';requiredElement('appShell').style.display='block';renderDashboard();});
 assert.equal(await page.evaluate(()=>localStorage.getItem(historyKey())),saved);
 assert.equal(await page.evaluate(()=>entryHistory.length),2);

 // Exercise the converted document, Fed, funding and recovery adapters on the isolated account.
 page.on('dialog',dialog=>void dialog.accept());
 const workflows=await page.evaluate(async()=>{
  requiredElement('fedPaste').value=JSON.stringify({observedAt:'2026-10-01T12:00:00Z',publishedAt:null,meetingDate:'2026-11-04',targetLower:4,targetUpper:4.25,hike:10,hold:70,cut:20,comparisonAt:null,hikeChange5d:null,holdChange5d:null,cutChange5d:null,source:'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',calendarSource:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',notes:'Isolated regression fixture'});
  importFedWatch();
  requiredElement('fundingQuickPaste').value=JSON.stringify({observationDate:'2026-09-16',publishedAt:'2026-09-17T20:31:00Z',balance:94,testBalance:null,testEvidence:'',source:'https://fred.stlouisfed.org/series/SWPT'});
  fillFundingFromAI();
  await generateAnalysisPrompt();
  const doc=analysisWordBlob('', 'Strict TypeScript document round trip.');
  await importAnalysisWord(new File([doc],'regression.docx',{type:doc.type}));
  const record=analysisRecords[0];
  if(!record)throw Error(requiredElement('analysisStatus').textContent||'Missing saved analysis');
  const original=record.word?.base64;
  await deleteAnalysis(record.id);
  const archived=await restoreArchiveEntries('migration-test');
  const saved=archived.find(item=>item.kind==='analysis'&&'id' in item.row&&item.row.id===record.id);
  if(!saved)throw Error('Deleted analysis was not archived');
  await restoreRowAction('analysis',saved.row);
  return {fed:fedWatchRows.length,funding:fundingRecords.length,analysis:analysisRecords.length,response:analysisRecords[0]?.response,originalPreserved:analysisRecords[0]?.word?.base64===original};
 });
 assert.deepEqual(workflows,{fed:1,funding:1,analysis:1,response:'Strict TypeScript document round trip.',originalPreserved:true});
 const fundingEquities=await page.evaluate(()=>{
  const originalFunding=fundingRecords,originalHistory=entryHistory,fixture=fundingRecords[0];
  if(!fixture)throw Error('Missing funding fixture');
  const readCells=()=>Array.from(requiredElement('fundingRows').querySelector('tr')?.querySelectorAll('td')??[]).slice(-3).map(td=>td.textContent);
  try{
   fundingRecords=[{...fixture,observationDate:'2026-10-28',publishedAt:'2026-10-29T20:31:00Z'}];
   entryHistory=[];renderFunding();const embedded=readCells();
   entryHistory=[{savedAt:'2026-10-30T21:00:00Z',values:{equitySessionDate:'2026-10-30',sp500:1,nasdaq:2,nasdaq100:3}}];
   renderFunding();const differentSession=readCells();
   entryHistory=[...entryHistory,{savedAt:'2026-10-31T21:00:00Z',values:{equitySessionDate:'2026-10-28',sp500:8000,nasdaq:27000,nasdaq100:30000}}];
   renderFunding();const saved=readCells();
   return {embedded,differentSession,saved,expected:[fundingNumber(7743.98),fundingNumber(26549.85),fundingNumber(29813.16)],savedExpected:[fundingNumber(8000),fundingNumber(27000),fundingNumber(30000)]};
  }finally{fundingRecords=originalFunding;entryHistory=originalHistory;renderFunding();}
 });
 assert.deepEqual(fundingEquities.embedded,fundingEquities.expected,'Funding table must show recent embedded closes');
 assert.deepEqual(fundingEquities.differentSession,fundingEquities.expected,'Never use another session to fill funding equity cells');
 assert.deepEqual(fundingEquities.saved,fundingEquities.savedExpected,'Saved same-session closes override embedded values');
 const accountRoundTrip=await page.evaluate(async()=>{
  if(!historyOwner)throw Error('Missing test account');
  localStorage.setItem(fredKeyStorage(),'test-fred-key');
  await saveRecoverySnapshot(historyOwner,'row-trash-account-test',{kind:'fed',rows:fedWatchRows,deletedAt:new Date().toISOString()});
  const backup=await createAccountBackup(),copy=parseAccountBackup(JSON.stringify(backup));
  let rejected=false;try{parseAccountBackup(JSON.stringify({...backup,snapshot:{}}));}catch{rejected=true;}
  loadEntryHistory('replacement-account-test');
  await restoreAccountData(copy,'replacement-account-test');
  const restored=await createAccountBackup();
  const originalAnalyses=validateAnalysisHistory(parseJson(backup.snapshot.analysisHistory??'[]'));
  return {rejected,same:snapshotFingerprint(restored.snapshot)===snapshotFingerprint(backup.snapshot),key:restored.fredKey,word:analysisRecords[0]?.word?.base64===originalAnalyses[0]?.word?.base64,trash:(await restoreArchiveEntries('replacement-account-test')).some(item=>item.kind==='fed'),paused:syncReadyOwner===null,original:localSnapshot(backup.owner).entryHistory===backup.snapshot.entryHistory};
 });
 assert.deepEqual(accountRoundTrip,{rejected:true,same:true,key:'test-fred-key',word:true,trash:true,paused:true,original:true});
 const invalidBoundaries=await page.evaluate(()=>{
  const analysis=analysisRecords[0],funding=fundingRecords[0],market=entryHistory[0];
  if(!analysis||!funding||!market)throw Error('Missing round-trip fixtures');
  const rejects=(operation:()=>unknown)=>{try{operation();return false;}catch{return true;}};
  return [
   rejects(()=>validateAnalysisHistory([{...analysis,word:{name:'bad.docx',text:'bad',base64:42}}])),
   rejects(()=>validateAnalysisHistory([{...analysis,values:{...analysis.values,vix:'19'}}])),
   rejects(()=>validateAnalysisHistory([{...analysis,categories:[{low:0,high:1},...analysis.categories.slice(1)]}])),
   rejects(()=>validateFunding({...funding,reference:'true'})),
   rejects(()=>validatedMarketHistory([{...market,values:{...market.values,volume:'100'}}])),
   rejects(()=>validatedMarketHistory([{...market,historyOverrides:{composite:{low:'0',high:1}}}])),
   rejects(()=>requiredValue(undefined))
  ];
 });
 assert(invalidBoundaries.every(Boolean),'Malformed boundary data must be rejected without assertions');
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{setPlatformLayout('mobile');history.replaceState(null,'','/');document.documentElement.style.scrollBehavior='auto';scrollTo(0,0)});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page overflows');
 await page.locator('.workspace-menu-button').click();
 await page.locator('.workspace-nav-link[data-screen=history]').click();
 assert(await page.locator('.workspace-screen[data-screen=history]').isVisible());
 await page.locator('.workspace-menu-button').click();
 await page.locator('.workspace-nav-link[data-screen=overview]').click();
 await page.screenshot({path:'test-results/mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: mocked sign-in, browser rendering, all 13 workspace routes, mobile navigation, 35-value save/reload, finite momentum, Fed/funding imports, Word round trip, delete/restore, desktop/mobile overflow; no uncaught errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
