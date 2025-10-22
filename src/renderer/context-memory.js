/**
 * 🧠 DYNAMIC CONTEXT MEMORY SYSTEM
 * 
 * Hybrid Episodic Memory Architecture for Agent Context Preservation
 * Solves the "10 message limit" problem that causes Reflexion → Executor handshake failures
 * 
 * Architecture:
 * - Short-Term Memory: Last 10 messages (immediate context)
 * - Mid-Term Memory: Phase snapshots (project continuity)
 * - Long-Term Memory: Mission summaries (adaptive memory)
 * 
 * @author ChatGPT + KayraDeniz Team
 * @date 2025-10-22
 */

class ContextMemorySystem {
    constructor() {
        // 📦 Short-Term Memory: Recent messages
        this.shortTermBuffer = [];
        this.shortTermLimit = 10;

        // 📊 Mid-Term Memory: Phase snapshots
        this.phaseSnapshots = new Map(); // phaseId → snapshot
        this.currentPhaseId = null;

        // 📚 Long-Term Memory: Mission summaries
        this.missionSummaries = new Map(); // missionId → summary
        this.currentMissionId = null;

        // 🔄 Context refresh tracking
        this.lastRefreshTimestamp = Date.now();
        this.refreshInterval = 60000; // 1 minute

        console.log('🧠 Context Memory System initialized');
    }

    // ===== SHORT-TERM MEMORY (Last 10 Messages) =====
    
    /**
     * Get recent messages (standard 10 message window)
     * @param {number} limit - Number of recent messages
     * @returns {Array} Recent message objects
     */
    getShortTermMemory(limit = 10) {
        return this.shortTermBuffer.slice(-limit);
    }

    /**
     * Add message to short-term buffer
     * @param {Object} message - Message object {role, content, timestamp, metadata}
     */
    addMessage(message) {
        const enrichedMessage = {
            ...message,
            timestamp: message.timestamp || Date.now(),
            metadata: {
                ...message.metadata,
                phaseId: this.currentPhaseId,
                missionId: this.currentMissionId
            }
        };

        this.shortTermBuffer.push(enrichedMessage);

        // Keep buffer at reasonable size
        if (this.shortTermBuffer.length > 50) {
            this.shortTermBuffer = this.shortTermBuffer.slice(-50);
        }
    }

    // ===== MID-TERM MEMORY (Phase Snapshots) =====

    /**
     * Capture current phase state as snapshot
     * @param {Object} phaseData - Phase context {currentPhase, mission, completedFiles, etc.}
     */
    capturePhaseSnapshot(phaseData) {
        const phaseId = `phase_${phaseData.currentPhase}_${Date.now()}`;
        
        const snapshot = {
            phaseId,
            phaseNumber: phaseData.currentPhase,
            mission: phaseData.mission,
            completedFiles: Array.from(phaseData.completedFiles || []),
            timestamp: Date.now(),
            status: phaseData.status || 'in-progress',
            
            // Capture key context
            orders: phaseData.orders || null,
            verificationResults: phaseData.verificationResults || null,
            analysisReport: phaseData.analysisReport || null,
            
            // Message snapshot at this phase
            messages: this.getShortTermMemory(5) // Last 5 messages at phase capture
        };

        this.phaseSnapshots.set(phaseId, snapshot);
        this.currentPhaseId = phaseId;

        console.log(`📸 Phase snapshot captured: ${phaseId} (Phase ${phaseData.currentPhase})`);
        
        // Keep only last 10 phase snapshots
        if (this.phaseSnapshots.size > 10) {
            const oldestKey = this.phaseSnapshots.keys().next().value;
            this.phaseSnapshots.delete(oldestKey);
        }

        return phaseId;
    }

    /**
     * Get specific phase snapshot
     * @param {string} phaseId - Phase snapshot ID
     * @returns {Object|null} Phase snapshot or null
     */
    getPhaseSnapshot(phaseId = null) {
        if (!phaseId) {
            phaseId = this.currentPhaseId;
        }
        return this.phaseSnapshots.get(phaseId) || null;
    }

    /**
     * Get all phase snapshots for current mission
     * @returns {Array} Array of phase snapshots
     */
    getAllPhaseSnapshots() {
        return Array.from(this.phaseSnapshots.values());
    }

