// Shared URL pattern matching utilities for consistent behavior across all scripts
// This file provides a single source of truth for URL pattern matching

/**
 * Normalizes a URL by removing query parameters and hash fragments
 * @param {string} url - URL to normalize
 * @returns {object} - Normalized URL parts
 */
function normalizeUrlBasic(url) {
    try {
        const u = new URL(url);
        return { origin: u.origin, path: u.pathname.replace(/\/+/g, '/') };
    } catch (e) {
        return { origin: '', path: '' };
    }
}

/**
 * Converts a URL to a pattern by replacing dynamic segments with wildcards
 * @param {string} url - URL to convert to pattern
 * @returns {string} - URL pattern with wildcards
 */
function toPatternFromUrl(url) {
    try {
        const { origin, path } = normalizeUrlBasic(url);
        const segs = path.split('/').filter(Boolean).map(seg => {
            if (/^\d+$/.test(seg)) return '*';                    // 12345
            if (/^[0-9a-f-]{8,}$/i.test(seg)) return '*';         // 3f2a1b..., UUID-ish
            return seg;
        });
        return origin + '/' + segs.join('/') + '/*';
    } catch (e) {
        return url + '/*';
    }
}

/**
 * Checks if a URL matches a pattern
 * @param {string} pattern - URL pattern to match against
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL matches pattern
 */
function matchesPattern(pattern, url) {
    if (!pattern || !url) return false;

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

/**
 * Validates if a URL pattern is well-formed
 * @param {string} pattern - URL pattern to validate
 * @returns {object} - Validation result
 */
function validateUrlPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') {
        return { isValid: false, error: 'Empty or invalid pattern' };
    }

    try {
        // Try to parse as URL
        new URL(pattern.replace('/*', '/'));
        return { isValid: true };
    } catch (e) {
        return { isValid: false, error: 'Invalid URL format' };
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.__ES_URL_UTILS__ = {
        normalizeUrlBasic,
        toPatternFromUrl,
        matchesPattern,
        validateUrlPattern
    };
}
