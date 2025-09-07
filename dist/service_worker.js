// Element Snapper – background / service worker
// Handles alarms (auto‑copy expiry), central storage utils, and scripting injections.

const STORAGE_KEYS = {
    VARS: 'vars',            // { [varId]: { id, name, value, autoCopyUntil?: number } }
    SITES: 'sites',          // { [siteId]: { id, title, urlPattern, elements: ElementRef[] } }
    PROFILES: 'profiles',    // { [profileId]: { id, name, mappings: Mapping[] } }
    OVERLAY_ENABLED: 'overlayEnabled'  // boolean
};

// Floating window cross-tab management
let floatingVisible = false;
let floatingState = { left: '', top: '', width: '', height: '', minimized: false, visible: false };
let floatingTabId = null;

// Recent copy state for 20s paste offers
let recentCopy = null; // { varId, varName, value, ts }

async function getActiveTabId(fallback = true) {
    // Returns the active tab id in the current window, or throws if none.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        if (fallback) throw new Error('No active tab found');
        return undefined;
    }
    return tab.id;
}

async function showFloatingOn(tabId) {
    try {
        await ensureContentScript(tabId);
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_FLOATING_VARS', payload: floatingState });
        floatingTabId = tabId;
    } catch (_) { }
}

async function hideFloatingOn(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { type: 'HIDE_FLOATING_VARS' });
    } catch (_) { }
}

// Robust content script injection with proper error handling
async function ensureContentScript(tabId) {
    // First, try to ping existing scripts
    const ping = () => new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('PING timeout')), 2000);
        chrome.tabs.sendMessage(tabId, { type: 'PING' }, (r) => {
            clearTimeout(t);
            if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
            res(r && r.pong === true);
        });
    });
    
    try {
        if (await ping()) return true;
    } catch (_) {
        // Scripts not ready, need to inject
    }

    try {
        // Check if page allows script injection (restricted pages)
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js', 'page-overlay.js']
        });
        
        // Wait for scripts to initialize
        await new Promise(r => setTimeout(r, 200));
        
        // Verify injection succeeded
        return await ping().catch(() => false);
    } catch (e) {
        console.error('Failed to inject content script:', e);
        return false;
    }
}

