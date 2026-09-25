import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS, classifyScore } from '../shared/constants.js';
import { escapeHtml, sanitizeIdentifier, sanitizeClassName, uniqueBy } from '../shared/utils.js';
import { sendToActiveTab, getActiveTab, ensureContentScript } from '../shared/messaging.js';
import {
  ACTION_KIND, SEVERITY, DEFAULT_SEVERITY,
  renderStepBody, stepTitle, slugMethodName,
} from '../shared/action-model.js';

// ---------- State ----------
let selected = null;
let pomItems = [];
let settings = { ...DEFAULT_SETTINGS };
let filterUniqueOnly = false;

let recordedSteps = [];
let recording = false;

const $ = (id) => document.getElementById(id);
const status = $('status');

// ---------- Status / toast ----------
function setStatus(text, kind = 'info') {
  if (!status) return;
  status.textContent = text;
  status.style.color =
    kind === 'error' ? 'var(--danger)' :
    kind === 'success' ? 'var(--success)' :
    '#536078';
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
  try { await navigator.clipboard.writeText(text); toast(label, 'success'); }
  catch { toast('Clipboard blocked', 'error'); }
}

// ---------- Storage ----------
async function loadState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.SELECTED, STORAGE_KEYS.POM, STORAGE_KEYS.SETTINGS,
  ]);
  if (data[STORAGE_KEYS.SELECTED]) selected = data[STORAGE_KEYS.SELECTED];
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
  if (!badge) return;
  if (!tab?.url) { badge.textContent = '—'; return; }
  try {
    const u = new URL(tab.url);
    badge.textContent = u.hostname.replace(/^www\./, '') || u.protocol;
    badge.title = tab.url;
  } catch {
    badge.textContent = tab.url.split(':')[0] || '—';
  }
}

// ============================================================
// LOCATOR LIST (inspector results) — same as v2
// ============================================================
function renderElementSummary() {
  if (!selected) return;
  const s = selected;
  const attrLine = Object.entries(s.attributes || {})
    .slice(0, 8)
    .map(([k, v]) => `${k}="${String(v).length > 60 ? String(v).slice(0, 60) + '…' : v}"`)
    .join('  ');
  const role = s.role ? `  role="${s.role}"` : '';
  const aria = s.ariaName ? `  aria-name="${s.ariaName}"` : '';
  $('elementSummary').textContent =
    `<${s.tag}${s.id ? ` id="${s.id}"` : ''}${role}${aria}>\n` +
    attrLine +
    (s.text ? `\n\n"${s.text.slice(0, 160)}"` : '');
}
function qualityClass(score) { return classifyScore(score).label.toLowerCase(); }

function renderLocators() {
  const list = $('locatorList');
  if (!list) return;
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
    const countLabel =
      l.count === 1 ? '<span class="ok">✓ Unique</span>' :
      l.count > 1   ? `<span class="warn">⚠ ${l.count} matches</span>` :
                      '<span class="err">✗ Not found</span>';
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
        <button data-use="${i}">📌 Use in Recorder</button>
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
      b.disabled = true; b.textContent = '…';
      try {
        const r = await sendToActiveTab({ type: MSG.TEST_LOCATOR, candidate: l });
        setStatus(`${l.type}: ${r?.count ?? '?'} matching element(s)`,
          r?.count === 1 ? 'success' : 'info');
      } catch { setStatus('Unable to test on this page.', 'error'); }
      finally { b.disabled = false; b.textContent = '🧪 Test'; }
    };
  });
  list.querySelectorAll('[data-use]').forEach(b => {
    b.onclick = () => {
      const l = locators[+b.dataset.use];
      recordedSteps.push({
        id: 's_' + Math.random().toString(36).slice(2, 10),
        kind: ACTION_KIND.CLICK,
        locatorCode: l.code,
        label: selected.ariaName || selected.text || selected.tag,
        value: '',
        url: selected.url || '',
        timestamp: Date.now(),
      });
      renderRecorderSteps();
      toast('Added to recorder');
    };
  });
}

function render() {
  const hasSelection = !!selected;
  $('elementCard').classList.toggle('hidden', !hasSelection);
  $('results').classList.toggle('hidden', !hasSelection);
  if (hasSelection) { renderElementSummary(); renderLocators(); }
}

function updatePomCount() {
  $('pomCount').textContent = `${pomItems.length} element${pomItems.length === 1 ? '' : 's'}`;
}

