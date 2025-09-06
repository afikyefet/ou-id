// Element Snapper – background / service worker
// Handles alarms (auto‑copy expiry), central storage utils, and scripting injections.

const STORAGE_KEYS = {
    VARS: 'vars',            // { [varId]: { id, name, value, autoCopyUntil?: number } }
    SITES: 'sites',          // { [siteId]: { id, title, urlPattern, elements: ElementRef[] } }
    PROFILES: 'profiles'     // { [profileId]: { id, name, mappings: Mapping[] } }
};

async function getActiveTabId(fallback = true) {
    // Returns the active tab id in the current window, or throws if none.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        if (fallback) throw new Error('No active tab found');
        return undefined;
    }
    return tab.id;
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
                const res = await chrome.tabs.sendMessage(tabId, {
                    type: 'RESOLVE_ELEMENT_AND_VALUE',
                    payload: msg.payload
                });
                sendResponse(res);
            }
            else if (msg.type === 'PASTE_PROFILE') {
                const res = await chrome.tabs.sendMessage(tabId, {
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
