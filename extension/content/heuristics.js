const AIDetector = (() => {
  const AI_VOCAB = [
    'delve', 'tapestry', 'leverage', 'navigate', 'realm', 'landscape',
    'ecosystem', 'paradigm', 'revolutionize', 'unleash', 'unlock',
    'harness', 'embrace', 'foster', 'cultivate', 'elevate', 'empower',
    'streamline', 'robust', 'seamless', 'holistic', 'multifaceted',
    'pivotal', 'transformative', 'cutting-edge', 'state-of-the-art',
    'game-changer', 'paramount', 'crucial', 'invaluable'
  ];

  const AI_PHRASES = [
    /in today'?s (fast-paced|digital|modern|ever-changing|competitive|dynamic)/i,
    /in the (world|realm|landscape|ecosystem|age|era) of/i,
    /let'?s dive (in|into)/i,
    /the truth is[,:]/i,
    /here'?s the thing[,:]/i,
    /at the end of the day/i,
    /(it )?boils down to/i,
    /moving forward/i,
    /that being said/i,
    /needless to say/i,
    /a testament to/i,
    /play(s|ed)? a (crucial|pivotal|vital|key|significant) role/i,
    /it'?s worth noting/i,
    /ever-(evolving|changing|growing)/i,
    /a deep dive/i,
    /unlock(s|ing)? the (power|potential|secret)/i,
    /the power of/i,
    /a journey of/i
  ];

  const NOT_JUST_PATTERN = /\b(it'?s |this is |that'?s )?not (just|only|merely|simply) [^.\n,—–\-]{3,60}[—–,\-] ?(it'?s |this is |that'?s |but |it )?[^.\n]{3,80}/i;

  const EMOJI_BULLET_RE = /^[\s]*[✅✔✨🚀💡🎯🔥⚡📌⭐🌟🔑📈🎉👉➡💪🙌✨]/gmu;

  const CTA_PATTERNS = [
    /what (are your thoughts|do you think)/i,
    /drop a comment/i,
    /let me know (in the comments|your thoughts)/i,
    /agree\?/i,
    /thoughts\?\s*$/i,
    /share your (thoughts|experience)/i,
    /comment below/i
  ];

  function score(text) {
    if (!text || text.length < 40) return null;

    const reasons = [];
    let total = 0;

    const emDashes = (text.match(/—/g) || []).length;
    if (emDashes >= 1) {
      const pts = Math.min(emDashes * 15, 36);
      total += pts;
      reasons.push(`${emDashes} em-dash${emDashes > 1 ? 'es' : ''} (+${pts})`);
    }

    if (NOT_JUST_PATTERN.test(text)) {
      total += 28;
      reasons.push(`"not just X — it's Y" structure (+28)`);
    }

    const lower = text.toLowerCase();
    const vocabHits = AI_VOCAB.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(lower));
    if (vocabHits.length > 0) {
      const pts = Math.min(vocabHits.length * 9, 30);
      total += pts;
      reasons.push(`AI vocab: ${vocabHits.slice(0, 3).join(', ')}${vocabHits.length > 3 ? '…' : ''} (+${pts})`);
    }

    const phraseHits = AI_PHRASES.filter(re => re.test(text));
    if (phraseHits.length > 0) {
      const pts = Math.min(phraseHits.length * 15, 36);
      total += pts;
      reasons.push(`${phraseHits.length} stock phrase${phraseHits.length > 1 ? 's' : ''} (+${pts})`);
    }

    const emojiBullets = (text.match(EMOJI_BULLET_RE) || []).length;
    if (emojiBullets >= 3) {
      total += 30;
      reasons.push(`${emojiBullets} emoji-bulleted lines (+30)`);
    } else if (emojiBullets >= 1) {
      total += 8;
      reasons.push(`emoji bullet (+8)`);
    }

    const hashtags = (text.match(/#\w+/g) || []).length;
    if (hashtags >= 5) {
      total += 10;
      reasons.push(`${hashtags} hashtags (+10)`);
    }

    const ctaHits = CTA_PATTERNS.filter(re => re.test(text)).length;
    if (ctaHits > 0) {
      total += 8;
      reasons.push(`generic CTA close (+8)`);
    }

    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length >= 6 && lines[0].length < 60 && text.includes('\n\n')) {
      total += 10;
      reasons.push(`hook + spaced structure (+10)`);
    }

    total = Math.min(total, 100);

    let label;
    if (total >= 50) label = 'Likely AI';
    else if (total >= 22) label = 'Mixed signals';
    else label = 'Likely human';

    return { score: total, label, reasons };
  }

  return { score };
})();

if (typeof window !== 'undefined') window.AIDetector = AIDetector;
