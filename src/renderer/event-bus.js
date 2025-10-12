/**
 * 📡 EVENT BUS SYSTEM
 * 
 * JSONL-based event stream for telemetry and tracking.
 * All agent operations emit events to this bus.
 * Narrator reads from this stream for live commentary.
 * 
 * Event Types:
 * - START_STEP: Step begins
 * - WRITE_FILE: File operation
 * - RUN_CMD: Command execution
 * - PROBE_FILE/HTTP/PORT: Validation
 * - STEP_RESULT: Step completion
 * - APPROVAL_REQUEST/GRANTED/DENIED: Approval workflow
 * - POLICY_VIOLATION: Policy check
 * - ERROR: Error occurred
 */

class EventBus {
    constructor(options = {}) {
        // Configuration
        this.config = {
            enableFileLogging: options.enableFileLogging !== false,
            enableConsoleLogging: options.enableConsoleLogging !== false,
            maxMemoryEvents: options.maxMemoryEvents || 1000,
            logFile: options.logFile || 'events.jsonl'
        };
        
        // In-memory event buffer (last N events)
        this.events = [];
        
        // Event listeners
        this.listeners = new Map();
        
        // Statistics
        this.stats = {
            totalEvents: 0,
            eventsByType: {}
        };
        
        console.log('✅ Event Bus initialized');
    }
    
    /**
     * Emit an event
     * @param {Object} event - Event object
     */
    emit(event) {
        // Add metadata
        const enrichedEvent = {
            timestamp: Date.now(),
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            ...event
        };
        
        // Add to memory buffer
        this.events.push(enrichedEvent);
        
        // Trim buffer if too large
        if (this.events.length > this.config.maxMemoryEvents) {
            this.events.shift();
        }
        
        // Update statistics
        this.stats.totalEvents++;
        this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;
        
        // Console logging
        if (this.config.enableConsoleLogging) {
            this.logToConsole(enrichedEvent);
        }
        
        // File logging (async, non-blocking)
        if (this.config.enableFileLogging) {
            this.logToFile(enrichedEvent).catch(err => {
                console.warn('⚠️ Failed to write event to file:', err.message);
            });
        }
        
        // Notify listeners
        this.notifyListeners(enrichedEvent);
        
        return enrichedEvent.id;
    }
    
    /**
     * Subscribe to events
     * @param {string|Array} eventTypes - Event type(s) to listen for (or '*' for all)
     * @param {Function} callback - Callback function
     * @returns {string} Listener ID
     */
    on(eventTypes, callback) {
        const id = `listener-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        // Normalize to array
        const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
        
        this.listeners.set(id, {
            types,
            callback
        });
        
        return id;
    }
    
    /**
     * Unsubscribe from events
     * @param {string} listenerId - Listener ID
     */
    off(listenerId) {
        this.listeners.delete(listenerId);
    }
    
    /**
     * Notify listeners of event
     * @param {Object} event - Event
     */
    notifyListeners(event) {
        for (const [id, listener] of this.listeners.entries()) {
            // Check if listener is interested in this event type
            if (listener.types.includes('*') || listener.types.includes(event.type)) {
                try {
                    listener.callback(event);
                } catch (error) {
                    console.error(`⚠️ Listener ${id} error:`, error);
                }
            }
        }
    }
    
    /**
     * Read recent events
     * @param {number} count - Number of events to read
     * @param {string} filterType - Optional event type filter
     * @returns {Array} Events
     */
    readRecent(count = 10, filterType = null) {
        let events = [...this.events];
        
        // Filter by type if specified
        if (filterType) {
            events = events.filter(e => e.type === filterType);
        }
        
        // Return last N events
        return events.slice(-count);
    }
    
    /**
     * Read events since timestamp
     * @param {number} since - Timestamp
     * @param {string} filterType - Optional event type filter
     * @returns {Array} Events
     */
    readSince(since, filterType = null) {
        let events = this.events.filter(e => e.timestamp > since);
        
        if (filterType) {
            events = events.filter(e => e.type === filterType);
        }
        
        return events;
    }
    
    /**
     * Log event to console with formatting
     * @param {Object} event - Event
     */
    logToConsole(event) {
        const icon = this.getEventIcon(event.type);
        const time = new Date(event.timestamp).toLocaleTimeString();
        
        console.log(`${icon} [${time}] ${event.type}:`, event);
    }
    
    /**
     * Log event to JSONL file
     * @param {Object} event - Event
     * @returns {Promise}
     */
    async logToFile(event) {
        // Use electron API if available
        if (window.electronAPI && window.electronAPI.appendToFile) {
            const line = JSON.stringify(event) + '\n';
            await window.electronAPI.appendToFile(this.config.logFile, line);
        }
    }
    
    /**
     * Get icon for event type
     * @param {string} type - Event type
     * @returns {string} Icon
     */
    getEventIcon(type) {
        const icons = {
            START_STEP: '🎯',
            WRITE_FILE: '📝',
            RUN_CMD: '⚙️',
            PROBE_FILE: '🔍',
            PROBE_HTTP: '🌐',
            PROBE_PORT: '🔌',
            STEP_RESULT: '✅',
            APPROVAL_REQUEST: '🔐',
            APPROVAL_GRANTED: '✅',
            APPROVAL_DENIED: '❌',
            POLICY_VIOLATION: '⚠️',
            ERROR: '❌',
            INFO: 'ℹ️'
        };
        
        return icons[type] || '•';
    }
    
    /**
     * Clear event buffer
     */
    clear() {
        this.events = [];
        console.log('🧹 Event buffer cleared');
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            ...this.stats,
            bufferSize: this.events.length,
            listeners: this.listeners.size
        };
    }
    
    /**
     * Export events to JSON
     * @param {Object} options - Export options
     * @returns {string} JSON string
     */
    exportToJSON(options = {}) {
        const { since = 0, filterType = null, pretty = true } = options;
        
        let events = this.events.filter(e => e.timestamp > since);
        
        if (filterType) {
            events = events.filter(e => e.type === filterType);
        }
        
        return pretty ? JSON.stringify(events, null, 2) : JSON.stringify(events);
    }
    
    /**
     * Helper: Emit START_STEP event
     */
    emitStepStart(step) {
        return this.emit({
            type: 'START_STEP',
            step: {
                id: step.id,
                title: step.title,
                intent: step.intent
            }
        });
    }
    
    /**
     * Helper: Emit STEP_RESULT event
     */
    emitStepResult(step, status, details = {}) {
        return this.emit({
            type: 'STEP_RESULT',
            step: {
                id: step.id,
                title: step.title
            },
            status,
            ...details
        });
    }
    
    /**
     * Helper: Emit WRITE_FILE event
     */
    emitWriteFile(filepath, operation = 'write') {
        return this.emit({
            type: 'WRITE_FILE',
            filepath,
            operation
        });
    }
    
    /**
     * Helper: Emit RUN_CMD event
     */
    emitRunCommand(command, cwd = null) {
        return this.emit({
            type: 'RUN_CMD',
            command,
            cwd
        });
    }
    
    /**
     * Helper: Emit PROBE event
     */
    emitProbe(probeType, target, result) {
        return this.emit({
            type: `PROBE_${probeType.toUpperCase()}`,
            target,
            ok: result.ok,
            details: result.details
        });
    }
    
    /**
     * Helper: Emit ERROR event
     */
    emitError(error, context = {}) {
        return this.emit({
            type: 'ERROR',
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}
