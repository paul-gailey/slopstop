const AIBadge = (() => {
  const MIN_WORDS_FOR_ML = 10;

  function colorFor(score) {
    if (score >= 60) return '#dc2626';
    if (score >= 30) return '#ca8a04';
    return '#16a34a';
  }

  function bandLabel(band) {
    return {
      likely_human: 'Likely human',
      leans_human: 'Leans human',
      ambiguous: 'Ambiguous',
      leans_ai: 'Leans AI',
      likely_ai: 'Likely AI',
    }[band] || band;
  }

  function bandColor(band) {
    return {
      likely_human: '#16a34a',
      leans_human: '#65a30d',
      ambiguous: '#ca8a04',
      leans_ai: '#ea580c',
      likely_ai: '#dc2626',
    }[band] || '#6b7280';
  }

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function build(result, text, extraClass) {
    const badge = document.createElement('span');
    badge.className = 'ai-detector-badge' + (extraClass ? ' ' + extraClass : '');
    badge.dataset.score = result.score;
    badge.style.background = colorFor(result.score);

    const label = document.createElement('span');
    label.className = 'ai-detector-badge-label';
    label.textContent = `AI ${result.score}`;
    badge.appendChild(label);

    const panel = document.createElement('span');
    panel.className = 'ai-detector-tooltip';

    const heuristicHeader = document.createElement('div');
    heuristicHeader.className = 'aid-section-title';
    heuristicHeader.textContent = `${result.label} · ${result.score}/100`;
    panel.appendChild(heuristicHeader);

    const reasonsEl = document.createElement('div');
    reasonsEl.className = 'aid-reasons';
    if (result.reasons.length) {
      result.reasons.forEach((r, i) => {
        if (i > 0) reasonsEl.appendChild(document.createElement('br'));
        reasonsEl.appendChild(document.createTextNode(`• ${r}`));
      });
    } else {
      reasonsEl.textContent = 'No strong heuristic signals.';
    }
    panel.appendChild(reasonsEl);

    const mlSection = document.createElement('div');
    mlSection.className = 'aid-ml-section';
    panel.appendChild(mlSection);

    badge.appendChild(panel);

    badge.dataset.aidText = text || '';
    badge.dataset.aidMlState = 'idle';

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePinned(badge);
    });

    badge.addEventListener('mouseenter', () => positionTooltip(badge));

    return badge;
  }

  function positionTooltip(badge) {
    const tooltip = badge.querySelector('.ai-detector-tooltip');
    if (!tooltip) return;
    const rect = badge.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipMaxWidth = 300;
    const margin = 8;

    tooltip.style.right = 'auto';
    let left = rect.left;
    if (left + tooltipMaxWidth > viewportWidth - margin) {
      left = viewportWidth - tooltipMaxWidth - margin;
    }
    if (left < margin) left = margin;
    tooltip.style.left = `${left}px`;

    const spaceBelow = viewportHeight - rect.bottom;
    if (spaceBelow < 180 && rect.top > spaceBelow) {
      tooltip.style.top = 'auto';
      tooltip.style.bottom = `${viewportHeight - rect.top + 4}px`;
    } else {
      tooltip.style.bottom = 'auto';
      tooltip.style.top = `${rect.bottom + 4}px`;
    }
  }

  function togglePinned(badge) {
    const pinned = badge.classList.toggle('aid-pinned');
    if (pinned) {
      positionTooltip(badge);
      document.querySelectorAll('.ai-detector-badge.aid-pinned').forEach(b => {
        if (b !== badge) b.classList.remove('aid-pinned');
      });
      ensureMLAffordance(badge);
    }
  }

  function ensureMLAffordance(badge) {
    if (badge.dataset.aidMlState !== 'idle') return;
    const text = badge.dataset.aidText || '';
    const panel = badge.querySelector('.ai-detector-tooltip');
    const mlSection = panel.querySelector('.aid-ml-section');
    while (mlSection.firstChild) mlSection.removeChild(mlSection.firstChild);

    if (wordCount(text) < MIN_WORDS_FOR_ML) {
      mlSection.appendChild(el('div', 'aid-ml-note', `Too short for AI detector (need ${MIN_WORDS_FOR_ML}+ words).`));
      badge.dataset.aidMlState = 'too_short';
      return;
    }

    const button = el('button', 'aid-run-btn', 'Run AI detector');
    button.type = 'button';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      requestInference(badge);
    });
    mlSection.appendChild(button);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setMLState(badge, state, payload) {
    badge.dataset.aidMlState = state;
    const panel = badge.querySelector('.ai-detector-tooltip');
    const mlSection = panel.querySelector('.aid-ml-section');
    while (mlSection.firstChild) mlSection.removeChild(mlSection.firstChild);

    if (state === 'loading') {
      mlSection.appendChild(el('div', 'aid-ml-note aid-loading', 'Running detector…'));
      return;
    }
    if (state === 'error') {
      mlSection.appendChild(el('div', 'aid-ml-note aid-error', payload || 'Detector unreachable — try again.'));
      return;
    }
    if (state === 'not_configured') {
      mlSection.appendChild(el('div', 'aid-ml-title', 'No backend configured'));
      const paywall = el('div', 'aid-paywall');
      paywall.appendChild(el('div', 'aid-quota-line', 'Add a detector URL in the extension popup.'));
      const btn = el('button', 'aid-signin-btn', 'Open settings');
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'openSettings' }).catch(() => {});
      });
      paywall.appendChild(btn);
      mlSection.appendChild(paywall);
      return;
    }
    if (state === 'done' && payload) {
      const color = bandColor(payload.band);
      const label = bandLabel(payload.band);
      const score = Number(payload.score);
      mlSection.appendChild(el('div', 'aid-ml-title', 'Detector estimate'));
      const result = el('div', 'aid-ml-result');
      result.style.color = color;
      result.appendChild(el('span', 'aid-ml-band', label));
      result.appendChild(el('span', 'aid-ml-score', `${score}/100`));
      mlSection.appendChild(result);
      if (payload.low_confidence) {
        mlSection.appendChild(el('div', 'aid-ml-caveat', 'Short text — less reliable.'));
      }

      const labelEl = badge.querySelector('.ai-detector-badge-label');
      if (labelEl) labelEl.textContent = `AI ${score}`;
      badge.style.background = color;
      badge.dataset.score = score;
      badge.dataset.aidSource = 'ml';
    }
  }

  function runtimeAvailable() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  async function requestInference(badge) {
    const text = badge.dataset.aidText || '';
    if (!text) return;
    if (!runtimeAvailable()) {
      setMLState(badge, 'error', 'Reload this tab to re-enable the detector.');
      return;
    }
    setMLState(badge, 'loading');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'runInference', text });
      if (!response) {
        setMLState(badge, 'error', 'No response from detector.');
        return;
      }
      if (response.not_configured) {
        setMLState(badge, 'not_configured');
        return;
      }
      if (!response.ok) {
        setMLState(badge, 'error', response.error === 'network_error' ? 'Network error — try again.' : 'Detector unavailable.');
        return;
      }
      setMLState(badge, 'done', response);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Extension context invalidated')) {
        setMLState(badge, 'error', 'Reload this tab to re-enable the detector.');
      } else {
        setMLState(badge, 'error');
      }
    }
  }

  function attach(host, result, text) {
    if (host.dataset.aiBadgeAttached === '1') return;
    host.dataset.aiBadgeAttached = '1';

    const badge = build(result, text);
    if (window.getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    host.appendChild(badge);
  }

  function attachInline(textEl, result, marker, text) {
    const key = marker || textEl;
    if (key.dataset && key.dataset.aiBadgeAttached === '1') return;
    if (key.dataset) key.dataset.aiBadgeAttached = '1';

    const badge = build(result, text, 'ai-detector-badge-inline');
    textEl.insertBefore(badge, textEl.firstChild);
  }

  return { attach, attachInline };
})();

(function applyEnabledToggle() {
  function apply(enabled) {
    document.documentElement.classList.toggle('ai-detector-disabled', !enabled);
  }
  chrome.storage.sync.get({ enabled: true }, ({ enabled }) => apply(enabled));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) apply(changes.enabled.newValue);
  });
})();

document.addEventListener('click', (e) => {
  if (e.target.closest('.ai-detector-badge')) return;
  document.querySelectorAll('.ai-detector-badge.aid-pinned').forEach(b => b.classList.remove('aid-pinned'));
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'getStats') return;
  const badges = document.querySelectorAll('.ai-detector-badge');
  const counts = { total: badges.length, human: 0, mixed: 0, ai: 0 };
  badges.forEach(b => {
    const score = parseInt(b.dataset.score, 10);
    if (Number.isNaN(score)) return;
    if (score >= 60) counts.ai++;
    else if (score >= 30) counts.mixed++;
    else counts.human++;
  });
  sendResponse(counts);
  return true;
});

if (typeof window !== 'undefined') window.AIBadge = AIBadge;
