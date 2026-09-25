import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants.js';

// --- Install / Update lifecycle ---
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({
      [STORAGE_KEYS.POM]: [],
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.HISTORY]: [],
    });
    console.info('[LocatorX] Initialized with default settings');
  }
  if (reason === 'update') {
    const { [STORAGE_KEYS.SETTINGS]: s } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...(s || {}) },
    });
  }
});

// --- Centralized message router (used by content scripts for reliability) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === MSG.ELEMENT_SELECTED) {
    (async () => {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.SELECTED]: msg.payload });

        // Append to history (cap at 50)
        const { [STORAGE_KEYS.HISTORY]: hist = [] } = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        const entry = {
          ...msg.payload,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          url: sender.tab?.url || '',
          title: sender.tab?.title || '',
        };
        hist.unshift(entry);
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: hist.slice(0, 50) });

        sendResponse({ ok: true });
      } catch (e) {
        console.error('[LocatorX] Failed to persist selection', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // keep channel open
  }
});

// --- Keyboard command shortcut ---
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'toggle-inspector') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try { await chrome.tabs.sendMessage(tab.id, { type: MSG.START_INSPECT }); } catch {}
    }
  }
});