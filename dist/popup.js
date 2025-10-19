// Standardized storage keys matching service worker
const STORAGE_KEYS = {
    VARS: 'vars',            // { [varId]: { id, name, value, autoCopyUntil?: number, sourceSelector?: string, sourceSiteId?: string, lastUpdated?: number } }
    SITES: 'sites',          // { [siteId]: { id, title, urlPattern, elements: ElementRef[] } }
    PROFILES: 'profiles',    // { [profileId]: { id, name, sitePattern, inputs: Mapping[] } }
    OVERLAY_ENABLED: 'overlayEnabled'  // boolean
};
const KEYS = STORAGE_KEYS; // Backward compatibility
const byId = (id) => document.getElementById(id);
const $vars = byId('vars-list');
const $sites = byId('sites-list');
const $profiles = byId('profiles-list');
// When picking a selector for a specific mapping, we store the target here:
window.__ES_EXPECT_SELECTOR__ = null;

// --- Utilities: escaping, messaging, tabs query, and modal helpers ---
function escapeHTML(input) {
    const s = String(input ?? '');
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sendMessageAsync(type, payload) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({ type, ...(payload !== undefined ? { payload } : {}) }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

function tabsQueryAsync(query) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.query(query, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tabs);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

// Basic modal system for replacing alert/prompt/confirm flows
const $modalRoot = (() => document.getElementById('modal-root'))();

// Minimal i18n scaffold (English only for now)
const I18N_DICTIONARY = {
    'ok': 'OK',
    'cancel': 'Cancel',
    'choose_profile': 'Choose a profile',
    'no_profiles_for_site': 'No profiles found for this page.\n\nCreate a profile first using "New Profile for This Page".',
    'no_inputs_in_profile': 'No inputs configured in this profile.\n\nClick Edit to add some inputs.',
    'no_valid_mappings': 'No valid input mappings found.\n\nMake sure each input has both a selector and a variable selected.',
    'create_variable_first': 'Create a variable first.',
    'pick_element_first': 'Pick an element first.'
};

function t(key, vars) {
    let s = I18N_DICTIONARY[key] || key;
    if (vars && typeof vars === 'object') {
        for (const k of Object.keys(vars)) {
            s = s.replace(new RegExp(`{${k}}`, 'g'), String(vars[k]));
        }
    }
    return s;
}

function closeModal() {
    if ($modalRoot) {
        $modalRoot.innerHTML = '';
        $modalRoot.style.display = 'none';
    }
}

function buildModalShell(title) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'background: var(--bg); border: 1px solid #1a2438; border-radius: 8px; width: 100%; max-width: 420px; max-height: 85vh; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4)';
    modal.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; border-bottom: 1px solid #1a2438;">
            <strong>${escapeHTML(title || 'FillFlux')}</strong>
            <button id="ff-modal-close" class="ghost" style="font-size:16px;">×</button>
        </div>
        <div id="ff-modal-body" style="padding: 12px 14px;"></div>
        <div id="ff-modal-actions" style="display:flex; gap:8px; justify-content:flex-end; padding: 10px 14px; border-top: 1px solid #1a2438;"></div>
    `;
    overlay.appendChild(modal);
    modal.querySelector('#ff-modal-close').addEventListener('click', closeModal);
    // ESC to close
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeModal();
        }
    });
    // focus trap
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const handleFocusTrap = (e) => {
        if (e.key !== 'Tab') return;
        const focusables = modal.querySelectorAll(focusableSelectors);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
    overlay.addEventListener('keydown', handleFocusTrap);
    return { overlay, modal };
}

async function alertModal(message, title = 'FillFlux') {
    return new Promise((resolve) => {
        if (!$modalRoot) return resolve();
        $modalRoot.style.display = 'flex';
        const { overlay, modal } = buildModalShell(title);
        modal.querySelector('#ff-modal-body').innerHTML = `<div style="white-space: pre-wrap;">${escapeHTML(message)}</div>`;
        const actions = modal.querySelector('#ff-modal-actions');
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.addEventListener('click', () => { closeModal(); resolve(); });
        actions.appendChild(ok);
        $modalRoot.appendChild(overlay);
        modal.querySelector('#ff-modal-close').focus();
    });
}

async function confirmModal(message, title = 'FillFlux') {
    return new Promise((resolve) => {
        if (!$modalRoot) return resolve(false);
        $modalRoot.style.display = 'flex';
        const { overlay, modal } = buildModalShell(title);
        modal.querySelector('#ff-modal-body').innerHTML = `<div style="white-space: pre-wrap;">${escapeHTML(message)}</div>`;
        const actions = modal.querySelector('#ff-modal-actions');
        const cancel = document.createElement('button');
        cancel.className = 'ghost';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => { closeModal(); resolve(false); });
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.addEventListener('click', () => { closeModal(); resolve(true); });
        actions.appendChild(cancel);
        actions.appendChild(ok);
        $modalRoot.appendChild(overlay);
        ok.focus();
    });
}

async function inputModal({ title = 'FillFlux', label = 'Enter value', initialValue = '' }) {
    return new Promise((resolve) => {
        if (!$modalRoot) return resolve(initialValue);
        $modalRoot.style.display = 'flex';
        const { overlay, modal } = buildModalShell(title);
        const body = modal.querySelector('#ff-modal-body');
        const id = 'ff-input-' + Math.random().toString(36).slice(2);
        body.innerHTML = `
            <label for="${id}" style="display:block; margin-bottom:6px;">${escapeHTML(label)}</label>
            <input id="${id}" value="${escapeHTML(initialValue)}" style="width:100%; padding:6px; background:#0e1628; border:1px solid #1a2438; color:var(--fg); border-radius:4px;" />
        `;
        const input = body.querySelector('input');
        const actions = modal.querySelector('#ff-modal-actions');
        const cancel = document.createElement('button');
        cancel.className = 'ghost';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => { const v = null; closeModal(); resolve(v); });
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.addEventListener('click', () => { const v = input.value; closeModal(); resolve(v); });
        actions.appendChild(cancel);
        actions.appendChild(ok);
        $modalRoot.appendChild(overlay);
        input.focus();
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { ok.click(); } });
    });
}

async function selectModal({ title = 'FillFlux', label = 'Choose', options = [] }) {
    return new Promise((resolve) => {
        if (!$modalRoot) return resolve(-1);
        $modalRoot.style.display = 'flex';
        const { overlay, modal } = buildModalShell(title);
        const body = modal.querySelector('#ff-modal-body');
        const id = 'ff-select-' + Math.random().toString(36).slice(2);
        body.innerHTML = `
            <label for="${id}" style="display:block; margin-bottom:6px;">${escapeHTML(label)}</label>
            <select id="${id}" style="width:100%; padding:6px; background:#0e1628; border:1px solid #1a2438; color:var(--fg); border-radius:4px;"></select>
        `;
        const select = body.querySelector('select');
        options.forEach((opt, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = opt;
            select.appendChild(o);
        });
        const actions = modal.querySelector('#ff-modal-actions');
        const cancel = document.createElement('button');
        cancel.className = 'ghost';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => { closeModal(); resolve(-1); });
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.addEventListener('click', () => { const idx = parseInt(select.value); closeModal(); resolve(idx); });
        actions.appendChild(cancel);
        actions.appendChild(ok);
        $modalRoot.appendChild(overlay);
        select.focus();
    });
}

// Overlay toggle state
let overlayEnabled = true;

// Initialize the overlay toggle state on popup open
(async function initOverlayToggle() {
    try {
        const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_OVERLAY_DATA' }, r));
        const enabled = res?.enabled ?? true;
        overlayEnabled = enabled; // reuse existing variable
        const btn = document.getElementById('btn-toggle-overlay');
        btn.textContent = enabled ? '📍 Page Controls ON' : '📍 Page Controls OFF';
        btn.style.color = enabled ? 'var(--accent)' : 'var(--muted)';
    } catch (_) {
        // ignore errors if extension context is unavailable
    }
})();

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

// Atomic storage operations to prevent race conditions
async function getAll() {
    return new Promise(r => chrome.storage.local.get(Object.values(STORAGE_KEYS), r));
}
async function set(partial) {
    return new Promise(r => chrome.storage.local.set(partial, r));
}

// Atomic variable creation
async function createVariable(name, value, sourceSelector = null, sourceSiteId = null) {
    const id = crypto.randomUUID();
    const all = await getAll();
    all[STORAGE_KEYS.VARS] = all[STORAGE_KEYS.VARS] || {};
    const newVar = {
        id,
        name,
        value,
        lastUpdated: Date.now(),
        ...(sourceSelector && { sourceSelector }),
        ...(sourceSiteId && { sourceSiteId })
    };
    all[STORAGE_KEYS.VARS][id] = newVar;
    await set({ [STORAGE_KEYS.VARS]: all[STORAGE_KEYS.VARS] });
    return newVar;
}

// Atomic profile creation
async function createProfile(name, sitePattern) {
    const id = crypto.randomUUID();
    const all = await getAll();
    all[STORAGE_KEYS.PROFILES] = all[STORAGE_KEYS.PROFILES] || {};
    const newProfile = {
        id,
        name,
        sitePattern,
        inputs: []
    };
    all[STORAGE_KEYS.PROFILES][id] = newProfile;
    await set({ [STORAGE_KEYS.PROFILES]: all[STORAGE_KEYS.PROFILES] });
    return newProfile;
}

// Notification system
function showNotification(message, type = 'info', duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;

    const notification = document.createElement('div');
    notification.style.cssText = `
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 4px;
        font-size: 12px;
        animation: slideIn 0.3s ease-out;
        max-width: 200px;
        word-wrap: break-word;
    `;

    notification.textContent = String(message ?? '');
    notificationArea.appendChild(notification);

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    if (!document.querySelector('#notification-style')) {
        style.id = 'notification-style';
        document.head.appendChild(style);
    }

    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

// Smart variable name generation
function generateSmartVariableName(selector, value, siteName) {
    // Extract meaningful parts from selector
    let suggestions = [];

    // Check for ID or name attributes
    const idMatch = selector.match(/#([^.\s\[]+)/);
    const nameMatch = selector.match(/\[name="([^"]+)"\]/);
    const dataTestIdMatch = selector.match(/\[data-testid="([^"]+)"\]/);
    const roleMatch = selector.match(/\[role="([^"]+)"\]/);

    if (idMatch) suggestions.push(cleanAttributeName(idMatch[1]));
    if (nameMatch) suggestions.push(cleanAttributeName(nameMatch[1]));
    if (dataTestIdMatch) suggestions.push(cleanAttributeName(dataTestIdMatch[1]));
    if (roleMatch) suggestions.push(cleanAttributeName(roleMatch[1]));

    // Extract element type
    const elementType = selector.split(/[\s>#\.\[]/)[0] || 'element';

    // Analyze value for context clues
    if (value && typeof value === 'string') {
        if (value.includes('@')) suggestions.push('email');
        else if (value.match(/^\d+$/)) suggestions.push('number');
        else if (value.match(/^\$[\d,]+/)) suggestions.push('price');
        else if (value.match(/\d{4}-\d{2}-\d{2}/)) suggestions.push('date');
        else if (value.length < 20 && !value.includes(' ')) suggestions.push('id');
        else if (value.includes(' ') && value.length < 100) suggestions.push('title');
    }

    // Element type specific names
    if (elementType === 'input') {
        suggestions.push('field');
    } else if (elementType === 'button') {
        suggestions.push('action');
    } else if (elementType === 'span' || elementType === 'div') {
        suggestions.push('text');
    }

    // Use site name as prefix
    const sitePrefix = siteName.replace(/^www\./, '').split('.')[0];

    // Build final name
    let finalName = sitePrefix;
    if (suggestions.length > 0) {
        finalName += '_' + suggestions[0];
    } else {
        finalName += '_' + elementType;
    }

    return finalName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function cleanAttributeName(attr) {
    return attr
        .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase to snake_case
        .replace(/[-\s]+/g, '_') // replace hyphens/spaces with underscore
        .replace(/[^a-zA-Z0-9_]/g, '') // remove special chars
        .toLowerCase();
}

// Render timer status with visual indicators
function renderTimerStatus(variable) {
    if (!variable.autoCopyUntil || variable.autoCopyUntil <= Date.now()) {
        let status = '<span style="color: var(--muted);">manual</span>';
        if (variable.lastUpdated) {
            const lastUpdate = new Date(variable.lastUpdated).toLocaleTimeString();
            status += ` • last updated ${lastUpdate}`;
        }
        return status;
    }

    const remainingMs = variable.autoCopyUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    const expiryTime = new Date(variable.autoCopyUntil).toLocaleTimeString();

    let color = 'var(--accent)'; // blue for active
    if (remainingMinutes <= 5) color = '#ff9500'; // orange for expiring soon
    if (remainingMinutes <= 1) color = '#ff3b30'; // red for about to expire

    let status = `<span style="color: ${color};">🔄 auto (${remainingMinutes}m left, until ${expiryTime})</span>`;

    if (variable.lastUpdated) {
        const lastUpdate = new Date(variable.lastUpdated).toLocaleTimeString();
        status += ` • updated ${lastUpdate}`;
    }

    if (variable.sourceSelector) {
        const shortSelector = variable.sourceSelector.length > 30 ?
            variable.sourceSelector.substring(0, 30) + '...' : variable.sourceSelector;
        status += `<br><span style="color: var(--muted); font-size: 10px;">from: ${escapeHTML(shortSelector)}</span>`;
    }

    return status;
}

// --- URL helpers (patternizing + matching) using shared utilities ---
function normalizeUrlBasic(url) {
    if (window.__ES_URL_UTILS__) {
        return window.__ES_URL_UTILS__.normalizeUrlBasic(url);
    }
    // Fallback implementation
    try {
        const u = new URL(url);
        return { origin: u.origin, path: u.pathname.replace(/\/+/g, '/') };
    } catch (e) {
        return { origin: '', path: '' };
    }
}

function toPatternFromUrl(url) {
    if (window.__ES_URL_UTILS__) {
        return window.__ES_URL_UTILS__.toPatternFromUrl(url);
    }
    // Fallback implementation
    try {
        const { origin, path } = normalizeUrlBasic(url);
        const segs = path.split('/').filter(Boolean).map(seg => {
            if (/^\d+$/.test(seg)) return '*';                    // 12345
            if (/^[0-9a-f-]{8,}$/i.test(seg)) return '*';         // 3f2a1b..., UUID-ish
            return seg;
        });
        return origin + '/' + segs.join('/') + '/*';
    } catch (e) {
        return url + '/*';
    }
}

function matchesPattern(pattern, url) {
    if (window.__ES_URL_UTILS__) {
        return window.__ES_URL_UTILS__.matchesPattern(pattern, url);
    }
    // Fallback implementation
    try {
        const p = new URL(pattern.replace('/*', '/')); // temp URL parse
        const u = new URL(url);
        if (p.origin !== u.origin) return false;
        // build pattern segments
        const pPath = pattern.endsWith('/*') ? p.pathname : pattern.replace(p.origin, '');
        const pSegs = pPath.replace(/\/+$/, '').split('/').filter(Boolean);
        const uSegs = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        // if pattern ends with /*, allow extra trailing segments
        const allowTail = pattern.endsWith('/*');
        if (!allowTail && pSegs.length !== uSegs.length) return false;
        if (allowTail && uSegs.length < pSegs.length) return false;
        for (let i = 0; i < pSegs.length; i++) {
            const ps = pSegs[i], us = uSegs[i];
            if (ps !== '*' && ps !== us) return false;
        }
        return true;
    } catch {
        // fallback: startsWith without query/hash
        const clean = (s) => s.split(/[?#]/)[0];
        return clean(url).startsWith(clean(pattern.replace(/\/\*$/, '')));
    }
}

// Renderers
async function renderVars() {
    const { [KEYS.VARS]: vars = {} } = await getAll();
    $vars.innerHTML = '';
    Object.values(vars).forEach(v => {
        const li = document.createElement('li');
        li.className = 'card';
        li.innerHTML = `
      <div class="row">
        <input value="${escapeHTML(v.name)}" data-role="name" />
        <input value="${escapeHTML(v.value ?? '')}" data-role="value" />
        <div style="display:flex; gap:4px; justify-content:flex-end">
          <button data-role="save">Save</button>
          <button class="ghost" data-role="auto">Auto</button>
          <button class="danger" data-role="del">Del</button>
        </div>
      </div>
      <div class="small">${renderTimerStatus(v)}</div>
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
            const ok = await confirmModal(`Delete variable "${escapeHTML(v.name)}"?`);
            if (!ok) return;
            const all = await getAll();
            delete all[KEYS.VARS][v.id];
            await set({ [KEYS.VARS]: all[KEYS.VARS] });
            renderVars();
        };
        li.querySelector('[data-role="auto"]').onclick = async () => {
            if (v.autoCopyUntil && v.autoCopyUntil > Date.now()) {
                // Already active, ask if they want to stop or extend
                const choice = await inputModal({ title: 'FillFlux', label: `Auto-copy active until ${new Date(v.autoCopyUntil).toLocaleTimeString()}\nEnter minutes to extend (0 to stop):`, initialValue: '0' });
                const minutes = +(choice || '0');

                if (minutes === 0) {
                    // Stop auto-copy
                    const all = await getAll();
                    delete all[KEYS.VARS][v.id].autoCopyUntil;
                    await set({ [KEYS.VARS]: all[KEYS.VARS] });
                    chrome.runtime.sendMessage({ type: 'CLEAR_ALARM', payload: { varId: v.id } });
                    renderVars();
                } else if (minutes > 0) {
                    // Extend timer
                    const until = Date.now() + minutes * 60 * 1000;
                    const all = await getAll();
                    all[KEYS.VARS][v.id] = { ...v, autoCopyUntil: until };
                    await set({ [KEYS.VARS]: all[KEYS.VARS] });
                    chrome.runtime.sendMessage({ type: 'SET_ALARM', payload: { varId: v.id, minutes } });
                    renderVars();
                    // Start auto-refreshing
                    startAutoRefresh(v.id);
                }
            } else {
                // Not active, start new timer
                const input = await inputModal({ title: 'FillFlux', label: 'Auto-copy for how many minutes?', initialValue: '10' });
                const minutes = +(input || '10') || 10;
                if (minutes > 0) {
                    const until = Date.now() + minutes * 60 * 1000;
                    const all = await getAll();
                    all[KEYS.VARS][v.id] = { ...v, autoCopyUntil: until };
                    await set({ [KEYS.VARS]: all[KEYS.VARS] });
                    chrome.runtime.sendMessage({ type: 'SET_ALARM', payload: { varId: v.id, minutes } });
                    renderVars();
                    // Start auto-refreshing
                    startAutoRefresh(v.id);
                }
            }
        };
        $vars.appendChild(li);
    });
}

