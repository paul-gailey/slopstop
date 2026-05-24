# slopstop

A Chrome extension that flags likely AI-generated posts and comments on LinkedIn and Substack.

**[Install from the Chrome Web Store →](https://chromewebstore.google.com/detail/slopstop/jioimkcoklaagibjbljcddkibhpmppkk)**

Two signals stacked together:

- **Heuristic badge** — pattern matching that runs entirely in the browser. Em-dash density, stock phrases, emoji-bullet structure. Free, instant, no network.
- **AI-detector model** — on-demand classifier behind a `/detect` endpoint. You bring your own backend (one `modal deploy` away).

A hosted, paid version of slopstop lives at <https://paulgailey.github.io/slopstop>. This repo is the open-source build: same extension, no auth, no quotas, point it at your own endpoint.

## Layout

```
docs/        GitHub Pages source — landing page, privacy, terms
extension/   Chrome extension (MV3, React popup, vanilla content scripts)
backend/     Modal app: /detect + /health. No auth, no quotas.
```

## Quick start (self-host)

1. Deploy the backend.

   ```sh
   cd backend
   pip install modal
   modal token new            # one-time
   modal deploy main.py
   ```

   Modal prints a URL like `https://you--slopstop-detector-web.modal.run`. Keep it.

2. Build the extension.

   ```sh
   cd extension
   npm install
   npm run build
   ```

3. Load it in Chrome.

   - Open `chrome://extensions`, toggle **Developer mode**.
   - Click **Load unpacked** and pick the `extension/` directory.
   - Click the slopstop icon in the toolbar, open **Settings**, paste your Modal URL.

4. Open LinkedIn or Substack and scroll. Posts get a heuristic badge instantly. Click any badge → **Run AI detector** to call your endpoint.

## What this build doesn't include

The hosted version of slopstop adds:

- Account sign-in (Clerk)
- Paid subscriptions (Stripe)
- Per-tier daily quotas
- Auto-firing the detector on every visible post (Pro feature)

None of those exist in this repo. If you self-host, the detector is free and unlimited — bounded only by your Modal usage.

## License

MIT. See [LICENSE](LICENSE).