// ============================================================
// INSPECT BUTTON
// ============================================================
$('inspectBtn').onclick = async () => {
  const btn = $('inspectBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Starting…';
  setStatus('Preparing inspector…');
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active tab');
    const url = tab.url || '';
    if (!/^https?:|^file:/.test(url)) {
      throw new Error(`Cannot inspect "${url.split(':')[0] || 'this'}" pages. Open a normal http/https site.`);
    }
    let alive = false;
    try {
      const pong = await chrome.tabs.sendMessage(tab.id, { type: MSG.PING }, { frameId: 0 });
      alive = !!pong?.ok;
    } catch {}
    if (!alive) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: [
          'src/content/locator-engine.js',
          'src/content/action-recorder.js',
          'src/content/content.js',
        ],
      });
      await new Promise(r => setTimeout(r, 100));
    }
    const reply = await chrome.tabs.sendMessage(tab.id, { type: MSG.START_INSPECT }, { frameId: 0 });
    if (!reply?.ok) throw new Error(reply?.error || 'Content script refused to start.');
    setStatus('Inspector active. Hover & click an element. Press Esc to cancel.', 'success');
    setTimeout(() => window.close(), 150);
  } catch (e) {
    setStatus(e.message || 'Could not start inspector.', 'error');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
};

$('stopBtn').onclick = async () => {
  try { await sendToActiveTab({ type: MSG.STOP_INSPECT }); } catch {}
  setStatus('Inspector stopped.');
};

$('clearBtn').onclick = async () => {
  selected = null;
  await chrome.storage.local.remove(STORAGE_KEYS.SELECTED);
  $('results').classList.add('hidden');
  $('elementCard').classList.add('hidden');
  setStatus('Cleared current selection.');
};

$('onlyUnique').onchange = (e) => { filterUniqueOnly = e.target.checked; renderLocators(); };

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

// ============================================================
// RECORDER
// ============================================================
function kindClass(k) {
  return String(k || '').replace(/[^a-z]/gi, '').toLowerCase();
}

function renderRecorderSteps() {
  const wrap = $('recSteps');
  $('recCount').textContent = `${recordedSteps.length} step${recordedSteps.length === 1 ? '' : 's'}`;
  if (!recordedSteps.length) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  wrap.innerHTML = '';
  recordedSteps.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'rec-step';
    div.innerHTML = `
      <span class="idx">${i + 1}</span>
      <span class="kind ${kindClass(s.kind)}">${escapeHtml(s.kind)}</span>
      <span class="body">
        <strong>${escapeHtml(s.label || s.locatorCode || s.kind)}</strong>
        ${s.value ? ` — <em>${escapeHtml(String(s.value).slice(0, 60))}</em>` : ''}
      </span>
      <button class="del" title="Delete step">✕</button>
    `;
    div.querySelector('.del').onclick = () => {
      recordedSteps.splice(i, 1);
      renderRecorderSteps();
    };
    wrap.appendChild(div);
  });
}

$('recStartBtn').onclick = async () => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active tab');
    const url = tab.url || '';
    if (!/^https?:|^file:/.test(url)) {
      throw new Error('Open a normal http:// or https:// page before recording.');
    }
    // Inject content scripts if needed
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MSG.PING }, { frameId: 0 });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: [
          'src/content/locator-engine.js',
          'src/content/action-recorder.js',
          'src/content/content.js',
        ],
      });
      await new Promise(r => setTimeout(r, 120));
    }
    recordedSteps = [];
    const reply = await chrome.tabs.sendMessage(tab.id, { type: MSG.REC_START }, { frameId: 0 });
    if (!reply?.ok) throw new Error(reply?.error || 'Failed to start recorder.');
    recording = true;
    $('recStartBtn').disabled = true;
    $('recStopBtn').disabled = false;
    $('recStatus').innerHTML =
      '<span class="rec-live-dot"></span> Recording… interact with the page.';
    $('recStatus').style.color = 'var(--success)';
    renderRecorderSteps();
    toast('Recorder started', 'success');
  } catch (e) {
    $('recStatus').textContent = e.message || 'Failed to start recorder.';
    $('recStatus').style.color = 'var(--danger)';
  }
};

$('recStopBtn').onclick = async () => {
  try {
    const reply = await sendToActiveTab({ type: MSG.REC_STOP });
    if (reply?.steps) recordedSteps = reply.steps;
  } catch {}
  recording = false;
  $('recStartBtn').disabled = false;
  $('recStopBtn').disabled = true;
  $('recStatus').textContent = `Stopped. ${recordedSteps.length} step(s) captured.`;
  $('recStatus').style.color = '#536078';
  renderRecorderSteps();
};

