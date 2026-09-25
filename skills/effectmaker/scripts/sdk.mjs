/** YouTube Effect Maker UI SDK. English UI selectors observed on 2026-09-25. */
export const ORIGIN = 'https://effects.youtube.com';
export const recipes = Object.freeze({
  text: ['Text', null, 'Add text'],
  filter: ['Visual effects', 'Color filter', 'Add filter'],
  particles: ['Visual effects', 'Particles', 'Add particles'],
  image: ['Image and video', 'Images', 'Add image'],
  imageSequence: ['Image and video', 'Images', 'Add image sequence'],
  facePaint: ['Face effects', 'Face paint', 'Add paint'],
  faceMaterial: ['Face effects', 'Face paint', 'Add 3D material'],
  faceAccessory: ['Face effects', 'Face accessory', 'Add image'],
  faceModel: ['Face effects', 'Face accessory', 'Add 3D model'],
  stretch: ['Face effects', 'Stretch', 'Add stretch'],
  body: ['Camera and segmentation', 'Body segmentation', 'Add body'],
  bodyBackground: ['Camera and segmentation', 'Body segmentation', 'Add body and background'],
  camera: ['Camera and segmentation', 'Camera feed', 'Add camera feed'],
  model: ['3D', '3D model', 'Add 3D model'],
  light: ['3D', 'Light', 'Add light'],
  snapshot: ['Image and video', 'Camera snapshot', 'Add with visual script'],
  drawing: ['Image and video', 'Draw', 'Add with visual script'],
  aiImage: ['Image and video', 'AI image', 'Add with visual script'],
  aiVideo: ['Image and video', 'AI video', 'Add with visual script'],
});
const panels = new Set(['Objects and assets','Visual effects','Image and video','Face effects','Camera and segmentation','Text','3D','Visual scripting']);
const headingFor = { 'Visual scripting': 'Visual script' };
const exact = name => ({name, exact:true});

