import {themeControls} from './theme';
/** Rehouse existing controls without changing their handlers or data contracts. */
export function initializeAccountMenu(topbar:HTMLElement):void {
 const actions=topbar.querySelector<HTMLElement>('.header-actions'),user=actions?.querySelector('.user-menu');
 if(!actions||!user)return;
 const account=document.createElement('div');account.className='account-control';
 const panel=document.createElement('div');panel.id='accountMenu';panel.className='account-panel';panel.hidden=true;
 panel.setAttribute('role','group');panel.setAttribute('aria-label','Account controls');
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Account';toggle.id='accountMenuButton';
 toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
 function setOpen(open:boolean):void {panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
 toggle.addEventListener('click',()=>setOpen(panel.hidden));
 for(const child of [...user.children])if(child.id!=='syncNowBtn')panel.append(child);
 panel.append(themeControls());
 account.append(toggle,panel);
 const sync=document.getElementById('syncNowBtn'),status=document.getElementById('syncStatus');
 if(status)topbar.append(status);if(sync)topbar.append(sync);topbar.append(account);
 // Keep static nodes present for existing contracts, including the hidden build label.
 actions.hidden=true;
 document.addEventListener('click',event=>{if(event.target instanceof Node&&!account.contains(event.target))setOpen(false);});
 document.addEventListener('focusin',event=>{if(event.target instanceof Node&&!account.contains(event.target))setOpen(false);});
 account.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.stopPropagation();setOpen(false);toggle.focus();}});
 panel.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('button')&&!event.target.closest('#desktopLayoutBtn,#mobileLayoutBtn,[data-theme-choice]'))setOpen(false);});
}
