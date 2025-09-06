const KEYS = { VARS: 'vars', SITES: 'sites', PROFILES: 'profiles' };
const byId = (id) => document.getElementById(id);
const $vars = byId('vars-list');
const $sites = byId('sites-list');
const $profiles = byId('profiles-list');
// When picking a selector for a specific mapping, we store the target here:
window.__ES_EXPECT_SELECTOR__ = null;

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

// --- URL helpers (patternizing + matching) ---
function normalizeUrlBasic(url) {
    const u = new URL(url);
    // ignore search/hash when matching
    return { origin: u.origin, path: u.pathname.replace(/\/+/g, '/') };
}

// Replace ID-like segments (pure numbers or long hex/uuid-ish) with '*'
function toPatternFromUrl(url) {
    const { origin, path } = normalizeUrlBasic(url);
    const segs = path.split('/').filter(Boolean).map(seg => {
        if (/^\d+$/.test(seg)) return '*';                    // 12345
        if (/^[0-9a-f-]{8,}$/i.test(seg)) return '*';         // 3f2a1b..., UUID-ish
        return seg;
    });
    return origin + '/' + segs.join('/') + '/*';
}

// Segment-aware match: '*' matches one segment, trailing '/*' matches any suffix
function matchesPattern(pattern, url) {
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
    const { url } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
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
            const allVars = (await getAll())[KEYS.VARS] || {};
            const varsArr = Object.values(allVars);
            (me.mappings || []).forEach((m, idx) => {
                // Back-compat: convert {{var:Name}} into { varName: 'Name' } in-memory (UI) if not already set
                let varName = m.varName || '';
                if (!varName && typeof m.value === 'string') {
                    const match = m.value.match(/^\{\{var:(.+)\}\}$/);
                    if (match) varName = match[1];
                }

                const div = document.createElement('div');
                div.className = 'row';
                div.innerHTML = `
                <div class="three-col">
                    <input value="${m.selector || ''}" placeholder="target selector" data-role="sel-${idx}" />
                    <button class="btn-small" data-role="pick-${idx}">Pick</button>
                    <button class="danger btn-small" data-role="rm-${idx}">Remove</button>
                </div>
                <div class="two-col" style="margin-top:6px">
                    <select data-role="var-${idx}">
                        <option value="">— choose variable —</option>
                        ${varsArr.map(v => `<option value="${v.name}" ${varName === v.name ? 'selected' : ''}>${v.name}</option>`).join('')}
                    </select>
                    <input value="${(!varName && m.value) ? m.value : ''}" placeholder="literal (used if no variable selected)" data-role="val-${idx}" />
                </div>
            `;

                // PICK selector for this mapping
                div.querySelector(`[data-role="pick-${idx}"]`).onclick = async () => {
                    // remember where to place the selector when the picker returns
                    window.__ES_EXPECT_SELECTOR__ = { profileId: p.id, mapIndex: idx };
                    chrome.runtime.sendMessage({ type: 'INJECT_PICKER' });
                };

                div.querySelector(`[data-role="rm-${idx}"]`).onclick = async () => {
                    const all = await getAll();
                    const mp = (all[KEYS.PROFILES][p.id].mappings || []);
                    mp.splice(idx, 1);
                    await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
                    redrawMaps();
                };
                mapsWrap.appendChild(div);

                // Persist edits
                const saveField = async () => {
                    const all = await getAll();
                    const mp = all[KEYS.PROFILES][p.id].mappings || [];
                    const mine = mp[idx] || (mp[idx] = { selector: '', value: '' });
                    mine.selector = div.querySelector(`[data-role="sel-${idx}"]`).value;
                    mine.varName = div.querySelector(`[data-role="var-${idx}"]`).value || '';
                    mine.value = div.querySelector(`[data-role="val-${idx}"]`).value; // literal
                    await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
                };
                div.querySelector(`[data-role="sel-${idx}"]`).addEventListener('change', saveField);
                div.querySelector(`[data-role="var-${idx}"]`).addEventListener('change', saveField);
                div.querySelector(`[data-role="val-${idx}"]`).addEventListener('change', saveField);
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
if (!window.__ES_POPUP_BOUND__) {
    window.__ES_POPUP_BOUND__ = true;
    chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg.type !== 'PICKER_RESULT') return;
        const { selector, url, value } = msg.payload;

        // 1) If we're currently picking a selector for a specific mapping, just place it there and stop.
        if (window.__ES_EXPECT_SELECTOR__) {
            const { profileId, mapIndex } = window.__ES_EXPECT_SELECTOR__;
            window.__ES_EXPECT_SELECTOR__ = null;
            const all = await getAll();
            const prof = all[KEYS.PROFILES][profileId];
            if (prof && prof.mappings && prof.mappings[mapIndex]) {
                prof.mappings[mapIndex].selector = selector;
                await set({ [KEYS.PROFILES]: all[KEYS.PROFILES] });
                renderProfiles();
                // No site/var creation in this flow.
                return;
            }
        }

        // 2) Otherwise, this is a normal "capture": save selector under Sites and create a Variable with the current value.
        const pattern = toPatternFromUrl(url);
        const title = new URL(url).hostname;
        const all = await getAll();
        const sites = all[KEYS.SITES];
        let site = Object.values(sites).find(s => s.urlPattern === pattern);
        if (!site) {
            site = { id: crypto.randomUUID(), title, urlPattern: pattern, elements: [] };
            sites[site.id] = site;
        }
        site.elements.push({ selector, note: '', createdAt: Date.now() });
        await set({ [KEYS.SITES]: sites });

        const varId = crypto.randomUUID();
        all[KEYS.VARS][varId] = { id: varId, name: selector.split(' ').slice(-1)[0], value };
        await set({ [KEYS.VARS]: all[KEYS.VARS] });

        await renderSites();
        await renderVars();
        document.querySelector('.tabs button.active')?.classList.remove('active');
        document.querySelector('.tabs button[data-tab="sites"]').classList.add('active');
        document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
        document.getElementById('tab-sites').classList.add('active');
    });
}

