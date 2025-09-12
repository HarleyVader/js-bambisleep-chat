/**
 * Storage Utilities for BambiSleep Chat
 * Provides safe localStorage operations with proper JSON handling
 * Includes protection against external script interference
 */

class StorageUtils {
    /**
     * Initialize protection against external interference
     */
    static init() {
        // Store original localStorage methods in case they get overridden
        this._originalSetItem = localStorage.setItem.bind(localStorage);
        this._originalGetItem = localStorage.getItem.bind(localStorage);
        this._originalRemoveItem = localStorage.removeItem.bind(localStorage);

        console.log('🛡️ StorageUtils initialized with protection against external interference');
    }
    /**
     * Safely set an item in localStorage with proper JSON serialization
     * @param {string} key - The storage key
     * @param {any} value - The value to store (will be JSON.stringify'd if object)
     */
    static setItem(key, value) {
        try {
            // Use original localStorage method if available
            const setItemMethod = this._originalSetItem || localStorage.setItem.bind(localStorage);

            if (value === null || value === undefined) {
                const removeItemMethod = this._originalRemoveItem || localStorage.removeItem.bind(localStorage);
                removeItemMethod(key);
                return;
            }

            // If it's already a string, check if it's valid
            if (typeof value === 'string') {
                // Prevent "[object Object]" from being stored
                if (value === '[object Object]') {
                    console.error(`⚠️ Attempted to store "[object Object]" string for key ${key} - this indicates a bug!`);
                    console.trace('Storage stack trace:');
                    return; // Don't store invalid data
                }
                setItemMethod(key, value);
                return;
            }

            // For objects, arrays, etc., use JSON.stringify with validation
            if (typeof value === 'object' || Array.isArray(value)) {
                const stringified = JSON.stringify(value);

                // Double-check that stringify worked correctly
                if (stringified === undefined || stringified === '[object Object]') {
                    console.error(`⚠️ JSON.stringify failed for key ${key}:`, value);
                    console.trace('Storage error stack trace:');
                    return; // Don't store invalid data
                }

                setItemMethod(key, stringified);
                console.debug(`💾 Stored object for key ${key}:`, stringified.substring(0, 100));
                return;
            }

            // For other primitives, convert to string
            setItemMethod(key, String(value));

        } catch (error) {
            console.error(`Failed to store ${key} in localStorage:`, error);
            console.error('Value that failed to store:', value);
            // Don't throw - fail gracefully
        }
    }

    /**
     * Safely get an item from localStorage with automatic JSON parsing
     * @param {string} key - The storage key
     * @param {any} defaultValue - Default value if key doesn't exist or parsing fails
     * @returns {any} The parsed value or defaultValue
     */
    static getItem(key, defaultValue = null) {
        try {
            // Use original localStorage method if available
            const getItemMethod = this._originalGetItem || localStorage.getItem.bind(localStorage);
            const item = getItemMethod(key);

            if (item === null || item === undefined) {
                return defaultValue;
            }

            // Validate that we actually got a string, not an object
            if (typeof item !== 'string') {
                console.warn(`⚠️ localStorage.getItem returned non-string for key ${key}:`, typeof item, item);
                return defaultValue;
            }

            // Check for "[object Object]" string which indicates improper storage
            if (item === '[object Object]') {
                console.warn(`⚠️ Detected "[object Object]" string in localStorage for key ${key}, removing invalid entry`);
                const removeItemMethod = this._originalRemoveItem || localStorage.removeItem.bind(localStorage);
                removeItemMethod(key);
                return defaultValue;
            }

            // Try to parse as JSON first
            try {
                return JSON.parse(item);
            } catch (parseError) {
                // If parsing fails, return as string (might be plain text)
                console.debug(`📝 Item ${key} stored as plain text, not JSON:`, item.substring(0, 50));
                return item;
            }

        } catch (error) {
            console.error(`Failed to retrieve ${key} from localStorage:`, error);
            return defaultValue;
        }
    }

    /**
     * Safely remove an item from localStorage
     * @param {string} key - The storage key
     */
    static removeItem(key) {
        try {
            const removeItemMethod = this._originalRemoveItem || localStorage.removeItem.bind(localStorage);
            removeItemMethod(key);
        } catch (error) {
            console.error(`Failed to remove ${key} from localStorage:`, error);
        }
    }

    /**
     * Check if localStorage is available
     * @returns {boolean} True if localStorage is available
     */
    static isAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, 'test');
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate that a value won't become "[object Object]" when stringified
     * @param {any} value - The value to validate
     * @returns {boolean} True if safe to store
     */
    static isSafeToStore(value) {
        if (value === null || value === undefined) {
            return true;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return true;
        }

        if (typeof value === 'object' || Array.isArray(value)) {
            // Check if JSON.stringify would work
            try {
                const stringified = JSON.stringify(value);
                return stringified !== undefined && stringified !== '[object Object]';
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    /**
     * Clean up any "[object Object]" entries from localStorage
     * This fixes issues where objects were improperly stored as strings
     */
    static cleanupInvalidEntries() {
        try {
            const keysToRemove = [];

            // Check all localStorage keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('bambi-')) {
                    const value = localStorage.getItem(key);
                    if (value === '[object Object]') {
                        keysToRemove.push(key);
                        console.warn(`🧹 Found invalid "[object Object]" entry for key: ${key}`);
                    }
                }
            }

            // Remove invalid entries
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🧹 Cleaned up invalid localStorage entry: ${key}`);
            });

            if (keysToRemove.length > 0) {
                console.log(`🧹 Cleaned up ${keysToRemove.length} invalid localStorage entries`);
            }

        } catch (error) {
            console.error('Error during localStorage cleanup:', error);
        }
    }
}

// Global namespace for easy access
window.StorageUtils = StorageUtils;

export { StorageUtils };
