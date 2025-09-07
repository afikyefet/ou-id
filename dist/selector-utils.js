// Shared selector resolution utilities for consistent behavior across all scripts
// This file provides a single source of truth for selector resolution

/**
 * Resolves a CSS selector in the document and shallow shadow roots
 * @param {string} css - CSS selector to resolve
 * @returns {Element|null} - Found element or null
 */
function resolveSelectorAcrossShadows(css) {
    if (!css || typeof css !== 'string') return null;

    try {
        // First try regular document query
        const el = document.querySelector(css);
        if (el) return el;
    } catch (e) {
        // Invalid selector, continue to shadow root search
    }

    try {
        // Search in shallow shadow roots (one level deep)
        const hosts = document.querySelectorAll('*');
        for (const host of hosts) {
            if (host.shadowRoot) {
                try {
                    const inside = host.shadowRoot.querySelector(css);
                    if (inside) return inside;
                } catch (e) {
                    // Invalid selector in shadow root, continue
                }
            }
        }
    } catch (e) {
        // Shadow root access failed, return null
    }

    return null;
}

/**
 * Resolves multiple CSS selectors and returns all matching elements
 * @param {string} css - CSS selector to resolve
 * @returns {Element[]} - Array of found elements
 */
function resolveAllSelectorsAcrossShadows(css) {
    if (!css || typeof css !== 'string') return [];

    const elements = [];

    try {
        // Regular document query
        const docElements = document.querySelectorAll(css);
        elements.push(...docElements);
    } catch (e) {
        // Invalid selector, continue to shadow root search
    }

    try {
        // Search in shallow shadow roots
        const hosts = document.querySelectorAll('*');
        for (const host of hosts) {
            if (host.shadowRoot) {
                try {
                    const inside = host.shadowRoot.querySelectorAll(css);
                    elements.push(...inside);
                } catch (e) {
                    // Invalid selector in shadow root, continue
                }
            }
        }
    } catch (e) {
        // Shadow root access failed
    }

    return elements;
}

/**
 * Validates if a CSS selector is likely to be robust
 * @param {string} selector - CSS selector to validate
 * @returns {object} - Validation result with score and issues
 */
function validateSelectorRobustness(selector) {
    if (!selector || typeof selector !== 'string') {
        return { score: 0, issues: ['Empty or invalid selector'] };
    }

    const issues = [];
    let score = 100;

    // Check for overly specific selectors
    if (selector.includes(':nth-of-type(')) {
        score -= 20;
        issues.push('Uses nth-of-type (fragile)');
    }

    if (selector.includes(':nth-child(')) {
        score -= 25;
        issues.push('Uses nth-child (very fragile)');
    }

    // Check for long class chains
    const classMatches = selector.match(/\./g);
    if (classMatches && classMatches.length > 3) {
        score -= 15;
        issues.push('Many class dependencies');
    }

    // Check for ID usage (good)
    if (selector.includes('#')) {
        score += 10;
    }

    // Check for data attributes (good)
    if (selector.includes('[data-')) {
        score += 5;
    }

    // Check for name attributes (good)
    if (selector.includes('[name=')) {
        score += 5;
    }

    // Check for role attributes (good)
    if (selector.includes('[role=')) {
        score += 5;
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        issues,
        isRobust: score >= 70
    };
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.__ES_SELECTOR_UTILS__ = {
        resolveSelectorAcrossShadows,
        resolveAllSelectorsAcrossShadows,
        validateSelectorRobustness
    };
}
