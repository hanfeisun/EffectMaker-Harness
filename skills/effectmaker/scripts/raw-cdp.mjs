/** Raw CDP helpers. Accepts a Codex tab cdp capability or Playwright CDPSession. */
export class RawEffectMakerCDP {
  constructor(transport,{keyboard}={}){this.keyboard=keyboard;if(typeof transport?.send!=='function')throw new Error('CDP send transport required');this.cdp=transport;}
  async tree(){return (await this.cdp.send('Accessibility.getFullAXTree')).nodes;}
  async find(role,name,{within,index}={}){
    const nodes=await this.tree();let allowed;
    if(within){
      const roots=nodes.filter(n=>!n.ignored&&n.role?.value===within.role&&n.name?.value===within.name);
      if(roots.length!==1)throw new Error('Scope must resolve to exactly one AX node');
      const byId=new Map(nodes.map(n=>[n.nodeId,n]));allowed=new Set();
      const visit=id=>{if(allowed.has(id))return;allowed.add(id);for(const child of byId.get(id)?.childIds??[])visit(child);};visit(roots[0].nodeId);
    }
    const matches=nodes.filter(n=>!n.ignored&&n.role?.value===role&&n.name?.value===name&&(!allowed||allowed.has(n.nodeId)));
    const node=index===undefined?(matches.length===1?matches[0]:null):matches[index];
    if(!node?.backendDOMNodeId)throw new Error(`AX ${role} ${name}: ${matches.length} matches; use an explicit scope/index`);
    if(node.properties?.some(p=>p.name==='disabled'&&p.value?.value===true))throw new Error('Disabled control: '+name);
    return node;
  }
  async click(role,name,options){
    const node=await this.find(role,name,options);const id=node.backendDOMNodeId;
    await this.cdp.send('DOM.scrollIntoViewIfNeeded',{backendNodeId:id});
    const {model}=await this.cdp.send('DOM.getBoxModel',{backendNodeId:id});const q=model.content;
    const x=(q[0]+q[2]+q[4]+q[6])/4,y=(q[1]+q[3]+q[5]+q[7])/4;
    await this.cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await this.cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    return this.tree();
  }
  async key(key,code,virtualKeyCode,modifiers=0){
    const args={key,code,windowsVirtualKeyCode:virtualKeyCode,modifiers};
    await this.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',...args});
    await this.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',...args});
  }
  async replace(role,name,text,{selectAllModifier=4,...options}={}){
    // 4=Meta on macOS, 2=Control on Windows/Linux. The caller chooses its platform.
    await this.click(role,name,options);
    if(this.keyboard){
      await this.keyboard.press(selectAllModifier===4?'super+a':'ctrl+a');
      await this.keyboard.type(String(text));
      await this.keyboard.press('Return');await this.keyboard.press('Tab');
    }else{
      await this.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:selectAllModifier,commands:['selectAll']});
      await this.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:selectAllModifier});
      await this.cdp.send('Input.insertText',{text:String(text)});
      await this.key('Enter','Enter',13);await this.key('Tab','Tab',9);
    }
    return this.tree();
  }
  async value(role,name,options){const node=await this.find(role,name,options);return node.value?.value;}
  async saved(){
    const node=await this.find('button','保存状态指示符');
    await this.cdp.send('DOM.getDocument');
    const {nodeIds}=await this.cdp.send('DOM.pushNodesByBackendIdsToFrontend',{backendNodeIds:[node.backendDOMNodeId]});
    const {attributes}=await this.cdp.send('DOM.getAttributes',{nodeId:nodeIds[0]});
    const pairs={};for(let i=0;i<attributes.length;i+=2)pairs[attributes[i]]=attributes[i+1];
    return {saved:pairs['data-title']==='已保存',label:pairs['data-title']??null};
  }
}

/** Codex permits raw DOM/AX/mouse access; route keyboard entry through its UI API. */
export async function fromCodexRawTab(tab){
  const transport=await tab.capabilities.get('cdp');
  return new RawEffectMakerCDP(transport,{keyboard:{
    press:key=>tab.pressKey(null,key),type:text=>tab.typeText(null,text),
  }});
}
