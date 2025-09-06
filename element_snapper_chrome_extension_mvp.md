# Element Snapper – Chrome Extension (MVP)

A simple, privacy‑first Chrome extension to **capture** values from elements on specific sites and **paste** saved variables into target forms. It includes:

- An interactive **Picker Overlay** (like Grammarly’s UI affordance) to click elements on the page and save robust selectors bound to a URL pattern.
- A **Variables** list with CRUD (create, rename, edit value, delete), and an **auto‑copy** toggle with expiry.
- **Sites** management (what you’ve captured per site + URL patterns).
- **Profiles** that map variables → target selectors for quick one‑click paste.

This is an MVP you can load in Chrome (Manifest V3). Files are organized below. Copy each into the same folder, then load via **chrome://extensions** → **Developer mode** → **Load unpacked**.

---

## 📁 File: `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "Element Snapper",
  "version": "0.1.0",
  "description": "Capture values from page elements and paste variables into forms using profiles.",
  "action": {
    "default_title": "Element Snapper",
    "default_popup": "popup.html"
  },
  "icons": {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  },
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "service_worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

> Put placeholder PNGs under `/icons/` or update the paths.

---

## 📁 File: `service_worker.js` (background)
```js
// Element Snapper – background / service worker
// Handles alarms (auto‑copy expiry), central storage utils, and scripting injections.

const STORAGE_KEYS = {
  VARS: 'vars',            // { [varId]: { id, name, value, autoCopyUntil?: number } }
  SITES: 'sites',          // { [siteId]: { id, title, urlPattern, elements: ElementRef[] } }
  PROFILES: 'profiles'     // { [profileId]: { id, name, mappings: Mapping[] } }
};

chrome.runtime.onInstalled.addListener(() => {
  // Initialize empty structures if they don't exist
  chrome.storage.local.get(Object.values(STORAGE_KEYS), (data) => {
    const init = {};
    if (!data[STORAGE_KEYS.VARS]) init[STORAGE_KEYS.VARS] = {};
    if (!data[STORAGE_KEYS.SITES]) init[STORAGE_KEYS.SITES] = {};
    if (!data[STORAGE_KEYS.PROFILES]) init[STORAGE_KEYS.PROFILES] = {};
    if (Object.keys(init).length) chrome.storage.local.set(init);
  });
});

// Handle messages from popup/content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'INJECT_PICKER') {
        // Inject picker overlay into the active tab
        await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ['picker.js']
        });
        sendResponse({ ok: true });
      }
      else if (msg.type === 'GET_SNAPSHOT') {
        // Ask content script to resolve selector on the current page and return value
        const res = await chrome.tabs.sendMessage(sender.tab.id, {
          type: 'RESOLVE_ELEMENT_AND_VALUE',
          payload: msg.payload
        });
        sendResponse(res);
      }
      else if (msg.type === 'PASTE_PROFILE') {
        // Ask content to paste mapping
        const res = await chrome.tabs.sendMessage(sender.tab.id, {
          type: 'PASTE_PROFILE_MAPPINGS',
          payload: msg.payload
        });
        sendResponse(res);
      }
      else if (msg.type === 'GET_ACTIVE_TAB_URL') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ url: tab?.url || '' });
      }
      else if (msg.type === 'SET_ALARM') {
        // msg.payload: { varId, minutes }
        const when = Date.now() + msg.payload.minutes * 60 * 1000;
        await chrome.alarms.create(`var-expiry:${msg.payload.varId}`, {
          when
        });
        sendResponse({ ok: true, expiresAt: when });
      }
      else if (msg.type === 'CLEAR_ALARM') {
        await chrome.alarms.clearAll();
        sendResponse({ ok: true });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // async
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('var-expiry:')) return;
  const varId = alarm.name.split(':')[1];
  const all = await chrome.storage.local.get(STORAGE_KEYS.VARS);
  const vars = all[STORAGE_KEYS.VARS] || {};
  if (vars[varId]) {
    delete vars[varId].autoCopyUntil;
    await chrome.storage.local.set({ [STORAGE_KEYS.VARS]: vars });
  }
});
```

---

