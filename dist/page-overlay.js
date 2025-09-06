// Interactive page overlay system - shows copy/paste controls directly on elements
(function() {
    if (window.__ES_PAGE_OVERLAY_ACTIVE__) return;
    window.__ES_PAGE_OVERLAY_ACTIVE__ = true;
    
    let overlayElements = new Map();
    let currentData = { vars: {}, sites: {}, profiles: {} };
    let isEnabled = false;
    let floatingWindow = null;
    let recentVars = [];
    
    // Styles for the overlay controls
    const overlayStyles = `
        .es-copy-indicator {
            position: absolute !important;
            background: linear-gradient(135deg, #4f8cff 0%, #6aa0ff 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 4px 8px !important;
            font-size: 11px !important;
            font-family: system-ui, sans-serif !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            box-shadow: 0 2px 8px rgba(79,140,255,0.3) !important;
            transition: all 0.2s ease !important;
            pointer-events: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            white-space: nowrap !important;
            backdrop-filter: blur(8px) !important;
        }
        
        .es-copy-indicator:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 4px 12px rgba(79,140,255,0.4) !important;
        }
        
        .es-paste-button {
            position: absolute !important;
            background: linear-gradient(135deg, #34c759 0%, #30d158 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 4px 8px !important;
            font-size: 11px !important;
            font-family: system-ui, sans-serif !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            box-shadow: 0 2px 8px rgba(52,199,89,0.3) !important;
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
            box-shadow: 0 4px 12px rgba(52,199,89,0.4) !important;
        }
        
        .es-element-highlight {
            outline: 2px solid #4f8cff !important;
            outline-offset: 1px !important;
            border-radius: 4px !important;
            background: rgba(79,140,255,0.05) !important;
        }
        
        .es-paste-highlight {
            outline: 2px solid #34c759 !important;
            outline-offset: 1px !important;
            border-radius: 4px !important;
            background: rgba(52,199,89,0.05) !important;
        }
        
        .es-notification {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: rgba(17,17,17,0.95) !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-family: system-ui, sans-serif !important;
            z-index: 2147483647 !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(12px) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            animation: esSlideIn 0.3s ease-out !important;
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
            width: 280px !important;
            max-height: 400px !important;
            background: rgba(17,17,17,0.95) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
            backdrop-filter: blur(16px) !important;
            z-index: 2147483645 !important;
            font-family: system-ui, sans-serif !important;
            color: white !important;
            resize: both !important;
            overflow: hidden !important;
        }
        
        .es-floating-header {
            padding: 12px 16px !important;
            border-bottom: 1px solid rgba(255,255,255,0.1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: move !important;
            background: rgba(79,140,255,0.1) !important;
        }
        
        .es-floating-title {
            font-size: 14px !important;
            font-weight: 600 !important;
            margin: 0 !important;
        }
        
        .es-floating-close {
            background: none !important;
            border: none !important;
            color: white !important;
            cursor: pointer !important;
            font-size: 16px !important;
            padding: 4px !important;
            border-radius: 4px !important;
            opacity: 0.7 !important;
        }
        
        .es-floating-close:hover {
            background: rgba(255,255,255,0.1) !important;
            opacity: 1 !important;
        }
        
        .es-floating-content {
            padding: 12px !important;
            max-height: 320px !important;
            overflow-y: auto !important;
        }
        
        .es-var-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 8px 0 !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
        }
        
        .es-var-info {
            flex: 1 !important;
            min-width: 0 !important;
        }
        
        .es-var-name {
            font-size: 12px !important;
            font-weight: 500 !important;
            color: #4f8cff !important;
            margin-bottom: 2px !important;
        }
        
        .es-var-value {
            font-size: 11px !important;
            color: rgba(255,255,255,0.7) !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        
        .es-var-copy {
            background: linear-gradient(135deg, #34c759 0%, #30d158 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 4px 8px !important;
            font-size: 10px !important;
            cursor: pointer !important;
            margin-left: 8px !important;
            display: flex !important;
            align-items: center !important;
            gap: 3px !important;
            transition: all 0.2s ease !important;
        }
        
        .es-var-copy:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 2px 8px rgba(52,199,89,0.3) !important;
        }
        
        .es-recent-section {
            margin-top: 12px !important;
            padding-top: 12px !important;
            border-top: 1px solid rgba(255,255,255,0.1) !important;
        }
        
        .es-section-title {
            font-size: 11px !important;
            font-weight: 600 !important;
            color: rgba(255,255,255,0.8) !important;
            margin-bottom: 8px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }
    `;
    
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = overlayStyles;
    document.head.appendChild(styleSheet);
    
    // Show notification
    function showNotification(message, duration = 2000) {
        const notification = document.createElement('div');
        notification.className = 'es-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'esSlideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    // Create floating vars window
    function createFloatingWindow() {
        if (floatingWindow) return floatingWindow;
        
        const window = document.createElement('div');
        window.className = 'es-floating-window';
        window.innerHTML = `
            <div class="es-floating-header">
                <h3 class="es-floating-title">Variables</h3>
                <button class="es-floating-close">×</button>
            </div>
            <div class="es-floating-content">
                <div class="es-vars-list"></div>
                <div class="es-recent-section">
                    <div class="es-section-title">Recently Updated</div>
                    <div class="es-recent-list"></div>
                </div>
            </div>
        `;
        
        // Make draggable
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const header = window.querySelector('.es-floating-header');
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = window.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
        });
        
        function handleDrag(e) {
            if (!isDragging) return;
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            window.style.left = Math.max(0, Math.min(window.innerWidth - window.offsetWidth, x)) + 'px';
            window.style.top = Math.max(0, Math.min(window.innerHeight - window.offsetHeight, y)) + 'px';
            window.style.right = 'auto';
        }
        
        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
        }
        
        // Close button
        window.querySelector('.es-floating-close').addEventListener('click', () => {
            window.remove();
            floatingWindow = null;
            // Remember that user closed it
            localStorage.setItem('es-floating-window-auto-show', 'false');
        });
        
        document.body.appendChild(window);
        floatingWindow = window;
        
        return window;
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
                <button class="es-var-copy" data-var-id="${variable.id}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy
                </button>
            `;
            
            // Copy button functionality
            item.querySelector('.es-var-copy').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(variable.value);
                    showNotification(`Copied ${variable.name} to clipboard`);
                } catch (e) {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = variable.value;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showNotification(`Copied ${variable.name} to clipboard`);
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
                <button class="es-var-copy" data-value="${escapeHtml(varData.newValue)}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy
                </button>
            `;
            
            // Copy button for recent vars
            item.querySelector('.es-var-copy').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(varData.newValue);
                    showNotification(`Copied ${varData.name} to clipboard`);
                } catch (e) {
                    const textarea = document.createElement('textarea');
                    textarea.value = varData.newValue;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showNotification(`Copied ${varData.name} to clipboard`);
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            ${variable.name}
        `;
        
        indicator.title = `Copy ${variable.name}: "${variable.value}"`;
        
        indicator.addEventListener('click', async (e) => {
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
                    showNotification(`Updated ${variable.name}: "${currentValue}"`);
                } catch (e) {
                    console.error('Failed to update variable:', e);
                }
            } else {
                showNotification(`${variable.name} is up to date`);
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3-1.34 3-3h3v16H6V3h3c0 1.66 1.34 3 3 3z"/>
                </svg>
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
                        showNotification(`Pasted ${suggestion.varName || 'value'}`);
                    }
                } else {
                    // Fallback
                    element.value = suggestion.value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    showNotification(`Pasted ${suggestion.varName || 'value'}`);
                }
            });
        } else {
            // Multiple suggestions - show dropdown
            button.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3-1.34 3-3h3v16H6V3h3c0 1.66 1.34 3 3 3z"/>
                </svg>
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
                        showNotification(`Pasted ${suggestion.varName || 'value'}`);
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
    
    // Position overlay element relative to target
    function positionOverlay(overlay, target) {
        const rect = target.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        overlay.style.left = (rect.right + scrollX - overlay.offsetWidth + 8) + 'px';
        overlay.style.top = (rect.top + scrollY - 8) + 'px';
    }
    
    // Update overlays based on current data
    async function updateOverlays() {
        console.log('updateOverlays called, enabled:', isEnabled, 'data:', currentData);
        if (!isEnabled) return;
        
        // Clear existing overlays
        overlayElements.forEach(overlay => overlay.remove());
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
                    const element = document.querySelector(variable.sourceSelector);
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
                            overlayElements.set(element, indicator);
                            
                            // Position the indicator
                            positionOverlay(indicator, element);
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
        
        // Add paste buttons for form fields
        const formElements = document.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"], [contenteditable=""]');
        console.log('Found form elements:', formElements.length);
        
        formElements.forEach(element => {
            // Get all variables as potential paste suggestions for global functionality
            const suggestions = [];
            
            // First, try profile-based suggestions
            const matchingProfiles = Object.values(currentData.profiles).filter(profile =>
                profile.sitePattern && matchesPattern(profile.sitePattern, currentUrl)
            );
            
            matchingProfiles.forEach(profile => {
                (profile.inputs || []).forEach(input => {
                    if (input.selector && input.varName) {
                        try {
                            if (element.matches(input.selector)) {
                                const variable = Object.values(currentData.vars).find(v => v.name === input.varName);
                                if (variable && variable.value) {
                                    suggestions.push({
                                        selector: input.selector,
                                        varName: variable.name,
                                        value: variable.value,
                                        priority: 'profile'
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn('Invalid selector in profile:', input.selector, e);
                        }
                    }
                });
            });
            
            // Add all variables as general suggestions for global use
            Object.values(currentData.vars).forEach(variable => {
                if (variable.value && !suggestions.find(s => s.varName === variable.name)) {
                    suggestions.push({
                        varName: variable.name,
                        value: variable.value,
                        priority: 'variable'
                    });
                }
            });
            
            // Show paste button if we have suggestions
            if (suggestions.length > 0) {
                element.classList.add('es-paste-highlight');
                
                // Sort suggestions: profile matches first, then variables
                suggestions.sort((a, b) => {
                    if (a.priority === 'profile' && b.priority === 'variable') return -1;
                    if (a.priority === 'variable' && b.priority === 'profile') return 1;
                    return a.varName.localeCompare(b.varName);
                });
                
                const button = createPasteButton(element, suggestions);
                if (button) {
                    document.body.appendChild(button);
                    overlayElements.set(element, button);
                    
                    // Position the button
                    positionOverlay(button, element);
                }
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
    
    // Reposition overlays on scroll/resize
    function repositionOverlays() {
        overlayElements.forEach((overlay, target) => {
            if (document.contains(target)) {
                positionOverlay(overlay, target);
            } else {
                overlay.remove();
                overlayElements.delete(target);
            }
        });
    }
    
    window.addEventListener('scroll', repositionOverlays);
    window.addEventListener('resize', repositionOverlays);
    
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
            createFloatingWindow();
            updateFloatingWindow();
            // Remember that user wants to see it
            localStorage.setItem('es-floating-window-auto-show', 'true');
        }
    });
    
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
                    // Auto-show floating window if there are variables and user previously opened it
                    const shouldAutoShow = localStorage.getItem('es-floating-window-auto-show') === 'true';
                    if (shouldAutoShow && Object.keys(currentData.vars).length > 0) {
                        createFloatingWindow();
                        updateFloatingWindow();
                    }
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
    
    console.log('Element Snapper page overlay initialized');
    console.log('Initial data:', currentData);
    console.log('Overlay enabled:', isEnabled);
})();