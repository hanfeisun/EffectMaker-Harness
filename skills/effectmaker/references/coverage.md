# Test coverage

Dates: 2026-09-24/25 (Codex adapter, project HeloWorld); 2026-09-26 (Browser Harness, projects Hello World and Harness check). Current interface: English (US).

## Current English revision

- Switched through the actual Account menu language setting; verified English toolbar, property groups, creation buttons and node categories.
- Observed 79 English node names in `node-catalog-en.json`. This is catalog observation, not 79 new English execution tests.
- Live English SDK checks: select text; change size 64→65→64 and verify committed values; Math/Add creation and undo; create and rename temporary text; visibility off/on; delete temporary text; confirm saved state.
- Real temporary Chromium integration: three tests passed. Two cover standalone Playwright/CDP, one runs the actual Browser Harness 0.1.13 package with the Python adapter. Tested numeric bounds, invalid values, scoped duplicate labels and disabled controls. The Harness test is explicitly skipped unless `HARNESS_PYTHON` is set.
- Real temporary Chromium also covers the Python panel/route/upload helpers: toggling toolbar panels from a subpanel, `begin_add`, `.cube`/GLB upload through a native `<dialog>`, rejection of uploads without an open dialog, and Python/JavaScript route parity.

## Live Browser Harness session (2026-09-26)

Browser Harness 0.1.13 on Windows 11, attached to the user's signed-in local Chrome with a hidden (background) editor tab.

- Switched the account language from Chinese (China) to English (US); confirmed the checked option and `hl=en`.
- `create_project` from Home. Without focus emulation the New project click was ignored while the tab was hidden; `focused()` fixed it.
- `rename_project`, `add_text`, `begin_add('lut')` + `upload_asset(.cube, 33³, ~1 MB)`, `begin_add('model')` + `upload_asset(.glb, 1.5 KB)`: each dialog closed automatically in about 2 s and saved.
- `objects()`, `assets()` (LUT and 3D asset groups), `open_panel` for all 8 toolbar panels, `set_number` on 3D Position/Rotation/Scale with `index=` and committed-value checks; preview screenshot showed the model and text.
- Object operations: `duplicate_object` (copy named `<name> 2`), `rename_object` (Enter committed), `set_object_visible` off/on (row button reflects state; editor view only), `delete_object` (no confirmation), and the one-LUT guard in `begin_add('lut')`.
- LUT formats, one Color filter only, preview **playing**, 10 frames averaged per state, using a channel-rotation LUT (R,G,B)→(G,B,R): no LUT 164.3/120.2/122.3; square PNG 512×512 (64³, 8×8 tiles, blue selects tile row-major, red across, green down) 120.7/122.3/164.1; row PNG 256×16 (16³) 120.3/122.1/163.9; `.cube` 120.7/122.1/163.9. All match the expected rotation within frame noise (~5). LUTs were swapped through the filter's LUT combobox (`Add LUT...` with an intercepted file chooser).
- Invalid earlier method, kept as a warning: comparing a paused preview, or toggling object visibility, showed no change for any edit.
- Not exercised live through Harness: undo/redo, `smoke_node`, AI routes, Submit.

## Historical Chinese-interface coverage

Original records remain unchanged in `node-catalog.json`, `tests/results/raw-cdp-nodes.json` and `tests/results/sdk-live.json`; their Chinese labels are evidence, not current selectors.

- 79 visible nodes: created individually through native CDP, checked AX subtree growth, undone, and checked restoration. 79/79 passed.
- 31 high-level SDK operation checks, including repeated restoration steps; not 31 distinct features.
- Re-selection verified text size 64, Y position 220, filter saturation 15, and saved state.
- Node categories: triggers 8, logic 13, control flow 9, scene objects 4, math 25, data 14, media 6.

| Feature | Observed work | Boundary |
|---|---|---|
| Projects | Created HeloWorld, renamed, saved, reopened | No bulk deletion |
| Text | Content, color, bold, size, position, fit-width toggle | Not every font/layout/shadow combination |
| Color filter | Creation and persisted saturation; `.cube`, square PNG and row PNG LUTs verified in the playing preview (2026-09-26) | One LUT per effect; PNG LUTs are listed as Image assets, not in the LUT combobox |
| Particles | Creation, property inspection, quantity step | Lifecycle combinations not exhaustive |
| Images | Generated/uploaded 64×64 PNG, reused asset | GIF/custom sequences not exercised |
| Face paint | Parent/image child, regions and masking controls | 3D material branch untested |
| Face accessory | Reused image in face-following object | 3D accessory branch untested |
| Stretch | Creation and strength/symmetry controls | Not every stretch point |
| Body segmentation | Body creation and edge/invert/opacity controls | Body-plus-background branch untested |
| Camera feed | Object creation using built-in sample | Real camera not enabled |
| 3D | Generated GLB import (Codex and Harness), transform values, editor modes and tools | Complex meshes/animation/materials untested |
| Light | Ambient creation, Environment selection | Not every environment image |
| AI image | English prompt, related objects/assets/graph, preview entry | Final generated output unverified |
| AI video | Prompt, graph and countdown subgraph | Full generation/record/export untested |
| Camera snapshot | Canvas and connected graph combination | Real camera capture untested |
| Draw | Created combination, observed AI incompatibility, undone | Gesture quality untested |
| Visual scripting | 79 creation/undo checks, search and help | No comprehensive wiring/execution semantics |
| Variables | Default numeric variable, rename, type inspection | Initial value persistence not certified; other types untested |
| Subgraphs | AI countdown subgraph and entry points | Manual grouping/ports not fully exercised |
| Objects | Selection, duplicate, rename, visibility (editor view only), temporary deletion, undo/redo; Harness helpers live-tested 2026-09-26 | Deletion limited to temporary test objects |
| Preview | Play/pause/reset, sample selection, layout | Not every device/video or new-window preview |
| Device preview | QR dialog opened | No phone scan |
| Effect limits | Dialog opened and reported a calculation error | Failure, not a pass |
| Submit | Validation reached thumbnail setup, then closed | No submission/publication/terms acceptance |

## Fixes retained in the helpers

1. Custom numeric fields can display uncommitted values. JavaScript uses a bounded arrow-key round trip; CDP/Harness use native keyboard entry and committed-value checks.
2. Object rename needs explicit blur; Enter alone did not reliably finish editing.
3. Asset selection/upload can auto-complete the dialog; do not click Done blindly.
4. Duplicate accessible names require property-group or region scoping.
5. Draw conflicts with AI image/video combinations.
6. Codex rejects raw CDP keyboard commands. Its adapter uses the documented keyboard surface; the standalone Harness uses its own authorized transport.
7. Stale managed tab handles need rebinding to the same existing tab. Mutation retries are not hidden.

All parameter permutations, all templates, node runtime correctness, complex asset compatibility, physical device performance, real camera, complete AI generation and formal publishing remain outside the verified scope.
