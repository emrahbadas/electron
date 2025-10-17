/**
 * 🤝 MULTI-AGENT COORDINATOR
 * 
 * OpenAI Agents SDK style multi-agent orchestration.
 * Coordinates specialized agents with handoffs and gating.
 * 
 * Features:
 * - Agent registration with roles
 * - Handoff management
 * - Artifact gating before handoffs
 * - Parallel agent execution
 * - Trace integration
 * - Project Manager pattern
 * 
 * Architecture:
 * ```
 * Project Manager
 *   ├─> Designer (creates design_spec.md)
 *   ├─> Frontend Dev (uses design_spec.md)
 *   ├─> Backend Dev (creates API)
 *   └─> Tester (verifies all)
 * ```
 */

class MultiAgentCoordinator {
    constructor(options = {}) {
        this.traceSystem = options.traceSystem;
        this.gatingSystem = options.gatingSystem;
        this.approvalSystem = options.approvalSystem;
        this.policyEngine = options.policyEngine;
        
        // Agent registry: name -> { name, role, instructions, handoffs, tools, status }
        this.agents = new Map();
        
        // Handoff rules: fromAgent -> [toAgent1, toAgent2, ...]
        this.handoffRules = new Map();
        
        // Active sessions: sessionId -> { currentAgent, history, context }
        this.sessions = new Map();
        
        // Statistics
        this.stats = {
            totalSessions: 0,
            totalHandoffs: 0,
            avgSessionDuration: 0,
            successRate: 0
        };
        
        console.log('🤝 Multi-Agent Coordinator initialized');
    }
    
    /**
     * Register an agent with its capabilities
     * @param {string} name - Agent name
     * @param {Object} config - Agent configuration
     */
    registerAgent(name, config) {
        if (this.agents.has(name)) {
            console.warn(`⚠️ Agent '${name}' already exists, overwriting`);
        }
        
        const agent = {
            name: name,
            role: config.role || 'worker',
            instructions: config.instructions || '',
            handoffs: config.handoffs || [],
            tools: config.tools || [],
            gates: config.gates || [], // Gates to verify before accepting handoff
            status: 'idle', // idle, active, blocked
            currentTask: null,
            lastActive: null,
            metadata: config.metadata || {}
        };
        
        this.agents.set(name, agent);
        
        // Register handoff rules
        if (agent.handoffs.length > 0) {
            this.handoffRules.set(name, agent.handoffs);
        }
        
        console.log(`🤖 Registered agent: ${name} (${agent.role})`);
        
        return agent;
    }
    
    /**
     * Start a new multi-agent session
     * @param {string} initialAgent - Starting agent
     * @param {string} task - Task description
     * @param {Object} context - Initial context
     * @returns {string} Session ID
     */
    startSession(initialAgent, task, context = {}) {
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const session = {
            id: sessionId,
            initialAgent: initialAgent,
            currentAgent: initialAgent,
            task: task,
            context: context,
            history: [],
            handoffs: [],
            startTime: Date.now(),
            endTime: null,
            status: 'active', // active, completed, failed
            result: null
        };
        
        this.sessions.set(sessionId, session);
        this.stats.totalSessions++;
        
        // Start trace if available
        if (this.traceSystem) {
            this.traceSystem.startTrace(initialAgent, task, { sessionId });
        }
        
        console.log(`🎬 Session ${sessionId} started: ${initialAgent} - ${task}`);
        
        return sessionId;
    }
    
    /**
     * Execute a task with the specified agent
     * @param {string} sessionId - Session ID
     * @param {string} agentName - Agent to execute
     * @param {Object} taskData - Task data
     * @returns {Promise<Object>} Execution result
     */
    async executeAgent(sessionId, agentName, taskData = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        const agent = this.agents.get(agentName);
        if (!agent) {
            throw new Error(`Agent ${agentName} not found`);
        }
        
        // Update agent status
        agent.status = 'active';
        agent.currentTask = taskData;
        agent.lastActive = Date.now();
        
        // Add to session history
        session.history.push({
            agent: agentName,
            task: taskData,
            startTime: Date.now(),
            endTime: null,
            result: null
        });
        
        console.log(`⚙️ [Session ${sessionId}] Executing: ${agentName}`);
        
        try {
            // Execute agent logic (this would call the actual agent implementation)
            // For now, this is a placeholder that should be overridden
            const result = await this.executeAgentLogic(agent, taskData, session.context);
            
            // Update history
            const historyEntry = session.history[session.history.length - 1];
            historyEntry.endTime = Date.now();
            historyEntry.result = result;
            
            // Update agent status
            agent.status = 'idle';
            agent.currentTask = null;
            
            console.log(`✅ [Session ${sessionId}] Agent ${agentName} completed`);
            
            return result;
        } catch (error) {
            agent.status = 'idle';
            agent.currentTask = null;
            
            console.error(`❌ [Session ${sessionId}] Agent ${agentName} failed:`, error);
            
            throw error;
        }
    }
    
