/**
 * 🔒 PHASE CONTEXT - File Duplication Prevention
 * 
 * Thread-safe file creation tracking with per-file locks.
 * Prevents the same file from being created multiple times in a phase.
 * 
 * ChatGPT-5 Audit Fix: Phase context completedFiles race condition protection
 */

export class PhaseContext {
    constructor() {
        this.completedFiles = new Set();
        this._locks = new Map(); // Per-file lock map
        this.currentPhase = 0;
        this.phaseHistory = [];
        this.phaseStartTime = Date.now();
    }
    
    /**
     * Normalize path (cross-platform, case-insensitive)
     * @param {string} p - File path
     * @returns {string} Normalized path
     */
    normalize(p) {
        if (!p) return '';
        return p.replace(/\\/g, '/').toLowerCase().trim();
    }
    
    /**
     * Check if file already completed in current phase
     * @param {string} p - File path
     * @returns {boolean}
     */
    hasFile(p) {
        return this.completedFiles.has(this.normalize(p));
    }
    
    /**
     * Mark file as completed
     * @param {string} p - File path
     */
    markFileCompleted(p) {
        const normalized = this.normalize(p);
        this.completedFiles.add(normalized);
        
        // Add to current phase history
        if (this.phaseHistory.length > 0) {
            const currentPhase = this.phaseHistory[this.phaseHistory.length - 1];
            if (currentPhase && currentPhase.files) {
                currentPhase.files.push(normalized);
            }
        }
        
        console.log(`📝 File marked completed: ${p}`);
    }
    
    /**
     * Execute function with per-file lock (prevents race conditions)
     * @param {string} p - File path
     * @param {Function} fn - Async function to execute
     * @returns {Promise<any>}
     */
    async withFileLock(p, fn) {
        const key = this.normalize(p);
        
        // Get previous lock promise (or resolve immediately)
        const prev = this._locks.get(key) || Promise.resolve();
        
        // Create new lock promise
        let release;
        const next = new Promise(resolve => { release = resolve; });
        
        // Store new lock
        this._locks.set(key, prev.then(() => next));
        
        try {
            // Wait for previous lock
            await prev;
            
            // Execute function
            return await fn();
            
        } finally {
            // Release lock
            release();
            
            // Clean up if this was the last lock
            if (this._locks.get(key) === next) {
                this._locks.delete(key);
            }
        }
    }
    
    /**
     * Start new phase
     * @param {number} phaseNumber - Phase number
     * @param {string} description - Phase description
     */
    startPhase(phaseNumber, description) {
        this.currentPhase = phaseNumber;
        this.phaseStartTime = Date.now();
        this.completedFiles.clear(); // Reset for new phase
        
        this.phaseHistory.push({
            phase: phaseNumber,
            description,
            startTime: Date.now(),
            files: []
        });
        
        console.log(`🎯 Phase ${phaseNumber} started: ${description}`);
    }
    
    /**
     * Get current phase stats
     */
    getStats() {
        return {
            currentPhase: this.currentPhase,
            completedFiles: this.completedFiles.size,
            totalPhases: this.phaseHistory.length,
            activeLocks: this._locks.size
        };
    }
    
    /**
     * Clear all state (use with caution)
     */
    reset() {
        this.completedFiles.clear();
        this._locks.clear();
        this.currentPhase = 0;
        this.phaseHistory = [];
        this.phaseStartTime = Date.now();
        
        console.log('🔄 Phase context reset');
    }
}

// Singleton instance
let instance = null;

/**
 * Get global phase context instance
 * @returns {PhaseContext}
 */
export function getPhaseContext() {
    if (!instance) {
        instance = new PhaseContext();
    }
    return instance;
}
