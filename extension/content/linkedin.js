(function () {
  const TEXT_SELECTOR = '[data-testid="expandable-text-box"]';

  function findHost(textEl) {
    const commentList = textEl.closest('[data-testid*="commentList"]');
    if (commentList) {
      let el = textEl.parentElement;
      let best = el;
      while (el && el !== commentList) {
        const count = el.querySelectorAll(TEXT_SELECTOR).length;
        if (count > 1) break;
        if (el.tagName === 'DIV') best = el;
        el = el.parentElement;
      }
      return best;
    }
    let el = textEl.parentElement;
    while (el && el !== document.body) {
      const dataId = el.getAttribute('data-id') || '';
      const dataUrn = el.getAttribute('data-urn') || '';
      if (/^urn:li:/.test(dataId) || /^urn:li:/.test(dataUrn)) return el;
      const role = el.getAttribute('role');
      if (role === 'article' || role === 'listitem') return el;
      el = el.parentElement;
    }
    return textEl.parentElement;
  }

  function process(textEl) {
    if (textEl.dataset.aiProcessed === '1') return;
    textEl.dataset.aiProcessed = '1';
    const host = findHost(textEl);
    if (!host) return;
    const text = textEl.innerText.trim();
    if (text.length < 40) return;
    const result = AIDetector.score(text);
    if (!result) return;
    AIBadge.attachInline(textEl, result, host, text);
  }

  function scan() {
    document.querySelectorAll(TEXT_SELECTOR).forEach(process);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