$('recClearBtn').onclick = async () => {
  recordedSteps = [];
  try { await sendToActiveTab({ type: MSG.REC_CLEAR }); } catch {}
  renderRecorderSteps();
  $('recStatus').textContent = 'Idle. Click Record and interact with the page.';
  $('recStatus').style.color = '#536078';
};

$('recGenPomBtn').onclick = () => {
  if (!recordedSteps.length) { setStatus('Nothing recorded yet.', 'error'); return; }
  const cls = sanitizeClassName($('className').value || 'RecordedPage');
  const code = buildAllurePom({
    className: cls,
    steps: recordedSteps,
    suite: $('recSuite').value || 'LocatorX Recorded Flows',
    epic: $('recEpic').value || 'LocatorX',
    testName: $('recTestName').value || 'Recorded user journey',
  });
  $('pomOutput').value = code;
  setStatus(`Recorded POM generated (${recordedSteps.length} steps).`, 'success');
};

$('recGenTestBtn').onclick = () => {
  if (!recordedSteps.length) { setStatus('Nothing recorded yet.', 'error'); return; }
  const cls = sanitizeClassName($('className').value || 'RecordedPage');
  const code = buildAllureTest({
    className: cls,
    testName: $('recTestName').value || 'Recorded user journey',
    suite: $('recSuite').value || 'LocatorX Recorded Flows',
    epic: $('recEpic').value || 'LocatorX',
    steps: recordedSteps,
  });
  $('allureOutput').value = code;
  setStatus('Allure test generated.', 'success');
};

// ============================================================
// ALLURE-ANNOTATED POM GENERATOR
// ============================================================
/**
 * Build a full Page Object with:
 * - @allure.step on every action
 * - @allure.description with a bullet list of steps
 * - @allure.severity per step (as a comment + annotation of the method group)
 * - deduplicated method names
 * - readonly locators for every element used
 */
function buildAllurePom({ className, steps, suite, epic, testName }) {
  // 1. Collect unique locators → property names
  const locatorMap = new Map(); // code → { name, label }
  steps.forEach(s => {
    if (!s.locatorCode) return;
    if (locatorMap.has(s.locatorCode)) return;
    const base = sanitizeIdentifier(
      s.ariaName || s.label || s.locatorCode,
      'element'
    );
    locatorMap.set(s.locatorCode, { name: base, label: s.label || base });
  });

  // Deduplicate names
  const nameCount = {};
  const locatorEntries = [];
  for (const [code, info] of locatorMap.entries()) {
    let n = info.name;
    nameCount[n] = (nameCount[n] || 0) + 1;
    if (nameCount[n] > 1) n = `${n}${nameCount[n]}`;
    locatorEntries.push({ code, name: n, label: info.label });
  }
  const locatorByName = new Map(locatorEntries.map(e => [e.code, e.name]));

  // 2. Rewrite each step's locator expression to this.<name>
  const enriched = steps.map((s, i) => {
    const propName = s.locatorCode ? locatorByName.get(s.locatorCode) : null;
    const locatorExpr = propName ? `this.${propName}` : 'this.page';
    const body = renderStepBody({ ...s, locatorCode: null, __expr: locatorExpr })
      .replace(/this\.page\./g, 'this.page.');
    return { step: s, index: i, propName, locatorExpr, body, title: stepTitle(s) };
  });

  // 3. Build method names (dedup)
  const methodSeen = {};
  const methods = enriched.map((e, i) => {
    let m = e.step.name || slugMethodName(e.step);
    methodSeen[m] = (methodSeen[m] || 0) + 1;
    if (methodSeen[m] > 1) m = `${m}${methodSeen[m]}`;
    const severity = DEFAULT_SEVERITY[e.step.kind] || SEVERITY.NORMAL;
    const body = renderStepBody({
      ...e.step,
      // swap locatorCode for a this.<prop> reference
      locatorCode: e.propName ? `this.${e.propName}` : '',
    });
    return {
      index: i,
      name: m,
      step: e.step,
      title: e.title,
      severity,
      body,
    };
  });

  // 4. Assemble properties & constructor
  const props = locatorEntries
    .map(e => `  readonly ${e.name}: Locator;`)
    .join('\n');
  const assigns = locatorEntries
    .map(e => `    this.${e.name} = ${e.code.replace(/^page\./, 'this.page.')};`)
    .join('\n');

  // 5. Assemble step methods
  const methodsCode = methods.map(m => `
  /**
   * Step ${m.index + 1}: ${m.title}
   * @allure.step
   * @allure.severity ${m.severity}
   */
  @allure.step(${JSON.stringify(m.title)})
  async ${m.name}(): Promise<void> {
    ${m.body}
  }`).join('\n');

  // 6. Description bullets
  const bullets = methods
    .map(m => ` *   - ${m.index + 1}. ${m.title}`)
    .join('\n');

  const date = new Date().toISOString().slice(0, 10);

  return `import { Page, Locator, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

/**
 * ${className}
 * Auto-generated by LocatorX Pro · ${date}
 *
 * @allure.suite ${suite}
 * @allure.epic ${epic}
 * @allure.feature ${className}
 * @allure.story ${testName}
 *
 * Recorded steps:
${bullets}
 */
export class ${className} {
  readonly page: Page;
${props}

  constructor(page: Page) {
    this.page = page;
${assigns}
  }

  /**
   * Navigate to a URL.
   * @allure.step Navigate to {url}
   */
  @allure.step('Navigate to {url}')
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }
${methodsCode}

  /**
   * Verify every recorded locator resolves at least once.
   * @allure.step Verify all locators resolve
   */
  @allure.step('Verify all locators resolve')
  async verifyAll(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
${locatorEntries.map(e => `    results['${e.name}'] = await this.${e.name}.count();`).join('\n')}
    return results;
  }

  /**
   * Run the recorded journey end-to-end.
   * @allure.step Run recorded journey
   */
  @allure.step('Run recorded journey')
  async runRecordedJourney(): Promise<void> {
${methods.map(m => `    await this.${m.name}();`).join('\n')}
  }
}
`;
}