    /**
     * Perform a handoff between agents
     * @param {string} sessionId - Session ID
     * @param {string} toAgent - Target agent
     * @param {Object} handoffData - Data to pass
     * @returns {Promise<Object>} Handoff result
     */
    async handoff(sessionId, toAgent, handoffData = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        const fromAgent = session.currentAgent;
        const targetAgent = this.agents.get(toAgent);
        
        if (!targetAgent) {
            throw new Error(`Target agent ${toAgent} not found`);
        }
        
        console.log(`🔄 [Session ${sessionId}] Handoff: ${fromAgent} → ${toAgent}`);
        
        // Verify handoff is allowed
        const allowedHandoffs = this.handoffRules.get(fromAgent) || [];
        if (!allowedHandoffs.includes(toAgent) && allowedHandoffs.length > 0) {
            console.warn(`⚠️ Handoff from ${fromAgent} to ${toAgent} not in allowed list`);
        }
        
        // Check gates if specified
        if (targetAgent.gates && targetAgent.gates.length > 0) {
            if (!this.gatingSystem) {
                throw new Error('Gating system not available but gates specified');
            }
            
            for (const gateName of targetAgent.gates) {
                const gateResult = await this.gatingSystem.verifyGate(gateName);
                
                if (!gateResult.passed) {
                    console.error(`❌ Gate '${gateName}' failed:`, gateResult.missingFiles);
                    
                    return {
                        success: false,
                        error: 'Gate verification failed',
                        gate: gateName,
                        missingFiles: gateResult.missingFiles
                    };
                }
            }
        }
        
        // Record handoff
        const handoff = {
            from: fromAgent,
            to: toAgent,
            data: handoffData,
            timestamp: Date.now()
        };
        
        session.handoffs.push(handoff);
        session.currentAgent = toAgent;
        this.stats.totalHandoffs++;
        
        // Trace handoff
        if (this.traceSystem) {
            this.traceSystem.recordHandoff(fromAgent, toAgent, handoffData);
        }
        
        console.log(`✅ [Session ${sessionId}] Handoff complete: ${fromAgent} → ${toAgent}`);
        
        return {
            success: true,
            fromAgent: fromAgent,
            toAgent: toAgent,
            handoff: handoff
        };
    }
    
    /**
     * Execute task with automatic handoffs
     * @param {string} sessionId - Session ID
     * @param {string} startAgent - Starting agent
     * @param {Object} task - Task data
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Final result
     */
    async executeWithHandoffs(sessionId, startAgent, task, options = {}) {
        const maxHandoffs = options.maxHandoffs || 10;
        const autoHandoff = options.autoHandoff !== false;
        
        let currentAgent = startAgent;
        let handoffCount = 0;
        let result = null;
        
        while (handoffCount < maxHandoffs) {
            // Execute current agent
            result = await this.executeAgent(sessionId, currentAgent, task);
            
            // Check if agent wants to handoff
            if (result.handoffTo && autoHandoff) {
                const handoffResult = await this.handoff(sessionId, result.handoffTo, result.handoffData || {});
                
                if (!handoffResult.success) {
                    console.error('❌ Handoff failed:', handoffResult.error);
                    break;
                }
                
                currentAgent = result.handoffTo;
                task = result.nextTask || task;
                handoffCount++;
            } else {
                // No more handoffs, task complete
                break;
            }
        }
        
        if (handoffCount >= maxHandoffs) {
            console.warn(`⚠️ Max handoffs (${maxHandoffs}) reached`);
        }
        
        return {
            success: true,
            result: result,
            handoffCount: handoffCount,
            finalAgent: currentAgent
        };
    }
    
    /**
     * Execute multiple agents in parallel
     * @param {string} sessionId - Session ID
     * @param {Array<Object>} agentTasks - Array of { agent, task }
     * @returns {Promise<Array>} Results from all agents
     */
    async executeParallel(sessionId, agentTasks) {
        console.log(`⚡ [Session ${sessionId}] Executing ${agentTasks.length} agents in parallel`);
        
        const promises = agentTasks.map(({ agent, task }) =>
            this.executeAgent(sessionId, agent, task)
        );
        
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            agent: agentTasks[index].agent,
            success: result.status === 'fulfilled',
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }
    
    /**
     * End a session
     * @param {string} sessionId - Session ID
     * @param {Object} result - Final result
     * @param {boolean} success - Success status
     */
    endSession(sessionId, result, success = true) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`⚠️ Session ${sessionId} not found`);
            return;
        }
        
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        session.status = success ? 'completed' : 'failed';
        session.result = result;
        
        // End trace
        if (this.traceSystem) {
            this.traceSystem.endTrace(result, success);
        }
        
        console.log(`🏁 Session ${sessionId} ended: ${session.duration}ms - ${success ? 'Success' : 'Failed'}`);
    }
    
    /**
     * Get session status
     * @param {string} sessionId - Session ID
     * @returns {Object} Session status
     */
    getSessionStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { exists: false };
        }
        
        return {
            exists: true,
            id: session.id,
            currentAgent: session.currentAgent,
            status: session.status,
            handoffs: session.handoffs.length,
            duration: session.endTime ? (session.endTime - session.startTime) : (Date.now() - session.startTime)
        };
    }
    
    /**
     * List all registered agents
     * @returns {Array} All agents
     */
    listAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            name: agent.name,
            role: agent.role,
            status: agent.status,
            handoffs: agent.handoffs.length,
            gates: agent.gates.length
        }));
    }
    
    /**
     * Get agent status
     * @param {string} agentName - Agent name
     * @returns {Object} Agent status
     */
    getAgentStatus(agentName) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            return { exists: false };
        }
        
        return {
            exists: true,
            name: agent.name,
            role: agent.role,
            status: agent.status,
            currentTask: agent.currentTask,
            lastActive: agent.lastActive
        };
    }
    
    /**
     * Get coordinator statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            totalAgents: this.agents.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            totalSessions: this.sessions.size
        };
    }
    
    /**
     * Placeholder for actual agent logic execution
     * Override this method to integrate with your agent implementation
     * @param {Object} agent - Agent config
     * @param {Object} task - Task data
     * @param {Object} context - Session context
     * @returns {Promise<Object>} Execution result
     */
    async executeAgentLogic(agent, task, context) {
        // This should be overridden by the actual implementation
        // For now, return a placeholder
        return {
            success: true,
            agent: agent.name,
            task: task,
            message: 'Agent logic not implemented'
        };
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiAgentCoordinator;
}