## 📁 File: `content.js` (content script – page bridge)
```js
// Runs on every page. Provides get/set helpers and listens for paste/capture requests.

function robustSelector(el) {
  // Build a resilient CSS selector using id, name, data-* and role; fallback to nth-child path
  if (!el || el.nodeType !== 1) return null;
  const parts = [];
  const tag = el.tagName.toLowerCase();

  // Prefer stable attributes
  const attrs = [];
  const id = el.getAttribute('id');
  if (id && !/\d{3,}/.test(id)) attrs.push(`#${CSS.escape(id)}`);
  const name = el.getAttribute('name');
  if (name) attrs.push(`[name="${CSS.escape(name)}"]`);
  const dataTestId = el.getAttribute('data-testid');
  if (dataTestId) attrs.push(`[data-testid="${CSS.escape(dataTestId)}"]`);
  const role = el.getAttribute('role');
  if (role) attrs.push(`[role="${CSS.escape(role)}"]`);

  if (attrs.length) {
    return `${tag}${attrs.join('')}`;
  }

  // Fallback: path with classes (filtered) and nth-child
  const path = [];
  let node = el;
  while (node && node.nodeType === 1 && path.length < 5) {
    let sel = node.tagName.toLowerCase();
    const cls = (node.getAttribute('class') || '')
      .split(/\s+/).filter(c => c && !/\d{3,}/.test(c) && c.length < 40).slice(0,2);
    if (cls.length) sel += '.' + cls.map(c => CSS.escape(c)).join('.');

    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(n => n.tagName === node.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        sel += `:nth-of-type(${idx})`;
      }
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
  if (tag === 'input' || tag === 'textarea') {
    if (type === 'checkbox') {
      el.checked = val === true || String(val).toLowerCase() === 'true';
    } else if (type === 'radio') {
      if (String(el.value) === String(val)) el.checked = true;
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
  // Fallback attempt
  try {
    el.textContent = val ?? '';
    return true;
  } catch { return false; }
}

// Try to resolve a selector robustly within the current document
function resolveSelector(css) {
  try {
    const el = document.querySelector(css);
    return el || null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'RESOLVE_ELEMENT_AND_VALUE') {
    const { selector } = msg.payload;
    const el = resolveSelector(selector);
    const value = getElementValue(el);
    sendResponse({ ok: !!el, value, present: !!el });
  }
  else if (msg.type === 'PASTE_PROFILE_MAPPINGS') {
    const { mappings } = msg.payload; // [{ selector, value }] where value is literal or a variable value already resolved
    const results = [];
    for (const m of mappings) {
      const el = resolveSelector(m.selector);
      const ok = setElementValue(el, m.value);
      results.push({ selector: m.selector, ok });
    }
    sendResponse({ ok: true, results });
  }
  return true;
});

// Expose helpers to picker.js via window
window.__ES_UTILS__ = { robustSelector, getElementValue };
```

---

## 📁 File: `picker.js` (injected on demand – overlay & element capture)
```js
// Lightweight overlay to pick an element and send it back to the extension.
(function() {
  if (window.__ES_PICKER_ACTIVE__) return; // prevent duplicates
  window.__ES_PICKER_ACTIVE__ = true;

  const { robustSelector, getElementValue } = window.__ES_UTILS__ || {};

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';

  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.border = '2px solid #4f8cff';
  box.style.borderRadius = '8px';
  box.style.background = 'rgba(79,140,255,0.08)';
  box.style.pointerEvents = 'none';
  overlay.appendChild(box);

  const badge = document.createElement('div');
  badge.textContent = 'Click to capture • ESC to cancel';
  badge.style.position = 'fixed';
  badge.style.left = '50%';
  badge.style.transform = 'translateX(-50%)';
  badge.style.bottom = '16px';
  badge.style.padding = '8px 12px';
  badge.style.borderRadius = '999px';
  badge.style.background = '#111';
  badge.style.color = '#fff';
  badge.style.font = '12px/1.3 system-ui, sans-serif';
  badge.style.pointerEvents = 'none';
  badge.style.opacity = '0.9';
  overlay.appendChild(badge);

  let currentEl = null;

  function highlight(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === box) return;
    currentEl = el.closest('input, textarea, [contenteditable=""], [contenteditable="true"], select') || el;
    highlight(currentEl);
  }

  function cleanup() {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    window.__ES_PICKER_ACTIVE__ = false;
  }

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentEl) return;
    const selector = robustSelector(currentEl);
    const value = getElementValue(currentEl);
    const url = location.href;
    chrome.runtime.sendMessage({
      type: 'PICKER_RESULT',
      payload: { selector, url, value }
    });
    cleanup();
  }

  function onKey(e) {
    if (e.key === 'Escape') cleanup();
  }

  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKey, true);

  document.documentElement.appendChild(overlay);
})();
```

---

## 📁 File: `popup.html`
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Element Snapper</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header>
    <h1>Element Snapper</h1>
  </header>

  <nav class="tabs">
    <button data-tab="vars" class="active">Variables</button>
    <button data-tab="sites">Sites</button>
    <button data-tab="profiles">Profiles</button>
  </nav>

  <main>
    <section id="tab-vars" class="tab active">
      <div class="toolbar">
        <button id="btn-pick">Pick Element</button>
        <button id="btn-copy-active">Copy from Page</button>
      </div>
      <ul id="vars-list" class="list"></ul>
      <div class="new-row">
        <input id="new-var-name" placeholder="New variable name" />
        <input id="new-var-value" placeholder="Value (optional)" />
        <button id="add-var">Add</button>
      </div>
    </section>

    <section id="tab-sites" class="tab">
      <div class="toolbar">
        <span id="active-url"></span>
      </div>
      <ul id="sites-list" class="list"></ul>
    </section>

    <section id="tab-profiles" class="tab">
      <div class="toolbar">
        <button id="btn-paste-profile">Paste to Page</button>
      </div>
      <ul id="profiles-list" class="list"></ul>
      <div class="new-row">
        <input id="new-profile-name" placeholder="New profile name" />
        <button id="add-profile">Add</button>
      </div>
    </section>
  </main>

  <script src="popup.js"></script>
</body>
</html>
```

