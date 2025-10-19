/**
 * @fileoverview Settings store for FillFlux extension
 * Provides centralized settings management with schema validation, persistence, and change events
 */

/**
 * @typedef {Object} GeneralSettings
 * @property {string} language - Language code (e.g., 'en', 'es')
 * @property {string} openSettingsShortcut - Keyboard shortcut for opening settings
 * @property {boolean} telemetryEnabled - Whether to collect anonymous usage data
 */

/**
 * @typedef {Object} BehaviorSettings
 * @property {boolean} snapToEdges - Whether to snap floating panels to edges
 * @property {number} snapDistance - Distance in pixels for snapping
 * @property {boolean} nudgeWithAltArrows - Whether Alt+Arrow keys nudge panels
 * @property {number} nudgeStepPx - Nudge step in pixels
 * @property {boolean} autoFlipIconsWhenCrowded - Auto-flip copy icons when crowded
 * @property {boolean} showTooltips - Whether to show tooltips
 */

/**
 * @typedef {Object} AccessibilitySettings
 * @property {boolean} focusRing - Whether to show focus rings
 * @property {boolean} reduceMotion - Whether to reduce animations
 * @property {boolean} highContrast - Whether to use high contrast mode
 * @property {boolean} ariaLiveToasts - Whether to use ARIA live regions for toasts
 */

/**
 * @typedef {Object} AppearanceSettings
 * @property {'light'|'dark'|'system'} theme - Theme preference
 * @property {string} brandColor - Primary brand color (hex)
 * @property {string} surfaceColor - Surface/background color (hex)
 * @property {string} textColor - Text color (hex)
 * @property {string} accentColor - Accent color (hex)
 * @property {number} borderRadius - Border radius in pixels
 * @property {number} borderWidth - Border width in pixels
 * @property {number} shadowStrength - Shadow strength (0-1)
 * @property {number} spacingScale - Base spacing unit in pixels
 * @property {number} iconSize - Icon size in pixels
 * @property {'br'|'tr'|'bl'|'tl'} copyIconCorner - Copy icon corner position
 * @property {number} panelWidth - Floating panel width in pixels
 * @property {'left'|'right'} panelPosition - Floating panel position
 * @property {boolean} compactMode - Whether to use compact mode
 * @property {string} customCSS - Optional user CSS
 */

/**
 * @typedef {Object} PrivacySettings
 * @property {boolean} collectAnonUsage - Whether to collect anonymous usage data
 * @property {boolean} logConsoleDebug - Whether to log debug info to console
 */

/**
 * @typedef {Object} Settings
 * @property {number} version - Settings schema version
 * @property {GeneralSettings} general - General settings
 * @property {BehaviorSettings} behavior - Behavior settings
 * @property {AccessibilitySettings} accessibility - Accessibility settings
 * @property {AppearanceSettings} appearance - Appearance settings
 * @property {PrivacySettings} privacy - Privacy settings
 */

/**
 * Default settings schema v1
 * @type {Settings}
 */
const DEFAULT_SETTINGS = {
    version: 1,
    general: {
        language: 'en',
        openSettingsShortcut: 'Alt+,',
        telemetryEnabled: true
    },
    behavior: {
        snapToEdges: true,
        snapDistance: 8,
        nudgeWithAltArrows: true,
        nudgeStepPx: 1,
        autoFlipIconsWhenCrowded: true,
        showTooltips: true
    },
    accessibility: {
        focusRing: true,
        reduceMotion: false,
        highContrast: false,
        ariaLiveToasts: true
    },
    appearance: {
        theme: 'system',
        brandColor: '#2266ff',
        surfaceColor: '#0f1115',
        textColor: '#e6e6e6',
        accentColor: '#8bc34a',
        borderRadius: 14,
        borderWidth: 1,
        shadowStrength: 0.25,
        spacingScale: 8,
        iconSize: 18,
        copyIconCorner: 'br',
        panelWidth: 360,
        panelPosition: 'right',
        compactMode: false,
        customCSS: ''
    },
    privacy: {
        collectAnonUsage: false,
        logConsoleDebug: false
    }
};

/**
 * Settings validation and clamping
 * @param {any} settings - Settings to validate
 * @returns {Settings} Validated and clamped settings
 */
