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
 * - File tree snapshot (project structure awareness)
 */

const fs = (typeof window !== 'undefined' && window.require) ? window.require('fs') : require('fs');
const path = (typeof window !== 'undefined' && window.require) ? window.require('path') : require('path');

class SessionContext {
    constructor() {
        this.sessionDir = path.join(process.cwd(), '.kayra-session');
        this.contextFile = path.join(this.sessionDir, 'context.json');
        
        // In-memory context
        this.context = {
            sessionId: this.generateSessionId(),
            startedAt: Date.now(),
            lastUpdated: Date.now(),
            
            // 📍 Current State
            currentProject: {
                name: null,
                path: null,
                type: null, // 'nodejs', 'react', 'python', etc.
                structure: {} // File tree snapshot
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
            
            // 📊 Statistics
            stats: {
                filesCreated: 0,
                filesModified: 0,
                commandsRun: 0,
                totalSteps: 0,
                successRate: 1.0
            },
            
            // 🔍 File Tracking
            trackedFiles: new Set(),
            modifiedFiles: new Set()
        };
        
        this.init();
        
        console.log('🧠 Session Context Manager initialized');
        console.log(`   Session ID: ${this.context.sessionId}`);
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `session-${timestamp}-${random}`;
    }
    
    /**
     * Initialize session directory
     */
    init() {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
        
        // Load existing context if available
        if (fs.existsSync(this.contextFile)) {
            try {
                const data = fs.readFileSync(this.contextFile, 'utf8');
                const loaded = JSON.parse(data);
                
                // Restore context but generate new session ID
                this.context = {
                    ...loaded,
                    sessionId: this.generateSessionId(),
                    startedAt: Date.now(),
                    lastUpdated: Date.now(),
                    trackedFiles: new Set(loaded.trackedFiles || []),
                    modifiedFiles: new Set(loaded.modifiedFiles || [])
                };
                
                console.log('📂 Loaded previous session context');
            } catch (err) {
                console.warn('⚠️ Failed to load session context:', err.message);
            }
        }
        
        this.save();
    }
    
    /**
     * Save context to disk
     */
    save() {
        try {
            const serializable = {
                ...this.context,
                trackedFiles: Array.from(this.context.trackedFiles),
                modifiedFiles: Array.from(this.context.modifiedFiles)
            };
            
            fs.writeFileSync(this.contextFile, JSON.stringify(serializable, null, 2), 'utf8');
            this.context.lastUpdated = Date.now();
        } catch (err) {
            console.error('❌ Failed to save session context:', err);
        }
    }
    
    /**
     * Update current project info
     */
    updateProject(info) {
        this.context.currentProject = {
            ...this.context.currentProject,
            ...info,
            lastScanned: Date.now()
        };
        this.save();
    }
    
    /**
     * Scan workspace and build file tree
     */
    scanWorkspace(workspaceRoot) {
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            console.warn('⚠️ Invalid workspace root:', workspaceRoot);
            return;
        }
        
        const structure = this.buildFileTree(workspaceRoot);
        
        this.context.currentProject.path = workspaceRoot;
        this.context.currentProject.structure = structure;
        this.context.currentProject.fileCount = this.countFiles(structure);
        
        this.save();
        
        console.log(`📁 Workspace scanned: ${this.context.currentProject.fileCount} files`);
    }
    
