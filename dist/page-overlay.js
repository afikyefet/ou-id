// Interactive page overlay system - shows copy/paste controls directly on elements
(function () {
    if (window.__ES_PAGE_OVERLAY_ACTIVE__) return;
    window.__ES_PAGE_OVERLAY_ACTIVE__ = true;

    let overlayElements = new Map(); // Map<Element, Set<HTMLElement>>
    let currentData = { vars: {}, sites: {}, profiles: {} };
    let isEnabled = false;
    let floatingWindow = null;
    let recentVars = [];
    let isMainTab = false; // Only one tab will own the floating window

    // Recent copy state for 20s paste offers
    const RECENT_TTL_MS = 20000;  // 20 seconds
    let recentCopy = null;        // { varId, varName, value, ts }
    let recentTimer = null;       // timeout handle
    let pasteChip = null;         // DOM for the chip
    let focusedEl = null;         // currently focused editable element

    // Material Design CSS Custom Properties for theming
    const themeStyles = `
        :root {
            --es-primary: var(--md-primary, #6750A4);
            --es-secondary: var(--md-secondary, #625B71);
            --es-success: var(--md-success, #006A6B);
            --es-error: var(--md-error, #BA1A1A);
            --es-background: var(--md-surface, #FEFBFF);
            --es-surface: var(--md-surface-variant, #E7E0EC);
            --es-text: var(--md-on-surface, #1C1B1F);
            --es-text-muted: var(--md-on-surface-variant, #49454F);
            --es-accent: var(--md-primary, #6750A4);
            --es-border: var(--md-outline-variant, #CAC4D0);
            --es-shadow: rgba(0,0,0,0.15);
            --es-radius: var(--radius-md, 8px);
            --es-space: var(--space-sm, 8px);
        }
        
        [data-es-theme="light"] {
            --es-primary: #0A84FF;
            --es-secondary: #6B7280;
            --es-success: #34C759;
            --es-background: rgba(247,247,249,0.92);
            --es-surface: rgba(0,0,0,0.06);
            --es-text: #111111;
            --es-text-muted: rgba(60,60,67,0.6);
            --es-accent: #007AFF;
            --es-border: rgba(0,0,0,0.12);
            --es-shadow: rgba(0,0,0,0.18);
        }
        
        [data-es-theme="gold"] {
            --es-primary: #FFB800;
            --es-secondary: #6B7280;
            --es-success: #32D74B;
            --es-background: rgba(251,245,230,0.92);
            --es-surface: rgba(255,184,0,0.18);
            --es-text: #3a2d16;
            --es-text-muted: rgba(58,45,22,0.7);
            --es-accent: #FFD60A;
            --es-border: rgba(255,184,0,0.28);
            --es-shadow: rgba(0,0,0,0.25);
        }
    `;

    // Styles for the overlay controls
    const overlayStyles = `
        .es-copy-indicator {
            position: absolute !important;
            width: 18px !important;
            height: 18px !important;
            border-radius: 50% !important;
            background: var(--es-primary) !important;
            color: #fff !important;
            border: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            cursor: pointer !important;
            pointer-events: auto !important;
            z-index: 2147483646 !important;
            box-shadow: 0 2px 8px var(--es-shadow) !important;
            transition: all 0.2s ease !important;
        }
        
        .es-copy-indicator:hover {
            transform: scale(1.1) !important;
            box-shadow: 0 2px 8px var(--es-shadow) !important;
        }
        
        .es-paste-button {
            position: absolute !important;
            background: var(--es-success) !important;
            color: #fff !important;
            border: none !important;
            border-radius: 10px !important;
            padding: 4px 8px !important;
            font-size: 11px !important;
            font-family: -apple-system, system-ui, sans-serif !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            box-shadow: 0 2px 8px var(--es-shadow) !important;
            transition: all 0.2s ease !important;
            pointer-events: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            white-space: nowrap !important;
            backdrop-filter: blur(8px) !important;
        }
        
        .es-paste-button:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 4px 12px var(--es-shadow) !important;
        }
        
        .es-element-highlight {
            outline: 1px solid var(--es-accent) !important;
            outline-offset: 0px !important;
            border-radius: 4px !important;
            background: color-mix(in srgb, var(--es-accent) 4%, transparent) !important;
        }
        
        .es-paste-highlight {
            outline: 1px solid var(--es-success) !important;
            outline-offset: 0px !important;
            border-radius: 4px !important;
            background: color-mix(in srgb, var(--es-success) 5%, transparent) !important;
        }
        
        .es-toast-container {
            position: fixed !important;
            bottom: 16px !important;
            left: 16px !important;
            z-index: 2147483647 !important;
            display: flex !important;
            flex-direction: column-reverse !important;
            gap: 8px !important;
            pointer-events: none !important;
        }
        
        .es-toast {
            background: var(--es-background) !important;
            color: var(--es-text) !important;
            padding: 12px 16px !important;
            border-radius: 10px !important;
            font-size: 13px !important;
            font-family: -apple-system, system-ui, sans-serif !important;
            box-shadow: 0 8px 24px var(--es-shadow) !important;
            backdrop-filter: blur(10px) !important;
            border: 1px solid var(--es-border) !important;
            pointer-events: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            min-width: 200px !important;
            max-width: 300px !important;
            transform: translateY(100%) !important;
            opacity: 0 !important;
            transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        
        .es-toast.es-toast-show {
            transform: translateY(0) !important;
            opacity: 1 !important;
        }
        
        .es-toast.es-toast-hide {
            transform: translateY(100%) !important;
            opacity: 0 !important;
        }
        
        .es-toast-icon {
            flex-shrink: 0 !important;
            font-size: 16px !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .es-toast-content {
            flex: 1 !important;
            min-width: 0 !important;
        }
        
        .es-toast-title {
            font-weight: 500 !important;
            margin: 0 0 2px 0 !important;
            font-size: 13px !important;
        }
        
        .es-toast-message {
            font-size: 12px !important;
            opacity: 0.8 !important;
            margin: 0 !important;
        }
        
        .es-toast-close {
            background: none !important;
            border: none !important;
            color: var(--es-text) !important;
            opacity: 0.6 !important;
            cursor: pointer !important;
            padding: 2px !important;
            border-radius: 2px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 16px !important;
            height: 16px !important;
            font-size: 12px !important;
            transition: opacity 0.2s ease !important;
        }
        
        .es-toast-close:hover {
            opacity: 1 !important;
            background: color-mix(in srgb, var(--es-text) 10%, transparent) !important;
        }
        
        .es-toast.es-toast-success {
            border-left: 3px solid var(--es-success) !important;
        }
        
        .es-toast.es-toast-error {
            border-left: 3px solid #FF3B30 !important;
        }
        
        .es-toast.es-toast-warning {
            border-left: 3px solid #FF9500 !important;
        }
        
        .es-toast.es-toast-info {
            border-left: 3px solid var(--es-accent) !important;
        }
        
        @keyframes esSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes esSlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .es-floating-window {
            position: fixed !important;
            top: 100px !important;
            right: 20px !important;
            width: 240px !important;
            max-height: 350px !important;
            background: var(--es-background) !important;
            border: 1px solid var(--es-border) !important;
            border-radius: var(--es-radius) !important;
            box-shadow: 0 12px 30px var(--es-shadow) !important;
            backdrop-filter: blur(14px) !important;
            z-index: 2147483645 !important;
            font-family: var(--font-family, -apple-system, system-ui, sans-serif) !important;
            color: var(--es-text) !important;
            resize: both !important;
            overflow: hidden !important;
        }
        
        .es-floating-header {
            padding: 8px 12px !important;
            border-bottom: 1px solid var(--es-surface) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: move !important;
            background: color-mix(in srgb, var(--es-accent) 6%, transparent) !important;
        }
        
        .es-floating-title {
            font-size: 12px !important;
            font-weight: 600 !important;
            margin: 0 !important;
        }
        
        .es-floating-close {
            background: none !important;
            border: none !important;
            color: var(--es-text) !important;
            cursor: pointer !important;
            font-size: 14px !important;
            padding: 2px !important;
            border-radius: 3px !important;
            opacity: 0.7 !important;
            line-height: 1 !important;
        }
        
        .es-floating-close:hover {
            background: color-mix(in srgb, var(--es-text) 10%, transparent) !important;
            opacity: 1 !important;
        }
        
        .es-floating-content {
            padding: 8px !important;
            max-height: 280px !important;
            overflow-y: auto !important;
        }
        
        .es-var-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 6px 0 !important;
            border-bottom: 1px solid var(--es-border) !important;
        }
        
        .es-var-info {
            flex: 1 !important;
            min-width: 0 !important;
        }
        
        .es-var-name {
            font-size: 11px !important;
            font-weight: 500 !important;
            color: var(--es-accent) !important;
            margin-bottom: 1px !important;
        }
        
        .es-var-value {
            font-size: 10px !important;
            color: var(--es-text-muted) !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        
        .es-var-copy {
            background: linear-gradient(135deg, var(--es-success) 0%, var(--es-success) 100%) !important;
            color: var(--es-text) !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 3px 6px !important;
            font-size: 9px !important;
            cursor: pointer !important;
            margin-left: 6px !important;
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            transition: all 0.2s ease !important;
        }
        
        .es-var-copy:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 2px 8px var(--es-shadow) !important;
        }
        
        .es-recent-section {
            margin-top: 8px !important;
            padding-top: 8px !important;
            border-top: 1px solid var(--es-border) !important;
        }
        
        .es-section-title {
            font-size: 10px !important;
            font-weight: 600 !important;
            color: var(--es-text-muted) !important;
            margin-bottom: 6px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.3px !important;
        }
        
        .es-floating-actions {
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        }
        
        .es-floating-theme,
        .es-floating-min {
            background: none !important;
            border: none !important;
            color: var(--es-text) !important;
            opacity: 0.8 !important;
            cursor: pointer !important;
            font-size: 14px !important;
            padding: 2px !important;
            border-radius: 3px !important;
            line-height: 1 !important;
        }
        
        .es-floating-theme:hover,
        .es-floating-min:hover {
            background: color-mix(in srgb, var(--es-text) 10%, transparent) !important;
            opacity: 1 !important;
        }
        
        .es-floating-window.es-minimized {
            width: 220px !important;
            height: auto !important;
            overflow: hidden !important;
        }
        
        .es-floating-window.es-minimized .es-floating-content {
            display: none !important;
        }
        
        .es-floating-window:focus-visible {
            outline: 2px solid var(--es-accent) !important;
            outline-offset: 2px !important;
            border-radius: 12px !important;
        }
        
        .es-btn:focus-visible,
        .es-copy-indicator:focus-visible {
            outline: 2px solid var(--es-accent) !important;
            outline-offset: 2px !important;
            border-radius: 8px !important;
        }
        
        .es-paste-chip {
            position: absolute !important;
            z-index: 2147483646 !important;
            pointer-events: auto !important;
            background: var(--es-accent) !important;
            color: #fff !important;
            border: none !important;
            border-radius: 10px !important;
            padding: 2px 8px !important;
            font: 12px/1 system-ui, sans-serif !important;
            box-shadow: 0 1px 4px rgba(0,0,0,.25) !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        }
        
        .es-paste-chip:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 2px 8px rgba(0,0,0,.3) !important;
        }
        
        .es-paste-chip:focus-visible {
            outline: 2px solid #fff !important;
            outline-offset: 2px !important;
        }
    `;

    // Inject Material Symbols font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@300';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Inject theme and overlay styles
    const themeStyleSheet = document.createElement('style');
    themeStyleSheet.textContent = themeStyles;
    document.head.appendChild(themeStyleSheet);

    const overlayStyleSheet = document.createElement('style');
    overlayStyleSheet.textContent = overlayStyles;
    document.head.appendChild(overlayStyleSheet);

    // ==== Accessibility: ARIA-live region
    let esLive = document.getElementById('es-aria-live');
    if (!esLive) {
        esLive = document.createElement('div');
        esLive.id = 'es-aria-live';
        esLive.setAttribute('aria-live', 'polite');
        esLive.style.position = 'fixed';
        esLive.style.left = '-9999px';
        esLive.style.top = '0';
        document.body.appendChild(esLive);
    }
    function announce(msg) { esLive.textContent = msg; }

    // Helper for tracking multiple overlays per element
    function trackOverlay(target, overlayEl) {
        let set = overlayElements.get(target);
        if (!set) {
            set = new Set();
            overlayElements.set(target, set);
        }
        set.add(overlayEl);
    }

    // Shadow DOM-aware selector resolution using shared utilities
    function resolveSelectorAcrossShadows(css) {
        // Use shared resolver if available, otherwise fallback to local implementation
        if (window.__ES_SELECTOR_UTILS__) {
            return window.__ES_SELECTOR_UTILS__.resolveSelectorAcrossShadows(css);
        }

        // Fallback implementation
        try {
            const el = document.querySelector(css);
            if (el) return el;
        } catch { }

        const hosts = document.querySelectorAll('*');
        for (const host of hosts) {
            if (host.shadowRoot) {
                try {
                    const inside = host.shadowRoot.querySelector(css);
                    if (inside) return inside;
                } catch { }
            }
        }
        return null;
    }

    // Professional Toast Notification System
    let toastContainer = null;
    let toastCounter = 0;

    function ensureToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'es-toast-container';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function showToast(options) {
        const {
            title = '',
            message = '',
            type = 'info', // 'success', 'error', 'warning', 'info'
            duration = 3000,
            closable = true
        } = options;

        // Handle legacy string input
        if (typeof options === 'string') {
            return showToast({ message: options, duration: arguments[1] || 3000 });
        }

        const container = ensureToastContainer();
        const toastId = `toast-${++toastCounter}`;

        // Icon mapping
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `es-toast es-toast-${type}`;
        toast.id = toastId;

        const icon = document.createElement('div');
        icon.className = 'es-toast-icon';
        icon.textContent = icons[type] || icons.info;

        const content = document.createElement('div');
        content.className = 'es-toast-content';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'es-toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'es-toast-message';
            messageEl.textContent = message;
            content.appendChild(messageEl);
        }

        toast.appendChild(icon);
        toast.appendChild(content);

        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'es-toast-close';
            closeBtn.innerHTML = '×';
            closeBtn.setAttribute('aria-label', 'Close notification');
            closeBtn.addEventListener('click', () => hideToast(toastId));
            toast.appendChild(closeBtn);
        }

        container.appendChild(toast);

        // Announce to screen readers
        const announcement = title ? `${title}. ${message}` : message;
        announce(announcement);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('es-toast-show');
        });

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => hideToast(toastId), duration);
        }

        return toastId;
    }

    function hideToast(toastId) {
        const toast = document.getElementById(toastId);
        if (!toast) return;

        toast.classList.add('es-toast-hide');
        toast.classList.remove('es-toast-show');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Legacy function for backward compatibility
    function showNotification(message, duration = 2000) {
        return showToast({ message, duration, type: 'info' });
    }

    // ==== Theme Management
    let currentTheme = 'dark'; // default theme

    // Load saved theme from storage or detect system preference
    async function initializeTheme() {
        try {
            const result = await chrome.storage.local.get(['es_theme']);
            if (result.es_theme) {
                currentTheme = result.es_theme;
            } else {
                // Auto-detect system theme preference
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                    currentTheme = 'light';
                }
            }
            applyTheme(currentTheme);
        } catch (e) {
            // Fallback for non-extension context
            currentTheme = 'dark';
            applyTheme(currentTheme);
        }
    }

    function applyTheme(theme) {
        currentTheme = theme;
        if (theme === 'light') {
            document.documentElement.setAttribute('data-es-theme', 'light');
        } else if (theme === 'gold') {
            document.documentElement.setAttribute('data-es-theme', 'gold');
        } else {
            document.documentElement.removeAttribute('data-es-theme'); // default dark
        }

        // Save theme preference
        try {
            chrome.storage.local.set({ es_theme: theme });
        } catch (e) {
            // Non-extension context, could use localStorage as fallback
        }
    }

    function cycleTheme() {
        const themes = ['dark', 'light', 'gold'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        applyTheme(nextTheme);

        const themeNames = { dark: 'Dark', light: 'Light', gold: 'Gold (Sponsor)' };
        showToast({
            title: 'Theme Changed',
            message: `Switched to ${themeNames[nextTheme]} theme`,
            type: 'info',
            duration: 1500
        });
    }

    // Initialize theme on load
    initializeTheme();

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
            if (currentTheme === 'auto' || (!currentTheme)) {
                applyTheme(e.matches ? 'light' : 'dark');
            }
        });
    }

    // ==== Floating Panel Snap & Nudge Config
    const FF_SNAP = 8;              // snap margin (px)
    const FF_NUDGE = 1;             // Alt+Arrow step
    const FF_NUDGE_FAST = 10;       // Shift+Alt step

    function snapToEdge(win) {
        const r = win.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        // distances to edges
        const dLeft = r.left;
        const dRight = vw - (r.left + r.width);
        const dTop = r.top;
        const dBottom = vh - (r.top + r.height);

        // snap horizontally
        if (Math.min(dLeft, dRight) <= 64) {
            if (dLeft <= dRight) {
                win.style.left = `${FF_SNAP + window.scrollX}px`;
                win.style.right = 'auto';
            } else {
                win.style.left = 'auto';
                win.style.right = `${FF_SNAP}px`;
            }
        }
        // snap vertically
        if (Math.min(dTop, dBottom) <= 64) {
            if (dTop <= dBottom) {
                win.style.top = `${FF_SNAP + window.scrollY}px`;
                win.style.bottom = 'auto';
            } else {
                win.style.top = 'auto';
                win.style.bottom = `${FF_SNAP}px`;
            }
        }
    }

    function clampToViewport(win) {
        const r = win.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        let left = r.left, top = r.top;

        if (left < FF_SNAP) left = FF_SNAP;
        if (top < FF_SNAP) top = FF_SNAP;
        if (left + r.width > vw - FF_SNAP) left = vw - r.width - FF_SNAP;
        if (top + r.height > vh - FF_SNAP) top = vh - r.height - FF_SNAP;

        win.style.left = `${left + window.scrollX}px`;
        win.style.top = `${top + window.scrollY}px`;
    }

    function onDragEnd() {
        clampToViewport(floatingWindow);
        snapToEdge(floatingWindow);
        persistFloatingState(floatingWindow);
    }

    function bindNudgeKeys(win) {
        win.setAttribute('tabindex', '0'); // focusable
        win.addEventListener('keydown', (e) => {
            if (!e.altKey) return;
            const step = e.shiftKey ? FF_NUDGE_FAST : FF_NUDGE;
            const r = win.getBoundingClientRect();
            let left = r.left, top = r.top;
            if (e.key === 'ArrowLeft') left -= step;
            if (e.key === 'ArrowRight') left += step;
            if (e.key === 'ArrowUp') top -= step;
            if (e.key === 'ArrowDown') top += step;
            win.style.left = `${left + window.scrollX}px`;
            win.style.top = `${top + window.scrollY}px`;
            clampToViewport(win);
            e.preventDefault();
            persistFloatingState(win);
        });
    }

    // Background-managed floating window persistence
    function readFloatingState() {
        return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_FLOATING_STATE' }, r));
    }

    function persistFloatingState(win) {
        const rect = win.getBoundingClientRect();
        const state = {
            left: win.style.left || (rect.left + 'px'),
            top: win.style.top || (rect.top + 'px'),
            width: win.style.width || '',
            height: win.style.height || '',
            minimized: win.classList.contains('es-minimized'),
            visible: true
        };
        chrome.runtime.sendMessage({ type: 'SET_FLOATING_STATE', payload: state }).catch(() => { });
    }

    // Create floating vars window (fixed)
    function createFloatingWindow() {
        if (floatingWindow) return floatingWindow;

        const panel = document.createElement('div');
        panel.className = 'es-floating-window';
        panel.innerHTML = `
      <div class="es-floating-header">
        <h3 class="es-floating-title">Variables</h3>
        <div class="es-floating-actions">
          <button class="es-floating-theme icon-btn small" title="Switch Theme" aria-label="Switch Theme">
            <span class="material-symbols-outlined">palette</span>
          </button>
          <button class="es-floating-min icon-btn small" title="Minimize" aria-label="Minimize">
            <span class="material-symbols-outlined">minimize</span>
          </button>
          <button class="es-floating-close icon-btn small" title="Close" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      <div class="es-floating-content">
        <div class="es-vars-list"></div>
        <div class="es-recent-section">
          <div class="es-section-title">Recently Updated</div>
          <div class="es-recent-list"></div>
        </div>
      </div>
    `;

        // Drag
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        const header = panel.querySelector('.es-floating-header');

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
        });

        function handleDrag(e) {
            if (!isDragging) return;
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            panel.style.left = Math.max(0, Math.min(vw - panel.offsetWidth, x)) + 'px';
            panel.style.top = Math.max(0, Math.min(vh - panel.offsetHeight, y)) + 'px';
            panel.style.right = 'auto';
            persistFloatingState(panel);
        }

        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            onDragEnd();
        }

        // Resize → persist
        const resizeObserver = new ResizeObserver(() => persistFloatingState(panel));
        resizeObserver.observe(panel);

        // Buttons (no duplicate consts)
        const themeBtn = panel.querySelector('.es-floating-theme');
        const minBtn = panel.querySelector('.es-floating-min');
        const closeBtn = panel.querySelector('.es-floating-close');

        themeBtn.addEventListener('click', cycleTheme);
        minBtn.addEventListener('click', () => {
            panel.classList.toggle('es-minimized');
            persistFloatingState(panel);
        });
        closeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'TOGGLE_FLOATING_VARS' }).catch(() => { });
        });

        // A11y
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'FillFlux Variables Panel');
        panel.setAttribute('tabindex', '0');
        themeBtn.setAttribute('aria-label', 'Switch theme');
        minBtn.setAttribute('aria-label', 'Minimize');
        closeBtn.setAttribute('aria-label', 'Close');

        document.body.appendChild(panel);
        floatingWindow = panel;
        restoreFloatingState(panel); // if you have this helper
        return panel;
    }

    async function restoreFloatingState(panel) {
        try {
            const state = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_FLOATING_STATE' }, r));
            if (!state || !panel) return;
            if (state.left) { panel.style.left = state.left; panel.style.right = 'auto'; }
            if (state.top) panel.style.top = state.top;
            if (state.width) panel.style.width = state.width;
            if (state.height && state.height !== 'auto') panel.style.height = state.height;
            panel.classList.toggle('es-minimized', !!state.minimized);
        } catch (_) { }
    }



    // Update floating window content
    function updateFloatingWindow() {
        if (!floatingWindow) return;

        const varsList = floatingWindow.querySelector('.es-vars-list');
        const recentList = floatingWindow.querySelector('.es-recent-list');

        // Update main vars list
        varsList.innerHTML = '';
        const sortedVars = Object.values(currentData.vars).sort((a, b) => a.name.localeCompare(b.name));

        sortedVars.forEach(variable => {
            const item = document.createElement('div');
            item.className = 'es-var-item';
            item.innerHTML = `
                <div class="es-var-info">
                    <div class="es-var-name">${escapeHtml(variable.name)}</div>
                    <div class="es-var-value" title="${escapeHtml(variable.value)}">${escapeHtml(variable.value || 'No value')}</div>
                </div>
                <button class="es-var-copy icon-btn small" data-var-id="${variable.id}" title="Copy" aria-label="Copy">
                    <span class="material-symbols-outlined">content_copy</span>
                </button>
            `;

            // Copy button functionality
            item.querySelector('.es-var-copy').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(variable.value);
                    showToast({
                        title: 'Copied!',
                        message: `${variable.name} copied to clipboard`,
                        type: 'success',
                        duration: 2000
                    });
                } catch (e) {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = variable.value;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast({
                        title: 'Copied!',
                        message: `${variable.name} copied to clipboard`,
                        type: 'success',
                        duration: 2000
                    });
                }
            });

            varsList.appendChild(item);
        });

        // Update recent vars list
        recentList.innerHTML = '';
        recentVars.slice(0, 3).forEach(varData => {
            const item = document.createElement('div');
            item.className = 'es-var-item';
            item.innerHTML = `
                <div class="es-var-info">
                    <div class="es-var-name">${escapeHtml(varData.name)}</div>
                    <div class="es-var-value" title="${escapeHtml(varData.newValue)}">${escapeHtml(varData.newValue || 'No value')}</div>
                </div>
                <button class="es-var-copy icon-btn small" data-value="${escapeHtml(varData.newValue)}" title="Copy" aria-label="Copy">
                    <span class="material-symbols-outlined">content_copy</span>
                </button>
            `;

            // Copy button for recent vars
            item.querySelector('.es-var-copy').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(varData.newValue);
                    showToast({
                        title: 'Copied!',
                        message: `${varData.name} copied to clipboard`,
                        type: 'success',
                        duration: 2000
                    });
                } catch (e) {
                    const textarea = document.createElement('textarea');
                    textarea.value = varData.newValue;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast({
                        title: 'Copied!',
                        message: `${varData.name} copied to clipboard`,
                        type: 'success',
                        duration: 2000
                    });
                }
            });

            recentList.appendChild(item);
        });

        if (recentVars.length === 0) {
            recentList.innerHTML = '<div style="font-size: 11px; color: rgba(255,255,255,0.5); font-style: italic;">No recent updates</div>';
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==== Recent Copy Paste Chip Functionality ====

    function isEditable(el) {
        if (!el || el.disabled || el.readOnly) return false;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'textarea') return true;
        if (tag === 'input') {
            const t = (el.type || 'text').toLowerCase();
            return ['text', 'email', 'number', 'search', 'tel', 'url', 'password', 'date', 'datetime-local', 'time'].includes(t);
        }
        if (el.isContentEditable) return true;
        return false;
    }

    function bestCornerPositionForChip(rect, size = 24, pad = 4) {
        const sx = window.scrollX, sy = window.scrollY;
        const cands = [
            { x: rect.right + sx + pad, y: rect.top + sy - pad - size }, // TR
            { x: rect.right + sx + pad, y: rect.bottom + sy + pad },        // BR
            { x: rect.left + sx - pad - size, y: rect.top + sy - pad - size }, // TL
            { x: rect.left + sx - pad - size, y: rect.bottom + sy + pad }         // BL
        ];
        const vw = document.documentElement.clientWidth + sx;
        const vh = document.documentElement.clientHeight + sy;
        const inViewport = p => p.x >= sx && p.y >= sy && p.x + size <= vw && p.y + size <= vh;
        for (const p of cands) if (inViewport(p)) return p;
        return cands.find(inViewport) || cands[0];
    }

    function ensurePasteChip() {
        if (pasteChip) return pasteChip;
        const btn = document.createElement('button');
        btn.className = 'es-paste-chip';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Paste recent value');

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!focusedEl || !recentCopy) return;
            const val = recentCopy.value ?? '';
            const ok = window.__ES_UTILS__?.setElementValue?.(focusedEl, val);
            if (ok !== false) {
                focusedEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                focusedEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                showToast({
                    title: 'Pasted ✓',
                    message: `${recentCopy.varName || 'Value'} pasted successfully`,
                    type: 'success',
                    duration: 2000
                });
            } else {
                showToast({
                    title: 'Paste failed',
                    message: 'Could not paste value',
                    type: 'error',
                    duration: 2000
                });
            }
            hidePasteChip();
        });

        pasteChip = btn;
        document.body.appendChild(btn);
        return btn;
    }

    function showPasteChipFor(el) {
        const now = Date.now();
        if (!recentCopy || (now - (recentCopy.ts || 0) > RECENT_TTL_MS)) return hidePasteChip();
        const chip = ensurePasteChip();
        const rect = el.getBoundingClientRect();
        const p = bestCornerPositionForChip(rect, 24, 4);
        chip.style.left = `${p.x}px`;
        chip.style.top = `${p.y}px`;
        chip.textContent = 'Paste';
        chip.title = recentCopy.varName ? `Paste ${recentCopy.varName}` : 'Paste';
        chip.style.display = 'inline-flex';
    }

    function hidePasteChip() {
        if (pasteChip) pasteChip.style.display = 'none';
    }

    function setRecentCopy(data) {
        recentCopy = { ...(data || {}), ts: Date.now() };
        if (recentTimer) clearTimeout(recentTimer);
        recentTimer = setTimeout(() => {
            recentCopy = null;
            hidePasteChip();
        }, RECENT_TTL_MS);
    }

    // Add to recent vars tracking
    function addToRecent(varData) {
        // Remove existing entry for same variable
        recentVars = recentVars.filter(item => item.variableId !== varData.variableId);
        // Add to front
        recentVars.unshift({
            variableId: varData.variableId,
            name: varData.variableName,
            newValue: varData.newValue,
            timestamp: Date.now()
        });
        // Keep only last 5
        recentVars = recentVars.slice(0, 5);

        updateFloatingWindow();
    }

    // Create copy indicator for tracked elements
    function createCopyIndicator(element, variable) {
        const indicator = document.createElement('button');
        indicator.className = 'es-copy-indicator';
        indicator.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 12px;">content_copy</span>
        `;

        // Variable name only in tooltip
        indicator.title = variable.name;

        // Accessibility attributes
        indicator.setAttribute('aria-label', `Copy ${variable.name}`);
        indicator.setAttribute('tabindex', '0');

        const handleCopy = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Get fresh value from element
            const currentValue = window.__ES_UTILS__?.getElementValue(element) || element.textContent?.trim() || '';

            if (currentValue !== variable.value) {
                // Update variable with new value
                try {
                    await chrome.runtime.sendMessage({
                        type: 'UPDATE_VARIABLE_VALUE',
                        payload: { variableId: variable.id, newValue: currentValue }
                    });
                    showToast({
                        title: 'Variable Updated',
                        message: `${variable.name}: "${currentValue}"`,
                        type: 'success',
                        duration: 2500
                    });
                } catch (e) {
                    console.error('Failed to update variable:', e);
                }
            } else {
                showToast({
                    title: 'No Change',
                    message: `${variable.name} is already up to date`,
                    type: 'info',
                    duration: 2000
                });
            }

            // Set recent copy locally for immediate paste offers
            setRecentCopy({ varId: variable.id, varName: variable.name, value: currentValue });
            // Also notify background so popup can know about it
            chrome.runtime?.sendMessage?.({
                type: 'FF_SET_RECENT_COPY',
                payload: { varId: variable.id, varName: variable.name, value: currentValue, ts: Date.now() }
            }).catch?.(() => { });
        };

        indicator.addEventListener('click', handleCopy);

        // Keyboard support
        indicator.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleCopy(e);
            }
        });

        return indicator;
    }

    // Create paste button for form fields
    function createPasteButton(element, suggestions) {
        if (suggestions.length === 0) return null;

        const button = document.createElement('button');
        button.className = 'es-paste-button';

        if (suggestions.length === 1) {
            const suggestion = suggestions[0];
            button.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 12px;">content_paste</span>
                ${suggestion.varName || 'Paste'}
            `;
            button.title = `Paste ${suggestion.varName}: "${suggestion.value}"`;

            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Set the value
                if (window.__ES_UTILS__?.setElementValue) {
                    const success = window.__ES_UTILS__.setElementValue(element, suggestion.value);
                    if (success) {
                        showToast({
                            title: 'Pasted!',
                            message: `${suggestion.varName || 'value'} pasted successfully`,
                            type: 'success',
                            duration: 2000
                        });
                    }
                } else {
                    // Fallback
                    element.value = suggestion.value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    showToast({
                        title: 'Pasted!',
                        message: `${suggestion.varName || 'value'} pasted successfully`,
                        type: 'success',
                        duration: 2000
                    });
                }
            });
        } else {
            // Multiple suggestions - show dropdown
            button.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 12px;">content_paste</span>
                Paste (${suggestions.length})
            `;
            button.title = `${suggestions.length} paste options available`;

            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Create dropdown menu
                const dropdown = document.createElement('div');
                dropdown.style.cssText = `
                    position: absolute;
                    background: rgba(17,17,17,0.95);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 8px 0;
                    z-index: 2147483647;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    min-width: 150px;
                `;

                suggestions.forEach(suggestion => {
                    const item = document.createElement('button');
                    item.style.cssText = `
                        display: block;
                        width: 100%;
                        padding: 8px 12px;
                        background: none;
                        border: none;
                        color: white;
                        text-align: left;
                        cursor: pointer;
                        font-size: 12px;
                        font-family: system-ui, sans-serif;
                    `;
                    item.innerHTML = `
                        <div style="font-weight: 500;">${suggestion.varName || 'Value'}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 10px;">"${suggestion.value.substring(0, 30)}${suggestion.value.length > 30 ? '...' : ''}"</div>
                    `;

                    item.addEventListener('mouseenter', () => {
                        item.style.background = 'rgba(255,255,255,0.1)';
                    });

                    item.addEventListener('mouseleave', () => {
                        item.style.background = 'none';
                    });

                    item.addEventListener('click', () => {
                        if (window.__ES_UTILS__?.setElementValue) {
                            window.__ES_UTILS__.setElementValue(element, suggestion.value);
                        } else {
                            element.value = suggestion.value;
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        showToast({
                            title: 'Pasted!',
                            message: `${suggestion.varName || 'value'} pasted successfully`,
                            type: 'success',
                            duration: 2000
                        });
                        dropdown.remove();
                    });

                    dropdown.appendChild(item);
                });

                // Position dropdown
                const rect = button.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 5) + 'px';
                dropdown.style.left = rect.left + 'px';

                document.body.appendChild(dropdown);

                // Close dropdown when clicking outside
                setTimeout(() => {
                    const closeDropdown = (e) => {
                        if (!dropdown.contains(e.target)) {
                            dropdown.remove();
                            document.removeEventListener('click', closeDropdown);
                        }
                    };
                    document.addEventListener('click', closeDropdown);
                }, 100);
            });
        }

        return button;
    }

    // ==== Adaptive Copy Icon Placement
    function bestCornerPosition(rect, size = 18, pad = 2) {
        // candidate corners: BR, TR, BL, TL
        const sx = window.scrollX, sy = window.scrollY;
        const cands = [
            { x: rect.right + sx + pad, y: rect.bottom + sy + pad },            // BR
            { x: rect.right + sx + pad, y: rect.top + sy - pad - size },     // TR
            { x: rect.left + sx - pad - size, y: rect.bottom + sy + pad },     // BL
            { x: rect.left + sx - pad - size, y: rect.top + sy - pad - size } // TL
        ];
        const vw = document.documentElement.clientWidth + sx;
        const vh = document.documentElement.clientHeight + sy;

        function inViewport(p) {
            return p.x >= sx && p.y >= sy && (p.x + size) <= vw && (p.y + size) <= vh;
        }
        function crowded(p) {
            // sample the center; if something else sits there, prefer another corner
            const cx = p.x - sx + size / 2, cy = p.y - sy + size / 2;
            const el = document.elementFromPoint(cx, cy);
            // ok if it's body/html or nothing; we avoid overlay collisions by z-index
            return el && el !== document.body && el !== document.documentElement;
        }

        for (const p of cands) {
            if (inViewport(p) && !crowded(p)) return p;
        }
        // fallback to first in-viewport candidate
        return cands.find(inViewport) || cands[0];
    }

    function positionCopyIndicator(btn, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const size = 18;
        const p = bestCornerPosition(rect, size, 2);
        btn.style.left = `${p.x}px`;
        btn.style.top = `${p.y}px`;
    }

    // Position overlay element relative to target
    function positionOverlay(overlay, target, type = 'paste') {
        const rect = target.getBoundingClientRect();
        const sx = window.pageXOffset || document.documentElement.scrollLeft;
        const sy = window.pageYOffset || document.documentElement.scrollTop;

        if (type === 'copy') {
            const pad = 2;             // hug the border
            const size = 18;           // icon size
            overlay.style.left = (rect.right + sx + pad) + 'px';
            overlay.style.top = (rect.bottom + sy + pad) + 'px';

            // Keep fully on-screen
            const maxLeft = sx + document.documentElement.clientWidth - size - 2;
            const maxTop = sy + document.documentElement.clientHeight - size - 2;
            overlay.style.left = Math.min(parseFloat(overlay.style.left), maxLeft) + 'px';
            overlay.style.top = Math.min(parseFloat(overlay.style.top), maxTop) + 'px';
        } else {
            // Default position for paste buttons (top-right, outside element)
            overlay.style.left = (rect.right + sx + 6) + 'px';
            overlay.style.top = (rect.top + sy - 6) + 'px';
        }
    }

    // Update overlays based on current data
    async function updateOverlays() {
        console.log('updateOverlays called, enabled:', isEnabled, 'data:', currentData);
        if (!isEnabled) return;

        // Clear existing overlays
        overlayElements.forEach(set => set.forEach(overlay => overlay.remove()));
        overlayElements.clear();

        // Remove highlights
        document.querySelectorAll('.es-element-highlight, .es-paste-highlight').forEach(el => {
            el.classList.remove('es-element-highlight', 'es-paste-highlight');
        });

        const currentUrl = location.href;

        // Add copy indicators for tracked elements
        console.log('Processing variables:', Object.keys(currentData.vars).length);
        Object.values(currentData.vars).forEach(variable => {
            console.log('Processing variable:', variable.name, 'sourceSelector:', variable.sourceSelector, 'sourceSiteId:', variable.sourceSiteId);
            if (variable.sourceSelector) {
                // Try to find element regardless of site matching for better global functionality
                try {
                    const element = resolveSelectorAcrossShadows(variable.sourceSelector);
                    console.log('Found element for selector:', variable.sourceSelector, element);
                    if (element) {
                        // Check if site matching is required
                        let shouldShow = true;
                        if (variable.sourceSiteId) {
                            const site = currentData.sites[variable.sourceSiteId];
                            console.log('Found site:', site?.title, 'pattern:', site?.urlPattern);
                            if (site && site.urlPattern) {
                                shouldShow = matchesPattern(site.urlPattern, currentUrl);
                                console.log('Site pattern match result:', shouldShow);
                            }
                        }

                        if (shouldShow) {
                            element.classList.add('es-element-highlight');

                            const indicator = createCopyIndicator(element, variable);
                            document.body.appendChild(indicator);
                            trackOverlay(element, indicator);

                            // Position the indicator using adaptive placement
                            positionCopyIndicator(indicator, element);
                            console.log('Added copy indicator for:', variable.name);
                        } else {
                            console.log('Site pattern does not match current URL');
                        }
                    }
                } catch (e) {
                    console.warn('Invalid selector:', variable.sourceSelector, e);
                }
            } else {
                console.log('Variable has no sourceSelector:', variable.name);
            }
        });

        // Only add paste buttons for form fields that have profile mappings
        console.log('Processing profiles for paste buttons...');

        // Find matching profiles for current URL
        const matchingProfiles = Object.values(currentData.profiles).filter(profile =>
            profile.sitePattern && matchesPattern(profile.sitePattern, currentUrl)
        );

        console.log('Found matching profiles:', matchingProfiles.length);

        // Collect all selectors that have profile mappings
        const profiledSelectors = new Set();
        const selectorToMappings = new Map();

        matchingProfiles.forEach(profile => {
            (profile.mappings || profile.inputs || []).forEach(mapping => {
                if (mapping.selector) {
                    profiledSelectors.add(mapping.selector);
                    if (!selectorToMappings.has(mapping.selector)) {
                        selectorToMappings.set(mapping.selector, []);
                    }
                    selectorToMappings.get(mapping.selector).push(mapping);
                }
            });
        });

        console.log('Found profiled selectors:', profiledSelectors.size);

        // Only process elements that match profiled selectors
        profiledSelectors.forEach(selector => {
            try {
                // First try regular document query
                const elements = document.querySelectorAll(selector);
                const shadowElements = [];

                // Also check shadow roots
                const hosts = document.querySelectorAll('*');
                for (const host of hosts) {
                    if (host.shadowRoot) {
                        try {
                            const inside = host.shadowRoot.querySelectorAll(selector);
                            shadowElements.push(...inside);
                        } catch { }
                    }
                }

                // Combine both results
                const allElements = [...elements, ...shadowElements];
                console.log(`Selector "${selector}" matches ${allElements.length} elements (${elements.length} regular + ${shadowElements.length} shadow)`);

                allElements.forEach(element => {
                    const mappings = selectorToMappings.get(selector);
                    const suggestions = [];

                    // Build suggestions from profile mappings
                    mappings.forEach(mapping => {
                        if (mapping.varName) {
                            // Variable-based mapping
                            const variable = Object.values(currentData.vars).find(v => v.name === mapping.varName);
                            if (variable && variable.value) {
                                suggestions.push({
                                    selector: mapping.selector,
                                    varName: variable.name,
                                    value: variable.value,
                                    priority: 'profile'
                                });
                            }
                        } else if (mapping.value) {
                            // Literal value mapping
                            suggestions.push({
                                selector: mapping.selector,
                                varName: 'Literal',
                                value: mapping.value,
                                priority: 'profile'
                            });
                        }
                    });

                    // Only show paste button if we have valid suggestions from profiles
                    if (suggestions.length > 0) {
                        element.classList.add('es-paste-highlight');

                        const button = createPasteButton(element, suggestions);
                        if (button) {
                            document.body.appendChild(button);
                            trackOverlay(element, button);

                            // Position the button
                            positionOverlay(button, element);
                            console.log(`Added paste button for element matching "${selector}"`);
                        }
                    }
                });
            } catch (e) {
                console.warn('Invalid selector in profile:', selector, e);
            }
        });
    }

    // Simple pattern matching
    function matchesPattern(pattern, url) {
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

    // RAF-throttled reposition overlays on scroll/resize
    let rafId = null;
    function repositionOverlays() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            overlayElements.forEach((set, target) => {
                if (!document.contains(target)) {
                    set.forEach(el => el.remove());
                    overlayElements.delete(target);
                    return;
                }
                set.forEach(overlay => {
                    if (overlay.classList.contains('es-copy-indicator')) {
                        positionCopyIndicator(overlay, target);
                    } else {
                        positionOverlay(overlay, target, 'paste');
                    }
                });
            });
        });
    }

    window.addEventListener('scroll', repositionOverlays, { passive: true });
    window.addEventListener('resize', repositionOverlays);

    // ==== Recent Copy Paste Chip Event Listeners ====

    // When an editable gets focus, show the chip if we have a fresh copy
    document.addEventListener('focusin', (e) => {
        if (!isEditable(e.target)) return;
        focusedEl = e.target;
        showPasteChipFor(focusedEl);
    });

    // Hide on blur or typing (optional)
    document.addEventListener('focusout', () => {
        focusedEl = null;
        hidePasteChip();
    });
    document.addEventListener('input', (e) => {
        if (e.target === focusedEl) hidePasteChip();
    });

    // Keep the chip anchored
    const repositionChip = (() => {
        let raf = null;
        return () => {
            if (!pasteChip || pasteChip.style.display === 'none') return;
            if (!focusedEl) return;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                showPasteChipFor(focusedEl);
            });
        };
    })();
    window.addEventListener('scroll', repositionChip, { passive: true });
    window.addEventListener('resize', repositionChip);

    // Listen for data updates
    chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg.type === 'UPDATE_OVERLAY_DATA') {
            currentData = msg.payload;
            await updateOverlays();
            updateFloatingWindow();
        } else if (msg.type === 'TOGGLE_OVERLAY') {
            isEnabled = msg.payload.enabled;
            if (isEnabled) {
                await updateOverlays();
                updateFloatingWindow();
            } else {
                overlayElements.forEach(overlay => overlay.remove());
                overlayElements.clear();
                document.querySelectorAll('.es-element-highlight, .es-paste-highlight').forEach(el => {
                    el.classList.remove('es-element-highlight', 'es-paste-highlight');
                });
                if (floatingWindow) {
                    floatingWindow.remove();
                    floatingWindow = null;
                }
            }
        } else if (msg.type === 'VARIABLE_UPDATED') {
            // Update variable in local data and refresh overlays
            if (currentData.vars[msg.payload.variableId]) {
                currentData.vars[msg.payload.variableId].value = msg.payload.newValue;
                addToRecent(msg.payload);
                await updateOverlays();
            }
        } else if (msg.type === 'SHOW_FLOATING_VARS') {
            if (!floatingWindow) createFloatingWindow();
            const state = msg.payload || (await readFloatingState());
            if (state) {
                if (state.left) { floatingWindow.style.left = state.left; floatingWindow.style.right = 'auto'; }
                if (state.top) floatingWindow.style.top = state.top;
                if (state.width) floatingWindow.style.width = state.width;
                if (state.height && state.height !== 'auto') floatingWindow.style.height = state.height;
                floatingWindow.classList.toggle('es-minimized', !!state.minimized);
            }
            updateFloatingWindow();
        } else if (msg.type === 'HIDE_FLOATING_VARS') {
            if (floatingWindow) { floatingWindow.remove(); floatingWindow = null; }
        } else if (msg.type === 'FF_SET_RECENT_COPY') {
            setRecentCopy(msg.payload || {});
            // If the user is already focused in an input, refresh the offer
            if (focusedEl) showPasteChipFor(focusedEl);
            sendResponse?.({ ok: true });
            return true;
        }
    });

    // Background service manages cross-tab behavior - no localStorage needed

    // Request initial data with retry logic
    function initializeOverlay() {
        chrome.runtime.sendMessage({ type: 'GET_OVERLAY_DATA' }, (response) => {
            if (chrome.runtime.lastError) {
                // Retry in 1 second if extension context is unavailable
                setTimeout(initializeOverlay, 1000);
                return;
            }

            if (response) {
                currentData = response.data;
                isEnabled = response.enabled;
                console.log('Page overlay initialized:', {
                    enabled: isEnabled,
                    vars: Object.keys(currentData.vars).length,
                    sites: Object.keys(currentData.sites).length,
                    profiles: Object.keys(currentData.profiles).length
                });

                if (isEnabled) {
                    updateOverlays();
                    // Floating window state is managed by background service
                }
            }
        });
    }

    // Initialize with delay to ensure extension is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initializeOverlay, 100));
    } else {
        setTimeout(initializeOverlay, 100);
    }

    // Handle dynamic content changes
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain form elements
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (
                        node.matches?.('input, textarea, select, [contenteditable]') ||
                        node.querySelector?.('input, textarea, select, [contenteditable]')
                    )) {
                        shouldUpdate = true;
                    }
                });
            }
        });

        if (shouldUpdate && isEnabled) {
            // Debounce updates
            clearTimeout(window.__esUpdateTimeout);
            window.__esUpdateTimeout = setTimeout(updateOverlays, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('FillFlux page overlay initialized');
    console.log('Initial data:', currentData);
    console.log('Overlay enabled:', isEnabled);
})();