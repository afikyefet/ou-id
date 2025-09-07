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
  } catch { }
  try {
    const hosts = document.querySelectorAll('*');
    for (const host of hosts) {
      if (host.shadowRoot) {
        const found = host.shadowRoot.querySelector(css);
        if (found) return found;
      }
    }
  } catch { }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ pong: true });
    return; // IMPORTANT: don't fall through
  } else if (msg.type === 'RESOLVE_ELEMENT_AND_VALUE') {
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
      results.push({ selector: m.selector, ok, found: !!el });
    }
    // ok = true if all succeeded
    sendResponse({ ok: results.every(r => r.ok), results });
  }
  return true;
});

// Smart element analysis for better picker UX
function analyzeElement(el) {
  if (!el || el.nodeType !== 1) return null;

  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();
  const id = el.getAttribute('id') || '';
  const name = el.getAttribute('name') || '';
  const placeholder = el.getAttribute('placeholder') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const className = el.className?.toString() || '';
  const value = getElementValue(el) || '';

  let category = 'element';
  let purpose = '';
  let confidence = 'low';

  // Analyze by element type and attributes
  if (tag === 'input') {
    if (type === 'email') { category = 'email'; purpose = 'Email field'; confidence = 'high'; }
    else if (type === 'password') { category = 'password'; purpose = 'Password field'; confidence = 'high'; }
    else if (type === 'text') {
      if (/name|first|last/i.test(name + id + placeholder + ariaLabel)) {
        category = 'name'; purpose = 'Name field'; confidence = 'high';
      } else if (/address|street|city|zip/i.test(name + id + placeholder + ariaLabel)) {
        category = 'address'; purpose = 'Address field'; confidence = 'high';
      } else if (/phone|mobile|tel/i.test(name + id + placeholder + ariaLabel)) {
        category = 'phone'; purpose = 'Phone field'; confidence = 'high';
      } else {
        category = 'text'; purpose = 'Text input'; confidence = 'medium';
      }
    }
    else if (type === 'number') { category = 'number'; purpose = 'Number field'; confidence = 'high'; }
    else if (type === 'checkbox') { category = 'checkbox'; purpose = 'Checkbox'; confidence = 'high'; }
    else if (type === 'radio') { category = 'radio'; purpose = 'Radio button'; confidence = 'high'; }
    else if (type === 'submit') { category = 'button'; purpose = 'Submit button'; confidence = 'high'; }
  } else if (tag === 'select') {
    category = 'select'; purpose = 'Dropdown'; confidence = 'high';
  } else if (tag === 'textarea') {
    category = 'textarea'; purpose = 'Text area'; confidence = 'high';
  } else if (tag === 'button') {
    category = 'button'; purpose = 'Button'; confidence = 'high';
  } else if (tag === 'a') {
    category = 'link'; purpose = 'Link'; confidence = 'medium';
  } else if (/h[1-6]/.test(tag)) {
    category = 'heading'; purpose = 'Heading'; confidence = 'medium';
  } else if (el.isContentEditable) {
    category = 'contenteditable'; purpose = 'Editable content'; confidence = 'high';
  }

  // Analyze value content for additional context
  if (value) {
    if (value.includes('@') && value.includes('.')) {
      category = 'email'; purpose = 'Email address'; confidence = 'high';
    } else if (/^\d+$/.test(value)) {
      category = 'number'; purpose = 'Number'; confidence = 'medium';
    } else if (/^\$[\d,]+(\.\d{2})?$/.test(value)) {
      category = 'price'; purpose = 'Price'; confidence = 'high';
    } else if (/\d{4}-\d{2}-\d{2}/.test(value)) {
      category = 'date'; purpose = 'Date'; confidence = 'high';
    }
  }

  return {
    category,
    purpose,
    confidence,
    value: value.substring(0, 50), // Limit for display
    hasValue: !!value
  };
}

// URL change monitoring for auto-copy functionality
let lastUrl = location.href;
let pageLoadTime = Date.now();

function checkForAutoRefresh() {
  // Notify background script of page change for auto-copy variables
  chrome.runtime.sendMessage({
    type: 'PAGE_CHANGED',
    payload: {
      url: location.href,
      timestamp: Date.now(),
      loadTime: pageLoadTime
    }
  }).catch(() => { }); // Ignore errors if extension is not ready
}

// Monitor URL changes (SPA navigation)
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    pageLoadTime = Date.now();
    // Delay to let page content load
    setTimeout(checkForAutoRefresh, 1000);
  }
});

observer.observe(document, { subtree: true, childList: true });

// Also check on initial load and when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkForAutoRefresh, 500);
  });
} else {
  setTimeout(checkForAutoRefresh, 500);
}

// Handle navigation events
window.addEventListener('popstate', () => {
  pageLoadTime = Date.now();
  setTimeout(checkForAutoRefresh, 1000);
});

// Handle hash changes
window.addEventListener('hashchange', () => {
  setTimeout(checkForAutoRefresh, 500);
});

// REMOVE: Page overlay now loads as a content script (CSP-proof)
function injectPageOverlay() {
  /* no-op: overlay is a content script now */
}

// Expose helpers to picker.js and page overlay
window.__ES_UTILS__ = { robustSelector, getElementValue, setElementValue, analyzeElement };