function validateAndClampSettings(settings) {
    const validated = { ...DEFAULT_SETTINGS };

    // Deep merge with validation
    if (settings.general) {
        validated.general = {
            ...validated.general,
            ...settings.general,
            language: typeof settings.general.language === 'string' ? settings.general.language : validated.general.language,
            openSettingsShortcut: typeof settings.general.openSettingsShortcut === 'string' ? settings.general.openSettingsShortcut : validated.general.openSettingsShortcut,
            telemetryEnabled: typeof settings.general.telemetryEnabled === 'boolean' ? settings.general.telemetryEnabled : validated.general.telemetryEnabled
        };
    }

    if (settings.behavior) {
        validated.behavior = {
            ...validated.behavior,
            ...settings.behavior,
            snapDistance: Math.max(0, Math.min(50, Number(settings.behavior.snapDistance) || validated.behavior.snapDistance)),
            nudgeStepPx: Math.max(1, Math.min(20, Number(settings.behavior.nudgeStepPx) || validated.behavior.nudgeStepPx))
        };
    }

    if (settings.accessibility) {
        validated.accessibility = { ...validated.accessibility, ...settings.accessibility };
    }

    if (settings.appearance) {
        validated.appearance = {
            ...validated.appearance,
            ...settings.appearance,
            borderRadius: Math.max(0, Math.min(50, Number(settings.appearance.borderRadius) || validated.appearance.borderRadius)),
            borderWidth: Math.max(0, Math.min(10, Number(settings.appearance.borderWidth) || validated.appearance.borderWidth)),
            shadowStrength: Math.max(0, Math.min(1, Number(settings.appearance.shadowStrength) || validated.appearance.shadowStrength)),
            spacingScale: Math.max(4, Math.min(24, Number(settings.appearance.spacingScale) || validated.appearance.spacingScale)),
            iconSize: Math.max(12, Math.min(48, Number(settings.appearance.iconSize) || validated.appearance.iconSize)),
            panelWidth: Math.max(200, Math.min(800, Number(settings.appearance.panelWidth) || validated.appearance.panelWidth)),
            theme: ['light', 'dark', 'system'].includes(settings.appearance.theme) ? settings.appearance.theme : validated.appearance.theme,
            copyIconCorner: ['br', 'tr', 'bl', 'tl'].includes(settings.appearance.copyIconCorner) ? settings.appearance.copyIconCorner : validated.appearance.copyIconCorner,
            panelPosition: ['left', 'right'].includes(settings.appearance.panelPosition) ? settings.appearance.panelPosition : validated.appearance.panelPosition
        };
    }

    if (settings.privacy) {
        validated.privacy = { ...validated.privacy, ...settings.privacy };
    }

    return validated;
}

/**
 * Deep merge utility
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

/**
 * Settings migration function
 * @param {any} input - Input settings
 * @param {number} fromVersion - Source version
 * @returns {Settings} Migrated settings
 */
function migrateSettings(input, fromVersion) {
    let settings = { ...input };

    switch (fromVersion) {
        case 0:
            // Migrate from v0 to v1
            settings = {
                version: 1,
                general: {
                    language: settings.language || 'en',
                    openSettingsShortcut: settings.openSettingsShortcut || 'Alt+,',
                    telemetryEnabled: settings.telemetryEnabled !== false
                },
                behavior: {
                    snapToEdges: settings.snapToEdges !== false,
                    snapDistance: settings.snapDistance || 8,
                    nudgeWithAltArrows: settings.nudgeWithAltArrows !== false,
                    nudgeStepPx: settings.nudgeStepPx || 1,
                    autoFlipIconsWhenCrowded: settings.autoFlipIconsWhenCrowded !== false,
                    showTooltips: settings.showTooltips !== false
                },
                accessibility: {
                    focusRing: settings.focusRing !== false,
                    reduceMotion: settings.reduceMotion === true,
                    highContrast: settings.highContrast === true,
                    ariaLiveToasts: settings.ariaLiveToasts !== false
                },
                appearance: {
                    theme: settings.theme || 'system',
                    brandColor: settings.brandColor || '#2266ff',
                    surfaceColor: settings.surfaceColor || '#0f1115',
                    textColor: settings.textColor || '#e6e6e6',
                    accentColor: settings.accentColor || '#8bc34a',
                    borderRadius: settings.borderRadius || 14,
                    borderWidth: settings.borderWidth || 1,
                    shadowStrength: settings.shadowStrength || 0.25,
                    spacingScale: settings.spacingScale || 8,
                    iconSize: settings.iconSize || 18,
                    copyIconCorner: settings.copyIconCorner || 'br',
                    panelWidth: settings.panelWidth || 360,
                    panelPosition: settings.panelPosition || 'right',
                    compactMode: settings.compactMode === true,
                    customCSS: settings.customCSS || ''
                },
                privacy: {
                    collectAnonUsage: settings.collectAnonUsage === true,
                    logConsoleDebug: settings.logConsoleDebug === true
                }
            };
            break;
        default:
            // Unknown version, return defaults
            settings = DEFAULT_SETTINGS;
            break;
    }

    return validateAndClampSettings(settings);
}

/**
 * Settings store class
 */
