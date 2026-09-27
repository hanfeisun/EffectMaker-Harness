import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recipes} from '../skills/effectmaker/scripts/sdk.mjs';
const run=promisify(execFile);
const modulePath=fileURLToPath(new URL('../skills/effectmaker/scripts',import.meta.url));
const python=process.env.HARNESS_PYTHON;
const skipReason='Set HARNESS_PYTHON to Python with browser-harness==0.1.13';

test('Python and JavaScript creation routes match',async(t)=>{
  if(!python){t.skip(skipReason);return;}
  const code=`import sys,json\nsys.path.insert(0,${JSON.stringify(modulePath)})\nfrom effectmaker_harness import RECIPES\nprint(json.dumps(RECIPES))`;
  const {stdout}=await run(python,['-c',code]);
  assert.deepEqual(JSON.parse(stdout),JSON.parse(JSON.stringify(recipes)));
});

async function withHarness(t,port,html,script){
  const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const runtime=await mkdtemp(join(tmpdir(),'em-bh-'));
  const host=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`]});
  const env={...process.env,BU_CDP_URL:`http://127.0.0.1:${port}`,BU_CDP_WS:'',BU_NAME:'default',BH_HOME:runtime,BH_RUNTIME_DIR:runtime,BH_TMP_DIR:runtime,BH_AGENT_WORKSPACE:join(runtime,'workspace'),BH_RECORD:'0',BH_TELEMETRY:'0',BH_TAB_MARKER:'0',PYTHONIOENCODING:'utf-8'};
  t.after(async()=>{await run(python,['-m','browser_harness.run','--reload'],{env,timeout:15000}).catch(()=>{});await host.close();await rm(runtime,{recursive:true,force:true});});
  const page=await host.newPage();
  await page.setContent(html);
  const title=await page.title();
  const code=`import sys,json,os\nsys.path.insert(0,${JSON.stringify(modulePath)})\nfrom browser_harness.admin import ensure_daemon\nfrom browser_harness import helpers as h\nfrom effectmaker_harness import EffectMakerHarness\nensure_daemon()\ntabs=[t for t in h.list_tabs() if t['title']==${JSON.stringify(title)}]\nassert len(tabs)==1\nh.switch_tab(tabs[0]['targetId'])\nem=EffectMakerHarness(timeout=5)\nRUNTIME=${JSON.stringify(runtime)}\n${script}`;
  const result=await run(python,['-c',code],{env,timeout:60000});
  return {page,result:JSON.parse(result.stdout.trim().split('\n').at(-1))};
}

test('Browser Harness transport commits scoped Effect Maker controls',async(t)=>{
  if(!python){t.skip(skipReason);return;}
  const {page,result}=await withHarness(t,19224,`<title>Effect Maker harness fixture</title>
    <button aria-label="Save status indicator" data-title="Saved">saved</button>
    <div role="group" aria-label="Text"><input role="spinbutton" aria-label="Size" aria-valuemin="1" aria-valuemax="100" aria-valuenow="64" value="64"></div>
    <div role="group" aria-label="Other"><input role="spinbutton" aria-label="Size" aria-valuenow="7" value="7"></div>
    <textarea aria-label="Text content">old text</textarea><button disabled aria-label="Disabled control">Disabled</button>
    <script>document.querySelector('input').onkeydown=e=>{if(e.key==='Enter')e.target.setAttribute('aria-valuenow',e.target.value);};</script>`,
  `for value in [23,1,100]:\n assert em.set_number('Text','Size',value)['committed']==value\nfor value in [101,float('nan')]:\n try: em.set_number('Text','Size',value)\n except ValueError: pass\n else: raise AssertionError('Invalid value accepted')\nfor role,name in [('spinbutton','Size'),('button','Disabled control')]:\n try: em.find(role,name)\n except RuntimeError: pass\n else: raise AssertionError('Ambiguous/disabled target accepted')\nassert em.replace('textbox','Text content','Hello\\nworld')=='Hello\\nworld'\nassert em.saved()['saved']\nprint(json.dumps({'passed':True,'transport':'browser-harness','checks':7}))`);
  assert.equal(result.passed,true);
  assert.equal(await page.getByRole('group',{name:'Other',exact:true}).getByRole('spinbutton').inputValue(),'7');
});

