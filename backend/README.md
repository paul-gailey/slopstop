# slopstop backend

A Modal app that exposes two endpoints:

- `POST /detect` — body `{"text": "..."}`, returns `{score, band, low_confidence, version}`.
- `GET /health` — returns `{ok, version, model}`.

That's it. No auth, no quotas, no billing.

## Deploy

```sh
pip install modal
modal token new            # one-time, links Modal CLI to your account
modal deploy main.py
```

Modal will print a URL like:

```
https://you--slopstop-detector-web.modal.run
```

Paste that into the extension's settings panel (the popup will append `/detect` itself).

First call cold-starts the GPU container (~5–8 s with the model baked into the image). Subsequent calls within ~5 min stay warm. Idle, the container scales to zero — you pay only for actual inference.

## Cost

On Modal's T4 GPU at 2026 prices, a warm inference is ~$0.00005 (≈300 ms). Modal also gives every account a generous monthly free tier. For casual personal use you'll likely stay free; heavy use will be cents per day.

## Swapping the model

`MODEL_NAME` at the top of `main.py` points at `desklib/ai-text-detector-v1.01`. To use a different HuggingFace model with the same PreTrainedModel + linear-classifier shape, just change the constant. For a model with a different architecture, rewrite `Detector.load` / `Detector.predict` accordingly.

The endpoint contract the extension expects:

```json
{
  "score": 0.0-100.0,
  "band": "likely_human" | "leans_human" | "ambiguous" | "leans_ai" | "likely_ai",
  "low_confidence": bool,
  "version": "string"
}
```

If you keep that shape, anything goes — call OpenAI, call your own endpoint, return a constant value. The extension doesn't care where the score comes from.

## Hardening (optional)

The default deploy is fully open. If you don't want randos hitting your endpoint, add one of:

- **A shared secret**: require an `Authorization: Bearer <token>` header in `/detect`, set the token via `modal.Secret`, and have the extension send it. Out of scope for the OSS build — fork and add it.
- **Origin lock**: restrict CORS to `chrome-extension://<your-extension-id>`. This only stops browser-based abusers; anyone with curl gets through.
- **Bring-your-own host**: deploy the same code somewhere private (a VPN-fronted box, Tailscale, Cloudflare Access in front of a tunnel).

## Local sanity check

After deploying, smoke-test from the shell:

```sh
export URL=https://you--slopstop-detector-web.modal.run
curl -s "$URL/health" | jq
curl -s -X POST "$URL/detect" \
  -H 'Content-Type: application/json' \
  --data '{"text":"This is a test paragraph long enough to clear the ten-word minimum."}' \
  | jq
```