    /**
     * Build file tree (max 3 levels deep)
     */
    buildFileTree(dirPath, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return {};
        
        const tree = {};
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                // Skip node_modules, .git, dist, etc.
                if (this.shouldIgnore(item)) continue;
                
                const fullPath = path.join(dirPath, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    tree[item] = {
                        type: 'directory',
                        children: this.buildFileTree(fullPath, depth + 1, maxDepth)
                    };
                } else {
                    tree[item] = {
                        type: 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    };
                }
            }
        } catch (err) {
            console.warn(`⚠️ Failed to read directory ${dirPath}:`, err.message);
        }
        
        return tree;
    }
    
    /**
     * Should ignore this file/folder?
     */
    shouldIgnore(name) {
        const ignoreList = [
            'node_modules', '.git', 'dist', 'build', '.next',
            '.cache', 'coverage', '.vscode', '.idea', '__pycache__',
            '.kayra-session', 'learn'
        ];
        return ignoreList.includes(name) || name.startsWith('.');
    }
    
    /**
     * Count total files in tree
     */
    countFiles(tree) {
        let count = 0;
        for (const key in tree) {
            if (tree[key].type === 'file') {
                count++;
            } else if (tree[key].children) {
                count += this.countFiles(tree[key].children);
            }
        }
        return count;
    }
    
    /**
     * Update active mission
     */
    updateMission(mission) {
        this.context.activeMission = {
            ...this.context.activeMission,
            ...mission,
            updatedAt: Date.now()
        };
        this.save();
    }
    
    /**
     * Record an operation
     */
    recordOperation(op) {
        const operation = {
            id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            type: op.type, // 'file_create', 'file_modify', 'command', 'verification'
            target: op.target, // file path or command
            result: op.result, // 'success' or 'failed'
            details: op.details || {},
            duration: op.duration || 0
        };
        
        // Keep only last 20 operations
        this.context.recentOps.unshift(operation);
        if (this.context.recentOps.length > 20) {
            this.context.recentOps = this.context.recentOps.slice(0, 20);
        }
        
        // Update statistics
        this.context.stats.totalSteps++;
        if (op.result === 'success') {
            if (op.type === 'file_create') this.context.stats.filesCreated++;
            if (op.type === 'file_modify') this.context.stats.filesModified++;
            if (op.type === 'command') this.context.stats.commandsRun++;
        }
        
        this.updateSuccessRate();
        this.save();
    }
    
    /**
     * Record an error
     */
    recordError(error) {
        const errorRecord = {
            timestamp: Date.now(),
            type: error.type, // 'build_failed', 'verification_failed', 'parse_error'
            message: error.message,
            context: error.context || {},
            stepId: error.stepId || null
        };
        
        // Keep only last 10 errors
        this.context.errors.unshift(errorRecord);
        if (this.context.errors.length > 10) {
            this.context.errors = this.context.errors.slice(0, 10);
        }
        
        this.save();
    }
    
    /**
     * Track a file
     */
    trackFile(filePath) {
        this.context.trackedFiles.add(filePath);
        this.save();
    }
    
    /**
     * Mark file as modified
     */
    markModified(filePath) {
        this.context.modifiedFiles.add(filePath);
        this.save();
    }
    
    /**
     * Update success rate
     */
    updateSuccessRate() {
        const total = this.context.recentOps.length;
        if (total === 0) {
            this.context.stats.successRate = 1.0;
            return;
        }
        
        const successful = this.context.recentOps.filter(op => op.result === 'success').length;
        this.context.stats.successRate = successful / total;
    }
    
    /**
     * Get context summary for AI prompt injection
     */
    getContextSummary() {
        const summary = {
            // Session info
            sessionId: this.context.sessionId,
            sessionDuration: Math.floor((Date.now() - this.context.startedAt) / 1000) + 's',
            
            // Current project
            project: this.context.currentProject.name || 'Unknown',
            projectPath: this.context.currentProject.path || 'Not set',
            projectType: this.context.currentProject.type || 'Unknown',
            fileCount: this.context.currentProject.fileCount || 0,
            
            // Active mission
            mission: this.context.activeMission.goal || 'No active mission',
            phase: `${this.context.activeMission.currentPhase}/${this.context.activeMission.totalPhases}`,
            completedSteps: this.context.activeMission.completedSteps.length,
            pendingSteps: this.context.activeMission.pendingSteps.length,
            
            // Recent activity
            lastOps: this.context.recentOps.slice(0, 5).map(op => ({
                type: op.type,
                target: op.target,
                result: op.result,
                ago: Math.floor((Date.now() - op.timestamp) / 1000) + 's ago'
            })),
            
            // Recent errors
            recentErrors: this.context.errors.slice(0, 3).map(err => ({
                type: err.type,
                message: err.message,
                ago: Math.floor((Date.now() - err.timestamp) / 1000) + 's ago'
            })),
            
            // Stats
            stats: this.context.stats,
            
            // Files
            trackedFiles: Array.from(this.context.trackedFiles).slice(0, 10),
            modifiedFiles: Array.from(this.context.modifiedFiles).slice(0, 10)
        };
        
        return summary;
    }
    
    /**
     * Generate AI context prompt
     */
    getAIContextPrompt() {
        const summary = this.getContextSummary();
        
        let prompt = `## 📍 CURRENT SESSION CONTEXT\n\n`;
        prompt += `**Session ID**: ${summary.sessionId} (${summary.sessionDuration})\n`;
        prompt += `**Project**: ${summary.project} (${summary.projectType})\n`;
        prompt += `**Location**: ${summary.projectPath}\n`;
        prompt += `**Files**: ${summary.fileCount} total, ${summary.trackedFiles.length} tracked, ${summary.modifiedFiles.length} modified\n\n`;
        
        prompt += `### 🎯 Active Mission\n`;
        prompt += `**Goal**: ${summary.mission}\n`;
        prompt += `**Phase**: ${summary.phase}\n`;
        prompt += `**Progress**: ${summary.completedSteps} completed, ${summary.pendingSteps} pending\n\n`;
        
        if (summary.lastOps.length > 0) {
            prompt += `### 📜 Recent Operations (Last ${summary.lastOps.length})\n`;
            summary.lastOps.forEach((op, i) => {
                prompt += `${i + 1}. [${op.result}] ${op.type}: ${op.target} (${op.ago})\n`;
            });
            prompt += `\n`;
        }
        
        if (summary.recentErrors.length > 0) {
            prompt += `### ❌ Recent Errors\n`;
            summary.recentErrors.forEach((err, i) => {
                prompt += `${i + 1}. [${err.type}] ${err.message} (${err.ago})\n`;
            });
            prompt += `\n`;
        }
        
        if (summary.trackedFiles.length > 0) {
            prompt += `### 📁 Tracked Files\n`;
            summary.trackedFiles.forEach(f => prompt += `- ${f}\n`);
            prompt += `\n`;
        }
        
        prompt += `### 📊 Statistics\n`;
        prompt += `**Success Rate**: ${(summary.stats.successRate * 100).toFixed(1)}%\n`;
        prompt += `**Total Steps**: ${summary.stats.totalSteps}\n`;
        prompt += `**Files Created**: ${summary.stats.filesCreated}\n`;
        prompt += `**Commands Run**: ${summary.stats.commandsRun}\n`;
        
        return prompt;
    }
    
    /**
     * Clear session (new project)
     */
    clear() {
        this.context = {
            sessionId: this.generateSessionId(),
            startedAt: Date.now(),
            lastUpdated: Date.now(),
            currentProject: { name: null, path: null, type: null, structure: {} },
            activeMission: { goal: null, currentPhase: 0, totalPhases: 0, completedSteps: [], pendingSteps: [], acceptanceCriteria: [] },
            recentOps: [],
            errors: [],
            stats: { filesCreated: 0, filesModified: 0, commandsRun: 0, totalSteps: 0, successRate: 1.0 },
            trackedFiles: new Set(),
            modifiedFiles: new Set()
        };
        
        this.save();
        console.log('🧹 Session context cleared');
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionContext;
}
if (typeof window !== 'undefined') {
    window.SessionContext = SessionContext;
}
