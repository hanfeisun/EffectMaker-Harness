import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const run=promisify(execFile);

test('Browser Harness transport commits scoped Effect Maker controls',async(t)=>{
  const python=process.env.HARNESS_PYTHON;
  if(!python){t.skip('Set HARNESS_PYTHON to Python with browser-harness==0.1.13');return;}
  const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const runtime=await mkdtemp(join(tmpdir(),'em-bh-'));
  const host=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--remote-debugging-address=127.0.0.1','--remote-debugging-port=19224']});
  const env={...process.env,BU_CDP_URL:'http://127.0.0.1:19224',BU_CDP_WS:'',BU_NAME:'default',BH_HOME:runtime,BH_RUNTIME_DIR:runtime,BH_TMP_DIR:runtime,BH_AGENT_WORKSPACE:join(runtime,'workspace'),BH_RECORD:'0',BH_TELEMETRY:'0',BH_TAB_MARKER:'0'};
  t.after(async()=>{await run(python,['-m','browser_harness.run','--reload'],{env,timeout:15000}).catch(()=>{});await host.close();await rm(runtime,{recursive:true,force:true});});
  const page=await host.newPage();
  await page.setContent(`<title>Effect Maker harness fixture</title>
    <button aria-label="Save status indicator" data-title="Saved">saved</button>
    <div role="group" aria-label="Text"><input role="spinbutton" aria-label="Size" aria-valuemin="1" aria-valuemax="100" aria-valuenow="64" value="64"></div>
    <div role="group" aria-label="Other"><input role="spinbutton" aria-label="Size" aria-valuenow="7" value="7"></div>
    <textarea aria-label="Text content">old text</textarea><button disabled aria-label="Disabled control">Disabled</button>
    <script>document.querySelector('input').onkeydown=e=>{if(e.key==='Enter')e.target.setAttribute('aria-valuenow',e.target.value);};</script>`);
  const modulePath=resolve(new URL('../skills/effectmaker/scripts',import.meta.url).pathname);
  const code=`import sys,json\nsys.path.insert(0,${JSON.stringify(modulePath)})\nfrom browser_harness.admin import ensure_daemon\nfrom browser_harness import helpers as h\nfrom effectmaker_harness import EffectMakerHarness\nensure_daemon()\ntabs=[t for t in h.list_tabs() if t['title']=='Effect Maker harness fixture']\nassert len(tabs)==1\nh.switch_tab(tabs[0]['targetId'])\nem=EffectMakerHarness()\nfor value in [23,1,100]:\n assert em.set_number('Text','Size',value)['committed']==value\nfor value in [101,float('nan')]:\n try: em.set_number('Text','Size',value)\n except ValueError: pass\n else: raise AssertionError('Invalid value accepted')\nfor role,name in [('spinbutton','Size'),('button','Disabled control')]:\n try: em.find(role,name)\n except RuntimeError: pass\n else: raise AssertionError('Ambiguous/disabled target accepted')\nassert em.replace('textbox','Text content','Hello\\nworld')=='Hello\\nworld'\nassert em.saved()['saved']\nprint(json.dumps({'passed':True,'transport':'browser-harness','checks':7}))`;
  const result=await run(python,['-c',code],{env,timeout:45000});
  assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)).passed,true);
  assert.equal(await page.getByRole('group',{name:'Other',exact:true}).getByRole('spinbutton').inputValue(),'7');
});
