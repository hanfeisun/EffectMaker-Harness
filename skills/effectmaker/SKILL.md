---
name: effectmaker
description: Create, inspect, and edit YouTube Effect Maker projects at effects.youtube.com using tested browser and CDP helpers. Use for text, assets, filters, face effects, 3D, visual scripting, and repeatable editor checks. This is not Effect House or a video-editing skill.
---

# YouTube Effect Maker

Use the current signed-in Effect Maker tab and the bundled helpers instead of rediscovering the editor. The selectors and accessible names were tested with the Simplified Chinese interface on 2026-09-24/25. Inspect a fresh accessibility snapshot before adapting to another language or a changed UI; do not silently change the account language.

## Choose a connection

For the Codex browser, use `cua_repl` to bind the supplied project URL. First read its current browser documentation. Then import `scripts/sdk.mjs` and call `fromCodexTab(tab)`. It accepts the documented Playwright-compatible browser surface.

When raw CDP is available, read `(await tab.capabilities.get('cdp')).documentation()`, import `scripts/raw-cdp.mjs`, and call `await fromCodexRawTab(tab)`. This wrapper finds fresh backend node IDs from the accessibility tree, scrolls and clicks through CDP, and routes keyboard entry through the supported Codex keyboard API. Codex rejects raw keyboard CDP commands; do not work around that restriction through page scripts.

For an existing, authorized local Chromium debugging endpoint, use `scripts/cdp.mjs` → `connectCDP(endpoint,{pageUrl})` in Node with Playwright installed. It attaches to exactly one matching tab. Do not start debugging against a personal browser profile or copy cookies to a new profile. `disconnect()` leaves the host browser open. The standalone transport has been tested against a real local CDP browser; the actual Effect Maker project has also been tested with the Codex raw-CDP adapter.

Read [API and recipes](references/api.md) for ready-to-use examples and function signatures. Read [test coverage](references/coverage.md) before claiming a feature is verified. The 79-node catalog and creation/undo results are in [node catalog](references/node-catalog.json).

## Editor invariants learned from testing

- Opening a toolbar panel is a toggle. Use `openPanel()` instead of assuming each click opens it. Script category `图片和视频` shares its accessible name with the toolbar; scope/disambiguate it as the helper does.
- Numeric inputs are custom text fields with `role=spinbutton`. `fill()` can alter the displayed value without changing `aria-valuenow` or the saved value. Use `setNumber()` (bounded up/down key round trip), or `RawEffectMakerCDP.replace()` with native keyboard input, and reselect the object to verify. Do not report success from the visible input alone.
- Object renaming commits on losing focus. `renameObject()` explicitly focuses the project name afterward. Reacquire the row by its new name.
- “X”, “Y”, “颜色”, “大小”, and “不透明度” repeat across property groups. Scope them to the current group; 3D groups can repeat axes for position, rotation, and scale, requiring an explicit index grounded in the current snapshot.
- A successful asset upload or existing-asset selection can automatically close the dialog and create the object. `finishAsset()` waits for it to disappear; do not blindly click “完成” again. Upload completion can be slow. After timeout, inspect the dialog and object tree before retrying to avoid duplicates.
- Use `waitSaved()` to verify `data-title="已保存"`. It retries only the read. After any ambiguous mutation failure, inspect actual state before retrying the action.
- Undo/redo changes selection, and a fresh page load clears undo history. Do not rely on yesterday's undo stack. Test-node smoke checks create one node then undo it and assert the previous graph is restored.
- AI image/video tools create several objects, assets, and connected nodes together. Prompts are English. The editor reports that drawing cannot coexist with AI image/video. Test those combinations separately or undo the drawing creation.
- `身体分割` and `摄像头画面` objects use the built-in sample video without granting camera access. Device preview only proves a QR code opens; physical-phone behavior needs an actual phone.
- The initial “提交” opens validation and thumbnail setup. That is not a published effect. Do not publish, accept terms, or send feedback as an incidental feature test.

## Working flow

1. Bind the requested project (or create one if asked), inspect its name and current objects.
2. Use `beginAdd`, `addText`, asset helpers, scoped property edits, and node helpers for the requested changes. Do not add every tested object to ordinary projects.
3. Read saved state, reselect edited objects, and inspect the preview. For important persistence checks, reload only after save is confirmed and then verify again.
4. Record failures and boundaries accurately: node creation/undo is a smoke test, not execution or numerical correctness of every node. Report unsupported features explicitly.

The historical HeloWorld project and prior test outcomes are examples, not a default destination for future edits. Request-specific project URLs and user choices take precedence.
