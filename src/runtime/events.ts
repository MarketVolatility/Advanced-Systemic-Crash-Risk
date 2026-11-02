/** Typed event bindings for the HTML shell; no executable inline attributes. */
type DashboardAction=(event:Event,element:HTMLElement)=>unknown;
const dashboardActions:Record<string,DashboardAction>={
 "backupAccount":()=>{void backupAccount();},
 "chooseAccountRestore":()=>{requiredElement('restoreAccountFile').click();},
 "restoreAccount":(_event,element)=>{if(element instanceof HTMLInputElement)void restoreAccount(element);},
 "handleLogin-1":(event)=>{if(event instanceof SubmitEvent)handleLogin(event);},
 "showAuthStep-2":()=>{showAuthStep('registerStep');},
 "handleRegister-3":(event)=>{if(event instanceof SubmitEvent)handleRegister(event);},
 "showAuthStep-4":()=>{showAuthStep('loginStep');},
 "setPlatformLayout-5":()=>{setPlatformLayout('desktop');},
 "setPlatformLayout-6":()=>{setPlatformLayout('mobile');},
 "syncNow-7":()=>{syncNow();},
 "openTroubleshootSync-8":()=>{openTroubleshootSync();},
 "logoutUser-9":()=>{logoutUser();},
 "preventDefault-10":(event)=>{event.preventDefault();finishSyncChoice('later');},
 "finishSyncChoice-11":()=>{finishSyncChoice('local');},
 "finishSyncChoice-12":()=>{finishSyncChoice('cloud');},
 "finishSyncChoice-13":()=>{finishSyncChoice('later');},
 "preventDefault-14":(event)=>{event.preventDefault();hideCloudOverwrite();},
 "overwriteCloudWithLocal-15":(event)=>{overwriteCloudWithLocal(event);},
 "hideCloudOverwrite-16":()=>{hideCloudOverwrite();},
 "preventDefault-17":(event)=>{event.preventDefault();event.stopPropagation();downloadLatestAnalysis();},
 "generateAnalysisPrompt-18":()=>{generateAnalysisPrompt();},
 "copyAnalysisPrompt-19":()=>{copyAnalysisPrompt();},
 "exportAnalysisWord-20":()=>{exportAnalysisWord();},
 "getElementById-21":()=>{requiredElement('analysisWordFile').click();},
 "importAnalysisWord-22":(_event,element)=>{if(element instanceof HTMLInputElement)void importAnalysisWord(element.files?.[0]);},
 "refreshAnalysisPreview-23":()=>{refreshAnalysisPreview();},
 "saveAnalysisResponse-24":()=>{saveAnalysisResponse();},
 "copyQuickPastePrompt-25":()=>{copyQuickPastePrompt();},
 "parseQuickPaste-26":()=>{parseQuickPaste();},
 "setAllChartRanges-27":(_event,element)=>{if(element instanceof HTMLSelectElement)setAllChartRanges(element.value);},
 "generateFedPrompt-28":()=>{generateFedPrompt();},
 "copyFedPrompt-29":()=>{copyFedPrompt();},
 "importFedWatch-30":()=>{importFedWatch();},
 "getElementById-31":()=>{requiredElement('fedPaste').value='';},
 "generateFundingQuickPrompt-32":()=>{generateFundingQuickPrompt();},
 "copyFundingQuickPrompt-33":()=>{copyFundingQuickPrompt();},
 "fillFundingFromAI-34":()=>{fillFundingFromAI();},
 "resetFundingForm-35":()=>{resetFundingForm();},
 "fundingPrompt-36":()=>{fundingPrompt();},
 "copyFundingPrompt-37":()=>{copyFundingPrompt();},
 "importFunding-38":()=>{importFunding();},
 "exportFunding-39":()=>{exportFunding();},
 "copyCpPrompt-40":()=>{copyCpPrompt();},
 "applyCpResponse-41":()=>{applyCpResponse();},
 "saveFredKey-42":()=>{saveFredKey();},
 "forgetFredKey-43":()=>{forgetFredKey();},
 "fetchFredLiveData-44":()=>{fetchFredLiveData();},
 "renderLiquidityDiagnostics-45":()=>{renderLiquidityDiagnostics();},
 "exportCloudComparison-46":()=>{exportCloudComparison();},
 "showCloudOverwrite-47":()=>{showCloudOverwrite();},
 "getElementById-48":()=>{requiredElement('restoreCloudFile').click();},
 "importCloudRestore-49":(_event,element)=>{if(element instanceof HTMLInputElement)void importCloudRestore(element);},
 "if-50":(_event,element)=>{if(element instanceof HTMLDetailsElement&&element.open)renderRestoreTables();},
 "renderRestoreTables-51":()=>{renderRestoreTables();},
};
function bindDashboardActions():void {
 for(const eventName of ['click','change','input','submit','toggle','cancel'] as const){
  document.querySelectorAll<HTMLElement>('[data-on'+eventName+']').forEach(element=>{
   const name=element.getAttribute('data-on'+eventName),action=name?dashboardActions[name]:undefined;
   if(!action)throw Error('Unknown dashboard action: '+name);
   element.addEventListener(eventName,event=>{void action(event,element);});
  });
 }
}
document.addEventListener('DOMContentLoaded',bindDashboardActions);
