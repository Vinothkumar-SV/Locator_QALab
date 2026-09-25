import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS, classifyScore } from '../shared/constants.js';
import { escapeHtml, sanitizeIdentifier, sanitizeClassName, uniqueBy } from '../shared/utils.js';
import { sendToActiveTab, getActiveTab, ensureContentScript } from '../shared/messaging.js';

// ---------- State ----------
let selected = null;
let pomItems = [];
let settings = { ...DEFAULT_SETTINGS };
let filterUniqueOnly = false;

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
const status = $('status');

function setStatus(text, kind = 'info') {
  status.textContent = text;
  status.style.color = kind === 'error' ? 'var(--danger)' : kind === 'success' ? 'var(--success)' : '#536078';
}

function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  if (kind === 'error') el.style.background = 'var(--danger)';
  if (kind === 'success') el.style.background = 'var(--success)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

async function copy(text, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label, 'success');
  } catch (e) {
    toast('Clipboard blocked', 'error');
  }
}

// ---------- Storage ----------
async function loadState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.SELECTED,
    STORAGE_KEYS.POM,
    STORAGE_KEYS.SETTINGS,
  ]);

  if (data[STORAGE_KEYS.SELECTED]) {
    selected = data[STORAGE_KEYS.SELECTED];
  }
  pomItems = Array.isArray(data[STORAGE_KEYS.POM]) ? data[STORAGE_KEYS.POM] : [];
  settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };

  updatePomCount();
}

async function savePom() {
  await chrome.storage.local.set({ [STORAGE_KEYS.POM]: pomItems });
  updatePomCount();
}

// ---------- Page badge ----------
async function refreshPageBadge() {
  const tab = await getActiveTab();
  const badge = $('pageBadge');
  if (!tab?.url) { badge.textContent = '—'; return; }
  try {
    const u = new URL(tab.url);
    badge.textContent = u.hostname.replace(/^www\./, '') || u.protocol;
    badge.title = tab.url;
  } catch {
    badge.textContent = tab.url.split(':')[0] || '—';
  }
}

// ---------- Render ----------
function renderElementSummary() {
  if (!selected) return;
  const s = selected;
  const attrLine = Object.entries(s.attributes || {})
    .slice(0, 8)
    .map(([k, v]) => `${k}="${v.length > 60 ? v.slice(0, 60) + '…' : v}"`)
    .join('  ');
  const role = s.role ? `  role="${s.role}"` : '';
  const aria = s.ariaName ? `  aria-name="${s.ariaName}"` : '';

  $('elementSummary').textContent =
    `<${s.tag}${s.id ? ` id="${s.id}"` : ''}${role}${aria}>\n` +
    attrLine +
    (s.text ? `\n\n"${s.text.slice(0, 160)}"` : '');
}

function qualityClass(score) {
  const q = classifyScore(score);
  return q.label.toLowerCase();
}

function renderLocators() {
  const list = $('locatorList');
  list.innerHTML = '';

  let locators = selected?.locators || [];
  if (filterUniqueOnly) locators = locators.filter(l => l.count === 1);

  $('count').textContent = `${locators.length} candidate${locators.length === 1 ? '' : 's'}`;

  if (!locators.length) {
    list.innerHTML = '<p class="hint">No locators match the current filter.</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  locators.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'locator';
    const countLabel = l.count === 1
      ? '<span class="ok">✓ Unique</span>'
      : l.count > 1
        ? `<span class="warn">⚠ ${l.count} matches</span>`
        : '<span class="err">✗ Not found</span>';

    div.innerHTML = `
      <div class="locator-head">
        <div class="left">
          <span class="rank">${i + 1}</span>
          <strong>${escapeHtml(l.type)}</strong>
        </div>
        <span class="quality ${qualityClass(l.score)}">${classifyScore(l.score).label}</span>
      </div>
      <div class="score-row">Health score: <strong>${l.score}/100</strong></div>
      <div class="code">${escapeHtml(l.code)}</div>
      <div class="meta">${countLabel} · strategy: ${escapeHtml(l.strategy)}</div>
      <div class="actions">
        <button data-copy="${i}">📋 Copy</button>
        <button data-test="${i}">🧪 Test</button>
      </div>
    `;
    frag.appendChild(div);
  });

  list.appendChild(frag);

  list.querySelectorAll('[data-copy]').forEach(b => {
    b.onclick = () => copy(locators[+b.dataset.copy].code, 'Locator copied');
  });
  list.querySelectorAll('[data-test]').forEach(b => {
    b.onclick = async () => {
      const l = locators[+b.dataset.test];
      b.disabled = true;
      b.textContent = '…';
      try {
        const r = await sendToActiveTab({ type: MSG.TEST, candidate: l });
        if (r?.ok) {
          setStatus(`${l.type}: ${r.count} matching element(s)`, r.count === 1 ? 'success' : 'info');
        } else {
          setStatus('Test failed on this page.', 'error');
        }
      } catch (e) {
        setStatus('Unable to test on this page.', 'error');
      } finally {
        b.disabled = false;
        b.textContent = '🧪 Test';
      }
    };
  });
}

function render() {
  const hasSelection = !!selected;
  $('elementCard').classList.toggle('hidden', !hasSelection);
  $('results').classList.toggle('hidden', !hasSelection);
  if (!hasSelection) return;

  renderElementSummary();
  renderLocators();
}

function updatePomCount() {
  $('pomCount').textContent = `${pomItems.length} element${pomItems.length === 1 ? '' : 's'}`;
}

// ---------- Actions ----------
$('inspectBtn').onclick = async () => {
  try {
    const tab = await getActiveTab();
    const ok = await ensureContentScript(tab.id);
    if (!ok) throw new Error('Content script unavailable');

    await sendToActiveTab({ type: MSG.START });
    setStatus('Inspector active. Hover & click an element. Press Esc to cancel.');
    window.close();
  } catch (e) {
    setStatus(
      'Cannot inspect this page. Try a normal http/https page and reload after installing.',
      'error'
    );
  }
};

