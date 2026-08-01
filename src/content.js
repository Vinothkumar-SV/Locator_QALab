(() => {
  if (window.__locatorXLoaded) return;
  window.__locatorXLoaded = true;

  let inspecting = false;
  let hovered = null;
  let previousOutline = "";

  function cssEscape(v) {
    return CSS.escape(String(v));
  }

  function cleanText(v) {
    return (v || "").replace(/\s+/g, " ").trim();
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "img") return "img";
    if (tag === "input") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (["button","submit","reset"].includes(t)) return "button";
      if (["checkbox"].includes(t)) return "checkbox";
      if (["radio"].includes(t)) return "radio";
      if (["text","email","password","search","tel","url","number"].includes(t)) return "textbox";
    }
    return null;
  }

  function accessibleName(el) {
    const aria = cleanText(el.getAttribute("aria-label"));
    if (aria) return aria;
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const txt = labelledby.split(/\s+/).map(id => document.getElementById(id)?.innerText || "").join(" ");
      if (cleanText(txt)) return cleanText(txt);
    }
    if (el.id) {
      const label = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (label && cleanText(label.innerText)) return cleanText(label.innerText);
    }
    const parentLabel = el.closest("label");
    if (parentLabel && cleanText(parentLabel.innerText)) return cleanText(parentLabel.innerText);
    if (el.tagName.toLowerCase() === "img") return cleanText(el.getAttribute("alt"));
    return cleanText(el.innerText || el.value);
  }

  function labelText(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (label) return cleanText(label.innerText);
    }
    const p = el.closest("label");
    return p ? cleanText(p.innerText) : "";
  }

  function quote(v) {
    return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }

  function cssPath(el) {
    if (el.id) return `#${cssEscape(el.id)}`;
    const testid = el.getAttribute("data-testid");
    if (testid) return `[data-testid="${testid.replace(/"/g,'\\"')}"]`;
    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g,'\\"')}"]`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      let part = cur.tagName.toLowerCase();
      if (cur.classList.length) part += "." + [...cur.classList].slice(0,2).map(cssEscape).join(".");
      const siblings = cur.parentElement ? [...cur.parentElement.children].filter(x => x.tagName === cur.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur)+1})`;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function xpath(el) {
    if (el.id) return `//*[@id=${quote(el.id)}]`;
    const attrs = ["data-testid","name","aria-label","placeholder"];
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v) return `//${el.tagName.toLowerCase()}[@${a}=${quote(v)}]`;
    }
    const text = cleanText(el.innerText);
    if (text && text.length <= 80) return `//${el.tagName.toLowerCase()}[normalize-space()=${quote(text)}]`;
    const segments = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let i = 1;
      let sib = cur.previousElementSibling;
      while (sib) { if (sib.tagName === cur.tagName) i++; sib = sib.previousElementSibling; }
      segments.unshift(`${cur.tagName.toLowerCase()}[${i}]`);
      cur = cur.parentElement;
    }
    return "/" + segments.join("/");
  }

  function candidates(el) {
    const out = [];
    const role = el.getAttribute("role") || implicitRole(el);
    const name = accessibleName(el);
    const label = labelText(el);
    const ph = cleanText(el.getAttribute("placeholder"));
    const testid = el.getAttribute("data-testid");
    const text = cleanText(el.innerText);
    const id = el.id;

    if (role && name) out.push({type:"getByRole", code:`page.getByRole(${quote(role)}, { name: ${quote(name)} })`, base:100, strategy:"role", value:{role,name}});
    if (label) out.push({type:"getByLabel", code:`page.getByLabel(${quote(label)})`, base:96, strategy:"label", value:label});
    if (testid) out.push({type:"getByTestId", code:`page.getByTestId(${quote(testid)})`, base:95, strategy:"testid", value:testid});
    if (ph) out.push({type:"getByPlaceholder", code:`page.getByPlaceholder(${quote(ph)})`, base:86, strategy:"placeholder", value:ph});
    if (text && text.length <= 80) out.push({type:"getByText", code:`page.getByText(${quote(text)}, { exact: true })`, base:80, strategy:"text", value:text});
    if (id) out.push({type:"ID / CSS", code:`page.locator(${quote("#"+cssEscape(id))})`, base:80, strategy:"css", value:"#"+cssEscape(id)});
    const css = cssPath(el);
    out.push({type:"CSS", code:`page.locator(${quote(css)})`, base:65, strategy:"css", value:css});
    const xp = xpath(el);
    out.push({type:"XPath", code:`page.locator(${quote(xp)})`, base:40, strategy:"xpath", value:xp});
    return out;
  }

  function countCandidate(c) {
    try {
      if (c.strategy === "css") return document.querySelectorAll(c.value).length;
      if (c.strategy === "xpath") {
        const r = document.evaluate(c.value, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return r.snapshotLength;
      }
      if (c.strategy === "testid") return document.querySelectorAll(`[data-testid="${CSS.escape(c.value)}"]`).length;
      if (c.strategy === "placeholder") return [...document.querySelectorAll("[placeholder]")].filter(e => e.getAttribute("placeholder") === c.value).length;
      if (c.strategy === "label") return [...document.querySelectorAll("label")].filter(l => cleanText(l.innerText) === c.value).length;
      if (c.strategy === "text") return [...document.querySelectorAll("body *")].filter(e => cleanText(e.innerText) === c.value).length;
      if (c.strategy === "role") return [...document.querySelectorAll("body *")].filter(e => (e.getAttribute("role") || implicitRole(e)) === c.value.role && accessibleName(e) === c.value.name).length;
    } catch {}
    return -1;
  }

  function dynamicPenalty(c) {
    const s = JSON.stringify(c.value);
    let p = 0;
    if (/\d{5,}/.test(s)) p += 15;
    if (/[a-f0-9]{12,}/i.test(s)) p += 15;
    if (/nth-of-type/.test(s)) p += 20;
    if (c.strategy === "xpath" && s.startsWith('"/html')) p += 25;
    return p;
  }

  function analyze(el) {
    return candidates(el).map(c => {
      const count = countCandidate(c);
      let score = c.base - dynamicPenalty(c);
      if (count === 1) score += 0;
      else if (count === 0) score -= 45;
      else if (count > 1) score -= Math.min(35, 10 + count);
      score = Math.max(0, Math.min(100, score));
      const quality = score >= 90 ? "BEST" : score >= 70 ? "GOOD" : score >= 45 ? "FRAGILE" : "AVOID";
      return {...c, count, score, quality};
    }).sort((a,b) => b.score-a.score);
  }

  function summary(el) {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    return {
      tag: el.tagName.toLowerCase(),
      text: cleanText(el.innerText || el.value).slice(0,160),
      attributes: attrs,
      locators: analyze(el)
    };
  }

  function restore() {
    if (hovered) hovered.style.outline = previousOutline;
    hovered = null;
  }

  function onMove(e) {
    if (!inspecting) return;
    e.preventDefault(); e.stopPropagation();
    if (hovered === e.target) return;
    restore();
    hovered = e.target;
    previousOutline = hovered.style.outline;
    hovered.style.outline = "3px solid #7c3aed";
  }

  function onClick(e) {
    if (!inspecting) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const el = e.target;
    stop();
    chrome.runtime.sendMessage({type:"LOCATORX_SELECTED", payload:summary(el)});
  }

  function start() {
    inspecting = true;
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
  }
  function stop() {
    inspecting = false; restore();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "LOCATORX_START") { start(); sendResponse({ok:true}); }
    if (msg.type === "LOCATORX_STOP") { stop(); sendResponse({ok:true}); }
    if (msg.type === "LOCATORX_TEST") {
      const c = msg.candidate;
      sendResponse({ok:true, count:countCandidate(c)});
    }
  });
})();