---

## 📁 File: `popup.css`
```css
:root { --fg:#eaeef7; --bg:#0b1220; --muted:#9fb3d1; --accent:#6aa0ff; }
*{ box-sizing:border-box }
body{ margin:0; font:13px/1.35 system-ui, sans-serif; color:var(--fg); background:var(--bg); width:360px }
header{ padding:10px 12px; border-bottom:1px solid #1a2438 }
h1{ font-size:14px; margin:0 }
.tabs{ display:flex; gap:4px; padding:8px 8px 0 }
.tabs button{ flex:1; background:#121a2c; color:var(--muted); border:1px solid #1b2540; padding:6px 8px; border-radius:8px 8px 0 0; cursor:pointer }
.tabs button.active{ color:var(--fg); background:#0e1628 }
.tab{ display:none; padding:8px; border:1px solid #1b2540; border-top:none; border-radius:0 8px 8px 8px; background:#0e1628 }
.tab.active{ display:block }
.toolbar{ display:flex; gap:6px; justify-content:space-between; align-items:center; margin-bottom:8px }
.list{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; max-height:300px; overflow:auto }
.card{ border:1px solid #1b2540; border-radius:10px; padding:8px; background:#101a2e }
.row{ display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center }
.row .small{ font-size:12px; color:var(--muted) }
.badge{ padding:2px 6px; border-radius:999px; background:#091227; border:1px solid #1b2540; color:var(--muted); font-size:11px }
button{ background:#17233d; color:var(--fg); border:1px solid #243253; border-radius:8px; padding:6px 8px; cursor:pointer }
button.ghost{ background:transparent; color:var(--muted) }
button.danger{ border-color:#6b2737; background:#2a0e16 }
input{ background:#0c1427; color:var(--fg); border:1px solid #1b2540; border-radius:8px; padding:6px 8px }
.new-row{ display:grid; grid-template-columns:1fr 1fr auto; gap:6px; margin-top:8px }
```

---

