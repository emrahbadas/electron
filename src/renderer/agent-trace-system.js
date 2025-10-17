/**
 * 🔍 AGENT TRACE SYSTEM
 * 
 * OpenAI Agents SDK style tracing for complete observability.
 * Records every agent action, handoff, tool call, and artifact.
 * 
 * Features:
 * - Timeline visualization with durations
 * - Agent handoff tracking
 * - Tool call recording (MCP, file ops, commands)
 * - Artifact verification
 * - Error tracking
 * - Performance metrics
 * - Audit trail for compliance
 * 
 * Integration:
 * - Extends EventBus for backward compatibility
 * - Adds trace-specific methods
 * - Generates exportable trace reports
 */

class AgentTraceSystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Active trace
        this.currentTrace = null;
        
        // Completed traces (last 50)
        this.traces = [];
        this.maxTraces = 50;
        
        // Statistics
        this.stats = {
            totalTraces: 0,
            totalDuration: 0,
            avgDuration: 0,
            successRate: 0
        };
        
        console.log('🔍 Agent Trace System initialized');
    }
    
    /**
     * Start a new trace session
     * @param {string} agentName - Name of the agent
     * @param {string} task - Task description
     * @param {Object} context - Additional context
     */
    startTrace(agentName, task, context = {}) {
        this.currentTrace = {
            id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            agent: agentName,
            task: task,
            context: context,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            
            // Timeline components
            steps: [],
            handoffs: [],
            toolCalls: [],
            artifacts: [],
            approvals: [],
            errors: [],
            
            // Metadata
            status: 'active', // active, completed, failed
            result: null,
            metrics: {
                stepsTotal: 0,
                stepsSucceeded: 0,
                stepsFailed: 0,
                toolCallsTotal: 0,
                artifactsCreated: 0,
                artifactsVerified: 0,
                handoffsTotal: 0,
                approvalsGranted: 0,
                approvalsDenied: 0
            }
        };
        
        // Emit trace start event
        this.eventBus.emit({
            type: 'TRACE_START',
            traceId: this.currentTrace.id,
            agent: agentName,
            task: task,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔍 [Trace ${this.currentTrace.id}] Started: ${agentName} - ${task}`);
        
        return this.currentTrace.id;
    }
    
    /**
     * Record a step in the current trace
     * @param {Object} step - Step details
     */
    recordStep(step) {
        if (!this.currentTrace) {
            console.warn('⚠️ No active trace to record step');
            return;
        }
        
        const stepRecord = {
            id: step.id,
            type: step.tool || 'unknown',
            description: step.explain?.goal || 'No description',
            startTime: Date.now(),
            endTime: null,
            duration: null,
            status: 'running', // running, completed, failed
            args: step.args,
            result: null,
            error: null
        };
        
        this.currentTrace.steps.push(stepRecord);
        this.currentTrace.metrics.stepsTotal++;
        
        console.log(`📝 [Trace] Step ${step.id}: ${stepRecord.description}`);
        
        return stepRecord;
    }
    
    /**
     * Complete a step
     * @param {string} stepId - Step ID
     * @param {Object} result - Step result
     * @param {boolean} success - Success status
     */
    completeStep(stepId, result, success = true) {
        if (!this.currentTrace) return;
        
        const step = this.currentTrace.steps.find(s => s.id === stepId);
        if (!step) {
            console.warn(`⚠️ Step ${stepId} not found in trace`);
            return;
        }
        
        step.endTime = Date.now();
        step.duration = step.endTime - step.startTime;
        step.status = success ? 'completed' : 'failed';
        step.result = result;
        
        if (success) {
            this.currentTrace.metrics.stepsSucceeded++;
        } else {
            this.currentTrace.metrics.stepsFailed++;
        }
        
        console.log(`✅ [Trace] Step ${stepId} completed in ${step.duration}ms`);
    }
    
    /**
     * Record an agent handoff
     * @param {string} fromAgent - Source agent
     * @param {string} toAgent - Target agent
     * @param {Object} context - Handoff context
     */
    recordHandoff(fromAgent, toAgent, context = {}) {
        if (!this.currentTrace) return;
        
        const handoff = {
            from: fromAgent,
            to: toAgent,
            context: context,
            timestamp: Date.now(),
            reason: context.reason || 'Not specified',
            artifacts: context.artifacts || []
        };
        
        this.currentTrace.handoffs.push(handoff);
        this.currentTrace.metrics.handoffsTotal++;
        
        // Emit handoff event
        this.eventBus.emit({
            type: 'AGENT_HANDOFF',
            traceId: this.currentTrace.id,
            from: fromAgent,
            to: toAgent,
            context: context,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔄 [Trace] Handoff: ${fromAgent} → ${toAgent}`);
        
        return handoff;
    }
    
    /**
     * Record a tool call (MCP, file op, command)
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @param {Object} result - Tool result
     */
    recordToolCall(toolName, args, result = null) {
        if (!this.currentTrace) return;
        
        const toolCall = {
            tool: toolName,
            args: args,
            result: result,
            timestamp: Date.now(),
            duration: result?.duration || null,
            success: result?.success !== false
        };
        
        this.currentTrace.toolCalls.push(toolCall);
        this.currentTrace.metrics.toolCallsTotal++;
        
        console.log(`🔧 [Trace] Tool call: ${toolName}`);
        
        return toolCall;
    }
    
    /**
     * Record an artifact (file created/modified)
     * @param {string} filePath - File path
     * @param {boolean} verified - Verification status
     */
    recordArtifact(filePath, verified = false) {
        if (!this.currentTrace) return;
        
        const artifact = {
            path: filePath,
            verified: verified,
            timestamp: Date.now(),
            size: null, // Could be populated later
            hash: null  // Could be populated later
        };
        
        this.currentTrace.artifacts.push(artifact);
        this.currentTrace.metrics.artifactsCreated++;
        
        if (verified) {
            this.currentTrace.metrics.artifactsVerified++;
        }
        
        console.log(`📦 [Trace] Artifact: ${filePath} ${verified ? '✓' : '?'}`);
        
        return artifact;
    }
    
    /**
     * Record an approval event
     * @param {string} approvalId - Approval ID
     * @param {boolean} granted - Approval granted?
     * @param {Object} proposal - Proposal details
     */
    recordApproval(approvalId, granted, proposal = {}) {
        if (!this.currentTrace) return;
        
        const approval = {
            id: approvalId,
            granted: granted,
            proposal: proposal,
            timestamp: Date.now(),
            duration: proposal.duration || null
        };
        
        this.currentTrace.approvals.push(approval);
        
        if (granted) {
            this.currentTrace.metrics.approvalsGranted++;
        } else {
            this.currentTrace.metrics.approvalsDenied++;
        }
        
        console.log(`${granted ? '✅' : '❌'} [Trace] Approval: ${approvalId}`);
        
        return approval;
    }
    
    /**
     * Record an error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    recordError(error, context = {}) {
        if (!this.currentTrace) return;
        
        const errorRecord = {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: Date.now()
        };
        
        this.currentTrace.errors.push(errorRecord);
        
        console.error(`❌ [Trace] Error: ${error.message}`);
        
        return errorRecord;
    }
    
    /**
     * End the current trace
     * @param {Object} result - Final result
     * @param {boolean} success - Success status
     */
    endTrace(result, success = true) {
        if (!this.currentTrace) {
            console.warn('⚠️ No active trace to end');
            return null;
        }
        
        this.currentTrace.endTime = Date.now();
        this.currentTrace.duration = this.currentTrace.endTime - this.currentTrace.startTime;
        this.currentTrace.status = success ? 'completed' : 'failed';
        this.currentTrace.result = result;
        
        // Update statistics
        this.stats.totalTraces++;
        this.stats.totalDuration += this.currentTrace.duration;
        this.stats.avgDuration = this.stats.totalDuration / this.stats.totalTraces;
        this.stats.successRate = (this.stats.totalTraces > 0)
            ? (this.traces.filter(t => t.status === 'completed').length / this.stats.totalTraces)
            : 0;
        
        // Emit trace end event
        this.eventBus.emit({
            type: 'TRACE_END',
            traceId: this.currentTrace.id,
            agent: this.currentTrace.agent,
            duration: this.currentTrace.duration,
            success: success,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🏁 [Trace ${this.currentTrace.id}] Ended: ${this.currentTrace.duration}ms - ${success ? 'Success' : 'Failed'}`);
        
        // Archive trace
        this.traces.unshift(this.currentTrace);
        if (this.traces.length > this.maxTraces) {
            this.traces.pop();
        }
        
        const completedTrace = this.currentTrace;
        this.currentTrace = null;
        
        return completedTrace;
    }
    
    /**
     * Get timeline for current trace
     * @returns {Array} Timeline with durations
     */
    getTimeline() {
        if (!this.currentTrace) return [];
        
        return this.currentTrace.steps.map(step => ({
            id: step.id,
            type: step.type,
            description: step.description,
            startTime: step.startTime,
            endTime: step.endTime,
            duration: step.duration,
            status: step.status
        }));
    }
    
    /**
     * Export trace as JSON for external analysis
     * @param {string} traceId - Trace ID (optional, uses current if not provided)
     * @returns {Object} Trace data
     */
    exportTrace(traceId = null) {
        const trace = traceId
            ? this.traces.find(t => t.id === traceId)
            : this.currentTrace;
        
        if (!trace) {
            console.warn('⚠️ Trace not found');
            return null;
        }
        
        return {
            ...trace,
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
    }
    
    /**
     * Get all traces
     * @returns {Array} All traces
     */
    getAllTraces() {
        return this.traces;
    }
    
    /**
     * Get trace statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            activeTrace: this.currentTrace ? this.currentTrace.id : null,
            totalTracesArchived: this.traces.length
        };
    }
    
    /**
     * Clear all traces
     */
    clearTraces() {
        this.traces = [];
        this.currentTrace = null;
        console.log('🗑️ All traces cleared');
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentTraceSystem;
}
