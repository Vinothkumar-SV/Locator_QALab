/**
 * LocatorX Engine — Runs inside the page.
 * Generates scored Playwright locator candidates for any DOM element.
 * Exposes: window.__LocatorXEngine.analyze(el)
 */
(() => {
  if (window.__LocatorXEngine) return;

  const CSS_ESCAPE = (v) => (window.CSS?.escape ? CSS.escape(String(v)) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));

  const cleanText = (v) => (v || '').replace(/\s+/g, ' ').trim();

  const quote = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

  // ---------- Accessibility helpers ----------
  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    const map = {
      button: 'button', a: el.hasAttribute('href') ? 'link' : null, textarea: 'textbox',
      select: 'combobox', img: 'img', nav: 'navigation', main: 'main',
      header: 'banner', footer: 'contentinfo', aside: 'complementary',
      article: 'article', form: 'form', table: 'table', h1: 'heading', h2: 'heading',
      h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', ul: 'list', ol: 'list',
      li: 'listitem', dialog: 'dialog', summary: 'button', details: 'group',
    };
    if (tag === 'input') {
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'file') return 'file';
      if (['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(type)) return 'textbox';
      return 'textbox';
    }
    return map[tag] || null;
  }

  function accessibleName(el) {
    const aria = cleanText(el.getAttribute('aria-label'));
    if (aria) return aria;

    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const txt = labelledby.split(/\s+/)
        .map(id => document.getElementById(id)?.innerText || '')
        .join(' ');
      if (cleanText(txt)) return cleanText(txt);
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS_ESCAPE(el.id)}"]`);
      if (label && cleanText(label.innerText)) return cleanText(label.innerText);
    }

    const parentLabel = el.closest('label');
    if (parentLabel && cleanText(parentLabel.innerText)) return cleanText(parentLabel.innerText);

    const title = cleanText(el.getAttribute('title'));
    if (title) return title;

    if (el.tagName.toLowerCase() === 'img') return cleanText(el.getAttribute('alt'));

    // input fallback to placeholder / value
    if (el.tagName.toLowerCase() === 'input') {
      return cleanText(el.value) || cleanText(el.getAttribute('placeholder'));
    }

    return cleanText(el.innerText);
  }

  function labelText(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS_ESCAPE(el.id)}"]`);
      if (label) return cleanText(label.innerText);
    }
    const p = el.closest('label');
    return p ? cleanText(p.innerText) : '';
  }

  // ---------- CSS Path (robust) ----------
  function cssPath(el, maxDepth = 6) {
    if (el.id && !/^\d/.test(el.id) && !/\d{5,}/.test(el.id)) return `#${CSS_ESCAPE(el.id)}`;
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-test');
    if (testid) return `[data-testid="${testid.replace(/"/g, '\\"')}"]`;
    const name = el.getAttribute('name');
    if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;

    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < maxDepth) {
      let part = cur.tagName.toLowerCase();
      if (cur.classList.length) {
        const stableClasses = [...cur.classList]
          .filter(c => !/\d{3,}/.test(c) && c.length < 30)
          .slice(0, 2)
          .map(CSS_ESCAPE);
        if (stableClasses.length) part += '.' + stableClasses.join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(x => x.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // ---------- XPath (multiple styles) ----------
  function xpathAbsolute(el) {
    const segments = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let i = 1;
      let sib = cur.previousElementSibling;
      while (sib) { if (sib.tagName === cur.tagName) i++; sib = sib.previousElementSibling; }
      segments.unshift(`${cur.tagName.toLowerCase()}[${i}]`);
      cur = cur.parentElement;
    }
    return '/' + segments.join('/');
  }

  function xpathRelative(el) {
    if (el.id) return `//*[@id=${quote(el.id)}]`;
    const attrs = ['data-testid', 'data-test-id', 'data-test', 'name', 'aria-label', 'placeholder', 'type'];
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v && v.length < 80) return `//${el.tagName.toLowerCase()}[@${a}=${quote(v)}]`;
    }
    const text = cleanText(el.innerText);
    if (text && text.length <= 60) return `//${el.tagName.toLowerCase()}[normalize-space()=${quote(text)}]`;
    // Build a partial relative path from nearest ancestor with id
    const anchor = el.closest('[id]');
    if (anchor) {
      const anchorXpath = `//*[@id=${quote(anchor.id)}]`;
      const chain = [];
      let cur = el;
      while (cur && cur !== anchor) {
        const idx = [...cur.parentElement.children].filter(x => x.tagName === cur.tagName).indexOf(cur) + 1;
        chain.unshift(`${cur.tagName.toLowerCase()}[${idx}]`);
        cur = cur.parentElement;
      }
      return `${anchorXpath}//${chain.join('//')}`;
    }
    return xpathAbsolute(el);
  }

  // ---------- Candidate builder ----------
  function buildCandidates(el) {
    const out = [];
    const role = el.getAttribute('role') || implicitRole(el);
    const name = accessibleName(el);
    const label = labelText(el);
    const ph = cleanText(el.getAttribute('placeholder'));
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-test');
    const text = cleanText(el.innerText);
    const id = el.id;
    const altText = cleanText(el.getAttribute('alt'));
    const title = cleanText(el.getAttribute('title'));
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    // 1. Test ID (most stable)
    if (testid) {
      out.push({ type: 'getByTestId', code: `page.getByTestId(${quote(testid)})`, base: 100, strategy: 'testid', value: testid });
    }

    // 2. Role + accessible name (Playwright best practice)
    if (role && name && name.length <= 80) {
      out.push({
        type: 'getByRole',
        code: `page.getByRole(${quote(role)}, { name: ${quote(name)} })`,
        base: 98, strategy: 'role', value: { role, name }
      });
      if (name.length > 20) {
        out.push({
          type: 'getByRole (regex)',
          code: `page.getByRole(${quote(role)}, { name: /${name.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/ })`,
          base: 92, strategy: 'role-regex', value: { role, name: name.slice(0, 20) }
        });
      }
    }

    // 3. Label
    if (label) {
      out.push({ type: 'getByLabel', code: `page.getByLabel(${quote(label)})`, base: 96, strategy: 'label', value: label });
    }

    // 4. Alt text
    if (altText) {
      out.push({ type: 'getByAltText', code: `page.getByAltText(${quote(altText)})`, base: 94, strategy: 'alt', value: altText });
    }

    // 5. Placeholder
    if (ph) {
      out.push({ type: 'getByPlaceholder', code: `page.getByPlaceholder(${quote(ph)})`, base: 88, strategy: 'placeholder', value: ph });
    }

    // 6. Title
    if (title) {
      out.push({ type: 'getByTitle', code: `page.getByTitle(${quote(title)})`, base: 86, strategy: 'title', value: title });
    }

    // 7. Text
    if (text && text.length <= 80) {
      out.push({ type: 'getByText', code: `page.getByText(${quote(text)}, { exact: true })`, base: 84, strategy: 'text', value: text });
    }

    // 8. ID via locator
    if (id && !/^\d/.test(id)) {
      out.push({ type: 'ID Locator', code: `page.locator(${quote('#' + CSS_ESCAPE(id))})`, base: 82, strategy: 'css', value: '#' + CSS_ESCAPE(id) });
    }

    // 9. input[type=...] scoped by context
    if (tag === 'input' && type) {
      const form = el.closest('form');
      if (form?.id) {
        out.push({
          type: 'Scoped CSS',
          code: `page.locator(${quote(`#${CSS_ESCAPE(form.id)} input[type="${type}"]`)})`,
          base: 78, strategy: 'css', value: `#${CSS_ESCAPE(form.id)} input[type="${type}"]`
        });
      }
    }

    // 10. CSS path
    const css = cssPath(el);
    out.push({ type: 'CSS', code: `page.locator(${quote(css)})`, base: 65, strategy: 'css', value: css });

    // 11. XPath relative
    const xpRel = xpathRelative(el);
    out.push({ type: 'XPath (relative)', code: `page.locator(${quote('xpath=' + xpRel)})`, base: 50, strategy: 'xpath', value: xpRel });

    // 12. XPath absolute (worst)
    const xpAbs = xpathAbsolute(el);
    if (xpAbs !== xpRel) {
      out.push({ type: 'XPath (absolute)', code: `page.locator(${quote('xpath=' + xpAbs)})`, base: 25, strategy: 'xpath', value: xpAbs });
    }

    return out;
  }

  // ---------- Count matching elements for a candidate ----------
  function countCandidate(c) {
    try {
      switch (c.strategy) {
        case 'css': return document.querySelectorAll(c.value).length;
        case 'xpath': {
          const r = document.evaluate(c.value, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return r.snapshotLength;
        }
        case 'testid': return document.querySelectorAll(`[data-testid="${CSS_ESCAPE(c.value)}"],[data-test-id="${CSS_ESCAPE(c.value)}"],[data-test="${CSS_ESCAPE(c.value)}"]`).length;
        case 'placeholder':
          return [...document.querySelectorAll('[placeholder]')].filter(e => e.getAttribute('placeholder') === c.value).length;
        case 'label':
          return [...document.querySelectorAll('label')].filter(l => cleanText(l.innerText) === c.value).length;
        case 'text':
          return [...document.querySelectorAll('body *')].filter(e => cleanText(e.innerText) === c.value).length;
        case 'alt':
          return document.querySelectorAll(`[alt="${CSS_ESCAPE(c.value)}"]`).length;
        case 'title':
          return document.querySelectorAll(`[title="${CSS_ESCAPE(c.value)}"]`).length;
        case 'role':
          return [...document.querySelectorAll('body *')]
            .filter(e => (e.getAttribute('role') || implicitRole(e)) === c.value.role && accessibleName(e) === c.value.name).length;
        case 'role-regex': {
          const re = new RegExp(c.value.name.slice(0, 20));
          return [...document.querySelectorAll('body *')]
            .filter(e => (e.getAttribute('role') || implicitRole(e)) === c.value.role && re.test(accessibleName(e))).length;
        }
        default: return -1;
      }
    } catch { return -1; }
  }

  // ---------- Scoring ----------
  function dynamicPenalty(c) {
    const s = JSON.stringify(c.value);
    let p = 0;
    if (/\d{5,}/.test(s)) p += 15;
    if (/[a-f0-9]{12,}/i.test(s)) p += 15;
    if (/nth-of-type/.test(s)) p += 20;
    if (/^\/html/.test(s)) p += 30;
    if (c.strategy === 'xpath' && /\/\*\d+/.test(s)) p += 10;
    return p;
  }

  function analyze(el) {
    const candidates = buildCandidates(el).map(c => {
      const count = countCandidate(c);
      let score = c.base - dynamicPenalty(c);
      if (count === 1) score += 5;
      else if (count === 0) score -= 50;
      else if (count > 1) score -= Math.min(40, 10 + count * 2);
      score = Math.max(0, Math.min(100, score));
      return { ...c, count, score };
    });

    // Deduplicate identical codes
    const seen = new Set();
    const unique = candidates.filter(c => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });

    return unique.sort((a, b) => b.score - a.score);
  }

  function summarizeElement(el) {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;

    // CSS path for the element
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classList: [...el.classList],
      text: cleanText(el.innerText || el.value).slice(0, 240),
      attributes: attrs,
      role: el.getAttribute('role') || implicitRole(el),
      ariaName: accessibleName(el),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      locators: analyze(el),
      timestamp: Date.now(),
      url: location.href,
      title: document.title,
    };
  }

  window.__LocatorXEngine = Object.freeze({
    analyze,
    countCandidate,
    summarizeElement,
    accessibleName,
    implicitRole,
  });
})();