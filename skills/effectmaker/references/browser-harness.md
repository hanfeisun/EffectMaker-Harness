# Browser Harness integration

## What is reused

[Browser Harness](https://github.com/browser-use/browser-harness) is an MIT-licensed Python browser controller. `effectmaker_harness.py` imports its `helpers` module rather than implementing another websocket client or daemon. It uses `cdp`, `list_tabs`, `switch_tab`, `page_info`, `click_at_xy`, `type_text`, and `press_key`. Site-specific lookup and verification remain in this skill.

Tested dependency: `browser-harness==0.1.13`, Python 3.12. See upstream [installation](https://github.com/browser-use/browser-harness/blob/main/install.md) and [workflow](https://github.com/browser-use/browser-harness/blob/main/SKILL.md) for connection setup. The skill does not automatically alter browser debugging permissions, install browser extensions, enable recordings, or launch cloud browsers.

## Use an existing authorized connection

Install the pinned package into an environment you control, then use its `browser-harness` executable. Add this skill's scripts directory to Python's import path:

```sh
EFFECTMAKER_SCRIPTS=/absolute/path/to/effectmaker/scripts browser-harness <<'PY'
import os, sys
sys.path.insert(0, os.environ['EFFECTMAKER_SCRIPTS'])
from effectmaker_harness import EffectMakerHarness
em = EffectMakerHarness()
print(em.attach_project('https://effects.youtube.com/edit/YOUR_PROJECT_ID'))
print(em.select_object('Text object: HeloWorld'))
print(em.set_number('Text', 'Size', 64))
print(em.wait_saved())
PY
```

Build a new project in one invocation (the Chrome tab may be in the background):

```sh
EFFECTMAKER_SCRIPTS=/absolute/path/to/effectmaker/scripts browser-harness <<'PY'
import os, sys
sys.path.insert(0, os.environ['EFFECTMAKER_SCRIPTS'])
from effectmaker_harness import EffectMakerHarness
em = EffectMakerHarness()
with em.focused():
    print(em.create_project('Hello World'))
    em.add_text('Hello World')
    em.begin_add('lut'); print(em.upload_asset('/absolute/path/look.cube'))
    em.begin_add('model'); print(em.upload_asset('/absolute/path/model.glb'))
    em.select_object('3D model object: model')
    em.set_number('Position & Scale', 'Y', 5, index=0)  # Position, Rotation, Scale share X/Y/Z labels
PY
```

Use the actual project URL and exact current object name. `attach_project()` requires one already-open match and fails when missing or ambiguous. It switches the daemon's current tab without foregrounding Chrome. Do not interleave another task's tab switching with these operations.

For repeated use, add a small import to your existing `$BH_AGENT_WORKSPACE/agent_helpers.py`; preserve its other helpers. This package does not overwrite the workspace. Upstream domain-skill discovery is optional (`BH_DOMAIN_SKILLS=1`); explicit imports work without enabling it. A host-specific copy of these instructions can live under `domain-skills/effects.youtube.com/` when that discovery mode is already in use.

## Available helpers

| Operation | API |
|---|---|
| Projects | `attach_project(url)`, `create_project(name)`, `rename_project(name)` |
| Background tab | `with focused():` emulates focus/visibility without foregrounding Chrome |
| Inspect | `outline(roles=None,contains=None,within=None)`, `tree()`, `find(role,name,within=(role,name),index=None)`, `exists(role,name,level=None)`, `wait_for(role,name)`, `attributes(node)` |
| Input | `click(role,name,**scope)`, `replace(role,name,value,**scope)` |
| Properties | `set_number(group,label,value,index=None)`, `choose(group,label,option,upload=None)` (e.g. swap the single LUT) |
| Panels | `open_panel(name)`, `show_objects()`, `show_assets()`, `objects()`, `assets()` |
| Objects | `begin_add(kind)` (routes in `RECIPES`, same as `recipes` in `sdk.mjs`), `add_text(text)`, `select_object(accessible_name)`, `duplicate_object(name)`, `rename_object(name,new)`, `delete_object(name)`, `set_object_visible(name,bool)` (editor view only), `object_menu(name,action)` |
| Assets | `begin_add('lut'|'model'|...)` then `upload_asset(path)`; `asset_dialog_text()`. `begin_add('lut')` refuses when a Color filter exists (one LUT per effect) |
| Save/history | `saved()`, `wait_saved()`, `undo()`, `redo()` |
| Script smoke test | `graph_count()`, `smoke_node(category,name)` |

For example, with the visual graph visible, `em.smoke_node('Math','Add')` temporarily creates one node and undoes it. A failure stops rather than retrying the mutation. `replace()` is a single input operation; `set_number()` adds numeric bounds and committed-value verification. Textbox entry blurs with Tab rather than pressing Enter, preserving multiline content; this is verified in the Chromium fixture.

`upload_asset()` sets the file on the asset dialog's input with Browser Harness `upload_file()`. The dialog is a native `<dialog>` (no `[role=dialog]` ancestor), so select `dialog[open] input[type=file]`. A successful upload closes the dialog and creates the object; the helper never clicks Done and never retries. The LUT dialog accepts `.cube` or a row/square PNG up to 512 px; the 3D dialog accepts GLB up to 5 MB.

## Practical notes

- **Background tabs.** When the Effect Maker tab is not visible, `document.visibilityState` is `hidden` and Home ignores the New project click. Wrap work in `with em.focused():` (it disables emulation in `finally`). Do not call `activate_tab()` unless the user asks to see the tab.
- **One invocation per multi-step interaction.** Menus and popovers close between separate `browser-harness` runs; open a menu and choose its item in the same script.
- **Windows.** Run with `PYTHONIOENCODING=utf-8` (or set it persistently); otherwise non-ASCII text in a heredoc, such as a Chinese UI label, is decoded incorrectly or raises `UnicodeEncodeError`.
- **Non-English UI.** Selectors are English (US). If the account menu shows another language, switch it first (**Account menu → Language → English (US)**) after confirming the project is saved.
- **Object menu.** The row context menu (Duplicate, Rename, Add object, Delete) is a manual popover: Escape does not close it; choosing an item or clicking a row does. Delete has no confirmation (Undo restores). Duplicates are named `<name> 2`.
- **Native file choosers.** Combobox entries such as `Add LUT...` call the OS file chooser without an in-page dialog. `choose(..., upload=path)` enables `Page.setInterceptFileChooserDialog`, answers `Page.fileChooserOpened` with `DOM.setFileInputFiles`, and disables interception afterwards, so no native window appears.
- **Checking effect output.** Keep the Preview playing and sample several frames (e.g. `canvas.ytEffectsEditorPreviewCanvas` via `toDataURL`). Paused previews and object visibility do not reflect effect changes.
- **Inspecting unknown UI.** `outline()` lists named controls, optionally scoped with `within=('group', 'Position & Scale')`. Prefer it to guessing a selector.

## Integration boundaries

On 2026-09-26 Browser Harness 0.1.13 was attached to a signed-in Effect Maker session in local Chrome on Windows (remote debugging enabled by the user) and exercised live; see [coverage](coverage.md). The package is also tested against real temporary Chromium, verifying CDP transport, scoped entry, saved-state reads, upper/lower bounds, NaN rejection, duplicate-label rejection, disabled controls, panel toggling, creation routes and asset uploads through a native `<dialog>`.

The Browser Harness integration test uses an isolated runtime, no personal profile, and recording/telemetry disabled for the test process. It shuts down its own daemon afterward. Existing user recording preferences are not changed.
