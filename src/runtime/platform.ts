function setPlatformLayout(mode:string,persist=true):void {DashboardCore.setPlatformLayout(mode,persist);}
DashboardCore.initializeTheme();
DashboardCore.initializePlatform();
document.addEventListener("DOMContentLoaded",()=>DashboardCore.initializeWorkspace());