// Auto-refresh functionality for variables with active timers
const activeRefreshIntervals = new Map();

function startAutoRefresh(varId) {
    // Clear existing interval if any
    if (activeRefreshIntervals.has(varId)) {
        clearInterval(activeRefreshIntervals.get(varId));
    }

    // Refresh every 30 seconds
    const intervalId = setInterval(async () => {
        await autoRefreshVariable(varId);
    }, 30000);

    activeRefreshIntervals.set(varId, intervalId);

    console.log(`Started auto-refresh for variable ${varId}`);
}

function stopAutoRefresh(varId) {
    if (activeRefreshIntervals.has(varId)) {
        clearInterval(activeRefreshIntervals.get(varId));
        activeRefreshIntervals.delete(varId);
        console.log(`Stopped auto-refresh for variable ${varId}`);
    }
}

async function autoRefreshVariable(varId) {
    try {
        const all = await getAll();
        const variable = all[KEYS.VARS][varId];

        if (!variable || !variable.autoCopyUntil || variable.autoCopyUntil <= Date.now()) {
            // Timer expired or variable deleted, stop refreshing
            stopAutoRefresh(varId);
            return;
        }

        // Use the stored source selector if available
        if (variable.sourceSelector) {
            const { url: activeUrl } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
            const sites = Object.values(all[KEYS.SITES] || {});

            // Check if current page matches the source site
            const sourceSite = sites.find(s => s.id === variable.sourceSiteId);
            if (sourceSite && matchesPattern(sourceSite.urlPattern, activeUrl || '')) {

                // Attempt to get updated value using stored selector
                const res = await new Promise(resolve => {
                    chrome.runtime.sendMessage({
                        type: 'GET_SNAPSHOT',
                        payload: { selector: variable.sourceSelector }
                    }, response => resolve(response));
                });

                if (res?.ok && res.value !== undefined && res.value !== variable.value) {
                    // Update variable with new value
                    all[KEYS.VARS][varId] = {
                        ...variable,
                        value: res.value,
                        lastUpdated: Date.now()
                    };
                    await set({ [KEYS.VARS]: all[KEYS.VARS] });

                    console.log(`✓ Auto-updated ${variable.name}: "${variable.value}" -> "${res.value}"`);

                    // Re-render if popup is still open
                    if (document.querySelector('#vars-list')) {
                        renderVars();
                    }
                } else if (!res?.ok) {
                    console.log(`Could not resolve selector for ${variable.name}: ${variable.sourceSelector}`);
                }
            }
        }
    } catch (error) {
        console.error(`Auto-refresh failed for variable ${varId}:`, error);
    }
}

