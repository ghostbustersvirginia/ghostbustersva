# readyled Review (from dropped ZIP)

I dropped `readyled-main.zip` in the repo root and had copilot review it for code comparison.

## What the package is trying to accomplish

`readyled` extracts the LED marquee logic into a reusable library so app code only passes:

- text + dimensions + speed
- font settings
- style tokens via CSS custom properties

The package then handles:

- font loading/waiting
- text rasterization to pixel grid
- LED canvas rendering + glow
- seamless scrolling animation classes/styles

## What works in the package

- The core renderer is real and functional (`src/readyled.ts` + `styles/readyled.css`).
- Build output includes both `dist/readyled.js` and `dist/readyled.css`.
- It centralizes logic you previously had inline in `LEDScrollbar.astro`.

## What works now, and what is still risky

- **Works now:** after `npm install`, the app loads and the package-driven LED scrollbar renders correctly.
- **Why it previously failed:** dependency was present in `package.json` but not installed locally, so Vite could not resolve `readyled/dist/readyled.css`.
- **Remaining risk:** dependency is GitHub SSH-based, so installs can fail on machines/CI without key setup.
- **Remaining risk:** package has no tests and no release/version workflow yet.
- **Remaining risk:** `readyled.ts` uses a global query for `.readyled-sign`, which can cause cross-instance behavior if multiple signs are rendered.
- **Remaining risk:** integration details (root CSS vars + speed conversion) are non-obvious and can regress without docs/tests.

## Copilot steps for your ReadLED repo (if you want to harden it)

1. In `readyled` repo, ask Copilot:
   - "Add README integration contract for Astro: required CSS vars, units, and example usage."
   - "Add tests for speed conversion and multi-instance render safety."
   - "Replace global `.readyled-sign` query with target-scoped behavior."
2. In this app repo, ask Copilot:
   - "Create a fallback local LED renderer path if `readyled` import fails."
   - "Add a small integration test plan doc for `LEDScrollbar.astro`."
3. After improvements, ask Copilot:
   - "Switch dependency from GitHub SSH ref to a pinned release/tag and verify `npm ci` on clean machine."

## ReadyLED hardening checklist (package PR)

- [ ] Remove global DOM query usage (`document.querySelector('.readyled-sign')`) and scope all work to `target`.
- [ ] Read style config from `target` (or explicit options), not global `:root` only.
- [ ] Replace module-level request state with per-instance state so one LED does not cancel/affect another.
- [ ] Add safe re-init behavior (`destroy()` or idempotent mount pattern).
- [ ] Add tests for multi-instance rendering and non-regression of speed conversion/animation timing.
- [ ] Publish/pin stable version tags for deterministic installs.

## Keystatic status (how the scroll bar behaves in the CMS)

Current CMS behavior is already partially configured and working:

- Site Settings exposes `ledScrollbarText` (global message text).
- Contact Page copy exposes `showLedScrollbar` and `ledPlacement`.
- Contact template renders LED in two editor-selectable positions: `after-social` or `before-booking`.

Editors cannot currently "drop" the LED bar arbitrarily on any page. Placement is intentionally constrained to Contact page layout options.
