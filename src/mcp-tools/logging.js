/**
 * MCP Logging System
 * Implements logging/setLevel per MCP specification
 */

class LoggingManager {
    constructor() {
        this.currentLevel = 'info'; // Default level
        this.levels = {
            'debug': 0,
            'info': 1,
            'warning': 2,
            'error': 3
        };
        this.listeners = new Set();
    }
    
    /**
     * Set log level
     * @param {object} params - Parameters
     * @param {string} params.level - Log level (debug, info, warning, error)
     * @returns {object} - Success response
     */
    async setLevel(params) {
        const { level } = params;
        
        // Validate level
        if (!this.levels.hasOwnProperty(level)) {
            throw new Error(`Invalid log level: ${level}. Must be one of: debug, info, warning, error`);
        }
        
        const oldLevel = this.currentLevel;
        this.currentLevel = level;
        
        // Emit level change event
        this.emit('level-changed', {
            oldLevel,
            newLevel: level,
            timestamp: new Date().toISOString()
        });
        
        return {
            success: true,
            level: this.currentLevel,
            previousLevel: oldLevel
        };
    }
    
    /**
     * Get current log level
     * @returns {string} - Current level
     */
    getLevel() {
        return this.currentLevel;
    }
    
    /**
     * Check if level is enabled
     * @param {string} level - Level to check
     * @returns {boolean} - Whether level is enabled
     */
    isLevelEnabled(level) {
        return this.levels[level] >= this.levels[this.currentLevel];
    }
    
    /**
     * Log message if level is enabled
     * @param {string} level - Log level
     * @param {string} message - Message
     * @param {object} metadata - Additional metadata
     */
    log(level, message, metadata = {}) {
        if (!this.isLevelEnabled(level)) {
            return;
        }
        
        const logEntry = {
            level,
            message,
            metadata,
            timestamp: new Date().toISOString()
        };
        
        // Emit log event
        this.emit('log', logEntry);
        
        // Console output with colors
        const colors = {
            'debug': '\x1b[36m',    // Cyan
            'info': '\x1b[32m',     // Green
            'warning': '\x1b[33m',  // Yellow
            'error': '\x1b[31m'     // Red
        };
        const reset = '\x1b[0m';
        
        const color = colors[level] || '';
        const levelStr = level.toUpperCase().padEnd(7);
        console.log(`${color}[${levelStr}]${reset} ${message}`, metadata);
    }
    
    /**
     * Debug log
     */
    debug(message, metadata) {
        this.log('debug', message, metadata);
    }
    
    /**
     * Info log
     */
    info(message, metadata) {
        this.log('info', message, metadata);
    }
    
    /**
     * Warning log
     */
    warning(message, metadata) {
        this.log('warning', message, metadata);
    }
    
    /**
     * Error log
     */
    error(message, metadata) {
        this.log('error', message, metadata);
    }
    
    /**
     * Register event listener
     */
    on(event, callback) {
        this.listeners.add({ event, callback });
    }
    
    /**
     * Emit event
     */
    emit(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error('Error in log listener:', error);
                }
            }
        }
    }
}

// Singleton instance
let loggingManager = null;

function getLoggingManager() {
    if (!loggingManager) {
        loggingManager = new LoggingManager();
    }
    return loggingManager;
}

module.exports = {
    LoggingManager,
    getLoggingManager
};
