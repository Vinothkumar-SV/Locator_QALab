import { MSG } from './constants.js';

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function sendToActiveTab(message, options = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab available');
  return chrome.tabs.sendMessage(tab.id, message, { frameId: 0, ...options });
}

export async function ensureContentScript(tabId) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: MSG.PING }, { frameId: 0 });
    if (r?.ok) return true;
  } catch {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ['src/content/locator-engine.js', 'src/content/content.js'],
    });
    await new Promise(r => setTimeout(r, 100));
    return true;
  } catch (e) {
    console.warn('[LocatorX] Cannot inject content script:', e.message);
    return false;
  }
}