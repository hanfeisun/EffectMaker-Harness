/** YouTube Effect Maker UI SDK. Selectors verified against zh-CN UI, 2026-09-24. */
export const ORIGIN = 'https://effects.youtube.com';
export const recipes = Object.freeze({
  text: ['文字', null, '添加文字'],
  filter: ['视觉效果', '颜色滤镜', '添加滤镜'],
  particles: ['视觉效果', '粒子', '添加粒子'],
  image: ['图片和视频', '图片', '添加图片'],
  imageSequence: ['图片和视频', '图片', '添加图片序列'],
  facePaint: ['面部特效', '面部彩绘', '添加彩绘'],
  faceMaterial: ['面部特效', '面部彩绘', '添加 3D 材质'],
  faceAccessory: ['面部特效', '面部配饰', '添加图片'],
  faceModel: ['面部特效', '面部配饰', '添加 3D 模型'],
  stretch: ['面部特效', '拉伸', '添加拉伸'],
  body: ['摄像头和分割', '身体分割', '添加身体'],
  bodyBackground: ['摄像头和分割', '身体分割', '添加身体和背景'],
  camera: ['摄像头和分割', '摄像头画面', '添加摄像头画面'],
  model: ['3D', '3D 模型', '添加 3D 模型'],
  light: ['3D', '光效', '增加光照'],
  snapshot: ['图片和视频', '相机快照', '添加照片和视觉脚本'],
  drawing: ['图片和视频', '绘制', '添加照片和视觉脚本'],
  aiImage: ['图片和视频', 'AI 图片', '添加照片和视觉脚本'],
  aiVideo: ['图片和视频', 'AI 视频', '添加照片和视觉脚本'],
});
const panels = new Set(['对象和素材资源','视觉效果','图片和视频','面部特效','摄像头和分割','文字','3D','视觉脚本编写']);
const headingFor = { '视觉脚本编写': '视觉脚本' };
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
    const ready=this.button('保存状态指示符').and(this.ui.locator('[data-title="已保存"]'));
    let last;
    // Some hosted drivers cap individual waits below the requested timeout.
    // Retry only this read-only check, never the preceding mutation.
    const deadline=Date.now()+this.timeoutMs;
    for(let attempt=0;attempt<5&&Date.now()<deadline;attempt++){
      try{await ready.waitFor({state:'visible',timeoutMs:Math.max(1,deadline-Date.now())});return {saved:true};}
      catch(error){last=error;if((await this.button('保存状态指示符').getAttribute('data-title'))==='已保存')return {saved:true};}
    }
    throw new Error('Save not confirmed; do not repeat the mutation. '+String(last));
  }
  async openProject(url){
    const u=new URL(url);
    if(u.origin!==ORIGIN || !/^\/edit\/[^/]+$/.test(u.pathname))throw new Error('Expected an Effect Maker project URL');
    await this.navigate(u.href); await this.role('textbox','项目名称').waitFor({state:'visible',timeoutMs:this.timeoutMs});
    return this.snapshot();
  }
  async createProject(name){
    if(!String(name).trim())throw new Error('Project name required');
    await this.navigate(ORIGIN+'/home');
    await this.button('新建项目').click();
    await this.role('textbox','项目名称').waitFor({state:'visible',timeoutMs:this.timeoutMs});
    await this.renameProject(name); return this.snapshot();
  }
  async renameProject(name){
    if(!String(name).trim())throw new Error('Project name required');
    const field=this.role('textbox','项目名称');
    await field.fill(name); await field.press('Enter'); await field.press('Tab');
    await this.waitSaved(); return this.snapshot();
  }
  async openPanel(name){
    if(!panels.has(name))throw new Error('Unknown panel: '+name);
    const visible = name==='对象和素材资源' ? this.role('tab','对象') : this.role('heading',headingFor[name]??name).and(this.ui.locator('h2,[aria-level="2"]'));
    if(!(await visible.isVisible())){
      // Toolbar buttons toggle. One click can close a subpanel instead of opening its root.
      await this.button(name).nth(0).click(); await this.snapshot();
      if(!(await visible.isVisible())){await this.button(name).nth(0).click(); await this.snapshot();}
    }
    await visible.waitFor({state:'visible',timeoutMs:this.timeoutMs});
    return this.snapshot();
  }
  async showObjects(){await this.openPanel('对象和素材资源');await this.role('tab','对象').click();return this.snapshot();}
  async showAssets(){await this.openPanel('对象和素材资源');await this.role('tab','素材资源').click();return this.snapshot();}
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
    if(skip)await this.button('跳过',dialog).click();
    else if(existing){await dialog.getByRole('combobox').click();await this.role('option',existing).click();}
    else {
      if(!this.upload)throw new Error('No upload adapter supplied');
      await this.upload(this.button('上传文件',dialog),path);
    }
    // Successful upload/selection auto-completes. Do not unconditionally click 完成.
    await dialog.waitFor({state:'hidden',timeoutMs:this.timeoutMs});
    await this.waitSaved();return this.snapshot();
  }
  async addText(text){
    await this.beginAdd('text');await this.setText('文字','文字内容',text);return this.snapshot();
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
    if(!['粗体','斜体','左对齐','居中对齐','右对齐'].includes(style))throw new Error('Unknown text style');
    const b=this.button(style,this.group('文字'));const pressed=(await b.getAttribute('aria-pressed'))==='true';
    if(pressed!==Boolean(enabled))await b.click();await this.waitSaved();return this.snapshot();
  }
  async objectMenu(accessibleName,action){
    if(!['复制','重命名','删除'].includes(action))throw new Error('Unsupported object action');
    await this.selectObject(accessibleName);await this.role('treeitem',accessibleName).click({button:'right'});
    await this.role('menuitem',action).click();return this.snapshot();
  }
  async renameObject(accessibleName,name){
    await this.objectMenu(accessibleName,'重命名');const f=this.role('textbox','场景对象名称');
    await f.waitFor({state:'visible',timeoutMs:this.timeoutMs});await f.fill(name);await f.press('Enter');
    await this.role('textbox','项目名称').click();
    await f.waitFor({state:'hidden',timeoutMs:this.timeoutMs});await this.waitSaved();return this.snapshot();
  }
  async setObjectVisible(accessibleName,visible){
    await this.selectObject(accessibleName);const row=this.role('treeitem',accessibleName);
    const toggle=this.button(visible?'可见性：关闭':'可见性：开启',row);
    if(await toggle.isVisible())await toggle.click();await this.waitSaved();return this.snapshot();
  }
  async undo(){const b=this.button('撤销');if(!(await b.isEnabled()))throw new Error('Nothing to undo');await b.click();await this.waitSaved();return this.snapshot();}
  async redo(){const b=this.button('重做');if(!(await b.isEnabled()))throw new Error('Nothing to redo');await b.click();await this.waitSaved();return this.snapshot();}
  async setPlaying(playing){const b=this.button(playing?'播放':'暂停');if(await b.isVisible())await b.click();return this.snapshot();}
  async resetPreview(){await this.button('重置特效').click();return this.snapshot();}
  async showPreviewModels(){await this.button('观看视频').click();return this.snapshot();}
  async choosePreviewModel(name){await this.role('radio',name).check();await this.button('完成').click();return this.snapshot();}
  async devicePreview(){await this.button('在设备上预览').click();await this.role('dialog','在设备上预览').waitFor({state:'visible',timeoutMs:this.timeoutMs});return this.snapshot();}
  async effectLimits(){await this.button('特效限制').click();return this.snapshot();}
  async dismissDialog(){await this.ui.getByRole('dialog').press('Escape');return this.snapshot();}
  async editMode(mode){if(!['2D','3D'].includes(mode))throw new Error('Use 2D or 3D');await this.button(mode+' 编辑').click();return this.snapshot();}
  async transformTool(tool){const names={move:'移动 (W)',rotate:'旋转 (E)',scale:'缩放 (R)'};if(!names[tool])throw new Error('Unknown transform tool');await this.button(names[tool]).click();return this.snapshot();}
  async setGraphVisible(visible){
    const region=this.role('region','视觉脚本编写');if((await region.isVisible())!==Boolean(visible)){
      await this.button('更改布局').click();await this.role('menuitem','显示视觉脚本').click();
    }return this.snapshot();
  }
  async nodeLibrary(){await this.openPanel('视觉脚本编写');const clear=this.button('清除');if(await clear.isVisible())await clear.click();return this.snapshot();}
  async searchNodes(query){await this.nodeLibrary();await this.role('textbox','搜索节点').fill(query);return this.snapshot();}
  async nodeDetails(category,name){
    await this.nodeLibrary();await this.button(category).nth(category==='图片和视频'?1:0).click();
    await this.button(name).click();return this.snapshot();
  }
  async addNode(category,name){await this.nodeDetails(category,name);await this.button('添加节点').click();await this.role('region','视觉脚本视口').waitFor({state:'visible',timeoutMs:this.timeoutMs});return this.snapshot();}
  async graphText(){return this.role('region','视觉脚本视口').innerText();}
  async smokeNode(category,name){
    await this.setGraphVisible(true);const before=await this.graphText();await this.addNode(category,name);
    const after=await this.graphText();if(before===after)throw new Error('Node creation produced no observable change');
    await this.undo();const restored=await this.graphText();if(before!==restored)throw new Error('Undo did not restore graph; stopped');
    return {category,name,created:true,undoRestored:true,executionTested:false};
  }
  async showVariables(){
    await this.setGraphVisible(true);const region=this.role('region','视觉脚本编写');
    if(!(await this.button('添加变量',region).isVisible()))await this.button('变量',region).click();return this.snapshot();
  }
  async createVariable(name){
    await this.showVariables();await this.button('添加变量').click();
    const f=this.role('textbox','名称',this.role('region','视觉脚本编写'));await f.fill(name);await f.press('Tab');await this.waitSaved();return this.snapshot();
  }
  async beginAI(kind,prompt){
    if(!['aiImage','aiVideo'].includes(kind))throw new Error('Expected aiImage or aiVideo');
    await this.beginAdd(kind);const dialog=this.ui.getByRole('dialog');
    const label=kind==='aiImage'?'图片说明（仅支持英文） 更多信息':'视频说明（仅限英文） 更多信息';
    await this.role('textbox',label,dialog).fill(prompt);await this.button('继续',dialog).click();
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
