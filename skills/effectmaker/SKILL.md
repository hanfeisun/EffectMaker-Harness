---
name: effectmaker
description: Create, inspect, and edit YouTube Effect Maker projects using English UI helpers built on Browser Harness, with Codex browser and Playwright/CDP adapters. Use for effects, text, assets, 3D and visual scripting. This is not Effect House or video editing.
---

# YouTube Effect Maker

Use the supplied project and current signed-in session. The helpers target **English (US)**, observed on 2026-09-25. Inspect the current UI before editing. When the user wants English, use **Account menu → Language → English (US)** after confirming the project is saved. This reloads the editor and clears its undo history. Existing object/asset names do not translate automatically.

## Choose the available transport

**Browser Harness:** read [integration and recipes](references/browser-harness.md), then import `scripts/effectmaker_harness.py` inside an existing authorized Browser Harness session. It reuses upstream connection, CDP, mouse, keyboard and file-upload helpers, and covers project creation, panels, creation routes and asset upload (`begin_add` + `upload_asset`). Wrap work on a background tab in `with em.focused():`, run multi-step menu interactions in one invocation, and on Windows set `PYTHONIOENCODING=utf-8`. Put project-specific additions in the agent workspace; do not modify the upstream core. Select exactly one matching project tab and serialize operations because a daemon has one current tab.

**Codex in-app browser:** read its current browser documentation, bind the supplied tab, import `scripts/sdk.mjs`, and call `fromCodexTab(tab)`. For raw CDP, read the tab's CDP capability documentation and use `fromCodexRawTab(tab)` from `scripts/raw-cdp.mjs`. The wrapper uses CDP for AX/DOM/mouse and the supported Codex keyboard API for text. Do not use Browser Harness to bypass a restricted Codex command or search internal app configuration for a websocket.

**Standalone Playwright:** use `scripts/cdp.mjs` → `connectCDP(endpoint,{pageUrl})` with an already authorized local endpoint. `disconnect()` preserves the browser. Do not copy cookies or export the user's browser profile to establish a session.

Use [API and recipes](references/api.md) for JavaScript operations, [English node names](references/node-catalog-en.json) for discovery, and [coverage](references/coverage.md) before claiming anything was tested. Original Chinese evidence in `node-catalog.json` is historical, not the current selector catalog.

## Editor invariants

- Toolbar buttons toggle panels; use `openPanel()` rather than assuming every click opens the root. A property heading can share a toolbar name: match the panel's level-two heading.
- Number fields are custom `spinbutton` inputs. `fill()` alone can change the display without committing. Use `setNumber()` or the Harness `set_number()` and verify `aria-valuenow`; reselect the object for persistence checks.
- Scope repeated names such as X, Y, Color, Size and Opacity to a property group. Use a fresh observed index only when the group still contains duplicates.
- Renaming an object needs explicit blur after entry. The JavaScript helper clicks Project title before checking the new row.
- Asset uploads/selections may close the dialog and create the object automatically. Wait for completion; do not blindly click Done or retry an upload after a timeout.
- Saved state is `data-title="Saved"` on **Save status indicator**. Retry reads only; inspect after an ambiguous mutation before repeating it.
- Undo changes selection. Node smoke checks require an authorized test project with no concurrent editing, then create one node, undo once and check restoration. They do not prove node execution semantics.
- Draw conflicts with AI image/video combinations. Use separate test projects or undo the temporary Draw combination.
- An effect may use only one LUT, but the editor does not block adding a second Color filter. To change the look, swap the existing filter's **LUT** combobox (Harness: `choose('LUT','LUT','Add LUT...', upload=path)`); `Add LUT...` opens the OS file chooser directly, so intercept it rather than clicking blind. PNG LUTs are stored as Image assets and do not appear in that combobox afterwards.
- Object visibility (row eye button) affects only the editor scene view, not the effect or the Preview panel. Do not use it to compare effect output.
- Keep the Preview playing when checking effect output; a paused preview does not redraw after edits, even after Reset effect. Do not pause it as a side effect.
- Built-in preview video does not require camera permission. A device QR dialog does not prove phone compatibility.
- Submit initially opens validation/thumbnail setup. Do not publish an effect as an incidental test.

## Working flow

1. Inspect project title, locale and objects; select the requested project explicitly.
2. Apply only the requested edits using the available transport. Keep new instructions and documentation in English; preserve user-authored project content.
3. Verify committed properties and saved state, then inspect the preview. Reload only after save and only when a persistence check warrants losing undo history.
4. Record observed failures and untested boundaries. Add a reusable helper when a repeated operation or demonstrated bug warrants it; avoid accumulating speculative selectors.

HeloWorld is a historical test project, not the default destination for future requests.