// Robust message sending with proper timeout handling
async function sendToContent(tabId, message, retries = 2) {
    const send = () => new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('Message timeout')), 5000);
        chrome.tabs.sendMessage(tabId, message, (r) => {
            clearTimeout(t);
            if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
            res(r);
        });
    });
    
    for (let i = 0; i <= retries; i++) {
        try {
            await ensureContentScript(tabId);
            return await send();
        } catch (e) {
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, 300));
        }
    }
}



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
            // Prefer sender.tab.id if present (messages from content scripts)
            const tabId = sender?.tab?.id ?? await getActiveTabId();

            if (msg.type === 'INJECT_PICKER') {
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['picker.js'] });
                    sendResponse({ ok: true });
                } catch (e) {
                    // Non-scriptable pages: chrome://, PDF viewer, Web Store, etc.
                    sendResponse({ ok: false, error: 'This page disallows script injection. Try a normal website tab.' });
                }
            }
            else if (msg.type === 'GET_SNAPSHOT') {
                const res = await sendToContent(tabId, {
                    type: 'RESOLVE_ELEMENT_AND_VALUE',
                    payload: msg.payload
                });
                sendResponse(res);
            }
            else if (msg.type === 'PASTE_PROFILE') {
                const res = await sendToContent(tabId, {
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
                if (msg.payload?.varId) {
                    // Clear specific alarm
                    await chrome.alarms.clear(`var-expiry:${msg.payload.varId}`);
                } else {
                    // Clear all alarms
                    await chrome.alarms.clearAll();
                }
                sendResponse({ ok: true });
            }
            else if (msg.type === 'REFRESH_CONTENT_SCRIPT') {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content.js', 'page-overlay.js']
                    });
                    sendResponse({ ok: true });
                } catch (e) {
                    sendResponse({ ok: false, error: e.message });
                }
            }
            else if (msg.type === 'PAGE_CHANGED') {
                // Auto-refresh variables when page changes
                await handlePageChanged(tabId, msg.payload);
                sendResponse({ ok: true });
            }
            else if (msg.type === 'GET_OVERLAY_DATA') {
                const data = await chrome.storage.local.get([STORAGE_KEYS.VARS, STORAGE_KEYS.SITES, STORAGE_KEYS.PROFILES]);
                const overlayEnabled = await getOverlayState();
                sendResponse({
                    data: {
                        vars: data[STORAGE_KEYS.VARS] || {},
                        sites: data[STORAGE_KEYS.SITES] || {},
                        profiles: data[STORAGE_KEYS.PROFILES] || {}
                    },
                    enabled: overlayEnabled
                });
            }
            else if (msg.type === 'TOGGLE_OVERLAY') {
                const enabled = msg.payload?.enabled ?? true;
                await setOverlayState(enabled);

                // Broadcast to all tabs in parallel (faster)
                const tabs = await chrome.tabs.query({});
                const promises = tabs.map(tab =>
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'TOGGLE_OVERLAY',
                        payload: { enabled }
                    }).catch(() => { }) // Ignore errors silently
                );
                await Promise.allSettled(promises);

                sendResponse({ ok: true });
            }
            else if (msg.type === 'SET_FLOATING_STATE') {
                floatingState = { ...floatingState, ...(msg.payload || {}) };
                await chrome.storage.local.set({ floatingState });
                sendResponse({ ok: true });
            }
            else if (msg.type === 'GET_FLOATING_STATE') {
                const { floatingState: saved } = await chrome.storage.local.get('floatingState');
                sendResponse(saved || floatingState);
            }
            else if (msg.type === 'TOGGLE_FLOATING_VARS') {
                floatingVisible = !floatingVisible;
                await chrome.storage.local.set({ floatingVisible });
                const activeTabId = sender?.tab?.id ?? await getActiveTabId();
                if (floatingVisible) {
                    if (floatingTabId && floatingTabId !== activeTabId) await hideFloatingOn(floatingTabId);
                    await showFloatingOn(activeTabId);
                } else {
                    if (floatingTabId) await hideFloatingOn(floatingTabId);
                    floatingTabId = null;
                }
                sendResponse({ ok: true, visible: floatingVisible });
            }
            else if (msg.type === 'UPDATE_VARIABLE_VALUE') {
                const { variableId, newValue } = msg.payload;
                const data = await chrome.storage.local.get(STORAGE_KEYS.VARS);
                const vars = data[STORAGE_KEYS.VARS] || {};

                if (vars[variableId]) {
                    const oldValue = vars[variableId].value;
                    vars[variableId].value = newValue;
                    vars[variableId].lastUpdated = Date.now();

                    await chrome.storage.local.set({ [STORAGE_KEYS.VARS]: vars });

                    // Build & broadcast a "recent copy" for 20s paste offers
                    const now = Date.now();
                    const varId = msg?.payload?.variableId;
                    const varName = (vars[varId]?.name) || 'Variable';
                    const value = msg?.payload?.newValue ?? '';

                    recentCopy = { varId, varName, value, ts: now };

                    const sendTo = async () => {
                        const targetTabId = sender?.tab?.id ?? (await getActiveTabId?.());
                        if (!targetTabId) return;
                        try {
                            await chrome.tabs.sendMessage(targetTabId, {
                                type: 'FF_SET_RECENT_COPY',
                                payload: recentCopy
                            });
                        } catch (_) { }
                    };
                    sendTo();

                    // Broadcast data update to page overlays
                    await broadcastDataUpdate();

                    // Broadcast update to all tabs
                    const tabs = await chrome.tabs.query({});
                    for (const tab of tabs) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, {
                                type: 'VARIABLE_UPDATED',
                                payload: {
                                    variableId,
                                    variableName: vars[variableId].name,
                                    oldValue,
                                    newValue
                                }
                            });
                        } catch (e) {
                            // Tab might not have content script
                        }
                    }
                }
                sendResponse({ ok: true });
            }
        } catch (e) {
            console.error(e);
            sendResponse({ ok: false, error: String(e) });
        }
    })();
    return true; // async
});

