type Platform = 'desktop' | 'mobile';
function isPlatform(mode: unknown): mode is Platform { return mode === 'desktop' || mode === 'mobile'; }
export function setPlatformLayout(mode: string, persist = true): void {
  if (!isPlatform(mode)) return;
  document.documentElement.dataset["platform"] = mode;
  // Keep the viewport accessible at every width; the selected mode controls density.
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) viewport.content = 'width=device-width, initial-scale=1.0';
  if (persist) { try { localStorage.setItem('crash-risk-platform-layout',mode); } catch { /* Styling still works if storage is full. */ } }
  for (const name of ['desktop','mobile']) document.getElementById(name+'LayoutBtn')?.setAttribute('aria-pressed',String(name === mode));
  window.dispatchEvent(new Event('resize'));
}
export function initializePlatform(): void {
  let saved: string | null = null;
  try { saved = localStorage.getItem('crash-risk-platform-layout'); } catch { /* Use responsive default. */ }
  const mode = isPlatform(saved) ? saved : window.matchMedia('(max-width:800px)').matches ? 'mobile' : 'desktop';
  setPlatformLayout(mode,false);
  document.addEventListener('DOMContentLoaded',() => setPlatformLayout(document.documentElement.dataset["platform"] ?? mode,false));
}
