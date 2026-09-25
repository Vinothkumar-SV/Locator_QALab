import { withRetry } from './utils.js';

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function sendToActiveTab(message, options = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab available');

  // Guard against restricted URLs
  const url = tab.url || '';
  if (!/^https?:|^file:|^chrome-extension:/.test(url)) {
    throw new Error(`Cannot operate on this page (${url.split(':')[0] || 'unknown'} scheme)`);
  }

  return withRetry(
    () => chrome.tabs.sendMessage(tab.id, message, options),
    { retries: 2, delay: 200 }
  );
}

export async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'LOCATORX_PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['src/content/locator-engine.js', 'src/content/content.js'],
      });
      return true;
    } catch (e) {
      console.warn('[LocatorX] Cannot inject content script:', e.message);
      return false;
    }
  }
}