// Start auto-refresh for variables that already have active timers
async function initializeAutoRefresh() {
    const all = await getAll();
    const now = Date.now();

    Object.values(all[KEYS.VARS] || {}).forEach(v => {
        if (v.autoCopyUntil && v.autoCopyUntil > now) {
            startAutoRefresh(v.id);
        }
    });
}

async function renderSites() {
    const { url } = await sendMessageAsync('GET_ACTIVE_TAB_URL');
    byId('active-url').textContent = url || '';

    const { [KEYS.SITES]: sites = {} } = await getAll();
    $sites.innerHTML = '';
    Object.values(sites).forEach(s => {
        const li = document.createElement('li');
        li.className = 'card';
        const els = s.elements?.length || 0;
        li.innerHTML = `
      <div class="row">
        <input value="${escapeHTML(s.title)}" data-role="title" />
        <input value="${escapeHTML(s.urlPattern)}" data-role="pattern" />
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
            const ok = await confirmModal(`Delete site "${escapeHTML(s.title)}"?`);
            if (!ok) return;
            const all = await getAll();
            delete all[KEYS.SITES][s.id];
            await set({ [KEYS.SITES]: all[KEYS.SITES] });
            renderSites();
        };
        $sites.appendChild(li);
    });
}

async function renderProfiles() {
    // Show current page info
    const { url } = await sendMessageAsync('GET_ACTIVE_TAB_URL');
    const currentDomain = url ? new URL(url).hostname : 'unknown';
    byId('current-site-info').textContent = `Current page: ${currentDomain}`;

    const { [KEYS.PROFILES]: profiles = {} } = await getAll();
    $profiles.innerHTML = '';

    // Show profiles that match current site
    const currentProfiles = Object.values(profiles).filter(p =>
        p.sitePattern && matchesPattern(p.sitePattern, url || '')
    );

    if (currentProfiles.length === 0) {
        const notice = document.createElement('div');
        notice.className = 'card';
        notice.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--muted);">
                No profiles for this site yet.<br>
                Click "New Profile for This Page" to create one.
            </div>
        `;
        $profiles.appendChild(notice);
        return;
    }

    currentProfiles.forEach(p => {
        const li = document.createElement('li');
        li.className = 'card';
        li.innerHTML = `
            <div class="row">
                <strong>${escapeHTML(p.name)}</strong>
                <div style="display:flex; gap:4px; justify-content:flex-end">
                    <button data-role="edit">Edit</button>
                    <button class="danger" data-role="del">Delete</button>
                </div>
            </div>
            <div class="small">${p.inputs?.length || 0} inputs configured</div>
            <div class="inputs-list" style="margin-top: 8px;"></div>
        `;

        const inputsList = li.querySelector('.inputs-list');

        // Show configured inputs
        (p.inputs || []).forEach((input, idx) => {
            const inputDiv = document.createElement('div');
            inputDiv.className = 'row';
            inputDiv.style.padding = '4px 0';
            inputDiv.style.borderBottom = '1px solid #1a2438';

            const varName = escapeHTML(input.varName || 'No variable selected');
            const selectorPreviewRaw = input.selector.length > 40 ?
                input.selector.substring(0, 40) + '...' : input.selector;
            const selectorPreview = escapeHTML(selectorPreviewRaw);

            inputDiv.innerHTML = `
                <div style="flex: 1;">
                    <div class="small" style="color: var(--muted);">${selectorPreview}</div>
                    <div style="color: var(--accent);">→ ${varName}</div>
                </div>
            `;
            inputsList.appendChild(inputDiv);
        });

        // Edit button
        li.querySelector('[data-role="edit"]').onclick = () => {
            editProfile(p.id);
        };

        // Delete button  
        li.querySelector('[data-role="del"]').onclick = async () => {
            const ok = await confirmModal(`Delete profile "${escapeHTML(p.name)}"?`);
            if (!ok) return;
            const all = await getAll();
            delete all[KEYS.PROFILES][p.id];
            await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
            renderProfiles();
        };

        $profiles.appendChild(li);
    });
}

// Profile editing functionality
async function editProfile(profileId) {
    const all = await getAll();
    const profile = all[KEYS.PROFILES][profileId];
    if (!profile) return;

    // Create edit overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center; padding: 20px;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--bg); border: 1px solid #1a2438; border-radius: 8px;
        width: 100%; max-width: 500px; max-height: 80vh; overflow-y: auto; padding: 16px;
    `;

    const allVars = Object.values(all[KEYS.VARS] || {});

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0;">Edit Profile: ${profile.name}</h3>
            <button id="close-edit" style="background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label>Profile Name:</label>
            <input id="edit-profile-name" value="${profile.name}" style="width: 100%; margin-top: 4px; padding: 6px; background: #0e1628; border: 1px solid #1a2438; color: var(--fg); border-radius: 4px;" />
        </div>
        
        <div style="margin-bottom: 16px;">
            <button id="add-input" style="background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">+ Add Input Field</button>
        </div>
        
        <div id="inputs-container"></div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #1a2438;">
            <button id="save-profile" style="background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Save Profile</button>
            <button id="cancel-edit" style="background: #333; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
    `;

    const inputsContainer = modal.querySelector('#inputs-container');

    function renderInputs() {
        inputsContainer.innerHTML = '';
        (profile.inputs || []).forEach((input, idx) => {
            const inputDiv = document.createElement('div');
            inputDiv.style.cssText = 'border: 1px solid #1a2438; border-radius: 4px; padding: 12px; margin-bottom: 8px;';

            const optionsHtml = allVars.map(v => {
                const nameEsc = escapeHTML(v.name);
                const raw = String(v.value || '');
                const previewRaw = raw.length > 30 ? raw.substring(0, 30) + '...' : raw;
                const previewEsc = escapeHTML(previewRaw);
                const selected = input.varName === v.name ? 'selected' : '';
                return `<option value="${nameEsc}" ${selected}>${nameEsc}: "${previewEsc}"</option>`;
            }).join('');

            inputDiv.innerHTML = `
                <div style="margin-bottom: 8px;">
                    <label>Input Selector:</label>
                    <div style="display: flex; gap: 4px; margin-top: 4px;">
                        <input class="selector-input" data-idx="${idx}" value="${escapeHTML(input.selector || '')}" 
                               style="flex: 1; padding: 6px; background: #0e1628; border: 1px solid #1a2438; color: var(--fg); border-radius: 4px;" 
                               placeholder="Click Pick to select" readonly />
                        <button class="pick-input" data-idx="${idx}" 
                                style="background: var(--accent); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Pick</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 8px;">
                    <label>Fill with Variable:</label>
                    <select class="var-select" data-idx="${idx}" 
                            style="width: 100%; margin-top: 4px; padding: 6px; background: #0e1628; border: 1px solid #1a2438; color: var(--fg); border-radius: 4px;">
                        <option value="">— Choose Variable —</option>
                        ${optionsHtml}
                    </select>
                </div>
                
                <div style="text-align: right;">
                    <button class="remove-input" data-idx="${idx}"
                            style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
                </div>
            `;

            inputsContainer.appendChild(inputDiv);
        });

        // Add event listeners
        inputsContainer.querySelectorAll('.pick-input').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                console.log('Setting picker expectation:', { profileId, inputIndex: idx, isEditing: true });
                window.__ES_EXPECT_SELECTOR__ = {
                    profileId,
                    inputIndex: idx,
                    isEditing: true
                };
                chrome.runtime.sendMessage({ type: 'INJECT_PICKER' });
                overlay.remove();
            };
        });

        inputsContainer.querySelectorAll('.var-select').forEach(select => {
            select.onchange = async () => {
                const idx = parseInt(select.dataset.idx);
                profile.inputs[idx].varName = select.value;

                // Save immediately to storage
                const all = await getAll();
                all[KEYS.PROFILES][profileId] = profile;
                await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
            };
        });

        inputsContainer.querySelectorAll('.remove-input').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.dataset.idx);
                profile.inputs.splice(idx, 1);

                // Save immediately to storage
                const all = await getAll();
                all[KEYS.PROFILES][profileId] = profile;
                await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });

                renderInputs();
            };
        });
    }

    // Initial render
    renderInputs();

    // Add input button
    modal.querySelector('#add-input').onclick = async () => {
        if (!profile.inputs) profile.inputs = [];
        profile.inputs.push({ selector: '', varName: '' });

        // Save immediately to storage so picker can find it
        const all = await getAll();
        all[KEYS.PROFILES][profileId] = profile;
        await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });

        renderInputs();
    };

    // Save profile
    modal.querySelector('#save-profile').onclick = async () => {
        profile.name = modal.querySelector('#edit-profile-name').value.trim();
        all[KEYS.PROFILES][profileId] = profile;
        await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
        overlay.remove();
        renderProfiles();
    };

    // Cancel/close
    modal.querySelector('#cancel-edit').onclick = () => overlay.remove();
    modal.querySelector('#close-edit').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Add rows
