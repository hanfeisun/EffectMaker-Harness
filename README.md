# EffectMaker Skill & CDP SDK

Reusable automation for [YouTube Effect Maker](https://effects.youtube.com/home), with English UI helpers and a [Browser Harness](https://github.com/browser-use/browser-harness) adapter.

- [Skill entry point](skills/effectmaker/SKILL.md)
- [Browser Harness setup and recipes](skills/effectmaker/references/browser-harness.md)
- [JavaScript API](skills/effectmaker/references/api.md)
- [Coverage and limitations](skills/effectmaker/references/coverage.md)

## Use the skill

Copy `skills/effectmaker/` to `~/.codex/skills/effectmaker/`, then invoke `$effectmaker` or ask to edit an Effect Maker project. Inspect an existing installation before replacing it.

The current SDK targets **English (US)**. In Effect Maker, select **Account menu → Language → English (US)**. The setting reloads the editor; wait for saved state first. Existing object and asset names are project content and retain their original names.

## Browser Harness reuse

The Python adapter imports Browser Harness's real CDP, tab selection, mouse and keyboard helpers. Browser Harness owns the connection and daemon; our code adds scoped accessibility lookup, committed property checks, saving, text creation and node smoke checks. Its core is not copied or modified.

```sh
uv pip install -r requirements-harness.txt
```

Use an already authorized Browser Harness connection. See the [integration guide](skills/effectmaker/references/browser-harness.md). The Codex in-app browser and standalone Playwright adapters remain available. A Codex tab handle is not a Browser Harness websocket endpoint.

## Validation

- English live editor: text creation, rename, visibility, cleanup, size change/restoration, save and Math/Add creation/undo.
- English catalog: 79 visible node names observed.
- Historical Chinese UI: 79 node creation/undo checks and 31 SDK operation checks (including restoration steps).
- Real temporary Chromium: Playwright/CDP and Browser Harness integration tests passed, including scoped numeric entry, bounds and invalid/ambiguous target rejection.

These are scoped checks, not a claim that all node execution semantics, AI generation, phone performance or publishing were verified. Historical evidence keeps its original Chinese labels.

## Run tests

```sh
npm install --no-save playwright
npm test
# Include the Browser Harness integration test:
HARNESS_PYTHON=/absolute/path/to/venv/bin/python npm test
```

Set `CHROMIUM_EXECUTABLE` when using a local Chrome executable instead of Playwright's bundled Chromium. Tests create temporary browser profiles and use ports 19223 and 19224. Browser Harness is tested at 0.1.13; the Python test is explicitly skipped if `HARNESS_PYTHON` is unset.

This repository and npm package are private. No credentials, cookies or browser profile data are included.
