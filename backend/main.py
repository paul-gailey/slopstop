"""
Modal deployment for an AI-text detector backend.

Open-source build:
  - /detect  POST {text} -> {score, band, low_confidence, version}
  - /health  GET

No auth, no quotas, no billing — just a 64 KB request-body cap so a stray
multi-MB upload can't tie up a container. CORS is open so any browser
extension build can call it. If you put this on the public internet, expect
anyone with the URL to be able to consume your Modal credits — keep the URL
private, or add your own auth.

Deploy:
  pip install modal
  modal token new
  modal deploy main.py

Modal prints a URL when the deploy completes. Paste it into the slopstop
extension popup's settings panel (without the /detect suffix).

Model:
  desklib/ai-text-detector-v1.01 — an open-source classifier. Swap MODEL_NAME
  to use a different HuggingFace model with the same PreTrainedModel shape,
  or rewrite Detector.load / Detector.predict to call a different provider
  (e.g. OpenAI moderation, your own private endpoint).
"""

import modal

MODEL_NAME = "desklib/ai-text-detector-v1.01"
VERSION = "oss-v0.2"
MAX_LEN = 768
MIN_WORDS = 10
LOW_CONFIDENCE_BELOW = 50
MAX_CHARS = 10_000

app = modal.App("slopstop-detector")

cpu_image = modal.Image.debian_slim().pip_install("fastapi[standard]")


def _download_model():
    """Bake the model into the image so cold starts skip the HF download."""
    from transformers import AutoTokenizer
    from huggingface_hub import snapshot_download

    AutoTokenizer.from_pretrained(MODEL_NAME)
    snapshot_download(MODEL_NAME)


gpu_image = (
    modal.Image.debian_slim()
    .pip_install("torch", "transformers<4.46", "huggingface_hub")
    .run_function(_download_model)
)


with gpu_image.imports():
    import torch
    import torch.nn as nn
    from transformers import AutoTokenizer, AutoConfig, AutoModel, PreTrainedModel

    class DesklibAIDetectionModel(PreTrainedModel):
        config_class = AutoConfig

        def __init__(self, config):
            super().__init__(config)
            self.model = AutoModel.from_config(config)
            self.classifier = nn.Linear(config.hidden_size, 1)
            self.init_weights()

        def forward(self, input_ids, attention_mask=None, labels=None):
            outputs = self.model(input_ids, attention_mask=attention_mask)
            last_hidden_state = outputs[0]
            mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
            pooled = (last_hidden_state * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
            logits = self.classifier(pooled)
            return {"logits": logits}


def score_to_band(score: float) -> str:
    if score < 20: return "likely_human"
    if score < 40: return "leans_human"
    if score < 60: return "ambiguous"
    if score < 80: return "leans_ai"
    return "likely_ai"


@app.cls(image=gpu_image, gpu="T4", scaledown_window=300)
class Detector:
    @modal.enter()
    def load(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = (
            DesklibAIDetectionModel
            .from_pretrained(MODEL_NAME)
            .to(self.device)
            .eval()
        )

    @modal.method()
    def predict(self, text: str) -> float:
        encoded = self.tokenizer(
            text,
            padding="max_length",
            truncation=True,
            max_length=MAX_LEN,
            return_tensors="pt",
        )
        input_ids = encoded["input_ids"].to(self.device)
        attention_mask = encoded["attention_mask"].to(self.device)

        with torch.no_grad():
            logits = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )["logits"]
            return torch.sigmoid(logits).item()


@app.function(image=cpu_image, scaledown_window=300)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware

    api = FastAPI()
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    # MAX_CHARS (10_000) of UTF-8 text is at most ~40 KB; 64 KB is a generous
    # cap that still rejects multi-MB bodies before FastAPI parses them. Only
    # catches requests that send a Content-Length header (chunked uploads
    # bypass this).
    MAX_BODY_BYTES = 64 * 1024

    @api.middleware("http")
    async def limit_body_size(request: Request, call_next):
        if request.method == "POST":
            cl = request.headers.get("content-length")
            if cl is not None:
                try:
                    if int(cl) > MAX_BODY_BYTES:
                        return JSONResponse(
                            {"error": "payload_too_large"},
                            status_code=413,
                        )
                except ValueError:
                    pass
        return await call_next(request)

    @api.post("/detect")
    def detect(payload: dict):
        text = (payload.get("text") or "").strip()
        if not text:
            raise HTTPException(400, "empty_text")
        if len(text) > MAX_CHARS:
            raise HTTPException(400, f"text_too_long (max {MAX_CHARS} chars)")

        word_count = len(text.split())
        if word_count < MIN_WORDS:
            raise HTTPException(400, f"text_too_short (min {MIN_WORDS} words)")

        probability = Detector().predict.remote(text)
        score = round(probability * 100, 1)

        return {
            "score": score,
            "band": score_to_band(score),
            "low_confidence": word_count < LOW_CONFIDENCE_BELOW,
            "version": VERSION,
        }

    @api.get("/health")
    def health():
        return {"ok": True, "version": VERSION, "model": MODEL_NAME}

    return api