byId('add-var').onclick = async () => {
    const name = byId('new-var-name').value.trim();
    const value = byId('new-var-value').value;
    if (!name) return;

    try {
        await createVariable(name, value);
        byId('new-var-name').value = '';
        byId('new-var-value').value = '';
        renderVars();
        showNotification(`Variable "${name}" created successfully`, 'success');
    } catch (error) {
        showNotification(`Failed to create variable: ${error.message}`, 'error');
    }
};

// New profile for current page
byId('btn-new-profile-here').onclick = async () => {
    const { url } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
    if (!url) {
        showNotification('Cannot detect current page URL', 'error');
        return;
    }

    const domain = new URL(url).hostname;
    const suggestedName = generateSmartProfileName(url);
    const name = await inputModal({ title: 'FillFlux', label: `Profile name for ${domain}:`, initialValue: suggestedName });
    if (!name) return;

    try {
        const pattern = toPatternFromUrl(url);
        const profile = await createProfile(name, pattern);
        renderProfiles();
        showNotification(`Profile "${name}" created successfully`, 'success');

        // Immediately open for editing
        editProfile(profile.id);
    } catch (error) {
        showNotification(`Failed to create profile: ${error.message}`, 'error');
    }
};

// Smart profile name generation
function generateSmartProfileName(url) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname;

    // Common form types based on URL patterns
    const formTypes = [
        { pattern: /login|signin|auth/i, name: 'Login' },
        { pattern: /register|signup|join/i, name: 'Registration' },
        { pattern: /checkout|payment|billing/i, name: 'Checkout' },
        { pattern: /profile|account|settings/i, name: 'Profile' },
        { pattern: /contact|support|feedback/i, name: 'Contact' },
        { pattern: /search|find/i, name: 'Search' },
        { pattern: /admin|dashboard/i, name: 'Admin' },
        { pattern: /order|purchase|buy/i, name: 'Order' }
    ];

    // Check URL for form type hints
    const fullUrl = url.toLowerCase();
    for (const type of formTypes) {
        if (type.pattern.test(fullUrl)) {
            return `${domain.split('.')[0]} ${type.name}`;
        }
    }

    // Default naming based on domain
    const siteName = domain.split('.')[0];
    return `${siteName} Form`;
}