$('stopBtn').onclick = async () => {
  try { await sendToActiveTab({ type: MSG.STOP }); } catch {}
  setStatus('Inspector stopped.');
};

$('clearBtn').onclick = async () => {
  selected = null;
  await chrome.storage.local.remove(STORAGE_KEYS.SELECTED);
  $('results').classList.add('hidden');
  $('elementCard').classList.add('hidden');
  setStatus('Cleared current selection.');
};

$('onlyUnique').onchange = (e) => {
  filterUniqueOnly = e.target.checked;
  renderLocators();
};

$('copySummaryBtn').onclick = () => {
  if (!selected) return;
  const lines = [
    `Tag: ${selected.tag}`,
    selected.id ? `ID: ${selected.id}` : null,
    selected.role ? `Role: ${selected.role}` : null,
    selected.ariaName ? `Accessible Name: ${selected.ariaName}` : null,
    selected.text ? `Text: ${selected.text}` : null,
    '',
    'Locators:',
    ...selected.locators.map((l, i) => `${i + 1}. [${classifyScore(l.score).label}] ${l.type} → ${l.code}`),
  ].filter(Boolean).join('\n');
  copy(lines, 'Element summary copied');
};

// ---------- POM ----------
$('addPomBtn').onclick = async () => {
  if (!selected) {
    setStatus('Inspect an element first.', 'error');
    return;
  }
  const best = selected.locators[0];
  if (!best) { setStatus('No locator available.', 'error'); return; }

  const hint =
    selected.ariaName ||
    selected.attributes?.name ||
    selected.attributes?.id ||
    selected.attributes?.['data-testid'] ||
    selected.text ||
    selected.tag;

  pomItems.push({
    name: sanitizeIdentifier(hint, `element${pomItems.length + 1}`),
    locator: best.code.replace(/^page\./, 'this.page.'),
    source: { tag: selected.tag, url: selected.url || '' },
  });

  await savePom();
  setStatus(`Added "${hint.slice(0, 40)}" to POM collector.`, 'success');
};

$('clearPomBtn').onclick = async () => {
  if (!pomItems.length) return;
  if (!confirm('Clear all POM items?')) return;
  pomItems = [];
  await savePom();
  $('pomOutput').value = '';
  setStatus('POM cleared.');
};

$('generatePomBtn').onclick = () => {
  if (!pomItems.length) {
    setStatus('No elements added to POM yet.', 'error');
    return;
  }
  const cls = sanitizeClassName($('className').value || 'GeneratedPage');
  const uniq = uniqueBy(pomItems, x => x.name);

  const props = uniq.map(x => `  readonly ${x.name}: Locator;`).join('\n');
  const assigns = uniq.map(x => `    this.${x.name} = ${x.locator};`).join('\n');

  $('pomOutput').value =
`import { Page, Locator, expect } from '@playwright/test';

/**
 * ${cls}
 * Auto-generated by LocatorX Pro · ${new Date().toISOString().slice(0, 10)}
 * Elements: ${uniq.length}
 */
export class ${cls} {
  readonly page: Page;
${props}

  constructor(page: Page) {
    this.page = page;
${assigns}
  }

  /** Navigate to the page under test. */
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  /** Verify all locators resolve on the current page. */
  async verifyAll(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    for (const name of Object.keys(this)) {
      const value = (this as any)[name];
      if (value && typeof (value as Locator).count === 'function') {
        results[name] = await (value as Locator).count();
      }
    }
    return results;
  }
}
`;
  setStatus(`POM generated with ${uniq.length} locators.`, 'success');
};

$('copyPomBtn').onclick = () => {
  const out = $('pomOutput').value;
  if (!out) { setStatus('Generate POM first.', 'error'); return; }
  copy(out, 'POM copied to clipboard');
};

// ---------- Allure ----------
$('allureBtn').onclick = () => {
  $('allureOutput').value =
`# ─── Install ─────────────────────────────────────────────
npm i -D @playwright/test allure-playwright allure-commandline

# ─── playwright.config.ts ────────────────────────────────
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', {
      outputFolder: 'allure-results',
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        framework: 'Playwright',
        node_version: process.version,
      },
    }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://example.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

# ─── tests/example.spec.ts ───────────────────────────────
import { test, expect } from '@playwright/test';
import { GeneratedPage } from '../pages/GeneratedPage';

test.describe('LocatorX generated flow', () => {
  test('should interact with generated locators', async ({ page }) => {
    const pom = new GeneratedPage(page);

    await test.step('Open application', async () => {
      await pom.goto('/');
    });

    await test.step('Verify locators resolve', async () => {
      const counts = await pom.verifyAll();
      for (const [name, count] of Object.entries(counts)) {
        expect.soft(count, \`\${name} should resolve\`).toBeGreaterThan(0);
      }
    });
  });
});

# ─── Run & report ────────────────────────────────────────
npx playwright test
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
`;
  setStatus('Allure setup generated.', 'success');
};

$('copyAllureBtn').onclick = () => {
  const out = $('allureOutput').value;
  if (!out) { setStatus('Generate setup first.', 'error'); return; }
  copy(out, 'Allure setup copied');
};

// ---------- Message listener ----------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === MSG.ELEMENT_SELECTED) {
    selected = msg.payload;
    render();
    setStatus(
      `Captured <${selected.tag}> with ${selected.locators.length} locators.`,
      'success'
    );
  }
});

// ---------- Init ----------
(async function init() {
  await loadState();
  await refreshPageBadge();
  if (selected) render();
})();