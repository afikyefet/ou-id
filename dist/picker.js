// Lightweight overlay to pick an element and send it back to the extension.
(function () {
    if (window.__ES_PICKER_ACTIVE__) return; // prevent duplicates
    window.__ES_PICKER_ACTIVE__ = true;

    let { robustSelector, getElementValue } = window.__ES_UTILS__ || {};
    // Fallbacks if content.js hasn't populated __ES_UTILS__ yet
    if (!robustSelector) {
        robustSelector = function (el) {
            if (!el || el.nodeType !== 1) return null;
            const id = el.getAttribute('id');
            const name = el.getAttribute('name');
            const dataTestId = el.getAttribute('data-testid');
            const role = el.getAttribute('role');
            const tag = el.tagName.toLowerCase();
            const picks = [];
            if (id && !/\d{3,}/.test(id)) picks.push(`#${CSS.escape(id)}`);
            if (name) picks.push(`[name="${CSS.escape(name)}"]`);
            if (dataTestId) picks.push(`[data-testid="${CSS.escape(dataTestId)}"]`);
            if (role) picks.push(`[role="${CSS.escape(role)}"]`);
            if (picks.length) return `${tag}${picks.join('')}`;
            // simple path
            const path = [];
            let n = el;
            while (n && n.nodeType === 1 && path.length < 5) {
                let sel = n.tagName.toLowerCase();
                const cls = (n.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 2);
                if (cls.length) sel += '.' + cls.map(c => CSS.escape(c)).join('.');
                const p = n.parentElement;
                if (p) {
                    const sibs = Array.from(p.children).filter(x => x.tagName === n.tagName);
                    if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(n) + 1})`;
                }
                path.unshift(sel);
                n = p;
            }
            return path.join(' > ');
        };
    }
    if (!getElementValue) {
        getElementValue = function (el) {
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
        };
    }

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

    let rafId = 0;
    function onMove(e) {
        if (rafId) cancelAnimationFrame(rafId);
        const x = e.clientX, y = e.clientY;
        rafId = requestAnimationFrame(() => {
            const el = document.elementFromPoint(x, y);
            if (!el || el === overlay || el === box) return;
            currentEl = el.closest('input, textarea, [contenteditable=""], [contenteditable="true"], select') || el;
            highlight(currentEl);
        });
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
