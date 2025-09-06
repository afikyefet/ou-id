// Interactive page overlay system - shows copy/paste controls directly on elements
(function() {
    if (window.__ES_PAGE_OVERLAY_ACTIVE__) return;
    window.__ES_PAGE_OVERLAY_ACTIVE__ = true;
    
    let overlayElements = new Map();
    let currentData = { vars: {}, sites: {}, profiles: {} };
    let isEnabled = false;
    
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
        Object.values(currentData.vars).forEach(variable => {
            if (variable.sourceSelector && variable.sourceSiteId) {
                const site = currentData.sites[variable.sourceSiteId];
                if (site && matchesPattern(site.urlPattern, currentUrl)) {
                    try {
                        const element = document.querySelector(variable.sourceSelector);
                        if (element) {
                            element.classList.add('es-element-highlight');
                            
                            const indicator = createCopyIndicator(element, variable);
                            document.body.appendChild(indicator);
                            overlayElements.set(element, indicator);
                            
                            // Position the indicator
                            positionOverlay(indicator, element);
                        }
                    } catch (e) {
                        console.warn('Invalid selector:', variable.sourceSelector, e);
                    }
                }
            }
        });
        
        // Add paste buttons for form fields
        const formElements = document.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"], [contenteditable=""]');
        
        formElements.forEach(element => {
            // Find matching profiles for this page
            const matchingProfiles = Object.values(currentData.profiles).filter(profile =>
                profile.sitePattern && matchesPattern(profile.sitePattern, currentUrl)
            );
            
            // Get paste suggestions for this element
            const suggestions = [];
            
            matchingProfiles.forEach(profile => {
                (profile.inputs || []).forEach(input => {
                    if (input.selector && input.varName) {
                        try {
                            if (element.matches(input.selector)) {
                                const variable = Object.values(currentData.vars).find(v => v.name === input.varName);
                                if (variable) {
                                    suggestions.push({
                                        selector: input.selector,
                                        varName: variable.name,
                                        value: variable.value
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn('Invalid selector in profile:', input.selector, e);
                        }
                    }
                });
            });
            
            if (suggestions.length > 0) {
                element.classList.add('es-paste-highlight');
                
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
        } else if (msg.type === 'TOGGLE_OVERLAY') {
            isEnabled = msg.payload.enabled;
            if (isEnabled) {
                await updateOverlays();
            } else {
                overlayElements.forEach(overlay => overlay.remove());
                overlayElements.clear();
                document.querySelectorAll('.es-element-highlight, .es-paste-highlight').forEach(el => {
                    el.classList.remove('es-element-highlight', 'es-paste-highlight');
                });
            }
        } else if (msg.type === 'VARIABLE_UPDATED') {
            // Update variable in local data and refresh overlays
            if (currentData.vars[msg.payload.variableId]) {
                currentData.vars[msg.payload.variableId].value = msg.payload.newValue;
                await updateOverlays();
            }
        }
    });
    
    // Request initial data
    chrome.runtime.sendMessage({ type: 'GET_OVERLAY_DATA' }, (response) => {
        if (response) {
            currentData = response.data;
            isEnabled = response.enabled;
            if (isEnabled) {
                updateOverlays();
            }
        }
    });
    
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
})();