// ============================================================
// ALLURE-ANNOTATED TEST GENERATOR
// ============================================================
function buildAllureTest({ className, testName, suite, epic, steps }) {
  const body = steps.map((s, i) => {
    const title = stepTitle(s);
    const locator = s.locatorCode
      ? s.locatorCode.replace(/^page\./, 'page.')
      : 'page';
    const expr = s.locatorCode ? locator : null;

    const q = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    let line;
    switch (s.kind) {
      case ACTION_KIND.NAVIGATE:      line = `await page.goto(${q(s.value)});`; break;
      case ACTION_KIND.CLICK:         line = `await ${expr}.click();`; break;
      case ACTION_KIND.FILL:          line = `await ${expr}.fill(${q(s.value)});`; break;
      case ACTION_KIND.CLEAR:         line = `await ${expr}.clear();`; break;
      case ACTION_KIND.TYPE:          line = `await ${expr}.pressSequentially(${q(s.value)});`; break;
      case ACTION_KIND.PRESS:         line = `await ${expr}.press(${q(s.value)});`; break;
      case ACTION_KIND.CHECK:         line = `await ${expr}.check();`; break;
      case ACTION_KIND.UNCHECK:       line = `await ${expr}.uncheck();`; break;
      case ACTION_KIND.SELECT:        line = `await ${expr}.selectOption(${q(s.value)});`; break;
      case ACTION_KIND.HOVER:         line = `await ${expr}.hover();`; break;
      case ACTION_KIND.FOCUS:         line = `await ${expr}.focus();`; break;
      case ACTION_KIND.BLUR:          line = `await ${expr}.blur();`; break;
      case ACTION_KIND.UPLOAD:        line = `await ${expr}.setInputFiles(${q(s.value)});`; break;
      case ACTION_KIND.WAIT:          line = `await page.waitForTimeout(${Number(s.value) || 0});`; break;
      case ACTION_KIND.SCROLL:        line = `await ${expr}.scrollIntoViewIfNeeded();`; break;
      case ACTION_KIND.ASSERT_TEXT:   line = `await expect(${expr}).toHaveText(${q(s.value)});`; break;
      case ACTION_KIND.ASSERT_VISIBLE:line = `await expect(${expr}).toBeVisible();`; break;
      case ACTION_KIND.ASSERT_COUNT:  line = `await expect(${expr}).toHaveCount(${Number(s.value) || 1});`; break;
      default:                        line = `// TODO: handle ${s.kind}`;
    }
    return `    await test.step(${q(`${i + 1}. ${title}`)}, async () => {
      ${line}
    });`;
  }).join('\n\n');

  return `import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { Severity } from 'allure-js-commons';
import { ${className} } from '../pages/${className}';

/**
 * ${testName}
 * Auto-generated by LocatorX Pro · ${new Date().toISOString().slice(0, 10)}
 */
test.describe('${suite}', () => {
  test.beforeEach(async () => {
    await allure.epic('${epic}');
    await allure.feature('${className}');
    await allure.story('${testName}');
    await allure.severity(Severity.CRITICAL);
    await allure.owner('LocatorX');
    await allure.tag('recorded');
    await allure.tag('playwright');
    await allure.link('https://github.com/Vinothkumar-SV', 'LocatorX', 'github');
  });

  test('${testName}', async ({ page }, testInfo) => {
    const pom = new ${className}(page);

    await allure.step('Attach environment info', async () => {
      await testInfo.attach('environment', {
        body: JSON.stringify({
          baseURL: testInfo.project.use.baseURL,
          browser: testInfo.project.name,
          os: process.platform,
          node: process.version,
        }, null, 2),
        contentType: 'application/json',
      });
    });

${body}

    await allure.step('Verify every locator resolves', async () => {
      const counts = await pom.verifyAll();
      for (const [name, count] of Object.entries(counts)) {
        await allure.step(\`Verify "\${name}" resolves\`, async () => {
          expect.soft(count, \`\${name} should resolve\`).toBeGreaterThan(0);
        });
      }
    });
  });
});
`;
}

