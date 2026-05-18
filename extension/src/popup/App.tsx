import { useEffect, useState } from "react";
import { STORAGE_KEY_BACKEND_URL } from "../config";

type Stats = { total: number; human: number; mixed: number; ai: number };
type Site = "LinkedIn" | "Substack" | null;

function siteFor(url: string | undefined): Site {
  if (!url) return null;
  if (/^https?:\/\/(?:www\.)?linkedin\.com\//.test(url)) return "LinkedIn";
  if (/^https?:\/\/(?:[^/]+\.)?substack\.com\//.test(url)) return "Substack";
  return null;
}

function StatsPanel({ stats }: { stats: Stats }) {
  const total = stats.total || 0;
  if (total === 0) {
    return (
      <section className="section stats-empty-section">
        <div className="stats-label">Items scored on this page</div>
        <div className="stats-empty">Scroll the feed to start scoring posts and comments.</div>
      </section>
    );
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <section className="section">
      <div className="stats-header">
        <span className="stats-label">Items scored on this page</span>
        <span className="stats-total">{total}</span>
      </div>
      <div className="stack-bar">
        <div className="stack-segment human" style={{ width: pct(stats.human) }} />
        <div className="stack-segment mixed" style={{ width: pct(stats.mixed) }} />
        <div className="stack-segment ai" style={{ width: pct(stats.ai) }} />
      </div>
      <div className="breakdown">
        <span className="key"><span className="dot human" /><b>{stats.human}</b> human</span>
        <span className="key"><span className="dot mixed" /><b>{stats.mixed}</b> mixed</span>
        <span className="key"><span className="dot ai" /><b>{stats.ai}</b> AI</span>
      </div>
    </section>
  );
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function BackendSettings() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_BACKEND_URL, (out) => {
      const stored = out[STORAGE_KEY_BACKEND_URL];
      if (typeof stored === "string") {
        setValue(stored);
        setSaved(stored);
      }
    });
  }, []);

  const trimmed = value.trim().replace(/\/+$/, "");
  const isDirty = trimmed !== (saved ?? "");
  const isValid = trimmed === "" || isHttpsUrl(trimmed);

  const save = async () => {
    if (!isValid) return;
    await chrome.storage.local.set({ [STORAGE_KEY_BACKEND_URL]: trimmed });
    setSaved(trimmed);
    setTestResult(null);
  };

  const test = async () => {
    if (!trimmed || !isValid) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${trimmed}/health`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          ok: true,
          message: data.version ? `Connected · ${data.version}` : "Connected",
        });
      } else {
        setTestResult({ ok: false, message: `HTTP ${res.status}` });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach endpoint" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="section">
      <div className="row-label">AI-detector backend</div>
      <div className="row-help">Paste your Modal endpoint URL. The extension will POST to <code>/detect</code> on it.</div>
      <input
        type="url"
        className="settings-input"
        placeholder="https://you--slopstop-detector-web.modal.run"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {!isValid && trimmed !== "" && (
        <div className="settings-error">Must be a valid http(s) URL.</div>
      )}
      <div className="settings-actions">
        <button
          type="button"
          className="primary-btn"
          onClick={save}
          disabled={!isDirty || !isValid}
        >
          {isDirty ? "Save" : "Saved"}
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={test}
          disabled={!trimmed || !isValid || testing}
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>
      {testResult && (
        <div className={testResult.ok ? "settings-ok" : "settings-error"}>
          {testResult.message}
        </div>
      )}
    </section>
  );
}

function PopupBody() {
  const [enabled, setEnabled] = useState(true);
  const [site, setSite] = useState<Site>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, human: 0, mixed: 0, ai: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.storage.sync.get({ enabled: true }, ({ enabled }) => setEnabled(enabled));
    chrome.storage.local.get(STORAGE_KEY_BACKEND_URL, (out) => {
      const stored = out[STORAGE_KEY_BACKEND_URL];
      const configured = typeof stored === "string" && stored.trim().length > 0;
      setBackendConfigured(configured);
      if (!configured) setShowSettings(true);
    });
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORAGE_KEY_BACKEND_URL]) {
        const v = changes[STORAGE_KEY_BACKEND_URL].newValue;
        setBackendConfigured(typeof v === "string" && v.trim().length > 0);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const detectedSite = siteFor(tab?.url);
      setSite(detectedSite);
      if (!detectedSite || !tab?.id) return;
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: "getStats" });
        if (result) setStats(result);
      } catch {
        /* tab not ready */
      }
    })();
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.sync.set({ enabled: next });
  };

  return (
    <div className="popup-root">
      <header className="header">
        <svg className="logo" width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#lg)" />
          <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif">AI</text>
        </svg>
        <div className="title">
          <h1>slopstop</h1>
          <div className="subtitle">Sniffs out AI slop on LinkedIn &amp; Substack</div>
        </div>
        <button
          type="button"
          className="settings-toggle"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Toggle settings"
          title="Settings"
        >
          ⚙
        </button>
      </header>

      <div className={`status ${site ? "active" : ""}`}>
        <span className="pulse" />
        <span className="status-text">{site ? `Scanning ${site}` : "Not on a supported site"}</span>
      </div>

      {backendConfigured === false && !showSettings && (
        <section className="section">
          <div className="row-label">No detector backend configured</div>
          <div className="row-help">
            Heuristic badges work without one. To run the AI detector,{" "}
            <button type="button" className="link-btn" onClick={() => setShowSettings(true)}>
              add a backend URL
            </button>.
          </div>
        </section>
      )}

      {showSettings && <BackendSettings />}

      <section className="section">
        <div className="toggle-row">
          <div>
            <div className="row-label">Show badges</div>
            <div className="row-help">Score posts as you scroll</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={enabled} onChange={toggle} />
            <span className="slider" />
          </label>
        </div>
      </section>

      {site && <StatsPanel stats={stats} />}
    </div>
  );
}

export function App() {
  return <PopupBody />;
}
