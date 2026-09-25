import { EffectMaker, ORIGIN } from './sdk.mjs';

/** Attach to an already-running, user-authorized Chromium CDP endpoint.
 * Never starts a user profile, reads cookies, logs in, or selects an unrelated tab.
 */
export async function connectCDP(endpoint,{pageUrl,playwright,timeoutMs=15000}={}){
  const u=new URL(endpoint);
  if(!['http:','https:','ws:','wss:'].includes(u.protocol))throw new Error('Unsupported CDP endpoint protocol');
  if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('Use a loopback CDP endpoint (or an explicitly authorized local tunnel)');
  if(u.username||u.password)throw new Error('Do not embed credentials in a CDP URL');
  const library=playwright??await import('playwright');
  const browser=await library.chromium.connectOverCDP(endpoint,{timeout:timeoutMs});
  const pages=browser.contexts().flatMap(context=>context.pages());
  const candidates=pages.filter(page=>pageUrl?page.url()===pageUrl:page.url().startsWith(ORIGIN+'/'));
  if(candidates.length!==1){await browser.close();throw new Error(`Expected one matching tab, found ${candidates.length}; supply pageUrl to disambiguate`);}
  const page=candidates[0];
  const sdk=new EffectMaker(page,{
    navigate:url=>page.goto(url),snapshot:()=>page.locator('body').ariaSnapshot(),timeoutMs,
    upload:async(button,path)=>{const pending=page.waitForEvent('filechooser',{timeout:10000});await button.click();const chooser=await pending;await chooser.setFiles(path);},
  });
  // browser.close() disconnects this connectOverCDP client; it does not terminate the host browser.
  return {sdk,page,disconnect:()=>browser.close()};
}