// Mirrors observed editor behaviour: toolbar buttons toggle (a click from a subpanel closes it),
// the asset dialog is a native <dialog>, and a successful upload closes it and adds an object.
const assetFixture=`<title>Effect Maker asset fixture</title>
  <button aria-label="Save status indicator" data-title="Saved">saved</button>
  <nav><button aria-label="Objects and assets">O</button><button aria-label="Visual effects">V</button><button aria-label="3D">3</button></nav>
  <section id="panel"></section>
  <dialog><p id="hint"></p><input type="file"><button>Done</button><button>Skip</button></dialog>
  <script>
    const panel=document.getElementById('panel'),dlg=document.querySelector('dialog'),save=document.querySelector('[aria-label="Save status indicator"]');
    const objects=['Text object: Hello World'];let state=null;
    const views={
      objects:()=>'<div role="tablist"><button role="tab">Objects</button><button role="tab">Assets</button></div><ul role="tree">'+objects.map(o=>'<li role="treeitem" aria-label="'+o+'">'+o+'</li>').join('')+'</ul>',
      vfx:()=>'<h2>Visual effects</h2><button>Color filter</button><button>Particles</button>',
      color:()=>'<button>Back</button><h2>Color filter</h2><button>Add filter</button><button>Use LUT</button>',
      threeD:()=>'<h2>3D</h2><button>3D model</button><button>Light</button>',
      model:()=>'<h2>3D model</h2><button>Add 3D model</button>',
    };
    const render=()=>{panel.innerHTML=state?views[state]():'';};
    const root={'Objects and assets':'objects','Visual effects':'vfx','3D':'threeD'};
    const sub={'Color filter':'color','3D model':'model'};
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;const name=b.getAttribute('aria-label')||b.textContent;
      if(root[name]){state=state===root[name]||(state&&!Object.values(root).includes(state))?null:root[name];render();}
      else if(sub[name]){state=sub[name];render();}
      else if(name==='Use LUT'||name==='Add 3D model'){document.getElementById('hint').textContent=name==='Use LUT'?'Add a .cube':'Attach 3D model (GLB)';dlg.showModal();}
    });
    dlg.querySelector('input').addEventListener('change',e=>{
      const file=e.target.files[0].name,kind=file.endsWith('.glb')?'3D model object: ':'Color filter object: ';
      save.dataset.title='Saving';
      setTimeout(()=>{objects.push(kind+file.replace(/\\.[^.]+$/,''));dlg.close();},300);
      setTimeout(()=>{save.dataset.title='Saved';},600);
    });
  </script>`;

test('Browser Harness opens panels, follows creation routes and uploads assets',async(t)=>{
  if(!python){t.skip(skipReason);return;}
  const {result}=await withHarness(t,19225,assetFixture,
  `lut=os.path.join(RUNTIME,'hello.cube');open(lut,'w').write('LUT_3D_SIZE 2\\n')\nglb=os.path.join(RUNTIME,'cube.glb');open(glb,'wb').write(b'glTF')\ntry: em.upload_asset(lut)\nexcept RuntimeError: pass\nelse: raise AssertionError('Upload without dialog accepted')\nfor bad in [lambda: em.begin_add('nope'), lambda: em.open_panel('Nope')]:\n try: bad()\n except ValueError: pass\n else: raise AssertionError('Unknown route accepted')\nem.begin_add('lut')\nassert '.cube' in em.asset_dialog_text()\nfirst=em.upload_asset(lut)\nassert first['saved'] and 'Color filter object: hello' in first['objects'], first\nassert em.asset_dialog_text() is None\nem.open_panel('Visual effects'); em.click('button','Color filter')\nem.open_panel('Visual effects')\nassert em.exists('heading','Visual effects',level=2)\nem.begin_add('model')\nsecond=em.upload_asset(glb)\nassert '3D model object: cube' in second['objects'], second\nassert em.objects()==['Text object: Hello World','Color filter object: hello','3D model object: cube']\nassert ('treeitem','3D model object: cube',None) in em.outline(roles=['treeitem'])\nprint(json.dumps({'passed':True,'checks':10}))`);
  assert.equal(result.passed,true);
});

