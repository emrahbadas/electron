/**
 * MCP Notifications System
 * Implements notifications/message and notifications/initialized per MCP spec
 */

const { getLoggingManager } = require('./logging.js');

class NotificationsManager {
    constructor() {
        this.logger = getLoggingManager();
        this.initialized = false;
        this.listeners = new Set();
        this.messageQueue = [];
    }
    
    /**
     * Send notification message
     * @param {object} params - Parameters
     * @param {string} params.level - Log level (debug, info, warning, error)
     * @param {string} params.message - Message text
     * @param {object} params.metadata - Optional metadata
     * @returns {object} - Success response
     */
    async sendMessage(params) {
        const { level = 'info', message, metadata = {} } = params;
        
        if (!message) {
            throw new Error('Message is required');
        }
        
        // Validate level
        const validLevels = ['debug', 'info', 'warning', 'error'];
        if (!validLevels.includes(level)) {
            throw new Error(`Invalid level: ${level}. Must be one of: ${validLevels.join(', ')}`);
        }
        
        const notification = {
            type: 'notification',
            method: 'notifications/message',
            params: {
                level,
                message,
                metadata,
                timestamp: new Date().toISOString()
            }
        };
        
        // Add to queue
        this.messageQueue.push(notification);
        
        // Emit to listeners
        this.emit('message', notification.params);
        
        // Log via logging system
        this.logger.log(level, message, metadata);
        
        return {
            success: true,
            messageId: this.messageQueue.length,
            timestamp: notification.params.timestamp
        };
    }
    
    /**
     * Send initialized notification
     * @param {object} params - Parameters
     * @param {object} params.clientInfo - Client information
     * @param {object} params.serverCapabilities - Server capabilities
     * @returns {object} - Success response
     */
    async sendInitialized(params) {
        const { clientInfo, serverCapabilities } = params;
        
        const notification = {
            type: 'notification',
            method: 'notifications/initialized',
            params: {
                clientInfo: clientInfo || { name: 'Unknown', version: '0.0.0' },
                serverCapabilities: serverCapabilities || {},
                timestamp: new Date().toISOString()
            }
        };
        
        this.initialized = true;
        
        // Emit to listeners
        this.emit('initialized', notification.params);
        
        // Log
        this.logger.info('Client initialized', {
            client: notification.params.clientInfo,
            capabilities: Object.keys(notification.params.serverCapabilities)
        });
        
        return {
            success: true,
            initialized: true,
            timestamp: notification.params.timestamp
        };
    }
    
    /**
     * Get notification queue
     * @returns {Array} - Message queue
     */
    getMessages() {
        return this.messageQueue;
    }
    
    /**
     * Clear message queue
     */
    clearMessages() {
        this.messageQueue = [];
    }
    
    /**
     * Get initialization status
     * @returns {boolean} - Whether client is initialized
     */
    isInitialized() {
        return this.initialized;
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
                    console.error('Error in notification listener:', error);
                }
            }
        }
    }
    
    /**
     * Send progress notification
     * @param {object} params - Parameters
     * @param {string} params.operationId - Operation ID
     * @param {number} params.progress - Progress (0-100)
     * @param {string} params.message - Progress message
     */
    async sendProgress(params) {
        const { operationId, progress, message } = params;
        
        if (!operationId) {
            throw new Error('Operation ID is required');
        }
        
        if (typeof progress !== 'number' || progress < 0 || progress > 100) {
            throw new Error('Progress must be a number between 0 and 100');
        }
        
        const notification = {
            type: 'notification',
            method: 'notifications/progress',
            params: {
                operationId,
                progress,
                message: message || `Progress: ${progress}%`,
                timestamp: new Date().toISOString()
            }
        };
        
        // Emit to listeners
        this.emit('progress', notification.params);
        
        // Log if significant milestone
        if (progress % 25 === 0) {
            this.logger.debug(`Operation ${operationId}: ${progress}%`, { message });
        }
        
        return {
            success: true,
            operationId,
            progress
        };
    }
    
    /**
     * Send error notification
     * @param {object} params - Parameters
     * @param {string} params.error - Error message
     * @param {object} params.details - Error details
     */
    async sendError(params) {
        const { error, details = {} } = params;
        
        if (!error) {
            throw new Error('Error message is required');
        }
        
        return await this.sendMessage({
            level: 'error',
            message: error,
            metadata: {
                ...details,
                type: 'error'
            }
        });
    }
    
    /**
     * Send warning notification
     * @param {object} params - Parameters
     * @param {string} params.warning - Warning message
     * @param {object} params.details - Warning details
     */
    async sendWarning(params) {
        const { warning, details = {} } = params;
        
        if (!warning) {
            throw new Error('Warning message is required');
        }
        
        return await this.sendMessage({
            level: 'warning',
            message: warning,
            metadata: {
                ...details,
                type: 'warning'
            }
        });
    }
}

// Singleton instance
let notificationsManager = null;

function getNotificationsManager() {
    if (!notificationsManager) {
        notificationsManager = new NotificationsManager();
    }
    return notificationsManager;
}

module.exports = {
    NotificationsManager,
    getNotificationsManager
};