    // ===== LONG-TERM MEMORY (Mission Summaries) =====

    /**
     * Create or update mission summary
     * @param {Object} missionData - Mission context {mission, intent, outcome, learnings}
     */
    saveMissionSummary(missionData) {
        const missionId = missionData.missionId || `mission_${Date.now()}`;
        
        const summary = {
            missionId,
            mission: missionData.mission,
            intent: missionData.intent || 'unknown',
            startTime: missionData.startTime || Date.now(),
            endTime: missionData.endTime || null,
            
            // High-level outcome
            outcome: missionData.outcome || 'in-progress',
            successRate: missionData.successRate || 0,
            
            // Key learnings and patterns
            learnings: missionData.learnings || [],
            patterns: missionData.patterns || [],
            
            // Phase progression
            phases: missionData.phases || [],
            totalPhases: missionData.totalPhases || 0,
            completedPhases: missionData.completedPhases || 0,
            
            // Condensed summary (2-3 sentences)
            condensedSummary: missionData.condensedSummary || this.generateCondensedSummary(missionData)
        };

        this.missionSummaries.set(missionId, summary);
        this.currentMissionId = missionId;

        console.log(`📚 Mission summary saved: ${missionId}`);
        
        // Keep only last 20 mission summaries
        if (this.missionSummaries.size > 20) {
            const oldestKey = this.missionSummaries.keys().next().value;
            this.missionSummaries.delete(oldestKey);
        }

        return missionId;
    }

    /**
     * Get specific mission summary
     * @param {string} missionId - Mission ID
     * @returns {Object|null} Mission summary or null
     */
    getMissionSummary(missionId = null) {
        if (!missionId) {
            missionId = this.currentMissionId;
        }
        return this.missionSummaries.get(missionId) || null;
    }

    /**
     * Generate condensed 2-3 sentence summary
     * @param {Object} missionData - Raw mission data
     * @returns {string} Condensed summary
     */
    generateCondensedSummary(missionData) {
        const mission = missionData.mission || 'Unknown mission';
        const phases = missionData.totalPhases || 0;
        const outcome = missionData.outcome || 'in-progress';
        
        return `Mission: ${mission}. Executed ${phases} phases. Status: ${outcome}.`;
    }

    // ===== HYBRID CONTEXT BUILDER =====

    /**
     * Get comprehensive context for LLM calls (ChatGPT's recommended approach)
     * Combines short-term, mid-term, and long-term memory
     * 
     * @param {Object} options - Context options
     * @returns {Object} Hybrid context object
     */
    getDynamicContext(options = {}) {
        const {
            includeShortTerm = true,
            shortTermLimit = 10,
            includePhaseSnapshot = true,
            includeMissionSummary = true,
            includeProjectContext = true
        } = options;

        const context = {
            timestamp: Date.now(),
            components: {}
        };

        // 1️⃣ Short-Term Memory (last N messages)
        if (includeShortTerm) {
            context.components.shortTerm = {
                messages: this.getShortTermMemory(shortTermLimit),
                count: this.shortTermBuffer.length
            };
        }

        // 2️⃣ Mid-Term Memory (current phase snapshot)
        if (includePhaseSnapshot && this.currentPhaseId) {
            const snapshot = this.getPhaseSnapshot();
            if (snapshot) {
                context.components.midTerm = {
                    phaseId: snapshot.phaseId,
                    phaseNumber: snapshot.phaseNumber,
                    mission: snapshot.mission,
                    completedFiles: snapshot.completedFiles,
                    status: snapshot.status,
                    orders: snapshot.orders,
                    verificationResults: snapshot.verificationResults,
                    analysisReport: snapshot.analysisReport
                };
            }
        }

        // 3️⃣ Long-Term Memory (mission summary)
        if (includeMissionSummary && this.currentMissionId) {
            const summary = this.getMissionSummary();
            if (summary) {
                context.components.longTerm = {
                    missionId: summary.missionId,
                    mission: summary.mission,
                    intent: summary.intent,
                    outcome: summary.outcome,
                    phases: summary.phases,
                    condensedSummary: summary.condensedSummary,
                    learnings: summary.learnings
                };
            }
        }

        return context;
    }

