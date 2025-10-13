/**
 * 👨‍🏫 NARRATOR AGENT
 * 
 * Converts technical events into human-readable "Usta Anlatımı" (Master's Commentary).
 * Reads from Event Bus and generates live commentary for users.
 * 
 * Features:
 * - Event stream monitoring (polls every 2 seconds)
 * - Event → Commentary conversion
 * - Context-aware narration (tracks current step)
 * - Turkish language support
 * - Educational tone (explains "why" not just "what")
 */

class NarratorAgent {
    constructor(eventBus, ui) {
        this.eventBus = eventBus;
        this.ui = ui;
        
        // Narration state
        this.lastNarrationTime = Date.now();
        this.currentStep = null;
        this.eventBuffer = [];
        
        // Configuration
        this.config = {
            pollInterval: 2000, // 2 seconds
            maxEventsPerNarration: 10,
            enableNarration: true
        };
        
        // Start monitoring
        if (this.eventBus) {
            this.startMonitoring();
            console.log('✅ Narrator Agent initialized');
        } else {
            console.warn('⚠️ Narrator Agent: Event Bus not available');
        }
    }
    
    /**
     * Start monitoring event bus
     */
    startMonitoring() {
        setInterval(() => {
            if (this.config.enableNarration) {
                this.narrate();
            }
        }, this.config.pollInterval);
        
        console.log(`📡 Narrator monitoring started (${this.config.pollInterval}ms interval)`);
    }
    
    /**
     * Main narration loop
     */
    async narrate() {
        try {
            // Read new events since last narration
            const events = this.eventBus.readSince(this.lastNarrationTime);
            
            if (events.length === 0) {
                return; // No new events
            }
            
            // Convert events to commentary
            const commentary = this.eventsToCommentary(events);
            
            if (commentary && commentary.length > 0) {
                // Send to UI
                if (this.ui && this.ui.addNarratorMessage) {
                    this.ui.addNarratorMessage(commentary);
                }
            }
            
            // Update timestamp
            this.lastNarrationTime = Date.now();
            
        } catch (error) {
            console.error('❌ Narrator error:', error);
        }
    }
    
    /**
     * Convert events to Turkish commentary
     * @param {Array} events - Events to narrate
     * @returns {string} Commentary text
     */
    eventsToCommentary(events) {
        if (!events || events.length === 0) {
            return '';
        }
        
        const messages = [];
        
        for (const event of events) {
            const message = this.eventToMessage(event);
            if (message) {
                messages.push(message);
            }
        }
        
        return messages.join(' ');
    }
    
    /**
     * Convert single event to Turkish message
     * @param {Object} event - Event object
     * @returns {string} Message text
     */
    eventToMessage(event) {
        const { type } = event;
        
        switch (type) {
            case 'START_STEP':
                this.currentStep = event.step;
                return this.narrateStepStart(event);
                
            case 'WRITE_FILE':
                return this.narrateWriteFile(event);
                
            case 'RUN_CMD':
                return this.narrateRunCommand(event);
                
            case 'PROBE_FILE':
            case 'PROBE_HTTP':
            case 'PROBE_PORT':
                return this.narrateProbe(event);
                
            case 'STEP_RESULT':
                return this.narrateStepResult(event);
                
            case 'APPROVAL_REQUEST':
                return this.narrateApprovalRequest(event);
                
            case 'APPROVAL_GRANTED':
                return '✅ Onay alındı, devam ediyorum.';
                
            case 'APPROVAL_DENIED':
                return '❌ İşlem reddedildi.';
                
            case 'POLICY_VIOLATION':
                return this.narratePolicyViolation(event);
                
            case 'ERROR':
                return this.narrateError(event);
                
            default:
                return null; // Skip unknown events
        }
    }
    
    /**
     * Narrate step start
     */
    narrateStepStart(event) {
        const { step } = event;
        
        if (!step) return null;
        
        return `🎯 Şimdi "${step.title}" adımına başlıyorum. ${step.intent ? 'Amacım: ' + step.intent : ''}`;
    }
    
