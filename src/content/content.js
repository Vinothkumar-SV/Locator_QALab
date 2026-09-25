(() => {
  if (window.__locatorXLoaded) return;
  window.__locatorXLoaded = true;

  const MSG = {
    START: 'LOCATORX_START',
    STOP: 'LOCATORX_STOP',
    SELECTED: 'LOCATORX_SELECTED',
    TEST: 'LOCATORX_TEST',
    HIGHLIGHT: 'LOCATORX_HIGHLIGHT',
    PING: 'LOCATORX_PING',
    PONG: 'LOCATORX_PONG',
  };

  let inspecting = false;
  let hovered = null;
  let previousOutline = '';
  let overlay = null;

  // ---------- Inspector Overlay (shows tag + role while hovering) ----------
  function createOverlay() {
    const el = document.createElement('div');
    el.id = '__locatorx_overlay__';
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      background: '#172033',
      color: '#fff',
      font: '600 11px/1.4 Consolas, monospace',
      padding: '4px 8px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      display: 'none',
      maxWidth: '400px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    document.documentElement.appendChild(el);
    return el;
  }

  function destroyOverlay() {
    if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function showOverlay(target) {
    if (!overlay) overlay = createOverlay();
    const rect = target.getBoundingClientRect();
    const engine = window.__LocatorXEngine;
    const role = target.getAttribute('role') || engine?.implicitRole(target) || '';
    const name = engine?.accessibleName(target) || '';
    const short = name.length > 40 ? name.slice(0, 40) + '…' : name;
    overlay.textContent = `<${target.tagName.toLowerCase()}>${role ? ` [${role}]` : ''}${short ? ` "${short}"` : ''}`;
    overlay.style.top = Math.max(0, rect.top - 22) + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.display = 'block';
  }

  function restore() {
    if (hovered) {
      hovered.style.outline = previousOutline;
      hovered.style.outlineOffset = '';
    }
    hovered = null;
    if (overlay) overlay.style.display = 'none';
  }

  function onMove(e) {
    if (!inspecting) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.id === '__locatorx_overlay__') return;
    if (hovered === target) return;

    restore();
    hovered = target;
    previousOutline = hovered.style.outline;
    hovered.style.outline = '3px solid #7c3aed';
    hovered.style.outlineOffset = '-1px';
    showOverlay(hovered);
  }

  function onClick(e) {
    if (!inspecting) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = e.target;
    if (!(target instanceof Element)) return;

    stop();

    try {
      const engine = window.__LocatorXEngine;
      const payload = engine
        ? engine.summarizeElement(target)
        : { error: 'LocatorX engine not available', tag: target.tagName.toLowerCase() };

      chrome.runtime.sendMessage({ type: MSG.SELECTED, payload }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn('[LocatorX] Message failed:', chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.error('[LocatorX] Selection failed:', err);
    }
  }

  function onKeyDown(e) {
    if (!inspecting) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
      chrome.runtime.sendMessage({ type: MSG.STOP }).catch(() => {});
    }
  }

  function start() {
    if (inspecting) return;
    inspecting = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  function stop() {
    if (!inspecting) return;
    inspecting = false;
    restore();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
  }

  // ---------- Message Router ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      switch (msg?.type) {
        case MSG.START:
          start();
          sendResponse({ ok: true, inspecting });
          return true;
        case MSG.STOP:
          stop();
          sendResponse({ ok: true, inspecting });
          return true;
        case MSG.PING:
          sendResponse({ ok: true, pong: true, inspecting });
          return true;
        case MSG.TEST: {
          const c = msg.candidate;
          const engine = window.__LocatorXEngine;
          const count = engine ? engine.countCandidate(c) : -1;
          sendResponse({ ok: true, count });
          return true;
        }
        case MSG.HIGHLIGHT: {
          const el = document.querySelector(msg.selector);
          if (el) {
            const prev = el.style.outline;
            el.style.outline = '3px solid #f59e0b';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { el.style.outline = prev; }, 1500);
          }
          sendResponse({ ok: true });
          return true;
        }
        default:
          return false;
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
      return true;
    }
  });

  // Notify that content script is ready
  console.debug('[LocatorX] Content script ready on', location.href);
})();