class SettingsStore {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.listeners = new Set();
        this.writeDebounceTimer = null;
        this.storage = null;
        this.init();
    }

    /**
     * Initialize the settings store
     */
    async init() {
        try {
            // Try to load settings from storage
            const stored = await this.loadFromStorage();
            if (stored) {
                this.settings = migrateSettings(stored, stored.version || 0);
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
            this.settings = { ...DEFAULT_SETTINGS };
        }

        // Initialize storage abstraction
        this.storage = new StorageAdapter();

        // Dispatch initial settings
        this.dispatchChange();
    }

    /**
     * Load settings from storage
     * @returns {Promise<Settings|null>} Loaded settings or null
     */
    async loadFromStorage() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => {
                    chrome.storage.sync.get(['appSettings'], (result) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Chrome storage error:', chrome.runtime.lastError);
                            resolve(null);
                        } else {
                            resolve(result.appSettings || null);
                        }
                    });
                });
            } else {
                const stored = localStorage.getItem('appSettings');
                return stored ? JSON.parse(stored) : null;
            }
        } catch (error) {
            console.warn('Storage read error:', error);
            return null;
        }
    }

    /**
     * Save settings to storage
     * @param {Settings} settings - Settings to save
     */
    async saveToStorage(settings) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => {
                    chrome.storage.sync.set({ appSettings: settings }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Chrome storage error:', chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            } else {
                localStorage.setItem('appSettings', JSON.stringify(settings));
            }
        } catch (error) {
            console.warn('Storage write error:', error);
        }
    }

    /**
     * Debounced save to storage
     * @param {Settings} settings - Settings to save
     */
    debouncedSave(settings) {
        if (this.writeDebounceTimer) {
            clearTimeout(this.writeDebounceTimer);
        }

        this.writeDebounceTimer = setTimeout(() => {
            this.saveToStorage(settings);
            this.writeDebounceTimer = null;
        }, 250);
    }

    /**
     * Dispatch settings change event
     */
    dispatchChange() {
        // Dispatch custom event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:settings:changed', {
                detail: this.settings
            }));
        }

        // Notify listeners
        this.listeners.forEach(callback => {
            try {
                callback(this.settings);
            } catch (error) {
                console.error('Settings listener error:', error);
            }
        });
    }

    /**
     * Get current settings
     * @returns {Promise<Settings>} Current settings
     */
    async getSettings() {
        return { ...this.settings };
    }

    /**
     * Update settings with deep merge
     * @param {Partial<Settings>} patch - Settings patch
     * @returns {Promise<Settings>} Updated settings
     */
    async updateSettings(patch) {
        const merged = deepMerge(this.settings, patch);
        const validated = validateAndClampSettings(merged);

        this.settings = validated;
        this.debouncedSave(validated);
        this.dispatchChange();

        return { ...validated };
    }

    /**
     * Subscribe to settings changes
     * @param {function(Settings): void} callback - Change callback
     * @returns {function(): void} Unsubscribe function
     */
    onSettingsChange(callback) {
        this.listeners.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Export settings as JSON string
     * @returns {Promise<string>} JSON string
     */
    async exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings from JSON string
     * @param {string} json - JSON string
     * @returns {Promise<Settings>} Imported settings
     */
    async importSettings(json) {
        try {
            const parsed = JSON.parse(json);
            const migrated = migrateSettings(parsed, parsed.version || 0);
            const validated = validateAndClampSettings(migrated);

            this.settings = validated;
            this.debouncedSave(validated);
            this.dispatchChange();

            return { ...validated };
        } catch (error) {
            throw new Error('Invalid settings JSON: ' + error.message);
        }
    }
}

/**
 * Storage adapter for Chrome extension vs localStorage
 */
class StorageAdapter {
    constructor() {
        this.isChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
    }

    /**
     * Get value from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Stored value
     */
    async get(key) {
        if (this.isChromeStorage) {
            return new Promise((resolve) => {
                chrome.storage.sync.get([key], (result) => {
                    resolve(chrome.runtime.lastError ? null : result[key]);
                });
            });
        } else {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : null;
        }
    }

    /**
     * Set value in storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        if (this.isChromeStorage) {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ [key]: value }, () => {
                    resolve();
                });
            });
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }
}

// Create global settings store instance
const settingsStore = new SettingsStore();

// Export API
if (typeof window !== 'undefined') {
    window.FluxFillSettings = {
        getSettings: () => settingsStore.getSettings(),
        updateSettings: (patch) => settingsStore.updateSettings(patch),
        onSettingsChange: (callback) => settingsStore.onSettingsChange(callback),
        exportSettings: () => settingsStore.exportSettings(),
        importSettings: (json) => settingsStore.importSettings(json)
    };
    // Backward alias in case older code referenced the prior name
    window.FillFluxSettings = window.FluxFillSettings;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        settingsStore,
        DEFAULT_SETTINGS,
        validateAndClampSettings,
        migrateSettings,
        StorageAdapter
    };
}