// Observed object-tree behaviour: the context menu is a popover, Rename edits in place,
// the visibility button is named for the current state, and "Add LUT..." opens the OS file chooser.
const objectFixture=`<title>Effect Maker object fixture</title>
  <button aria-label="Save status indicator" data-title="Saved">saved</button>
  <input aria-label="Project title" value="Fixture">
  <nav><button aria-label="Objects and assets">O</button></nav>
  <section id="panel"></section>
  <div role="group" aria-label="LUT"><input role="combobox" aria-label="LUT" readonly value="look"><div id="opts"></div></div>
  <div id="menu"></div><input type="file" id="picker" hidden>
  <script>
    const panel=document.getElementById('panel'),menu=document.getElementById('menu'),opts=document.getElementById('opts'),lut=document.querySelector('[role=combobox]'),picker=document.getElementById('picker');
    const save=document.querySelector('[aria-label="Save status indicator"]');
    const saved=()=>{save.dataset.title='Saving';setTimeout(()=>{save.dataset.title='Saved';},200);};
    const objects=['Text object: Hello','Color filter object: look'],hidden=new Set(),luts=['look'];
    let open=false,selected=null,editing=null,target=null;
    const row=o=>editing===o?'<li role="treeitem" aria-label="'+o+'"><input aria-label="Scene object name" value="'+o.split(': ')[1]+'"></li>'
      :'<li role="treeitem" aria-label="'+o+'">'+o+(selected===o||hidden.has(o)?' <button aria-label="Visibility '+(hidden.has(o)?'Off':'On')+'">eye</button>':'')+'</li>';
    const render=()=>{panel.innerHTML=open?'<div role="tablist"><button role="tab">Objects</button><button role="tab">Assets</button></div><ul role="tree">'+objects.map(row).join('')+'</ul>':'';
      const f=panel.querySelector('[aria-label="Scene object name"]');if(f){f.focus();f.onkeydown=e=>{if(e.key==='Enter'){objects[objects.indexOf(editing)]=editing.split(': ')[0]+': '+f.value;editing=null;render();saved();}};}};
    document.addEventListener('contextmenu',e=>{const li=e.target.closest('[role=treeitem]');if(!li)return;e.preventDefault();target=li.getAttribute('aria-label');
      menu.innerHTML='<div role="menu">'+['Duplicate','Rename','Add object','Delete'].map(a=>'<div role="menuitem">'+a+'</div>').join('')+'</div>';});
    document.addEventListener('click',e=>{
      const item=e.target.closest('[role=menuitem]'),eye=e.target.closest('[aria-label^="Visibility"]'),li=e.target.closest('[role=treeitem]'),option=e.target.closest('[role=option]');
      if(item){const a=item.textContent,i=objects.indexOf(target);menu.innerHTML='';
        if(a==='Duplicate')objects.splice(i+1,0,target+' 2');if(a==='Delete')objects.splice(i,1);if(a==='Rename')editing=target;render();if(a!=='Rename')saved();return;}
      if(eye){const o=eye.closest('[role=treeitem]').getAttribute('aria-label');hidden.has(o)?hidden.delete(o):hidden.add(o);render();saved();return;}
      if(li&&!e.target.closest('input')){selected=li.getAttribute('aria-label');menu.innerHTML='';render();return;}
      if(e.target.closest('[aria-label="Objects and assets"]')){open=!open;render();return;}
      if(e.target===lut){opts.innerHTML='<div role="listbox" aria-label="LUT">'+['Add LUT...','None',...luts].map(o=>'<div role="option">'+o+'</div>').join('')+'</div>';return;}
      if(option){opts.innerHTML='';if(option.textContent==='Add LUT...')picker.click();else{lut.value=option.textContent;saved();}}
    });
    picker.addEventListener('change',()=>{const name=picker.files[0].name.replace(/\.[^.]+$/,'');luts.push(name);setTimeout(()=>{lut.value=name;saved();},200);});
  </script>`;

test('Browser Harness edits objects and swaps the single LUT',async(t)=>{
  if(!python){t.skip(skipReason);return;}
  const {result}=await withHarness(t,19226,objectFixture,
  `png=os.path.join(RUNTIME,'fresh.png');open(png,'wb').write(b'PNG')\nassert em.objects()==['Text object: Hello','Color filter object: look']\ncopy=em.duplicate_object('Text object: Hello')\nassert copy=='Text object: Hello 2', copy\nrenamed=em.rename_object(copy,'Renamed')\nassert renamed=='Text object: Renamed', renamed\nassert em.set_object_visible(renamed,False) is False and em.exists_within(('treeitem',renamed),'button','Visibility Off')\nassert em.set_object_visible(renamed,True) and em.exists_within(('treeitem',renamed),'button','Visibility On')\nem.delete_object(renamed)\nassert em.objects()==['Text object: Hello','Color filter object: look']\nfor bad,err in [(lambda: em.delete_object('Text object: missing'),RuntimeError),(lambda: em.object_menu('Text object: Hello','Explode'),ValueError),(lambda: em.begin_add('lut'),RuntimeError)]:\n try: bad()\n except err: pass\n else: raise AssertionError('Unsafe operation accepted')\nassert em.choose('LUT','LUT','None')=='None'\nassert em.choose('LUT','LUT','Add LUT...',upload=png)=='fresh'\nassert em.choose('LUT','LUT','look')=='look'\nprint(json.dumps({'passed':True,'checks':12}))`);
  assert.equal(result.passed,true);
});