## 📁 File: `popup.js`
```js
const KEYS = { VARS: 'vars', SITES: 'sites', PROFILES: 'profiles' };
const byId = (id) => document.getElementById(id);
const $vars = byId('vars-list');
const $sites = byId('sites-list');
const $profiles = byId('profiles-list');

// Tab logic
for (const btn of document.querySelectorAll('.tabs button')) {
  btn.addEventListener('click', () => {
    document.querySelector('.tabs button.active')?.classList.remove('active');
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
    byId(`tab-${tab}`).classList.add('active');
  });
}

// Basic storage helpers
async function getAll() { return new Promise(r => chrome.storage.local.get([KEYS.VARS, KEYS.SITES, KEYS.PROFILES], r)); }
async function set(partial) { return new Promise(r => chrome.storage.local.set(partial, r)); }

// Renderers
async function renderVars() {
  const { [KEYS.VARS]: vars = {} } = await getAll();
  $vars.innerHTML = '';
  Object.values(vars).forEach(v => {
    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
      <div class="row">
        <input value="${v.name}" data-role="name" />
        <input value="${v.value ?? ''}" data-role="value" />
        <div style="display:flex; gap:4px; justify-content:flex-end">
          <button data-role="save">Save</button>
          <button class="ghost" data-role="auto">Auto</button>
          <button class="danger" data-role="del">Del</button>
        </div>
      </div>
      <div class="small">${v.autoCopyUntil ? `auto until ${new Date(v.autoCopyUntil).toLocaleTimeString()}` : 'manual'}</div>
    `;
    // events
    li.querySelector('[data-role="save"]').onclick = async () => {
      const name = li.querySelector('[data-role="name"]').value.trim();
      const value = li.querySelector('[data-role="value"]').value;
      const all = await getAll();
      all[KEYS.VARS][v.id] = { ...v, name, value };
      await set({ [KEYS.VARS]: all[KEYS.VARS] });
      renderVars();
    };
    li.querySelector('[data-role="del"]').onclick = async () => {
      const all = await getAll();
      delete all[KEYS.VARS][v.id];
      await set({ [KEYS.VARS]: all[KEYS.VARS] });
      renderVars();
    };
    li.querySelector('[data-role="auto"]').onclick = async () => {
      const minutes = +prompt('Auto-copy for how many minutes?', '10') || 10;
      const until = Date.now() + minutes * 60 * 1000;
      const all = await getAll();
      all[KEYS.VARS][v.id] = { ...v, autoCopyUntil: until };
      await set({ [KEYS.VARS]: all[KEYS.VARS] });
      chrome.runtime.sendMessage({ type: 'SET_ALARM', payload: { varId: v.id, minutes } });
      renderVars();
    };
    $vars.appendChild(li);
  });
}

async function renderSites() {
  const [{ url }] = await Promise.all([
    new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r))
  ]);
  byId('active-url').textContent = url || '';

  const { [KEYS.SITES]: sites = {} } = await getAll();
  $sites.innerHTML = '';
  Object.values(sites).forEach(s => {
    const li = document.createElement('li');
    li.className = 'card';
    const els = s.elements?.length || 0;
    li.innerHTML = `
      <div class="row">
        <input value="${s.title}" data-role="title" />
        <input value="${s.urlPattern}" data-role="pattern" />
        <div style="display:flex; gap:4px; justify-content:flex-end">
          <button data-role="save">Save</button>
          <button class="danger" data-role="del">Del</button>
        </div>
      </div>
      <div class="small">${els} selectors</div>
    `;
    li.querySelector('[data-role="save"]').onclick = async () => {
      const title = li.querySelector('[data-role="title"]').value.trim();
      const urlPattern = li.querySelector('[data-role="pattern"]').value.trim();
      const all = await getAll();
      all[KEYS.SITES][s.id] = { ...s, title, urlPattern };
      await set({ [KEYS.SITES]: all[KEYS.SITES] });
      renderSites();
    };
    li.querySelector('[data-role="del"]').onclick = async () => {
      const all = await getAll();
      delete all[KEYS.SITES][s.id];
      await set({ [KEYS.SITES]: all[KEYS.SITES] });
      renderSites();
    };
    $sites.appendChild(li);
  });
}

