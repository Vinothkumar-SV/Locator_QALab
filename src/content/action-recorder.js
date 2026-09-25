/**
 * LocatorX Action Recorder — runs inside the page.
 * Captures user interactions and turns each into a structured step.
 */
(() => {
  if (window.__LocatorXRecorder) return;

  const KIND = {
    NAVIGATE: 'navigate', CLICK: 'click', FILL: 'fill', CLEAR: 'clear', TYPE: 'type',
    PRESS: 'press', CHECK: 'check', UNCHECK: 'uncheck', SELECT: 'select', HOVER: 'hover',
    FOCUS: 'focus', BLUR: 'blur', UPLOAD: 'upload', WAIT: 'wait', SCROLL: 'scroll',
    ASSERT_TEXT: 'assertText', ASSERT_VISIBLE: 'assertVisible', ASSERT_COUNT: 'assertCount',
  };

  const RECORDER_ATTR = 'data-locatorx-recorder';

  let recording = false;
  let steps = [];
  let pendingNav = null;
  let lastHoverAt = 0;
  let activeFocus = null;
  let debounceTimer = null;

  // ---------- Helpers ----------
  const cleanText = (v) => (v || '').replace(/\s+/g, ' ').trim();

  function pickLocator(el) {
    try {
      const engine = window.__LocatorXEngine;
      if (!engine) return { code: '', label: '' };
      const summarized = engine.summarizeElement(el);
      const best = summarized.locators?.[0];
      return {
        code: best?.code || '',
        label: summarized.ariaName || summarized.text || el.tagName.toLowerCase(),
        tag: summarized.tag,
        id: summarized.id,
        role: summarized.role,
        ariaName: summarized.ariaName,
      };
    } catch {
      return { code: '', label: '' };
    }
  }

  function makeStep(kind, el, value, extra = {}) {
    const info = el ? pickLocator(el) : {};
    return {
      id: 's_' + Math.random().toString(36).slice(2, 10),
      kind,
      locatorCode: info.code || '',
      label: info.label || extra.label || '',
      tag: info.tag || '',
      id: info.id || '',
      role: info.role || '',
      ariaName: info.ariaName || '',
      value: value ?? '',
      url: location.href,
      timestamp: Date.now(),
      ...extra,
    };
  }

  function pushStep(step) {
    // Coalesce rapid hover+click on the same element
    const prev = steps[steps.length - 1];
    if (
      prev &&
      prev.kind === KIND.HOVER &&
      step.kind === KIND.CLICK &&
      prev.locatorCode === step.locatorCode
    ) {
      steps.pop();
    }
    steps.push(step);
    notifyUpdate();
  }

  function notifyUpdate() {
    try {
      chrome.runtime.sendMessage({ type: 'LOCATORX_RECORDER_TICK', count: steps.length });
    } catch {}
  }

  // ---------- Event handlers ----------
  function isRecorderElement(el) {
    if (!(el instanceof Element)) return false;
    return el.hasAttribute(RECORDER_ATTR) || !!el.closest(`[${RECORDER_ATTR}]`);
  }

  function onClickCapture(e) {
    if (!recording) return;
    const el = e.target;
    if (!(el instanceof Element) || isRecorderElement(el)) return;

    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    // Submit-type buttons inside forms → emit click; form submission captured separately
    pushStep(makeStep(KIND.CLICK, el));
  }

  function onInputCapture(e) {
    if (!recording) return;
    const el = e.target;
    if (!(el instanceof Element) || isRecorderElement(el)) return;

    const tag = el.tagName.toLowerCase();
    if (!['input', 'textarea'].includes(tag)) return;

    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['checkbox', 'radio', 'file', 'submit', 'button', 'reset', 'image', 'hidden'].includes(type)) return;

    // Debounce so each pause in typing produces one FILL step
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const value = el.value || '';
      const prev = steps[steps.length - 1];
      // Replace previous FILL on same element
      if (prev && prev.kind === KIND.FILL && prev.locatorCode === pickLocator(el).code) {
        prev.value = value;
        prev.timestamp = Date.now();
        notifyUpdate();
        return;
      }
      if (!value) return;
      pushStep(makeStep(KIND.FILL, el, value));
    }, 500);
  }

  function onChangeCapture(e) {
    if (!recording) return;
    const el = e.target;
    if (!(el instanceof Element) || isRecorderElement(el)) return;

    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    if (tag === 'select') {
      pushStep(makeStep(KIND.SELECT, el, el.value));
      return;
    }
    if (tag === 'input') {
      if (type === 'checkbox') {
        pushStep(makeStep(el.checked ? KIND.CHECK : KIND.UNCHECK, el));
        return;
      }
      if (type === 'radio' && el.checked) {
        pushStep(makeStep(KIND.CLICK, el));
        return;
      }
      if (type === 'file') {
        const files = [...(el.files || [])].map(f => f.name).join(', ');
        pushStep(makeStep(KIND.UPLOAD, el, files || '<file>'));
        return;
      }
    }
  }

  function onKeyDownCapture(e) {
    if (!recording) return;
    const el = e.target;
    if (!(el instanceof Element) || isRecorderElement(el)) return;

    // Enter on a form input → likely submit; let the click/submit handlers catch it.
    if (e.key === 'Enter' && el.tagName === 'INPUT') {
      return;
    }
    // Tab / Shift+Tab / arrows / modifier-only keys → ignore
    if (['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    // Printable keys are handled by onInputCapture; only record non-printable specials
    if (e.key.length === 1) return;

    pushStep(makeStep(KIND.PRESS, el, e.key));
  }

  let hoverTimer = null;
  function onMouseOverCapture(e) {
    if (!recording) return;
    const el = e.target;
    if (!(el instanceof Element) || isRecorderElement(el)) return;
    if (el === document.documentElement || el === document.body) return;

    // Only record meaningful hovers (interactive elements) and not the click target
    const tag = el.tagName.toLowerCase();
    const interactive = ['a', 'button'].includes(tag) ||
      el.getAttribute('role') === 'button' ||
      el.hasAttribute('aria-haspopup') ||
      el.classList.contains('tooltip-trigger');

    if (!interactive) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      // Skip if a click happened on the same element within 800ms
      const last = steps[steps.length - 1];
      if (last && last.kind === KIND.CLICK && last.locatorCode === pickLocator(el).code) return;
      pushStep(makeStep(KIND.HOVER, el));
    }, 800);
  }

  function onSubmitCapture(e) {
    if (!recording) return;
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    // Record as a click on the submit button if we can find it
    const submitter = e.submitter;
    if (submitter) pushStep(makeStep(KIND.CLICK, submitter));
  }

  function onBeforeUnload() {
    if (!recording) return;
    // Buffer pending navigation; will be flushed on next page's content script
    pendingNav = location.href;
    try {
      sessionStorage.setItem('__locatorx_pending_nav__', JSON.stringify({
        from: location.href,
        steps,
        at: Date.now(),
      }));
    } catch {}
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && recording) {
      try {
        const raw = sessionStorage.getItem('__locatorx_pending_nav__');
        if (raw) {
          const info = JSON.parse(raw);
          // If we just navigated here, capture a NAVIGATE step
          if (info.from && info.from !== location.href && Date.now() - info.at < 5000) {
            pushStep(makeStep(KIND.NAVIGATE, null, location.href, { label: location.href }));
          }
          sessionStorage.removeItem('__locatorx_pending_nav__');
        }
      } catch {}
    }
  }

  // ---------- Public API ----------
  function start() {
    if (recording) return;
    recording = true;
    steps = [];
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('input', onInputCapture, true);
    document.addEventListener('change', onChangeCapture, true);
    document.addEventListener('keydown', onKeyDownCapture, true);
    document.addEventListener('mouseover', onMouseOverCapture, true);
    document.addEventListener('submit', onSubmitCapture, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    pushStep(makeStep(KIND.NAVIGATE, null, location.href, { label: location.href }));
    notifyUpdate();
  }

  function stop() {
    if (!recording) return;
    recording = false;
    clearTimeout(debounceTimer);
    clearTimeout(hoverTimer);
    document.removeEventListener('click', onClickCapture, true);
    document.removeEventListener('input', onInputCapture, true);
    document.removeEventListener('change', onChangeCapture, true);
    document.removeEventListener('keydown', onKeyDownCapture, true);
    document.removeEventListener('mouseover', onMouseOverCapture, true);
    document.removeEventListener('submit', onSubmitCapture, true);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function getSteps() { return steps.slice(); }
  function clearSteps() { steps = []; notifyUpdate(); }
  function isRecording() { return recording; }

  window.__LocatorXRecorder = Object.freeze({
    start, stop, getSteps, clearSteps, isRecording,
  });

  // ---------- Message router ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      switch (msg?.type) {
        case 'LOCATORX_REC_START':
          start();
          sendResponse({ ok: true, recording: true });
          return true;
        case 'LOCATORX_REC_STOP':
          stop();
          sendResponse({ ok: true, recording: false, steps: getSteps() });
          return true;
        case 'LOCATORX_REC_GET':
          sendResponse({ ok: true, steps: getSteps(), recording });
          return true;
        case 'LOCATORX_REC_CLEAR':
          clearSteps();
          sendResponse({ ok: true });
          return true;
        default:
          return false;
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
      return true;
    }
  });
})();