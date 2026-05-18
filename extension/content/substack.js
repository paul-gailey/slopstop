(function () {
  // Full post body on /p/* pages — badge sits in its own block ABOVE the body
  // (inside the body it gets clipped by embed wrappers like YouTube iframes).
  const POST_BODY = '.body.markup';
  const COMMENT = '.comment-body';
  const NOTE_TEXT = '[data-component-name="NoteContentBody"], .pencraft.reset.markup, .feed-item .body';

  function processInline(el) {
    if (el.dataset.aiProcessed === '1') return;
    const text = (el.innerText || '').trim();
    if (text.length < 40) return;
    el.dataset.aiProcessed = '1';
    const result = AIDetector.score(text);
    if (!result) return;
    AIBadge.attachInline(el, result, null, text);
  }

  function processPostBody(el) {
    if (el.dataset.aiProcessed === '1') return;
    const text = (el.innerText || '').trim();
    if (text.length < 40) return;
    if (!el.parentNode) return;
    el.dataset.aiProcessed = '1';
    const result = AIDetector.score(text);
    if (!result) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-detector-block-wrapper';
    el.parentNode.insertBefore(wrapper, el);
    AIBadge.attachInline(wrapper, result, el, text);
  }

  function scan() {
    document.querySelectorAll(POST_BODY).forEach(processPostBody);
    document.querySelectorAll(COMMENT).forEach(processInline);
    document.querySelectorAll(NOTE_TEXT).forEach(processInline);
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
