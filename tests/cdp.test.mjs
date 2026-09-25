import test from 'node:test';
import assert from 'node:assert/strict';
import {RawEffectMakerCDP} from '../skills/effectmaker/scripts/raw-cdp.mjs';
import {connectCDP} from '../skills/effectmaker/scripts/cdp.mjs';

test('rejects non-loopback CDP and credentials before connecting',async()=>{
  await assert.rejects(()=>connectCDP('https://example.com:9222'),/loopback/);
  await assert.rejects(()=>connectCDP('http://user:secret@localhost:9222'),/credentials/);
});

test('connects through real CDP and commits custom numeric controls',async(t)=>{
  const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const options={headless:true,args:['--remote-debugging-address=127.0.0.1','--remote-debugging-port=19223']};
  if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  const host=await pw.chromium.launch(options);t.after(()=>host.close());
  const page=await host.newPage();
  // Local fixture only. No Effect Maker identity or application network is mocked.
  await page.setContent(`<button aria-label="Save status indicator" data-title="Saved">cloud_check</button>
    <div role="group" aria-label="Color filter">
      <input role="spinbutton" aria-label="Saturation" type="text" aria-valuenow="0" aria-valuemin="-100" aria-valuemax="100" step="1" value="0">
    </div>
    <script>
      const field=document.querySelector('input');
      field.onkeydown=e=>{if(e.key==='Enter')field.setAttribute('aria-valuenow',field.value);if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        e.preventDefault();field.value=Math.min(100,Math.max(-100,Number(field.value)+(e.key==='ArrowUp'?1:-1)));
        field.setAttribute('aria-valuenow',field.value);
      }};
    </script>`);
  const connection=await connectCDP('http://127.0.0.1:19223',{pageUrl:page.url(),playwright:pw});
  t.after(()=>connection.disconnect());
  const {sdk}=connection;
  assert.deepEqual(await sdk.setNumber('Color filter','Saturation',15),{value:15,committed:15});
  assert.deepEqual(await sdk.setNumber('Color filter','Saturation',100),{value:100,committed:100});
  assert.deepEqual(await sdk.setNumber('Color filter','Saturation',-100),{value:-100,committed:-100});
  await assert.rejects(()=>sdk.setNumber('Color filter','Saturation',101),/bounds/);
  await assert.rejects(()=>sdk.setNumber('Color filter','Saturation',NaN),/Finite/);
  const raw=new RawEffectMakerCDP(await connection.page.context().newCDPSession(connection.page));
  await raw.replace('spinbutton','Saturation','23',{within:{role:'group',name:'Color filter'},selectAllModifier:process.platform==='darwin'?4:2});
  console.log('Raw input state',await connection.page.getByRole('spinbutton').evaluate(el=>({value:el.value,aria:el.getAttribute('aria-valuenow')})));
  assert.equal(await raw.value('spinbutton','Saturation'),23);
  assert.equal((await raw.saved()).saved,true);
  await connection.disconnect();
  assert.equal(await page.title(),''); // disconnect preserved the host page
});