    /**
     * Narrate file write
     */
    narrateWriteFile(event) {
        const { filepath, operation = 'yazıyorum' } = event;
        
        if (!filepath) return null;
        
        const filename = filepath.split(/[/\\]/).pop();
        
        const operations = {
            'write': 'yazıyorum',
            'create': 'oluşturuyorum',
            'modify': 'düzenliyorum',
            'delete': 'siliyorum'
        };
        
        const verb = operations[operation] || operation;
        
        return `📝 \`${filename}\` dosyasını ${verb}.`;
    }
    
    /**
     * Narrate command execution
     */
    narrateRunCommand(event) {
        const { command, cwd } = event;
        
        if (!command) return null;
        
        // Shorten command for display
        const shortCmd = command.length > 50 
            ? command.substring(0, 47) + '...'
            : command;
        
        return `⚙️ Komutu çalıştırıyorum: \`${shortCmd}\``;
    }
    
    /**
     * Narrate probe execution
     */
    narrateProbe(event) {
        const { type, target, ok } = event;
        
        if (!target) return null;
        
        const probeTypes = {
            'PROBE_FILE': 'Dosya kontrolü',
            'PROBE_HTTP': 'HTTP kontrolü',
            'PROBE_PORT': 'Port kontrolü'
        };
        
        const probeName = probeTypes[type] || 'Kontrol';
        const filename = typeof target === 'string' ? target.split(/[/\\]/).pop() : target;
        
        if (ok) {
            return `✅ ${probeName} başarılı: \`${filename}\``;
        } else {
            return `⚠️ ${probeName} başarısız: \`${filename}\` - Analiz ediyorum...`;
        }
    }
    
    /**
     * Narrate step result
     */
    narrateStepResult(event) {
        const { status, step } = event;
        
        if (status === 'PASS') {
            return `🎉 "${step?.title || 'Adım'}" başarıyla tamamlandı!`;
        } else if (status === 'FAIL') {
            return `⚠️ "${step?.title || 'Adım'}" başarısız oldu. Sorunu analiz edip düzeltme önerisi hazırlıyorum...`;
        }
        
        return null;
    }
    
    /**
     * Narrate approval request
     */
    narrateApprovalRequest(event) {
        return `🔐 Onay bekliyorum. Lütfen önerilen değişiklikleri inceleyin ve onaylayın veya reddedin.`;
    }
    
    /**
     * Narrate policy violation
     */
    narratePolicyViolation(event) {
        const { violation } = event;
        
        if (!violation) return null;
        
        const severityEmoji = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢'
        };
        
        const emoji = severityEmoji[violation.severity] || '⚠️';
        
        return `${emoji} Politika uyarısı: ${violation.message}`;
    }
    
    /**
     * Narrate error
     */
    narrateError(event) {
        const { error } = event;
        
        if (!error) return null;
        
        return `❌ Hata oluştu: ${error.message || 'Bilinmeyen hata'}. Çözüm arıyorum...`;
    }
    
    /**
     * Get current step info (for context)
     * @returns {Object|null} Current step
     */
    getCurrentStep() {
        return this.currentStep;
    }
    
    /**
     * Enable/disable narration
     * @param {boolean} enabled - Enable or disable
     */
    setEnabled(enabled) {
        this.config.enableNarration = enabled;
        console.log(`📢 Narrator ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Set poll interval
     * @param {number} interval - Interval in milliseconds
     */
    setPollInterval(interval) {
        this.config.pollInterval = interval;
        console.log(`📡 Narrator poll interval set to ${interval}ms`);
    }
    
    /**
     * Clear narration history
     */
    clear() {
        this.eventBuffer = [];
        this.lastNarrationTime = Date.now();
        console.log('🧹 Narrator history cleared');
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            enabled: this.config.enableNarration,
            pollInterval: this.config.pollInterval,
            currentStep: this.currentStep?.title || 'None',
            lastNarration: new Date(this.lastNarrationTime).toLocaleTimeString()
        };
    }
    
    /**
     * Manual narration (for testing)
     * @param {string} message - Message to narrate
     */
    narrateManual(message) {
        if (this.ui && this.ui.addNarratorMessage) {
            this.ui.addNarratorMessage(message);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NarratorAgent;
}
