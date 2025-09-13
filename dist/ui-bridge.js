(function () {
    try {
        const tablist = document.querySelector('nav.tabs');
        const tabs = Array.from(document.querySelectorAll('nav.tabs button'));
        const panels = Array.from(document.querySelectorAll('main .tab'));

        if (tablist && tabs.length && panels.length) {
            tablist.setAttribute('role', 'tablist');
            tabs.forEach((btn) => {
                btn.setAttribute('role', 'tab');
                const targetId = 'tab-' + btn.dataset.tab;
                btn.setAttribute('aria-controls', targetId);
                const selected = btn.classList.contains('active');
                btn.setAttribute('aria-selected', selected ? 'true' : 'false');
                btn.setAttribute('tabindex', selected ? '0' : '-1');
            });
            panels.forEach((panel) => {
                panel.setAttribute('role', 'tabpanel');
                const active = panel.classList.contains('active');
                panel.setAttribute('aria-hidden', active ? 'false' : 'true');
            });

            // Sync ARIA when tabs change (hook into existing clicks)
            tablist.addEventListener('click', (e) => {
                const btn = e.target.closest('button[role="tab"]');
                if (!btn) return;
                tabs.forEach((t) => {
                    const isSel = t === btn;
                    t.setAttribute('aria-selected', isSel ? 'true' : 'false');
                    t.setAttribute('tabindex', isSel ? '0' : '-1');
                });
                panels.forEach((p) => {
                    const isActive = ('#' + p.id) === ('#tab-' + btn.dataset.tab);
                    p.setAttribute('aria-hidden', isActive ? 'false' : 'true');
                });
            });

            // Keyboard navigation for tabs
            tablist.addEventListener('keydown', (e) => {
                const current = document.activeElement;
                if (!tabs.includes(current)) return;
                let idx = tabs.indexOf(current);
                if (e.key === 'ArrowRight') { idx = (idx + 1) % tabs.length; tabs[idx].focus(); e.preventDefault(); tabs[idx].click(); }
                if (e.key === 'ArrowLeft') { idx = (idx - 1 + tabs.length) % tabs.length; tabs[idx].focus(); e.preventDefault(); tabs[idx].click(); }
            });
        }

        // Tooltips and ARIA for primary actions
        const ariaMap = [
            ['btn-pick', 'Pick element', 'Pick an element on page'],
            ['btn-copy-active', 'Copy from page', 'Copy value from a tracked element'],
            ['btn-refresh-content', 'Refresh scripts', 'Reinject content scripts'],
            ['btn-toggle-overlay', 'Page controls', 'Toggle on-page controls'],
            ['btn-floating-vars', 'Floating vars', 'Toggle floating variables panel'],
            ['add-var', 'Add variable', 'Create new variable'],
            ['btn-new-profile-here', 'New profile', 'Create a profile for this page'],
            ['btn-fill-form', 'Fill form', 'Fill form using selected profile']
        ];
        ariaMap.forEach(([id, aria, title]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.setAttribute('aria-label', aria);
            if (!el.title) el.title = title;
        });

        // Reposition popup notification area to bottom-left (iOS toast vibe)
        const notifArea = document.getElementById('notification-area');
        if (notifArea) {
            notifArea.style.top = 'auto';
            notifArea.style.right = 'auto';
            notifArea.style.bottom = '12px';
            notifArea.style.left = '12px';
        }

        // Sync pressed state for overlay toggle
        (async function syncToggles() {
            const overlayBtn = document.getElementById('btn-toggle-overlay');
            if (overlayBtn) {
                try {
                    const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_OVERLAY_DATA' }, r));
                    const enabled = !!res?.enabled;
                    overlayBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
                } catch (_) {
                    // ignore
                }
                overlayBtn.addEventListener('click', () => {
                    const pressed = overlayBtn.getAttribute('aria-pressed') === 'true';
                    overlayBtn.setAttribute('aria-pressed', (!pressed).toString());
                });
            }

            const floatBtn = document.getElementById('btn-floating-vars');
            if (floatBtn) {
                try {
                    const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_FLOATING_STATE' }, r));
                    const visible = !!res?.visible;
                    floatBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
                } catch (_) {
                    // ignore if background doesn't support
                }
                floatBtn.addEventListener('click', async () => {
                    // Re-query shortly after toggle to reflect real state if available
                    setTimeout(async () => {
                        try {
                            const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_FLOATING_STATE' }, r));
                            const visible = !!res?.visible;
                            floatBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
                        } catch (_) { }
                    }, 150);
                });
            }
        })();
    } catch (e) {
        // Ensure no console errors stop the popup; fail silently
    }
})();


