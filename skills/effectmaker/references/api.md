# API and recipes

## Codex browser

After loading browser documentation and binding a tab with `cua.getTab(...)`:

```js
const {fromCodexTab} = await import('/absolute/path/to/effectmaker/scripts/sdk.mjs');
const em = fromCodexTab(tab);
await em.showObjects();
await em.addText('Hello world');
await em.setNumber('文字', '大小', 64);
await em.setText('文字', '颜色', '#00e5ff');
await em.setTextStyle('粗体', true);
await em.setNumber('位置和大小', 'Y', 220);
await em.waitSaved();
```

The instance returns fresh snapshots after most mutations. Review them before choosing the next action. `setNumber()` returns both displayed and committed values. Never share the same page concurrently between agents or scripts.

## Raw CDP in Codex

```js
const cap = await tab.capabilities.get('cdp');
nodeRepl.write(await cap.documentation());
const {fromCodexRawTab} = await import('/absolute/path/to/effectmaker/scripts/raw-cdp.mjs');
const raw = await fromCodexRawTab(tab);
await raw.click('treeitem', '文字对象：HeloWorld');
await raw.replace('spinbutton', '大小', '64', {
  within: {role:'group', name:'文字'},
  selectAllModifier:4 // macOS; use 2 for Control on Windows/Linux
});
nodeRepl.write(await raw.value('spinbutton','大小',{within:{role:'group',name:'文字'}}));
nodeRepl.write(await raw.saved());
```

`tree()`, `find(role,name,{within,index})`, `click(...)`, `replace(...)`, `value(...)`, and `saved()` are provided. Fresh AX lookup prevents backend IDs from becoming stale. Raw `saved()` is a single observation, not a wait. `key()` is for standalone CDP transports; Codex callers should use `replace()` with its provided keyboard adapter.

## Standalone Playwright/CDP

```js
import {connectCDP} from './skills/effectmaker/scripts/cdp.mjs';
const {sdk:em,disconnect} = await connectCDP('http://127.0.0.1:9222', {
  pageUrl: process.env.EFFECTMAKER_PROJECT_URL
});
try {
  console.log(await em.snapshot());
  await em.selectObject('文字对象：HeloWorld');
  await em.setNumber('文字','大小',64);
  await em.waitSaved();
} finally { await disconnect(); }
```

The endpoint must already be running and authorized. No endpoint/token/cookie is stored in the package. Do not export the user's browser profile. Use Node 20+ and Playwright 1.58+; integration tests ran on 1.62.1.

## Function map

| Purpose | Functions |
|---|---|
| Projects and saving | `createProject(name)`, `openProject(url)`, `renameProject(name)`, `waitSaved()` |
| Panels and trees | `openPanel(name)`, `showObjects()`, `showAssets()`, `listTree()`, `selectObject(accessibleName)`, `selectAsset(accessibleName)` |
| Object creation | `beginAdd(kind)`, `finishAsset({path|existing|skip})`, `addText(text)` |
| Properties | `setText(group,label,value)`, `setNumber(group,label,value,{index})`, `readNumber(group,label,index)`, `choose(group,label,option)`, `setCheckbox(group,label,checked)`, `setTextStyle(style,enabled)` |
| Object operations | `objectMenu(name,'复制'|'重命名'|'删除')`, `renameObject(name,newName)`, `setObjectVisible(name,visible)`, `undo()`, `redo()` |
| Preview/editor | `setPlaying(bool)`, `resetPreview()`, `showPreviewModels()`, `choosePreviewModel(radioName)`, `devicePreview()`, `effectLimits()`, `dismissDialog()`, `editMode('2D'|'3D')`, `transformTool('move'|'rotate'|'scale')` |
| Scripting | `setGraphVisible(bool)`, `nodeLibrary()`, `searchNodes(query)`, `nodeDetails(category,name)`, `addNode(category,name)`, `graphText()`, `smokeNode(category,name)` |
| Variables/AI | `showVariables()`, `createVariable(name)`, `beginAI('aiImage'|'aiVideo',englishPrompt)` |

`beginAdd` routes: text, filter, particles, image, imageSequence, facePaint, faceMaterial, faceAccessory, faceModel, stretch, body, bodyBackground, camera, model, light, snapshot, drawing, aiImage, aiVideo. Presence in this map is not a claim that every route has been fully validated; see coverage.

### Asset upload

```js
await em.beginAdd('image');
await em.finishAsset({path:'/absolute/path/to/test.png'});
// Or reuse a named asset in a dialog that exposes an asset selector:
await em.beginAdd('faceAccessory');
await em.finishAsset({existing:'test-sticker'});
```

The tested GLB upload dialog states a 5 MB maximum. The face-paint image dialog states a 10 MB maximum. These are observed UI limits, not assumptions for every uploader. Set a larger `timeoutMs` if upload processing is slow. After a timeout inspect the current state; do not upload again automatically.

### Node smoke checks

```js
await em.smokeNode('数学','加');
```

This mutates the project temporarily. Run only in an authorized test project with no concurrent editing. It adds one node, undoes once, and checks graph text restoration. It does not connect or execute the node. The raw-CDP runner in `scripts/node-smoke.mjs` additionally verifies AX subtree size before and after each temporary node.

## Troubleshooting

Hosted browser calls sometimes cap waits near 3 seconds. A timeout can occur after the mutation has succeeded. Refresh the snapshot; check save state and the expected object name before deciding whether to retry. If element evaluation becomes unavailable after a tab/session restart, reacquire the tab from the same selected browser and reinstantiate the SDK; do not repeatedly reuse a stale driver.

Observed number-field limits are enforced before the SDK's step round trip. A control whose step cannot move in either direction is rejected rather than silently changing it. A selected 3D control may be disabled depending on object/light type.