// Picker integration
byId('btn-pick').onclick = () => chrome.runtime.sendMessage({ type: 'INJECT_PICKER' });

// Manual content script refresh
byId('btn-refresh-content').onclick = async () => {
    try {
        const res = await sendMessageAsync('REFRESH_CONTENT_SCRIPT');

        if (res?.ok) {
            await alertModal('Content scripts refreshed successfully!');
        } else {
            await alertModal(`Failed to refresh: ${res?.error || 'Unknown error'}`);
        }
    } catch (error) {
        await alertModal(`Refresh failed: ${error.message}`);
    }
};

// Toggle page overlay controls
byId('btn-toggle-overlay').onclick = async () => {
    overlayEnabled = !overlayEnabled;

    try {
        const res = await sendMessageAsync('TOGGLE_OVERLAY', { enabled: overlayEnabled });

        if (res?.ok) {
            byId('btn-toggle-overlay').textContent = overlayEnabled ? '📍 Page Controls ON' : '📍 Page Controls OFF';
            byId('btn-toggle-overlay').style.color = overlayEnabled ? 'var(--accent)' : 'var(--muted)';
            showNotification(overlayEnabled ? 'Page controls enabled' : 'Page controls disabled');
        }
    } catch (error) {
        await alertModal(`Toggle failed: ${error.message}`);
    }
};

