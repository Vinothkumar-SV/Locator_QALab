export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

export function sanitizeIdentifier(input, fallback = 'element') {
  if (!input) return fallback;
  let x = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[^a-zA-Z_$]+/, '');
  if (!x) return fallback;
  return x[0].toLowerCase() + x.slice(1);
}

export function sanitizeClassName(input, fallback = 'GeneratedPage') {
  const clean = String(input || '').replace(/[^a-zA-Z0-9_$]/g, '');
  if (!clean) return fallback;
  return clean[0].toUpperCase() + clean.slice(1);
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function uniqueBy(arr, keyFn) {
  const seen = new Map();
  return arr.map(item => {
    const key = keyFn(item);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count > 1 ? { ...item, name: `${item.name}${count}` } : item;
  });
}

export async function withRetry(fn, { retries = 2, delay = 150 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; if (i < retries) await new Promise(r => setTimeout(r, delay)); }
  }
  throw lastErr;
}