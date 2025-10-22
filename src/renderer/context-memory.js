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

        // 🎯 Meta-Reflection Engine: Agent performance tracking
        this.agentPerformanceStats = new Map(); // agentName → stats
        this.agentExecutionHistory = []; // Ordered list of agent executions
        this.learningEnabled = true;

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
     * @param {Function} llmCall - Optional LLM call function for auto-summarization
     */
    addMessage(message, llmCall = null) {
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

        // Auto-summarize every 20 messages (Context Summarizer Agent)
        if (llmCall && this.shortTermBuffer.length >= 20 && this.shortTermBuffer.length % 20 === 0) {
            // Don't await - run in background
            this.summarizeOldMessages(llmCall).catch(err => {
                console.error('❌ Auto-summarization failed:', err);
            });
        }

        // Keep buffer at reasonable size (fallback protection)
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

    // ===== CONTEXT SUMMARIZER AGENT =====

    /**
     * Summarize old messages into condensed format
     * Called automatically every 20 messages or manually
     * @param {Function} llmCall - LLM call function for summarization
     * @returns {Object} Summarization result
     */
    async summarizeOldMessages(llmCall = null) {
        // Only summarize if we have enough messages
        if (this.shortTermBuffer.length < 20) {
            console.log('⏭️ Not enough messages to summarize (need 20+)');
            return { summarized: false, reason: 'insufficient_messages' };
        }

        // Get messages to summarize (oldest 10 messages)
        const messagesToSummarize = this.shortTermBuffer.slice(0, 10);
        
        if (!llmCall) {
            console.warn('⚠️ No LLM call function provided, using simple summarization');
            // Fallback: Simple text concatenation
            const summary = this.simpleMessageSummary(messagesToSummarize);
            return { summarized: true, method: 'simple', summary };
        }

        try {
            // Build summarization prompt
            const summaryPrompt = this.buildSummarizationPrompt(messagesToSummarize);
            
            // Call LLM for intelligent summarization
            const llmSummary = await llmCall([
                { role: 'user', content: summaryPrompt }
            ], {
                temperature: 0.3,
                maxTokens: 150
            });

            // Store summary in long-term memory
            const summaryId = `summary_${Date.now()}`;
            const summaryEntry = {
                id: summaryId,
                timestamp: Date.now(),
                originalMessages: messagesToSummarize.length,
                summary: llmSummary,
                messageRange: {
                    first: messagesToSummarize[0].timestamp,
                    last: messagesToSummarize[messagesToSummarize.length - 1].timestamp
                }
            };

            // Remove summarized messages from short-term buffer
            this.shortTermBuffer = this.shortTermBuffer.slice(10);

            console.log(`📝 Context Summarizer: ${messagesToSummarize.length} messages → summary`);
            
            return { 
                summarized: true, 
                method: 'llm', 
                summary: llmSummary,
                messagesRemoved: messagesToSummarize.length 
            };

        } catch (error) {
            console.error('❌ Context summarization failed:', error);
            return { summarized: false, reason: 'llm_error', error: error.message };
        }
    }

    /**
     * Build summarization prompt for LLM
     * @param {Array} messages - Messages to summarize
     * @returns {string} Summarization prompt
     */
    buildSummarizationPrompt(messages) {
        const messageText = messages.map((msg, idx) => 
            `${idx + 1}. ${msg.role}: ${msg.content.substring(0, 200)}`
        ).join('\n');

        return `
You are a context summarization assistant. Your job is to condense conversation history into 2-3 concise sentences.

**Messages to summarize:**
${messageText}

**Instructions:**
- Create a 2-3 sentence summary capturing the essence
- Focus on: main topics, key decisions, important outcomes
- Use past tense (e.g., "User requested...", "System created...")
- Be factual and concise
- DO NOT include greetings or meta-commentary

**Summary:**`.trim();
    }

    /**
     * Simple fallback summarization (no LLM)
     * @param {Array} messages - Messages to summarize
     * @returns {string} Simple summary
     */
    simpleMessageSummary(messages) {
        const userMessages = messages.filter(m => m.role === 'user');
        const topics = [...new Set(userMessages.map(m => {
            // Extract key words (simple heuristic)
            const words = m.content.split(' ').filter(w => w.length > 5);
            return words[0] || 'unknown';
        }))];

        return `Conversation covered ${messages.length} messages about: ${topics.join(', ')}. Last update: ${new Date(messages[messages.length - 1].timestamp).toLocaleTimeString()}.`;
    }

    /**
     * Check if summarization is needed and trigger automatically
     * @param {Function} llmCall - LLM call function
     * @returns {boolean} Whether summarization was triggered
     */
    async autoSummarizeIfNeeded(llmCall = null) {
        // Trigger every 20 messages
        if (this.shortTermBuffer.length >= 20 && this.shortTermBuffer.length % 20 === 0) {
            console.log('🤖 Auto-summarization triggered (20 message threshold)');
            await this.summarizeOldMessages(llmCall);
            return true;
        }
        return false;
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
        }
    }

    // ===== META-REFLECTION ENGINE =====

    /**
     * Track agent execution performance
     * @param {Object} execution - Agent execution result
     */
    trackAgentPerformance(execution) {
        if (!this.learningEnabled) return;

        const { agentName, taskType, success, duration, errorType, metadata } = execution;

        // Initialize agent stats if not exists
        if (!this.agentPerformanceStats.has(agentName)) {
            this.agentPerformanceStats.set(agentName, {
                totalExecutions: 0,
                successCount: 0,
                failureCount: 0,
                averageDuration: 0,
                taskTypeStats: new Map(),
                errorPatterns: new Map(),
                lastExecution: null,
                successRate: 0
            });
        }

        const stats = this.agentPerformanceStats.get(agentName);

        // Update execution counts
        stats.totalExecutions++;
        if (success) {
            stats.successCount++;
        } else {
            stats.failureCount++;
        }

        // Update success rate
        stats.successRate = (stats.successCount / stats.totalExecutions) * 100;

        // Update average duration
        const totalDuration = stats.averageDuration * (stats.totalExecutions - 1) + duration;
        stats.averageDuration = totalDuration / stats.totalExecutions;

        // Track task type performance
        if (!stats.taskTypeStats.has(taskType)) {
            stats.taskTypeStats.set(taskType, { attempts: 0, successes: 0 });
        }
        const taskStats = stats.taskTypeStats.get(taskType);
        taskStats.attempts++;
        if (success) taskStats.successes++;

        // Track error patterns
        if (!success && errorType) {
            const errorCount = stats.errorPatterns.get(errorType) || 0;
            stats.errorPatterns.set(errorType, errorCount + 1);
        }

        // Update last execution
        stats.lastExecution = {
            timestamp: Date.now(),
            success,
            duration,
            taskType,
            metadata
        };

        // Add to execution history
        this.agentExecutionHistory.push({
            agentName,
            taskType,
            success,
            duration,
            timestamp: Date.now(),
            errorType,
            metadata
        });

        // Keep history manageable (last 100 executions)
        if (this.agentExecutionHistory.length > 100) {
            this.agentExecutionHistory = this.agentExecutionHistory.slice(-100);
        }

        console.log(`📊 Meta-Reflection: ${agentName} tracked (${stats.successRate.toFixed(1)}% success)`);
    }

    /**
     * Get agent performance statistics
     * @param {string} agentName - Agent name to get stats for
     * @returns {Object} Agent performance stats
     */
    getAgentStats(agentName) {
        if (!this.agentPerformanceStats.has(agentName)) {
            return null;
        }

        const stats = this.agentPerformanceStats.get(agentName);
        
        return {
            agentName,
            totalExecutions: stats.totalExecutions,
            successRate: stats.successRate.toFixed(2) + '%',
            averageDuration: Math.round(stats.averageDuration) + 'ms',
            taskTypePerformance: Array.from(stats.taskTypeStats.entries()).map(([type, data]) => ({
                taskType: type,
                attempts: data.attempts,
                successRate: ((data.successes / data.attempts) * 100).toFixed(1) + '%'
            })),
            topErrors: Array.from(stats.errorPatterns.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([error, count]) => ({ error, count })),
            lastExecution: stats.lastExecution
        };
    }

    /**
     * Get all agent performance stats
     * @returns {Array} Array of agent stats
     */
    getAllAgentStats() {
        return Array.from(this.agentPerformanceStats.keys())
            .map(agentName => this.getAgentStats(agentName))
            .sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
    }

    /**
     * Get best performing agent for a specific task type
     * @param {string} taskType - Task type to find best agent for
     * @returns {string} Best agent name
     */
    getBestAgentForTask(taskType) {
        let bestAgent = null;
        let bestSuccessRate = 0;

        for (const [agentName, stats] of this.agentPerformanceStats.entries()) {
            const taskStats = stats.taskTypeStats.get(taskType);
            if (taskStats && taskStats.attempts >= 3) { // Need at least 3 attempts
                const successRate = (taskStats.successes / taskStats.attempts) * 100;
                if (successRate > bestSuccessRate) {
                    bestSuccessRate = successRate;
                    bestAgent = agentName;
                }
            }
        }

        return bestAgent || 'RouterAgent'; // Default to RouterAgent
    }

    /**
     * Get learning insights for Luma Supreme
     * @returns {Object} Learning insights
     */
    getLearningInsights() {
        const recentExecutions = this.agentExecutionHistory.slice(-20);
        const recentFailures = recentExecutions.filter(e => !e.success);

        return {
            totalAgents: this.agentPerformanceStats.size,
            totalExecutions: this.agentExecutionHistory.length,
            recentSuccessRate: recentExecutions.length > 0 
                ? ((recentExecutions.filter(e => e.success).length / recentExecutions.length) * 100).toFixed(1) + '%'
                : 'N/A',
            mostReliableAgent: this.getAllAgentStats()[0]?.agentName || 'None',
            commonErrorPatterns: this.getCommonErrorPatterns(),
            recommendations: this.generateRecommendations(recentFailures)
        };
    }

    /**
     * Get common error patterns across all agents
     * @returns {Array} Common error patterns
     */
    getCommonErrorPatterns() {
        const allErrors = new Map();
        
        for (const stats of this.agentPerformanceStats.values()) {
            for (const [error, count] of stats.errorPatterns.entries()) {
                allErrors.set(error, (allErrors.get(error) || 0) + count);
            }
        }

        return Array.from(allErrors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([error, count]) => ({ error, occurrences: count }));
    }

    /**
     * Generate recommendations based on recent failures
     * @param {Array} recentFailures - Recent failed executions
     * @returns {Array} Recommendations
     */
    generateRecommendations(recentFailures) {
        const recommendations = [];

        if (recentFailures.length > 5) {
            recommendations.push('High failure rate detected. Consider reviewing agent prompts.');
        }

        const errorCounts = new Map();
        recentFailures.forEach(f => {
            if (f.errorType) {
                errorCounts.set(f.errorType, (errorCounts.get(f.errorType) || 0) + 1);
            }
        });

        for (const [error, count] of errorCounts.entries()) {
            if (count >= 3) {
                recommendations.push(`Recurring error pattern: ${error} (${count} times). Needs attention.`);
            }
        }

        return recommendations;
    }

    /**
     * Clear all memory (reset)
     */
    clearAll() {
        this.shortTermBuffer = [];
        this.phaseSnapshots.clear();
        this.missionSummaries.clear();
        this.agentPerformanceStats.clear();
        this.agentExecutionHistory = [];
        this.currentPhaseId = null;
        this.currentMissionId = null;
        console.log('🧹 Context memory cleared (including agent performance stats)');
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
            memoryAge: Date.now() - this.lastRefreshTimestamp,
            agentPerformance: {
                totalAgents: this.agentPerformanceStats.size,
                totalExecutions: this.agentExecutionHistory.length,
                trackingEnabled: this.learningEnabled
            }
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
