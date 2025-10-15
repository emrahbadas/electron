/**
 * 📚 LEARNING STORE
 * 
 * FAIL → PASS tracking system.
 * Stores reflections in JSONL format.
 */

// Use window.require for Electron renderer process
// Prevent re-declaration if already loaded
if (typeof window.learningStoreModules === 'undefined') {
    window.learningStoreModules = {
        fs: window.require ? window.require('fs') : null,
        path: window.require ? window.require('path') : null
    };
}
const fs = window.learningStoreModules.fs;
const path = window.learningStoreModules.path;

class LearningStore {
    constructor() {
        if (!fs || !path) {
            console.warn('⚠️ Learning Store: Node.js modules not available in renderer');
            this.disabled = true;
            return;
        }
        
        this.disabled = false;
        this.learningDir = path.join(process.cwd(), 'learn');
        this.reflectionsFile = path.join(this.learningDir, 'reflections.jsonl');
        this.patternsFile = path.join(this.learningDir, 'patterns.json');
        
        this.init();
        
        console.log('✅ Learning Store initialized');
    }
    
    /**
     * Initialize learning directory and files
     */
    init() {
        // Create learn/ directory if not exists
        if (!fs.existsSync(this.learningDir)) {
            fs.mkdirSync(this.learningDir, { recursive: true });
            console.log('📁 Created learn/ directory');
        }
        
        // Create reflections.jsonl if not exists
        if (!fs.existsSync(this.reflectionsFile)) {
            fs.writeFileSync(this.reflectionsFile, '', 'utf8');
            console.log('📝 Created reflections.jsonl');
        }
        
        // Create patterns.json if not exists
        if (!fs.existsSync(this.patternsFile)) {
            const initialPatterns = {
                lastUpdated: Date.now(),
                patterns: []
            };
            fs.writeFileSync(this.patternsFile, JSON.stringify(initialPatterns, null, 2), 'utf8');
            console.log('📝 Created patterns.json');
        }
    }
    
    /**
     * Save a reflection (FAIL → PASS event)
     * @param {Object} reflection - Reflection data
     */
    saveReflection(reflection) {
        const entry = {
            timestamp: Date.now(),
            mission: reflection.mission || 'Unknown',
            step: reflection.step || 'Unknown',
            tool: reflection.tool || 'Unknown',
            error: reflection.error || '',
            rootCause: reflection.rootCause || '',
            fix: reflection.fix || '',
            result: reflection.result || 'FAIL',
            pattern: reflection.pattern || null,
            metadata: reflection.metadata || {}
        };
        
        // Append to JSONL file
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.reflectionsFile, line, 'utf8');
        
        console.log('📚 Reflection saved:', entry.pattern || entry.error);
        
        // Update patterns if successful fix
        if (entry.result === 'PASS' && entry.pattern) {
            this.updatePattern(entry);
        }
        
        return entry;
    }
    
    /**
     * Update pattern database
     * @param {Object} reflection - Successful reflection
     */
    updatePattern(reflection) {
        const patterns = this.loadPatterns();
        
        // Find existing pattern or create new
        let pattern = patterns.patterns.find(p => p.id === reflection.pattern);
        
        if (pattern) {
            // Update existing pattern
            pattern.count += 1;
            pattern.lastSeen = Date.now();
            pattern.fixes.push({
                timestamp: reflection.timestamp,
                fix: reflection.fix,
                mission: reflection.mission
            });
        } else {
            // Create new pattern
            pattern = {
                id: reflection.pattern,
                count: 1,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                rootCause: reflection.rootCause,
                fixes: [{
                    timestamp: reflection.timestamp,
                    fix: reflection.fix,
                    mission: reflection.mission
                }]
            };
            patterns.patterns.push(pattern);
        }
        
        patterns.lastUpdated = Date.now();
        
        // Save patterns
        fs.writeFileSync(this.patternsFile, JSON.stringify(patterns, null, 2), 'utf8');
        
        console.log(`📈 Pattern updated: ${reflection.pattern} (count: ${pattern.count})`);
    }
    
    /**
     * Load all patterns
     * @returns {Object} Patterns object
     */
    loadPatterns() {
        try {
            const data = fs.readFileSync(this.patternsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Error loading patterns:', error.message);
            return { lastUpdated: Date.now(), patterns: [] };
        }
    }
    
    /**
     * Get pattern by ID
     * @param {string} patternId - Pattern identifier
     * @returns {Object|null} Pattern or null
     */
    getPattern(patternId) {
        const patterns = this.loadPatterns();
        return patterns.patterns.find(p => p.id === patternId) || null;
    }
    
    /**
     * Get top N most common patterns
     * @param {number} limit - Number of patterns
     * @returns {Array} Top patterns
     */
    getTopPatterns(limit = 10) {
        if (this.disabled) return [];
        const patterns = this.loadPatterns();
        return patterns.patterns
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * Load all reflections
     * @param {number} limit - Max number of reflections (0 = all)
     * @returns {Array} Reflections
     */
    loadReflections(limit = 0) {
        try {
            const data = fs.readFileSync(this.reflectionsFile, 'utf8');
            const lines = data.trim().split('\n').filter(line => line.length > 0);
            
            const reflections = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.error('❌ Invalid JSONL line:', line);
                    return null;
                }
            }).filter(r => r !== null);
            
            // Return limited or all
            if (limit > 0) {
                return reflections.slice(-limit); // Last N reflections
            }
            return reflections;
        } catch (error) {
            console.error('❌ Error loading reflections:', error.message);
            return [];
        }
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        if (this.disabled) {
            return {
                totalReflections: 0,
                successfulFixes: 0,
                failedFixes: 0,
                totalPatterns: 0,
                successRate: 0,
                topPatterns: []
            };
        }
        
        const reflections = this.loadReflections();
        const patterns = this.loadPatterns();
        
        const totalReflections = reflections.length;
        const successfulFixes = reflections.filter(r => r.result === 'PASS').length;
        const failedFixes = reflections.filter(r => r.result === 'FAIL').length;
        const totalPatterns = patterns.patterns.length;
        
        return {
            totalReflections,
            successfulFixes,
            failedFixes,
            totalPatterns,
            successRate: totalReflections > 0 ? (successfulFixes / totalReflections * 100).toFixed(1) : 0,
            topPatterns: this.getTopPatterns(5)
        };
    }
    
    /**
     * Search reflections by error or pattern
     * @param {string} query - Search query
     * @returns {Array} Matching reflections
     */
    search(query) {
        const reflections = this.loadReflections();
        const lowerQuery = query.toLowerCase();
        
        return reflections.filter(r => 
            r.error.toLowerCase().includes(lowerQuery) ||
            r.rootCause.toLowerCase().includes(lowerQuery) ||
            (r.pattern && r.pattern.toLowerCase().includes(lowerQuery))
        );
    }
    
    /**
     * Clear all reflections (dangerous!)
     */
    clear() {
        fs.writeFileSync(this.reflectionsFile, '', 'utf8');
        console.log('🗑️ All reflections cleared');
    }
}

// Singleton instance
let learningStoreInstance = null;

function getLearningStore() {
    if (!learningStoreInstance) {
        learningStoreInstance = new LearningStore();
    }
    return learningStoreInstance;
}

// Singleton export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LearningStore, getLearningStore };
}

