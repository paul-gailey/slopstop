import { STORAGE_KEY_BACKEND_URL } from "../config";

type DetectResponse =
  | { ok: true; score: number; band: string; low_confidence: boolean; version: string }
  | { ok: false; not_configured: true }
  | { ok: false; validation_error: string }
  | { ok: false; error: string };

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["device_id"]);
  if (!stored.device_id) {
    await chrome.storage.local.set({ device_id: crypto.randomUUID() });
  }
  const synced = await chrome.storage.sync.get("enabled");
  if (synced.enabled === undefined) {
    await chrome.storage.sync.set({ enabled: true });
  }
});

async function getBackendUrl(): Promise<string | null> {
  const { [STORAGE_KEY_BACKEND_URL]: url } = await chrome.storage.local.get(
    STORAGE_KEY_BACKEND_URL,
  );
  if (typeof url !== "string" || !url.trim()) return null;
  return url.trim().replace(/\/+$/, "");
}

async function runInference(text: string): Promise<DetectResponse> {
  const baseUrl = await getBackendUrl();
  if (!baseUrl) return { ok: false, not_configured: true };

  try {
    const res = await fetch(`${baseUrl}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.status === 400) {
      const detail = await res.json().catch(() => ({}));
      return { ok: false, validation_error: detail.detail || "invalid_input" };
    }
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "runInference") {
    runInference(msg.text).then(sendResponse);
    return true;
  }
  if (msg?.type === "openSettings") {
    chrome.action.openPopup().catch((err) => {
      console.warn("[slopstop] openPopup failed:", err);
    });
    return false;
  }
  return false;
});