// Receive picker result and attach it to the current site bucket
if (!window.__ES_POPUP_BOUND__) {
    window.__ES_POPUP_BOUND__ = true;
    chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg.type !== 'PICKER_RESULT') return;
        const { selector, url, value } = msg.payload;

        // 1) If we're currently picking a selector for a specific input, just place it there and stop.
        if (window.__ES_EXPECT_SELECTOR__) {
            const { profileId, inputIndex, isEditing } = window.__ES_EXPECT_SELECTOR__;
            console.log('Processing picker result for profile:', { profileId, inputIndex, isEditing, selector });
            window.__ES_EXPECT_SELECTOR__ = null;
            const all = await getAll();
            const prof = all[KEYS.PROFILES][profileId];

            if (prof && prof.inputs && prof.inputs[inputIndex] !== undefined) {
                console.log('Updating profile input:', prof.inputs[inputIndex]);
                prof.inputs[inputIndex].selector = selector;
                await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
                console.log('Profile updated successfully');

                if (isEditing) {
                    // Reopen the edit dialog
                    setTimeout(() => editProfile(profileId), 100);
                } else {
                    renderProfiles();
                }
                // No site/var creation in this flow.
                return;
            } else {
                console.error('Profile input not found:', { prof: !!prof, inputsLength: prof?.inputs?.length, inputIndex });
            }
        }

        // 2) Otherwise, this is a normal "capture": save selector under Sites and create a Variable with the current value.
        const pattern = toPatternFromUrl(url);
        const title = new URL(url).hostname;
        const all = await getAll();
        const sites = all[STORAGE_KEYS.SITES] || (all[STORAGE_KEYS.SITES] = {});
        let site = Object.values(sites).find(s => s.urlPattern === pattern);
        if (!site) {
            site = { id: crypto.randomUUID(), title, urlPattern: pattern, elements: [] };
            sites[site.id] = site;
        }
        site.elements.push({ selector, note: '', createdAt: Date.now() });
        await set({ [STORAGE_KEYS.SITES]: sites });

        // Smart variable name suggestion
        const suggestedName = generateSmartVariableName(selector, value, title);

        // Create variable atomically with source information
        const variable = await createVariable(suggestedName, value, selector, site.id);

        // Set recent copy for paste offers
        try {
            const [tab] = await tabsQueryAsync({ active: true, currentWindow: true });
            if (tab?.id) {
                await sendMessageAsync('SET_RECENT_COPY', { varId: variable.id, varName: variable.name, value, ts: Date.now() });
            }
        } catch (_) { }

        await renderSites();
        await renderVars();
        document.querySelector('.tabs button.active')?.classList.remove('active');
        document.querySelector('.tabs button[data-tab="vars"]').classList.add('active');
        document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
        document.getElementById('tab-vars').classList.add('active');
    });
}