// ============================================================
// MESSAGE LISTENER — recorder ticks + inspector selections
// ============================================================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === MSG.ELEMENT_SELECTED) {
    selected = msg.payload;
    render();
    setStatus(`Captured <${selected.tag}> with ${selected.locators?.length || 0} locators.`, 'success');
  }
  if (msg?.type === MSG.REC_TICK) {
    // Content script pushed a new step; re-fetch to stay in sync
    refreshRecorderSteps();
  }
});

async function refreshRecorderSteps() {
  try {
    const r = await sendToActiveTab({ type: MSG.REC_GET });
    if (r?.ok && Array.isArray(r.steps)) {
      recordedSteps = r.steps;
      recording = !!r.recording;
      $('recStartBtn').disabled = recording;
      $('recStopBtn').disabled = !recording;
      renderRecorderSteps();
    }
  } catch { /* ignore */ }
}

// ============================================================
// CLASSIC POM BUTTON (kept for the inspector-only flow)
// ============================================================
$('addPomBtn').onclick = async () => {
  if (!selected) { setStatus('Inspect an element first.', 'error'); return; }
  const best = selected.locators[0];
  if (!best) { setStatus('No locator available.', 'error'); return; }
  const hint = selected.ariaName || selected.attributes?.name || selected.attributes?.id
    || selected.attributes?.['data-testid'] || selected.text || selected.tag;
  pomItems.push({
    name: sanitizeIdentifier(hint, `element${pomItems.length + 1}`),
    locator: best.code.replace(/^page\./, 'this.page.'),
    source: { tag: selected.tag, url: selected.url || '' },
  });
  await savePom();
  setStatus(`Added "${String(hint).slice(0, 40)}" to POM collector.`, 'success');
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
  // If we have recorder steps, prefer the Allure version
  if (recordedSteps.length) {
    $('recGenPomBtn').click();
    return;
  }
  if (!pomItems.length) { setStatus('No elements added to POM yet.', 'error'); return; }
  const cls = sanitizeClassName($('className').value || 'GeneratedPage');
  const uniq = uniqueBy(pomItems, x => x.name);
  const props = uniq.map(x => `  readonly ${x.name}: Locator;`).join('\n');
  const assigns = uniq.map(x => `    this.${x.name} = ${x.locator};`).join('\n');
  $('pomOutput').value = `import { Page, Locator, expect } from '@playwright/test';

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

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

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

// ============================================================
// ALLURE SETUP BUTTON
// ============================================================
$('allureBtn').onclick = () => {
  $('allureOutput').value =
`# ─── Install ─────────────────────────────────────────────
npm i -D @playwright/test allure-playwright allure-commandline allure-js-commons

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
  copy(out, 'Copied');
};

// ============================================================
// INIT
// ============================================================
(async function init() {
  try {
    await loadState();
    await refreshPageBadge();
    if (selected) render();
    renderRecorderSteps();
  } catch (e) {
    console.error('[LocatorX] init failed:', e);
  }
})();