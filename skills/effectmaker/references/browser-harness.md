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

Use the actual project URL and exact current object name. `attach_project()` requires one already-open match and fails when missing or ambiguous. It switches the daemon's current tab without foregrounding Chrome. Do not interleave another task's tab switching with these operations.

For repeated use, add a small import to your existing `$BH_AGENT_WORKSPACE/agent_helpers.py`; preserve its other helpers. This package does not overwrite the workspace. Upstream domain-skill discovery is optional (`BH_DOMAIN_SKILLS=1`); explicit imports work without enabling it. A host-specific copy of these instructions can live under `domain-skills/effects.youtube.com/` when that discovery mode is already in use.

## Available helpers

| Operation | API |
|---|---|
| Select existing project | `attach_project(url)` |
| Inspect | `tree()`, `find(role,name,within=(role,name),index=None)`, `attributes(node)` |
| Input | `click(role,name,**scope)`, `replace(role,name,value,**scope)` |
| Properties | `set_number(group,label,value,index=None)` |
| Objects | `show_objects()`, `select_object(accessible_name)`, `add_text(text)` |
| Save/history | `saved()`, `wait_saved()`, `undo()`, `redo()` |
| Script smoke test | `graph_count()`, `smoke_node(category,name)` |

For example, with the visual graph visible, `em.smoke_node('Math','Add')` temporarily creates one node and undoes it. A failure stops rather than retrying the mutation. `replace()` is a single input operation; `set_number()` adds numeric bounds and committed-value verification. Textbox entry blurs with Tab rather than pressing Enter, preserving multiline content; this is verified in the Chromium fixture.

## Integration boundaries

The current signed-in Effect Maker tab is in Codex's in-app browser. That managed tab has no externally supplied Browser Harness endpoint in this task. English live-site checks therefore used the Codex adapter. The **actual Browser Harness package** was separately tested against real temporary Chromium, verifying CDP transport, scoped entry, saved-state reads, upper/lower bounds, NaN rejection, duplicate-label rejection and disabled controls. This is not a live authenticated Effect Maker test through Browser Harness.

The Browser Harness integration test uses an isolated runtime, no personal profile, and recording/telemetry disabled for the test process. It shuts down its own daemon afterward. Existing user recording preferences are not changed.