// Copy from page: resolve selected site element into selected var (prompt)
byId('btn-copy-active').onclick = async () => {
    const all = await getAll();
    const vars = Object.values(all[KEYS.VARS]);
    if (!vars.length) { await alertModal('Create a variable first.'); return; }
    const varIdx = await inputModal({ title: 'FillFlux', label: 'Which variable index to update?', initialValue: '0' });
    const choice = vars[+varIdx || 0];
    if (!choice) return;

    // Limit to selectors whose urlPattern matches the ACTIVE TAB (segment-aware, no query/hash)
    const { url: activeUrl } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
    const sites = Object.values(all[KEYS.SITES]);
    const allEls = sites
        .filter(s => matchesPattern(s.urlPattern, activeUrl || ''))
        .flatMap(s => s.elements.map(e => ({ site: s, selector: e.selector })));
    if (!allEls.length) { await alertModal('Pick an element first.'); return; }
    const elIdx = await inputModal({ title: 'FillFlux', label: 'Which element selector index?', initialValue: '0' });
    const elChoice = allEls[+elIdx || 0];
    if (!elChoice) return;

    try {
        const res = await sendMessageAsync('GET_SNAPSHOT', { selector: elChoice.selector });

        if (!res?.ok) {
            return alertModal(`Could not resolve element on this page.\nSelector: ${elChoice.selector}\nPage may need to refresh or element may not exist.`);
        }

        const varsObj = all[KEYS.VARS];
        varsObj[choice.id] = { ...choice, value: res.value };
        await set({ [KEYS.VARS]: varsObj });
        renderVars();
        await alertModal(`Successfully copied value: "${String(res.value)}"`);

        // Set recent copy for paste offers
        try {
            const [tab] = await tabsQueryAsync({ active: true, currentWindow: true });
            if (tab?.id) {
                await sendMessageAsync('SET_RECENT_COPY', { varId: choice.id, varName: choice.name, value: res.value, ts: Date.now() });
            }
        } catch (_) { }
    } catch (error) {
        await alertModal(`Error copying from page: ${error.message}\n\nTry refreshing the page and trying again.`);
    }
};

