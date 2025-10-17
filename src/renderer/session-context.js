/**
 * 🧠 SESSION CONTEXT MANAGER
 * 
 * Agent'ın kısa süreli belleği - "Ben neredeyim, ne yapıyorum?" sorusuna cevap verir.
 * 
 * FEATURES:
 * - Active session tracking (current project, phase, files)
 * - Last N operations memory (what did I just do?)
 * - Error history (what went wrong?)
 * - Next steps queue (what should I do next?)
 * - In-memory only (no file system access in renderer process)
 */

class SessionContext {
    constructor() {
        // In-memory context (no fs access in renderer)
        this.context = {
            sessionId: this.generateSessionId(),
            startedAt: Date.now(),
            lastUpdated: Date.now(),
            
            // 📍 Current State
            currentProject: {
                name: null,
                path: null,
                type: null, // 'nodejs', 'react', 'python', etc.
                fileCount: 0,
                structure: {} // Simplified structure
            },
            
            // 🎯 Active Mission
            activeMission: {
                goal: null,
                currentPhase: 0,
                totalPhases: 0,
                completedSteps: [],
                pendingSteps: [],
                acceptanceCriteria: []
            },
            
            // 📜 Recent Operations (Last 20)
            recentOps: [],
            
            // ❌ Error History (Last 10)
            errors: [],
            
            // 📦 Tracked Files
            files: {
                created: [],
                modified: [],
                tracked: [] // Phase tracking
            },
            
            // 📊 Statistics
            stats: {
                opsTotal: 0,
                opsSuccess: 0,
                opsFailed: 0,
                filesCreated: 0,
                errors: 0
            }
        };
        
        console.log('🧠 Session Context initialized (in-memory)');
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Update current project info
     */
    setProject(name, path, type = 'unknown') {
        this.context.currentProject = {
            name,
            path,
            type,
            fileCount: this.context.files.created.length,
            structure: {} // Simplified
        };
        this.context.lastUpdated = Date.now();
        
        console.log(`📍 Project set: ${name} (${type})`);
    }
    
    /**
     * Scan workspace (simplified - just file count)
     */
    async scanWorkspace(workspaceRoot) {
        if (!workspaceRoot) {
            console.warn('⚠️ No workspace root provided');
            return;
        }
        
        this.context.currentProject.path = workspaceRoot;
        this.context.currentProject.fileCount = this.context.files.created.length;
        this.context.lastUpdated = Date.now();
        
        console.log(`🔍 Workspace scanned: ${workspaceRoot}`);
    }
    
    /**
     * Set active mission
     */
    setMission(goal, totalPhases = 1, acceptanceCriteria = []) {
        this.context.activeMission = {
            goal,
            currentPhase: 1,
            totalPhases,
            completedSteps: [],
            pendingSteps: [],
            acceptanceCriteria
        };
        this.context.lastUpdated = Date.now();
        
        console.log(`🎯 Mission set: ${goal}`);
    }
    
    /**
     * Update mission progress
     */
    updateMissionProgress(currentPhase, completedSteps = [], pendingSteps = []) {
        this.context.activeMission.currentPhase = currentPhase;
        this.context.activeMission.completedSteps = completedSteps;
        this.context.activeMission.pendingSteps = pendingSteps;
        this.context.lastUpdated = Date.now();
    }
    
    /**
     * Record an operation
     */
    recordOperation(type, description, success = true, metadata = {}) {
        const op = {
            type,
            description,
            success,
            metadata,
            timestamp: Date.now()
        };
        
        this.context.recentOps.unshift(op);
        
        // Keep last 20 operations
        if (this.context.recentOps.length > 20) {
            this.context.recentOps = this.context.recentOps.slice(0, 20);
        }
        
        // Update stats
        this.context.stats.opsTotal++;
        if (success) {
            this.context.stats.opsSuccess++;
        } else {
            this.context.stats.opsFailed++;
        }
        
        this.context.lastUpdated = Date.now();
    }
    
    /**
     * Record an error
     */
    recordError(error, context = {}) {
        const errorRecord = {
            message: error.message || error,
            context,
            timestamp: Date.now()
        };
        
        this.context.errors.unshift(errorRecord);
        
        // Keep last 10 errors
        if (this.context.errors.length > 10) {
            this.context.errors = this.context.errors.slice(0, 10);
        }
        
        this.context.stats.errors++;
        this.context.lastUpdated = Date.now();
        
        console.error(`❌ Error recorded: ${errorRecord.message}`);
    }
    
    /**
     * Track file creation
     */
    trackFileCreated(filePath) {
        if (!this.context.files.created.includes(filePath)) {
            this.context.files.created.push(filePath);
            this.context.stats.filesCreated++;
        }
        this.context.lastUpdated = Date.now();
    }
    
    /**
     * Track file modification
     */
    trackFileModified(filePath) {
        if (!this.context.files.modified.includes(filePath)) {
            this.context.files.modified.push(filePath);
        }
        this.context.lastUpdated = Date.now();
    }
    
    /**
     * Get context summary for AI prompt
     */
    getContextSummary() {
        const { currentProject, activeMission, recentOps, errors, files, stats } = this.context;
        
        const summary = {
            // Project info
            project: currentProject.name || 'Unknown',
            projectType: currentProject.type || 'Unknown',
            fileCount: files.created.length,
            
            // Mission info
            mission: activeMission.goal || 'No active mission',
            phase: `${activeMission.currentPhase}/${activeMission.totalPhases}`,
            completedSteps: activeMission.completedSteps.length,
            pendingSteps: activeMission.pendingSteps.length,
            
            // Recent activity
            lastOperation: recentOps[0]?.description || 'None',
            recentErrors: errors.slice(0, 3).map(e => e.message),
            
            // Statistics
            successRate: stats.opsTotal > 0 
                ? Math.round((stats.opsSuccess / stats.opsTotal) * 100)
                : 0,
            totalOps: stats.opsTotal,
            totalErrors: stats.errors,
            
            // Files
            filesCreated: files.created.length,
            recentFiles: files.created.slice(-5)
        };
        
        return summary;
    }
    
    /**
     * Generate AI context prompt
     */
    getAIContextPrompt() {
        const summary = this.getContextSummary();
        
        return `
## 📊 SESSION CONTEXT

**Current Project**: ${summary.project} (${summary.projectType}, ${summary.fileCount} files)

**Active Mission**: ${summary.mission}
- Progress: Phase ${summary.phase}
- Completed Steps: ${summary.completedSteps}
- Pending Steps: ${summary.pendingSteps}

**Recent Activity**:
- Last Operation: ${summary.lastOperation}
- Success Rate: ${summary.successRate}%
- Total Operations: ${summary.totalOps}
- Files Created: ${summary.filesCreated}

**Recent Errors**: ${summary.recentErrors.length > 0 ? summary.recentErrors.join(', ') : 'None'}

**Recent Files**: ${summary.recentFiles.length > 0 ? summary.recentFiles.join(', ') : 'None'}
`.trim();
    }
    
    /**
     * Reset context
     */
    reset() {
        this.context.recentOps = [];
        this.context.errors = [];
        this.context.files = {
            created: [],
            modified: [],
            tracked: []
        };
        this.context.activeMission = {
            goal: null,
            currentPhase: 0,
            totalPhases: 0,
            completedSteps: [],
            pendingSteps: [],
            acceptanceCriteria: []
        };
        
        console.log('🗑️ Session context reset');
    }
    
    /**
     * Get full context object
     */
    getContext() {
        return this.context;
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionContext;
}