async function renderProfiles() {
  const { [KEYS.PROFILES]: profiles = {} } = await getAll();
  $profiles.innerHTML = '';
  Object.values(profiles).forEach(p => {
    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
      <div class="row">
        <input value="${p.name}" data-role="name" />
        <div style="display:flex; gap:4px; justify-content:flex-end">
          <button data-role="save">Save</button>
          <button class="danger" data-role="del">Del</button>
        </div>
      </div>
      <div class="small">${p.mappings?.length || 0} mappings</div>
      <div style="margin-top:6px; display:flex; gap:6px">
        <button data-role="add-map">+ Mapping</button>
      </div>
      <div class="maps"></div>
    `;
    const mapsWrap = li.querySelector('.maps');

    const redrawMaps = async () => {
      const { [KEYS.PROFILES]: allP = {} } = await getAll();
      const me = allP[p.id];
      mapsWrap.innerHTML = '';
      (me.mappings || []).forEach((m, idx) => {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
          <input value="${m.selector}" placeholder="target selector" data-role="sel-${idx}" />
          <input value="${m.value}" placeholder="literal or {{var:name}}" data-role="val-${idx}" />
          <button class="danger" data-role="rm-${idx}">X</button>
        `;
        div.querySelector(`[data-role="rm-${idx}"]`).onclick = async () => {
          const all = await getAll();
          const mp = (all[KEYS.PROFILES][p.id].mappings || []);
          mp.splice(idx, 1);
          await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
          redrawMaps();
        };
        mapsWrap.appendChild(div);
      });
    };

    li.querySelector('[data-role="add-map"]').onclick = async () => {
      const all = await getAll();
      const mp = all[KEYS.PROFILES][p.id].mappings || (all[KEYS.PROFILES][p.id].mappings = []);
      mp.push({ selector: '', value: '' });
      await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
      redrawMaps();
    };

    li.querySelector('[data-role="save"]').onclick = async () => {
      const name = li.querySelector('[data-role="name"]').value.trim();
      const all = await getAll();
      all[KEYS.PROFILES][p.id] = { ...p, name };
      await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
      renderProfiles();
    };

    li.querySelector('[data-role="del"]').onclick = async () => {
      const all = await getAll();
      delete all[KEYS.PROFILES][p.id];
      await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
      renderProfiles();
    };

    $profiles.appendChild(li);
    redrawMaps();
  });
}

// Add rows
byId('add-var').onclick = async () => {
  const name = byId('new-var-name').value.trim();
  const value = byId('new-var-value').value;
  if (!name) return;
  const id = crypto.randomUUID();
  const all = await getAll();
  all[KEYS.VARS][id] = { id, name, value };
  await set({ [KEYS.VARS]: all[KEYS.VARS] });
  byId('new-var-name').value = '';
  byId('new-var-value').value = '';
  renderVars();
};

byId('add-profile').onclick = async () => {
  const name = byId('new-profile-name').value.trim();
  if (!name) return;
  const id = crypto.randomUUID();
  const all = await getAll();
  all[KEYS.PROFILES][id] = { id, name, mappings: [] };
  await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
  byId('new-profile-name').value = '';
  renderProfiles();
};

// Picker integration
byId('btn-pick').onclick = () => chrome.runtime.sendMessage({ type: 'INJECT_PICKER' });

// Receive picker result and attach it to the current site bucket
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== 'PICKER_RESULT') return;
  const { selector, url, value } = msg.payload;

  // Create/attach site by origin + path wildcard
  const u = new URL(url);
  const pattern = `${u.origin}${u.pathname}*`;
  const title = u.hostname;

  const all = await getAll();
  const sites = all[KEYS.SITES];
  let site = Object.values(sites).find(s => s.urlPattern === pattern);
  if (!site) {
    site = { id: crypto.randomUUID(), title, urlPattern: pattern, elements: [] };
    sites[site.id] = site;
  }
  site.elements.push({ selector, note: '', createdAt: Date.now() });
  await set({ [KEYS.SITES]: sites });

  // Optionally create a variable with the captured value
  const varId = crypto.randomUUID();
  all[KEYS.VARS][varId] = { id: varId, name: selector.split(' ').slice(-1)[0], value };
  await set({ [KEYS.VARS]: all[KEYS.VARS] });

  renderSites();
  renderVars();
});

