// Lightweight overlay to pick an element and send it back to the extension.
(function () {
    if (window.__ES_PICKER_ACTIVE__) return; // prevent duplicates
    window.__ES_PICKER_ACTIVE__ = true;

    const { robustSelector, getElementValue } = window.__ES_UTILS__ || {};

    // Fallback implementations in case content.js hasn't loaded yet
    const getSelectorFn = robustSelector || function(el) {
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
    };

    const getValueFn = getElementValue || function(el) {
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
    };

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
    badge.innerHTML = '<div style="text-align: center;"><strong>Click to capture • ESC to cancel</strong></div><div id="element-info" style="margin-top: 4px; font-size: 11px; color: #ccc;"></div>';
    badge.style.position = 'fixed';
    badge.style.left = '50%';
    badge.style.transform = 'translateX(-50%)';
    badge.style.bottom = '16px';
    badge.style.padding = '8px 12px';
    badge.style.borderRadius = '8px';
    badge.style.background = 'rgba(17,17,17,0.95)';
    badge.style.color = '#fff';
    badge.style.font = '12px/1.3 system-ui, sans-serif';
    badge.style.pointerEvents = 'none';
    badge.style.opacity = '1';
    badge.style.backdropFilter = 'blur(8px)';
    badge.style.border = '1px solid rgba(255,255,255,0.2)';
    badge.style.zIndex = '2147483647';
    badge.style.maxWidth = '300px';
    overlay.appendChild(badge);
    
    const elementInfo = badge.querySelector('#element-info');

    let currentEl = null;

    function highlight(el) {
        if (!el) {
            elementInfo.textContent = '';
            return;
        }
        
        const rect = el.getBoundingClientRect();
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
        
        // Show smart element analysis
        try {
            const analysis = window.__ES_UTILS__?.analyzeElement?.(el);
            if (analysis) {
                let info = `${analysis.purpose}`;
                if (analysis.hasValue && analysis.value) {
                    info += ` • "${analysis.value}"`;
                }
                elementInfo.textContent = info;
            } else {
                elementInfo.textContent = `${el.tagName.toLowerCase()} element`;
            }
        } catch (e) {
            elementInfo.textContent = `${el.tagName.toLowerCase()} element`;
        }
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

    function onClick(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        
        // Click-time element resolution for cases where user clicks without moving mouse
        // Support shadow DOM via composedPath()
        let targetEl = currentEl;
        if (!targetEl) {
            const path = e.composedPath?.() || [];
            targetEl = path[0] || document.elementFromPoint(e.clientX, e.clientY);
            if (targetEl) {
                targetEl = targetEl.closest('input, textarea, select, [contenteditable], [contenteditable="true"]') || targetEl;
            }
        }
        
        if (!targetEl) return;
        
        const selector = getSelectorFn(targetEl);
        const value = getValueFn(targetEl);
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