    /**
     * Format context as LLM-friendly prompt injection
     * @param {Object} context - Dynamic context from getDynamicContext()
     * @returns {string} Formatted prompt segment
     */
    formatContextForPrompt(context) {
        let prompt = '';

        // Long-Term Context (Mission Summary)
        if (context.components.longTerm) {
            const lt = context.components.longTerm;
            prompt += `
🎯 **CURRENT MISSION CONTEXT**:
Mission: ${lt.mission}
Intent: ${lt.intent}
Status: ${lt.outcome}
Progress: ${lt.phases.length} phases completed
Summary: ${lt.condensedSummary}

`;
        }

        // Mid-Term Context (Phase Snapshot)
        if (context.components.midTerm) {
            const mt = context.components.midTerm;
            prompt += `
📊 **CURRENT PHASE CONTEXT**:
Phase: ${mt.phaseNumber}
Mission: ${mt.mission}
Status: ${mt.status}
Completed Files: ${mt.completedFiles.length} files
${mt.analysisReport ? `\nLast Analysis: ${mt.analysisReport.substring(0, 200)}...` : ''}

`;
        }

        // Short-Term Context (Recent Messages)
        if (context.components.shortTerm && context.components.shortTerm.messages.length > 0) {
            const st = context.components.shortTerm;
            prompt += `
💬 **RECENT CONVERSATION** (Last ${st.messages.length} messages):
${st.messages.map(msg => `${msg.role}: ${msg.content.substring(0, 100)}...`).join('\n')}

`;
        }

        return prompt.trim();
    }

    // ===== CONTEXT INJECTION METHODS =====

    /**
     * Inject context into analyzeUserRequest call
     * @param {string} userRequest - User's request
     * @param {Object} options - Additional options
     * @returns {string} Enhanced request with context
     */
    injectContextIntoRequest(userRequest, options = {}) {
        const context = this.getDynamicContext(options);
        const contextPrompt = this.formatContextForPrompt(context);

        if (!contextPrompt) {
            return userRequest;
        }

        return `
${contextPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**USER'S CURRENT REQUEST**:
${userRequest}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT**: Consider the mission context, phase state, and recent conversation when responding. Maintain continuity with previous work.
        `.trim();
    }

    /**
     * Get project context summary for workspace-aware agents
     * @returns {Object} Project context
     */
    getProjectContext() {
        const snapshot = this.getPhaseSnapshot();
        if (!snapshot) {
            return null;
        }

        return {
            mission: snapshot.mission,
            phase: snapshot.phaseNumber,
            files: snapshot.completedFiles,
            status: snapshot.status,
            lastOrders: snapshot.orders
        };
    }

    // ===== MAINTENANCE & CLEANUP =====

    /**
     * Auto-refresh context to prevent stale data
     */
    refreshContext() {
        const now = Date.now();
        if (now - this.lastRefreshTimestamp > this.refreshInterval) {
            console.log('🔄 Context memory auto-refresh triggered');
            this.lastRefreshTimestamp = now;
            
            // Could trigger summarization here
            // this.summarizeOldMessages();
        }
    }

    /**
     * Clear all memory (reset)
     */
    clearAll() {
        this.shortTermBuffer = [];
        this.phaseSnapshots.clear();
        this.missionSummaries.clear();
        this.currentPhaseId = null;
        this.currentMissionId = null;
        console.log('🧹 Context memory cleared');
    }

    /**
     * Get memory statistics
     * @returns {Object} Memory stats
     */
    getStats() {
        return {
            shortTermMessages: this.shortTermBuffer.length,
            phaseSnapshots: this.phaseSnapshots.size,
            missionSummaries: this.missionSummaries.size,
            currentPhaseId: this.currentPhaseId,
            currentMissionId: this.currentMissionId,
            memoryAge: Date.now() - this.lastRefreshTimestamp
        };
    }
}

// ===== SINGLETON INSTANCE =====
let contextMemoryInstance = null;

/**
 * Get global context memory instance
 * @returns {ContextMemorySystem} Singleton instance
 */
function getContextMemory() {
    if (!contextMemoryInstance) {
        contextMemoryInstance = new ContextMemorySystem();
    }
    return contextMemoryInstance;
}

// Export for CommonJS and ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContextMemorySystem, getContextMemory };
}