export class EffectMaker {
  constructor(driver, {navigate, snapshot, upload, timeoutMs=15000}={}) {
    if (!driver?.getByRole) throw new Error('A Playwright-compatible driver is required');
    this.ui=driver; this.navigate=navigate ?? (url=>driver.goto(url));
    this.inspect=snapshot ?? (()=>driver.locator('body').innerText());
    this.upload=upload; this.timeoutMs=timeoutMs;
  }
  role(role,name,scope=this.ui){return scope.getByRole(role,exact(name));}
  button(name,scope=this.ui){return this.role('button',name,scope);}
  group(name){return this.role('group',name);}
  async snapshot(){return this.inspect();}
  async waitSaved(){
    const ready=this.button('Save status indicator').and(this.ui.locator('[data-title="Saved"]'));
    let last;
    // Some hosted drivers cap individual waits below the requested timeout.
    // Retry only this read-only check, never the preceding mutation.
    const deadline=Date.now()+this.timeoutMs;
    for(let attempt=0;attempt<5&&Date.now()<deadline;attempt++){
      try{await ready.waitFor({state:'visible',timeoutMs:Math.max(1,deadline-Date.now())});return {saved:true};}
      catch(error){last=error;if((await this.button('Save status indicator').getAttribute('data-title'))==='Saved')return {saved:true};}
    }
    throw new Error('Save not confirmed; do not repeat the mutation. '+String(last));
  }
  async openProject(url){
    const u=new URL(url);
    if(u.origin!==ORIGIN || !/^\/edit\/[^/]+$/.test(u.pathname))throw new Error('Expected an Effect Maker project URL');
    await this.navigate(u.href); await this.role('textbox','Project title').waitFor({state:'visible',timeoutMs:this.timeoutMs});
    return this.snapshot();
  }
  async createProject(name){
    if(!String(name).trim())throw new Error('Project name required');
    await this.navigate(ORIGIN+'/home');
    await this.button('New project').click();
    await this.role('textbox','Project title').waitFor({state:'visible',timeoutMs:this.timeoutMs});
    await this.renameProject(name); return this.snapshot();
  }
  async renameProject(name){
    if(!String(name).trim())throw new Error('Project name required');
    const field=this.role('textbox','Project title');
    await field.fill(name); await field.press('Enter'); await field.press('Tab');
    await this.waitSaved(); return this.snapshot();
  }
  async openPanel(name){
    if(!panels.has(name))throw new Error('Unknown panel: '+name);
    const visible = name==='Objects and assets' ? this.role('tab','Objects') : this.role('heading',headingFor[name]??name).and(this.ui.locator('h2,[aria-level="2"]'));
    if(!(await visible.isVisible())){
      // Toolbar buttons toggle. One click can close a subpanel instead of opening its root.
      await this.button(name).nth(0).click(); await this.snapshot();
      if(!(await visible.isVisible())){await this.button(name).nth(0).click(); await this.snapshot();}
    }
    await visible.waitFor({state:'visible',timeoutMs:this.timeoutMs});
    return this.snapshot();
  }
  async showObjects(){await this.openPanel('Objects and assets');await this.role('tab','Objects').click();return this.snapshot();}
  async showAssets(){await this.openPanel('Objects and assets');await this.role('tab','Assets').click();return this.snapshot();}
  async listTree(){return this.role('treeitem',/.*/).allTextContents({timeoutMs:this.timeoutMs});}
  async selectObject(accessibleName){
    await this.showObjects(); const row=this.role('treeitem',accessibleName);await row.click();return this.snapshot();
  }
  async selectAsset(accessibleName){await this.showAssets();await this.role('treeitem',accessibleName).click();return this.snapshot();}
  async beginAdd(kind){
    const route=recipes[kind];if(!route)throw new Error('Unknown object kind: '+kind);
    await this.openPanel(route[0]);
    if(route[1]){await this.button(route[1]).nth(0).click();await this.snapshot();}
    await this.button(route[2]).click();return this.snapshot();
  }
  async finishAsset({path,existing,skip=false}={}){
    if([Boolean(path),Boolean(existing),skip].filter(Boolean).length!==1)throw new Error('Choose exactly one of path, existing, skip');
    const dialog=this.ui.getByRole('dialog');await dialog.waitFor({state:'visible',timeoutMs:this.timeoutMs});
    if(skip)await this.button('Skip',dialog).click();
    else if(existing){await dialog.getByRole('combobox').click();await this.role('option',existing).click();}
    else {
      if(!this.upload)throw new Error('No upload adapter supplied');
      await this.upload(this.button('Upload file',dialog),path);
    }
    // Successful upload/selection auto-completes. Do not unconditionally click Done.
    await dialog.waitFor({state:'hidden',timeoutMs:this.timeoutMs});
    await this.waitSaved();return this.snapshot();
  }
  async addText(text){
    await this.beginAdd('text');await this.setText('Text','Text content',text);return this.snapshot();
  }
  async setText(group,label,value){
    const field=this.role('textbox',label,this.group(group));await field.fill(String(value));await field.press('Tab');
    await this.waitSaved();return this.snapshot();
  }
  async readNumber(group,label,index){
    let field=this.role('spinbutton',label,this.group(group));if(index!==undefined)field=field.nth(index);
    return field.evaluate(el=>({value:Number(el.value),committed:el.getAttribute('aria-valuenow')===null?null:Number(el.getAttribute('aria-valuenow'))}));
  }
  async setNumber(group,label,value,{index}={}){
    const n=Number(value);if(!Number.isFinite(n))throw new Error('Finite numeric value required');
    let field=this.role('spinbutton',label,this.group(group));if(index!==undefined)field=field.nth(index);
    if(!(await field.isEnabled()))throw new Error('Control disabled: '+label);
    const bounds=await field.evaluate(el=>({min:el.getAttribute('aria-valuemin'),max:el.getAttribute('aria-valuemax'),step:el.getAttribute('step')}));
    if(bounds.min!==null&&n<Number(bounds.min)||bounds.max!==null&&n>Number(bounds.max))throw new Error('Value outside observed control bounds');
    await field.fill(String(n));
    // Effect Maker custom number inputs can change visually without committing.
    // Arrow key events commit; choose order that does not clamp at the upper bound.
    const step=Number(bounds.step)||1;
    const downFirst=bounds.max!==null&&n+step>Number(bounds.max);
    if(downFirst&&bounds.min!==null&&n-step<Number(bounds.min))throw new Error('No safe step round trip available');
    await field.press(downFirst?'ArrowDown':'ArrowUp');
    await field.press(downFirst?'ArrowUp':'ArrowDown');
    await field.press('Tab');
    const actual=await this.readNumber(group,label,index);
    if(Math.abs(actual.value-n)>1e-7||actual.committed!==null&&Math.abs(actual.committed-n)>1e-7)throw new Error('Number did not commit: '+JSON.stringify(actual));
    await this.waitSaved();return actual;
  }
  async choose(group,label,option){await this.role('combobox',label,this.group(group)).click();await this.role('option',option).click();await this.waitSaved();return this.snapshot();}
  async setCheckbox(group,label,checked){await this.role('checkbox',label,this.group(group)).setChecked(Boolean(checked));await this.waitSaved();return this.snapshot();}
  async setTextStyle(style,enabled){
    if(!['Bold','Italic','Align left','Align center','Align right'].includes(style))throw new Error('Unknown text style');
    const b=this.button(style,this.group('Text'));const pressed=(await b.getAttribute('aria-pressed'))==='true';
    if(pressed!==Boolean(enabled))await b.click();await this.waitSaved();return this.snapshot();
  }
  async objectMenu(accessibleName,action){
    if(!['Duplicate','Rename','Delete'].includes(action))throw new Error('Unsupported object action');
    await this.selectObject(accessibleName);await this.role('treeitem',accessibleName).click({button:'right'});
    await this.role('menuitem',action).click();return this.snapshot();
  }
  async renameObject(accessibleName,name){
    await this.objectMenu(accessibleName,'Rename');const f=this.role('textbox','Scene object name');
    await f.waitFor({state:'visible',timeoutMs:this.timeoutMs});await f.fill(name);await f.press('Enter');
    await this.role('textbox','Project title').click();
    await f.waitFor({state:'hidden',timeoutMs:this.timeoutMs});await this.waitSaved();return this.snapshot();
  }
  async setObjectVisible(accessibleName,visible){
    await this.selectObject(accessibleName);const row=this.role('treeitem',accessibleName);
    const toggle=this.button(visible?'Visibility Off':'Visibility On',row);
    if(await toggle.isVisible())await toggle.click();await this.waitSaved();return this.snapshot();
  }
  async undo(){const b=this.button('Undo');if(!(await b.isEnabled()))throw new Error('Nothing to undo');await b.click();await this.waitSaved();return this.snapshot();}
  async redo(){const b=this.button('Redo');if(!(await b.isEnabled()))throw new Error('Nothing to redo');await b.click();await this.waitSaved();return this.snapshot();}
  async setPlaying(playing){const b=this.button(playing?'Play':'Pause');if(await b.isVisible())await b.click();return this.snapshot();}
  async resetPreview(){await this.button('Reset effect').click();return this.snapshot();}
  async showPreviewModels(){await this.button('View video').click();return this.snapshot();}
  async choosePreviewModel(name){await this.role('radio',name).check();await this.button('Done').click();return this.snapshot();}
  async devicePreview(){await this.button('Preview on device').click();await this.role('dialog','Preview on device').waitFor({state:'visible',timeoutMs:this.timeoutMs});return this.snapshot();}
  async effectLimits(){await this.button('Effect limits').click();return this.snapshot();}
  async dismissDialog(){await this.ui.getByRole('dialog').press('Escape');return this.snapshot();}
  async editMode(mode){if(!['2D','3D'].includes(mode))throw new Error('Use 2D or 3D');await this.button('Edit '+mode).click();return this.snapshot();}
  async transformTool(tool){const names={move:'Move (W)',rotate:'Rotate (E)',scale:'Scale (R)'};if(!names[tool])throw new Error('Unknown transform tool');await this.button(names[tool]).click();return this.snapshot();}
  async setGraphVisible(visible){
    const region=this.role('region','Visual scripting');if((await region.isVisible())!==Boolean(visible)){
      await this.button('Change layout').click();await this.role('menuitem','Show visual script').click();
    }return this.snapshot();
  }
  async nodeLibrary(){await this.openPanel('Visual scripting');const clear=this.button('Clear');if(await clear.isVisible())await clear.click();return this.snapshot();}
  async searchNodes(query){await this.nodeLibrary();await this.role('textbox','Search for nodes').fill(query);return this.snapshot();}
  async nodeDetails(category,name){
    await this.nodeLibrary();await this.button(category).nth(0).click();
    await this.button(name).click();return this.snapshot();
  }
  async addNode(category,name){await this.nodeDetails(category,name);await this.button('Add node').click();await this.role('region','Visual scripting viewport').waitFor({state:'visible',timeoutMs:this.timeoutMs});return this.snapshot();}
  async graphText(){return this.role('region','Visual scripting viewport').innerText();}
  async smokeNode(category,name){
    await this.setGraphVisible(true);const before=await this.graphText();await this.addNode(category,name);
    const after=await this.graphText();if(before===after)throw new Error('Node creation produced no observable change');
    await this.undo();const restored=await this.graphText();if(before!==restored)throw new Error('Undo did not restore graph; stopped');
    return {category,name,created:true,undoRestored:true,executionTested:false};
  }
  async showVariables(){
    await this.setGraphVisible(true);const region=this.role('region','Visual scripting');
    if(!(await this.button('Add variable',region).isVisible()))await this.button('Variables',region).click();return this.snapshot();
  }
  async createVariable(name){
    await this.showVariables();await this.button('Add variable').click();
    const f=this.role('textbox','Name',this.role('region','Visual scripting'));await f.fill(name);await f.press('Tab');await this.waitSaved();return this.snapshot();
  }
  async beginAI(kind,prompt){
    if(!['aiImage','aiVideo'].includes(kind))throw new Error('Expected aiImage or aiVideo');
    await this.beginAdd(kind);const dialog=this.ui.getByRole('dialog');
    const label=kind==='aiImage'?'Image description More info':'Video description More info';
    await this.role('textbox',label,dialog).fill(prompt);await this.button('Continue',dialog).click();
    await dialog.waitFor({state:'hidden',timeoutMs:this.timeoutMs});await this.waitSaved();return this.snapshot();
  }
}

/** Adapter for the documented Codex in-app browser, using only its supported UI APIs. */
export function fromCodexTab(tab,options={}){
  return new EffectMaker(tab.playwright,{
    navigate:url=>tab.goto(url),snapshot:()=>tab.playwright.domSnapshot(),
    upload:async(button,path)=>{const pending=tab.playwright.waitForEvent('filechooser',{timeoutMs:10000});await button.click();const chooser=await pending;await chooser.setFiles(path);},
    ...options,
  });
}
