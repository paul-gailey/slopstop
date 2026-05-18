# slopstop extension

Chrome MV3 extension. React popup, vanilla content scripts.

## Build

```sh
npm install
npm run build
```

Output lands in `dist/`. `manifest.json` references it; load the whole `extension/` directory as an unpacked extension.

## Load in Chrome

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → pick this `extension/` directory.
4. Click the slopstop icon in the toolbar.
5. The first time you open the popup it'll show the settings panel. Paste your `/detect` endpoint URL (without the `/detect` suffix — see `../backend/README.md`). Hit **Save**, then **Test connection** to confirm the backend is up.

## Architecture

```
content/
  heuristics.js   Pattern matcher. Runs in-page, no network. Produces score + reasons.
  badge.js        Builds the colored badge UI + tooltip. Owns the "Run AI detector" flow.
  linkedin.js     LinkedIn DOM hooks. Finds posts/comments, attaches a badge.
  substack.js     Same, for Substack posts/comments/notes.
  styles.css      Badge + tooltip CSS.

src/
  config.ts                       Just the storage key for the backend URL.
  background/index.ts             Service worker. Reads URL from chrome.storage,
                                  POSTs to {url}/detect, returns the response.
  popup/App.tsx                   React popup: stats, on/off toggle, settings panel.
  popup/popup.css                 Popup styling.
  popup/main.tsx, index.html      Vite entry.

manifest.json                     MV3 manifest.
vite.popup.config.ts              Bundles the popup React app to dist/.
vite.background.config.ts         Bundles the service worker (single file, inlined).
```

## Heuristic vs. detector

Two scoring layers, independent:

- The **heuristic badge** runs entirely client-side via `content/heuristics.js`. It looks at em-dash density, stock phrases, emoji-bullet lines, generic CTA closes, hashtag spam, and a few other tells. Produces a 0–100 score with human-readable reasons.
- The **AI detector** is the model behind your `/detect` endpoint. Triggered manually per badge by clicking the tooltip's **Run AI detector** button. The response replaces the badge's color and score.

You can run the extension with no backend configured — the heuristic badges still work; only the "Run AI detector" button complains.

## What was stripped from this build

This is the open-source build. The hosted version of slopstop additionally has:

- Clerk sign-in
- Stripe checkout + customer portal
- Per-tier daily quotas (anon / free / basic / plus / pro)
- Auto-run-on-every-post (Pro feature)

None of those are in this codebase. Self-hosters get an unlimited, click-to-run detector pointing at their own infra.

## Permissions

- `storage` — remembers your show-badges preference and the configured backend URL.
- `activeTab` — to read the current tab's URL for the "scanning LinkedIn/Substack" status.
- `host_permissions: https://*/*` — needed because the configured backend URL is arbitrary; we can't statically list a host pattern. If you'd rather tighten this, swap it for the specific host of your Modal deployment and rebuild.
