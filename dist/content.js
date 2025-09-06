// Runs on every page. Provides robust selector/value helpers and resolves/pastes on request.

function robustSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
  
    // Prefer stable attributes first
    const attrs = [];
    const id = el.getAttribute('id');
    if (id && !/\d{3,}/.test(id)) attrs.push(`#${CSS.escape(id)}`);
    const name = el.getAttribute('name');
    if (name) attrs.push(`[name="${CSS.escape(name)}"]`);
    const dataTestId = el.getAttribute('data-testid');
    if (dataTestId) attrs.push(`[data-testid="${CSS.escape(dataTestId)}"]`);
    const role = el.getAttribute('role');
    if (role) attrs.push(`[role="${CSS.escape(role)}"]`);
    if (attrs.length) return `${tag}${attrs.join('')}`;
  
    // Fallback: short DOM path with filtered classes + nth-of-type
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && path.length < 5) {
      let sel = node.tagName.toLowerCase();
      const cls = (node.getAttribute('class') || '')
        .split(/\s+/)
        .filter(c => c && !/\d{3,}/.test(c) && c.length < 40)
        .slice(0, 2);
      if (cls.length) sel += '.' + cls.map(c => CSS.escape(c)).join('.');
  
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(n => n.tagName === node.tagName);
        if (siblings.length > 1) sel += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(sel);
      node = parent;
    }
    return path.join(' > ');
  }
  
  function getElementValue(el) {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'select') return el.value ?? '';
    if (tag === 'input' || tag === 'textarea') {
      if (type === 'checkbox') return el.checked ? 'true' : 'false';
      if (type === 'radio') return el.checked ? el.value : '';
      return el.value ?? '';
    }
    if (el.isContentEditable) return el.innerText;
    return el.textContent?.trim() ?? '';
  }
  
  function setElementValue(el, val) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'select') {
      el.value = val ?? '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (tag === 'input' || tag === 'textarea') {
      if (type === 'checkbox') {
        el.checked = val === true || String(val).toLowerCase() === 'true';
      } else if (type === 'radio') {
        const name = el.getAttribute('name');
        if (name) {
          const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
          for (const r of group) r.checked = String(r.value) === String(val);
        } else {
          if (String(el.value) === String(val)) el.checked = true;
        }
      } else {
        el.value = val ?? '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.isContentEditable) {
      el.innerText = val ?? '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    try {
      el.textContent = val ?? '';
      return true;
    } catch { return false; }
  }
  
  // Resolve selector in document, then shallow shadow roots in this frame
  function resolveSelector(css) {
    try {
      const el = document.querySelector(css);
      if (el) return el;
    } catch {}
    try {
      const hosts = document.querySelectorAll('*');
      for (const host of hosts) {
        if (host.shadowRoot) {
          const found = host.shadowRoot.querySelector(css);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  }
  
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'RESOLVE_ELEMENT_AND_VALUE') {
      const { selector } = msg.payload;
      const el = resolveSelector(selector);
      const value = getElementValue(el);
      sendResponse({ ok: !!el, value, present: !!el });
    } else if (msg.type === 'PASTE_PROFILE_MAPPINGS') {
      const { mappings } = msg.payload; // [{ selector, value }]
      const results = [];
      for (const m of mappings) {
        const el = resolveSelector(m.selector);
        const ok = setElementValue(el, m.value);
        results.push({ selector: m.selector, ok });
      }
      // ok = true if all succeeded
      sendResponse({ ok: results.every(r => r.ok), results });
    }
    return true;
  });
  
  // Expose helpers to picker.js
  window.__ES_UTILS__ = { robustSelector, getElementValue };
  