// Copy from page: resolve selected site element into selected var (prompt)
byId('btn-copy-active').onclick = async () => {
  const all = await getAll();
  const vars = Object.values(all[KEYS.VARS]);
  if (!vars.length) return alert('Create a variable first.');
  const varIdx = prompt(`Which variable index to update?\n${vars.map((v,i)=>`${i}: ${v.name}`).join('\n')}`, '0');
  const choice = vars[+varIdx || 0];
  if (!choice) return;

  // Ask user which selector from current site
  const sites = Object.values(all[KEYS.SITES]);
  const allEls = sites.flatMap(s => s.elements.map(e => ({ site: s, selector: e.selector })));
  if (!allEls.length) return alert('Pick an element first.');
  const elIdx = prompt(`Which element selector index?\n${allEls.map((e,i)=>`${i}: ${e.selector} (${e.site.title})`).join('\n')}`, '0');
  const elChoice = allEls[+elIdx || 0];
  if (!elChoice) return;

  const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_SNAPSHOT', payload: { selector: elChoice.selector } }, r));
  if (!res?.ok) return alert('Could not resolve element on this page.');

  const varsObj = all[KEYS.VARS];
  varsObj[choice.id] = { ...choice, value: res.value };
  await set({ [KEYS.VARS]: varsObj });
  renderVars();
};

// Paste a profile into current page
byId('btn-paste-profile').onclick = async () => {
  const all = await getAll();
  const profiles = Object.values(all[KEYS.PROFILES]);
  if (!profiles.length) return alert('Create a profile first.');
  const idx = +prompt(`Profile index?\n${profiles.map((p,i)=>`${i}: ${p.name}`).join('\n')}`, '0') || 0;
  const profile = profiles[idx];
  if (!profile) return;

  // Resolve template values like {{var:Name}}
  const varsByName = Object.fromEntries(Object.values(all[KEYS.VARS]).map(v => [v.name, v]));
  const mappings = (profile.mappings || []).map(m => {
    const tmpl = String(m.value || '');
    const match = tmpl.match(/^\{\{var:(.+)\}\}$/);
    if (match) {
      const v = varsByName[match[1]];
      return { selector: m.selector, value: v?.value ?? '' };
    }
    return { selector: m.selector, value: tmpl };
  });

  chrome.runtime.sendMessage({ type: 'PASTE_PROFILE', payload: { mappings } }, (res) => {
    if (!res?.ok) alert('Paste failed on this page.');
  });
};

// Initial renders
renderVars();
renderSites();
renderProfiles();
```

---

## 🔐 Storage Shapes (for reference)
```ts
// Variable
interface Var { id: string; name: string; value?: string; autoCopyUntil?: number }

// Site (URL-bounded element selectors)
interface Site { id: string; title: string; urlPattern: string; elements: ElementRef[] }
interface ElementRef { selector: string; note?: string; createdAt: number }

// Profile (mappings for quick paste)
interface Profile { id: string; name: string; mappings: Mapping[] }
interface Mapping { selector: string; value: string /* literal or "{{var:Name}}" */ }
```

---

## 🧪 How to test the MVP
1. Load the folder in **chrome://extensions** → **Load unpacked**.
2. Open any page with inputs (e.g., a demo form).
3. Open the popup → **Pick Element** → click an input on the page.
4. See it appear under **Sites**; a new variable is also created under **Variables**.
5. Hit **Copy from Page** to copy a value from a saved selector into a chosen variable.
6. Create a **Profile**, add a mapping: `selector: input[name=email]`, `value: {{var:YourVarName}}`.
7. Click **Paste to Page** to fill the form.

---

## 🧭 Notes, constraints, and next steps
- **Granular URL matching**: We currently save pattern as `origin + pathname + *`. You can change to hostname‑only or allow user edits.
- **Robust selectors**: The generator prefers `id/name/data-testid/role`. You can swap for XPath or libraries like CSS‑Path.
- **Auto‑copy**: We store an `autoCopyUntil` timestamp and clear it with an alarm; you can extend to auto‑refresh from the page via a MutationObserver.
- **Security/permissions**: We only act on user actions. Avoid auto‑pasting without a click on sensitive domains.
- **UX polish**: Replace prompts with inline UI, drag‑to‑reorder, search/filter, per‑site element notes, etc.
- **Edge cases**: Shadow DOM, iframes, SPA route changes, React controlled inputs (we already dispatch input/change).
- **Sync**: Switch `storage.local` → `storage.sync` if you want cross‑device.
- **Export/Import**: Add backup JSON in options page.
```