// Fill form with profile data
byId('btn-fill-form').onclick = async () => {
    const { url } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
    const all = await getAll();

    // Find profiles for current page
    const matchingProfiles = Object.values(all[KEYS.PROFILES]).filter(p =>
        p.sitePattern && matchesPattern(p.sitePattern, url || '')
    );

    if (matchingProfiles.length === 0) { return alertModal('No profiles found for this page.\n\nCreate a profile first using "New Profile for This Page".'); }

    let profile;
    if (matchingProfiles.length === 1) {
        profile = matchingProfiles[0];
    } else {
        const idx = await selectModal({
            title: 'FillFlux',
            label: t('choose_profile'),
            options: matchingProfiles.map((p, i) => `${i}: ${p.name}`)
        });
        if (idx < 0 || !matchingProfiles[idx]) return;
        profile = matchingProfiles[idx];
    }

    if (!profile || !profile.inputs || profile.inputs.length === 0) { return alertModal('No inputs configured in this profile.\n\nClick Edit to add some inputs.'); }

    // Build mappings from profile inputs
    const varsByName = Object.fromEntries(Object.values(all[KEYS.VARS]).map(v => [v.name, v.value]));
    const mappings = profile.inputs
        .filter(input => input.selector && input.varName) // Only inputs with selector and variable
        .map(input => {
            const value = varsByName[input.varName] || '';
            return { selector: input.selector, value };
        });

    if (mappings.length === 0) { return alertModal('No valid input mappings found.\n\nMake sure each input has both a selector and a variable selected.'); }

    try {
        const res = await sendMessageAsync('PASTE_PROFILE', { mappings });

        if (!res?.ok) {
            const failedResults = (res.results || []).filter(r => !r.ok);
            const notFoundResults = (res.results || []).filter(r => !r.found);

            let errorMsg = `Fill failed for profile "${profile.name}".\n\n`;
            if (notFoundResults.length > 0) {
                errorMsg += `Elements not found:\n${notFoundResults.map(f => `• ${f.selector}`).join('\n')}\n\n`;
            }
            if (failedResults.length > 0) {
                errorMsg += `Failed to set values:\n${failedResults.map(f => `• ${f.selector}`).join('\n')}`;
            }
            errorMsg += '\nTry using "Refresh Scripts" and try again.';
            return alertModal(errorMsg);
        }

        const successful = (res.results || []).filter(r => r.ok).length;
        const failed = (res.results || []).filter(r => !r.ok);

        if (failed.length === 0) {
            await alertModal(`Successfully filled ${successful} fields with "${profile.name}" profile!`);
        } else {
            await alertModal(`Filled ${successful} fields, but ${failed.length} failed:\n${failed.map(f => `• ${f.selector} ${f.found ? '(set failed)' : '(not found)'}`).join('\n')}`);
        }
    } catch (error) {
        await alertModal(`Fill error: ${error.message}\n\nTry using "Refresh Scripts" button and try again.`);
    }
};

// Toggle floating vars window
byId('btn-floating-vars').onclick = async () => {
    try {
        const res = await sendMessageAsync('TOGGLE_FLOATING_VARS');

        showNotification(res?.visible ? 'Floating panel ON' : 'Floating panel OFF');
    } catch (error) {
        await alertModal(`Failed to toggle floating vars: ${error.message}`);
    }
};

// Listen for background auto-copy updates
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'VARIABLE_UPDATED') {
        const { variableName, oldValue, newValue } = msg.payload;
        showNotification(`${variableName} updated: ${newValue}`, 'success');

        // Re-render variables to show updated value
        if (document.querySelector('#vars-list')) {
            renderVars();
        }
    }
});

// Initial renders
renderVars();
renderSites();
renderProfiles();

// Initialize auto-refresh for existing active variables
initializeAutoRefresh();
