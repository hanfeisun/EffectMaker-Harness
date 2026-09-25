/** Run only in an authorized disposable/test project, with the graph visible. */
export function graphNodeCount(nodes){
  const root=nodes.find(n=>!n.ignored&&n.role?.value==='region'&&n.name?.value==='视觉脚本视口');
  if(!root)throw new Error('Show the visual script graph before testing');
  const byId=new Map(nodes.map(n=>[n.nodeId,n]));let count=0;const seen=new Set();
  const visit=id=>{if(seen.has(id))return;seen.add(id);const n=byId.get(id);if(!n)return;if(!n.ignored)count++;for(const child of n.childIds??[])visit(child);};
  visit(root.nodeId);return count;
}
export async function smokeRawNode(raw,{category,name}){
  const isRoot=tree=>tree.some(n=>!n.ignored&&n.role?.value==='heading'&&n.name?.value==='视觉脚本');
  if(!isRoot(await raw.tree()))if(!isRoot(await raw.click('button','视觉脚本编写')))await raw.click('button','视觉脚本编写');
  await raw.click('button',category,{index:category==='图片和视频'?1:0});await raw.click('button',name);
  const before=graphNodeCount(await raw.tree());
  const added=graphNodeCount(await raw.click('button','添加节点'));
  if(added<=before)throw new Error('No new node observed; inspect state before continuing');
  const after=graphNodeCount(await raw.click('button','撤销'));
  if(after!==before)throw new Error('Undo did not restore the graph; stopped');
  return {category,name,created:true,undoRestored:true,executionTested:false};
}