// Copy from page: resolve selected site element into selected var (prompt)
byId('btn-copy-active').onclick = async () => {
    const all = await getAll();
    const vars = Object.values(all[KEYS.VARS]);
    if (!vars.length) return alert('Create a variable first.');
    const varIdx = prompt(`Which variable index to update?\n${vars.map((v, i) => `${i}: ${v.name}`).join('\n')}`, '0');
    const choice = vars[+varIdx || 0];
    if (!choice) return;

    // Limit to selectors whose urlPattern matches the ACTIVE TAB (segment-aware, no query/hash)
    const { url: activeUrl } = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, r));
    const sites = Object.values(all[KEYS.SITES]);
    const allEls = sites
        .filter(s => matchesPattern(s.urlPattern, activeUrl || ''))
        .flatMap(s => s.elements.map(e => ({ site: s, selector: e.selector })));
    if (!allEls.length) return alert('Pick an element first.');
    const elIdx = prompt(`Which element selector index?\n${allEls.map((e, i) => `${i}: ${e.selector} (${e.site.title})`).join('\n')}`, '0');
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
    const idx = +prompt(`Profile index?\n${profiles.map((p, i) => `${i}: ${p.name}`).join('\n')}`, '0') || 0;
    const profile = profiles[idx];
    if (!profile) return;

    // Build mappings preferring explicit var selection, else literal
    const varsByName = Object.fromEntries(Object.values(all[KEYS.VARS]).map(v => [v.name, v.value]));
    const mappings = (profile.mappings || []).map(m => {
        let value = '';
        if (m.varName && varsByName.hasOwnProperty(m.varName)) {
            value = varsByName[m.varName] ?? '';
        } else if (typeof m.value === 'string') {
            // Back-compat for {{var:Name}} if still present in storage
            const match = m.value.match(/^\{\{var:(.+)\}\}$/);
            if (match && varsByName.hasOwnProperty(match[1])) {
                value = varsByName[match[1]] ?? '';
            } else {
                value = m.value;
            }
        }
        return { selector: m.selector, value };
    });

    chrome.runtime.sendMessage({ type: 'PASTE_PROFILE', payload: { mappings } }, (res) => {
        const err = chrome.runtime.lastError?.message;
        if (err) return alert(`Paste failed: ${err}`);
        if (!res?.ok) return alert('Paste failed on this page.');
        const failed = (res.results || []).filter(r => !r.ok);
        if (failed.length) {
          alert(`Pasted with warnings:\n${failed.map(f => `• ${f.selector}`).join('\n')}`);
        }
      });
      
};

// Initial renders
renderVars();
renderSites();
renderProfiles();