// Handle page changes for auto-copy variables
async function handlePageChanged(tabId, payload) {
    try {
        const { url, timestamp } = payload;
        const data = await chrome.storage.local.get([STORAGE_KEYS.VARS, STORAGE_KEYS.SITES]);
        const vars = data[STORAGE_KEYS.VARS] || {};
        const sites = data[STORAGE_KEYS.SITES] || {};

        console.log(`Page changed: ${url}`);

        // Find variables with active auto-copy timers
        const activeVars = Object.values(vars).filter(v =>
            v.autoCopyUntil && v.autoCopyUntil > Date.now()
        );

        if (activeVars.length === 0) return;

        console.log(`Found ${activeVars.length} active auto-copy variables`);

        // Find site that matches current URL
        const matchingSite = Object.values(sites).find(site =>
            matchesPatternInBackground(site.urlPattern, url)
        );

        if (!matchingSite) {
            console.log('No matching site found for URL:', url);
            return;
        }

        console.log(`Matched site: ${matchingSite.title} (${matchingSite.urlPattern})`);

        // Update variables that have source selectors from this site
        const updatedVars = {};

        for (const variable of activeVars) {
            if (variable.sourceSiteId === matchingSite.id && variable.sourceSelector) {
                try {
                    console.log(`Updating variable ${variable.name} with selector: ${variable.sourceSelector}`);

                    const response = await sendToContent(tabId, {
                        type: 'RESOLVE_ELEMENT_AND_VALUE',
                        payload: { selector: variable.sourceSelector }
                    });

                    if (response?.ok && response.value !== undefined) {
                        const oldValue = variable.value;
                        const newValue = response.value;

                        updatedVars[variable.id] = {
                            ...variable,
                            value: newValue,
                            lastUpdated: timestamp
                        };

                        console.log(`✓ Updated ${variable.name}: "${oldValue}" -> "${newValue}"`);

                        // Notify popup of variable update
                        try {
                            chrome.runtime.sendMessage({
                                type: 'VARIABLE_UPDATED',
                                payload: {
                                    variableId: variable.id,
                                    variableName: variable.name,
                                    oldValue,
                                    newValue
                                }
                            });
                        } catch (e) {
                            // Popup might not be open, ignore error
                        }
                    } else {
                        console.log(`✗ Could not resolve ${variable.name} (selector: ${variable.sourceSelector})`);
                    }
                } catch (error) {
                    console.error(`Failed to update variable ${variable.name}:`, error);
                }
            }
        }

        // Save updated variables
        if (Object.keys(updatedVars).length > 0) {
            const allVars = { ...vars, ...updatedVars };
            await chrome.storage.local.set({ [STORAGE_KEYS.VARS]: allVars });

            // Broadcast data update to page overlays
            await broadcastDataUpdate();

            console.log(`Updated ${Object.keys(updatedVars).length} variables`);
        }

    } catch (error) {
        console.error('Error in handlePageChanged:', error);
    }
}

// Background pattern matching
function matchesPatternInBackground(pattern, url) {
    try {
        const p = new URL(pattern.replace('/*', '/'));
        const u = new URL(url);
        if (p.origin !== u.origin) return false;

        const pPath = pattern.endsWith('/*') ? p.pathname : pattern.replace(p.origin, '');
        const pSegs = pPath.replace(/\/+$/, '').split('/').filter(Boolean);
        const uSegs = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

        const allowTail = pattern.endsWith('/*');
        if (!allowTail && pSegs.length !== uSegs.length) return false;
        if (allowTail && uSegs.length < pSegs.length) return false;

        for (let i = 0; i < pSegs.length; i++) {
            const ps = pSegs[i], us = uSegs[i];
            if (ps !== '*' && ps !== us) return false;
        }
        return true;
    } catch {
        const clean = (s) => s.split(/[?#]/)[0];
        return clean(url).startsWith(clean(pattern.replace(/\/\*$/, '')));
    }
}

// Overlay state management
async function getOverlayState() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.OVERLAY_ENABLED);
    return result[STORAGE_KEYS.OVERLAY_ENABLED] ?? true; // Default to enabled
}

async function setOverlayState(enabled) {
    await chrome.storage.local.set({ [STORAGE_KEYS.OVERLAY_ENABLED]: enabled });
}

// Broadcast data updates to all tabs
async function broadcastDataUpdate() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.VARS, STORAGE_KEYS.SITES, STORAGE_KEYS.PROFILES]);
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'UPDATE_OVERLAY_DATA',
                payload: {
                    vars: data[STORAGE_KEYS.VARS] || {},
                    sites: data[STORAGE_KEYS.SITES] || {},
                    profiles: data[STORAGE_KEYS.PROFILES] || {}
                }
            });
        } catch (e) {
            // Tab might not have content script
        }
    }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith('var-expiry:')) return;
    const varId = alarm.name.split(':')[1];
    const all = await chrome.storage.local.get(STORAGE_KEYS.VARS);
    const vars = all[STORAGE_KEYS.VARS] || {};
    if (vars[varId]) {
        delete vars[varId].autoCopyUntil;
        await chrome.storage.local.set({ [STORAGE_KEYS.VARS]: vars });
        console.log(`Auto-copy timer expired for variable: ${vars[varId]?.name || varId}`);
    }
});

// Broadcast data changes so the overlay updates live
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.vars || changes.sites || changes.profiles) {
        try {
            await broadcastDataUpdate();
        } catch (_) {
            // Ignore errors if tabs don't respond
        }
    }
});

// Follow the active tab with floating window
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const { floatingVisible: vis } = await chrome.storage.local.get('floatingVisible');
    floatingVisible = !!vis;
    if (!floatingVisible) return;
    if (floatingTabId && floatingTabId !== tabId) await hideFloatingOn(floatingTabId);
    await showFloatingOn(tabId);
});

chrome.windows.onFocusChanged.addListener(async () => {
    const tabId = await getActiveTabId(false);
    const { floatingVisible: vis } = await chrome.storage.local.get('floatingVisible');
    floatingVisible = !!vis;
    if (!floatingVisible || !tabId) return;
    if (floatingTabId && floatingTabId !== tabId) await hideFloatingOn(floatingTabId);
    await showFloatingOn(tabId);
});
