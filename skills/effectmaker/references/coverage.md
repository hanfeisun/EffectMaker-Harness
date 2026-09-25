# Test coverage

Dates: 2026-09-24/25. Project: HeloWorld. Current interface: English (US).

## Current English revision

- Switched through the actual Account menu language setting; verified English toolbar, property groups, creation buttons and node categories.
- Observed 79 English node names in `node-catalog-en.json`. This is catalog observation, not 79 new English execution tests.
- Live English SDK checks: select text; change size 64→65→64 and verify committed values; Math/Add creation and undo; create and rename temporary text; visibility off/on; delete temporary text; confirm saved state.
- Real temporary Chromium integration: three tests passed. Two cover standalone Playwright/CDP, one runs the actual Browser Harness 0.1.13 package with the Python adapter. Tested numeric bounds, invalid values, scoped duplicate labels and disabled controls. The Harness test is explicitly skipped unless `HARNESS_PYTHON` is set.
- Browser Harness has not been attached to the signed-in live Effect Maker project: the in-app tab does not expose a supplied external endpoint. The transport and helper logic are fixture-tested; live English checks used the Codex adapter.

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
| Color filter | Creation and persisted saturation | LUT upload untested |
| Particles | Creation, property inspection, quantity step | Lifecycle combinations not exhaustive |
| Images | Generated/uploaded 64×64 PNG, reused asset | GIF/custom sequences not exercised |
| Face paint | Parent/image child, regions and masking controls | 3D material branch untested |
| Face accessory | Reused image in face-following object | 3D accessory branch untested |
| Stretch | Creation and strength/symmetry controls | Not every stretch point |
| Body segmentation | Body creation and edge/invert/opacity controls | Body-plus-background branch untested |
| Camera feed | Object creation using built-in sample | Real camera not enabled |
| 3D | Generated GLB import, editor modes and tools | Complex meshes/animation/materials untested |
| Light | Ambient creation, Environment selection | Not every environment image |
| AI image | English prompt, related objects/assets/graph, preview entry | Final generated output unverified |
| AI video | Prompt, graph and countdown subgraph | Full generation/record/export untested |
| Camera snapshot | Canvas and connected graph combination | Real camera capture untested |
| Draw | Created combination, observed AI incompatibility, undone | Gesture quality untested |
| Visual scripting | 79 creation/undo checks, search and help | No comprehensive wiring/execution semantics |
| Variables | Default numeric variable, rename, type inspection | Initial value persistence not certified; other types untested |
| Subgraphs | AI countdown subgraph and entry points | Manual grouping/ports not fully exercised |
| Objects | Selection, duplicate, rename, visibility, temporary deletion, undo/redo | Deletion limited to temporary test objects |
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
