/**
 * 🌌 LUMA SUPRIME AGENT - KayraDeniz Üst Akıl Katmanı
 * 
 * Supreme Agent: Tüm alt ajanları koordine eden, kararları alan,
 * hataları analiz eden ve sistemin genel yönünü belirleyen bilinç katmanı.
 * 
 * Görevler:
 * - Intent analysis ve niyet sınıflandırma
 * - Task prioritization (görev önceliklendirme)
 * - Risk assessment ve güvenlik kontrolü
 * - Agent assignment (hangi ajan hangi görevi alsın)
 * - Learning loop (SessionContext + LearningStore)
 * - EventBus coordination (tüm sistem olaylarını dinle)
 * - Night Orders modulation (görevleri şekillendirme)
 * 
 * @version 2.0.0
 * @author KayraDeniz Team
 */

import { LumaCore } from './luma-core.js';
import { LumaContextBridge } from './luma-context-bridge.js';

export class LumaSuprimeAgent {
    constructor(options = {}) {
        // Core systems
        this.lumaCore = options.lumaCore || new LumaCore();
        this.lumaBridge = options.lumaBridge || null; // Will be set externally
        
        // System integrations (set externally)
        this.sessionContext = options.sessionContext || null;
        this.learningStore = options.learningStore || null;
        this.eventBus = options.eventBus || null;
        this.multiAgentCoordinator = options.multiAgentCoordinator || null;
        this.reflexionSystem = options.reflexionSystem || null;
        
        // Supreme Agent state
        this.activeTask = null;
        this.taskQueue = [];
        this.agentAssignments = new Map(); // Track which agent is doing what
        this.decisionHistory = [];
        this.systemState = 'idle'; // idle, thinking, executing, reflecting
        
        // Configuration
        this.maxQueueSize = 10;
        this.maxHistorySize = 100;
        this.enableAutoReflection = true;
        
        console.log('🌌 Luma Supreme Agent initialized');
    }
    
    /**
     * 🧠 MAIN EXECUTION ENTRY POINT
     * Kullanıcı girdisini alır, analiz eder, karar verir ve uygun ajanları çalıştırır
     * 
     * @param {string} input - Kullanıcı mesajı
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Supreme decision and result
     */
    async execute(input, options = {}) {
        const startTime = Date.now();
        this.systemState = 'thinking';
        
        try {
            // 🔍 STEP 1: Intent Analysis (Luma Core)
            this.emitSuprimeEvent('THINKING_START', { input, timestamp: startTime });
            
            const intent = this.lumaCore.analyzeIntent(input);
            console.log(`🧠 Supreme Agent: Intent detected → ${intent}`);
            
            // 🎯 STEP 2: Context Gathering (SessionContext + LearningStore)
            const context = await this.gatherSystemContext(input);
            
            // 🤔 STEP 3: Reasoning (Luma Core with full context)
            const decision = this.lumaCore.reason(intent, {
                prompt: input,
                context,
                learningStore: this.learningStore,
                sessionContext: this.sessionContext
            });
            
            console.log(`🧠 Supreme Decision:`, decision);
            this.emitSuprimeEvent('DECISION_MADE', { decision });
            
            // 🚦 STEP 4: Risk Assessment and Validation
            const validation = await this.validateDecision(decision, context);
            
            if (!validation.approved) {
                this.emitSuprimeEvent('DECISION_BLOCKED', { 
                    reason: validation.reason,
                    decision 
                });
                return {
                    type: 'blocked',
                    decision,
                    validation,
                    message: `❌ Supreme Agent: ${validation.reason}`
                };
            }
            
            // 🎯 STEP 5: Task Creation and Prioritization
            const task = this.createTask(input, intent, decision, context);
            const prioritized = this.prioritizeTask(task);
            
            // 📋 STEP 6: Agent Assignment
            const assignedAgent = this.assignAgent(prioritized);
            console.log(`🎯 Task assigned to: ${assignedAgent}`);
            
            this.emitSuprimeEvent('TASK_ASSIGNED', { 
                task: prioritized,
                agent: assignedAgent 
            });
            
            // 🚀 STEP 7: Execute via Multi-Agent Coordinator
            this.systemState = 'executing';
            const result = await this.executeViaCoordinator(
                assignedAgent, 
                prioritized,
                decision
            );
            
            // 📊 STEP 8: Result Analysis and Learning
            this.systemState = 'reflecting';
            await this.processResult(result, task, decision);
            
            // 💾 STEP 9: Save Decision to History
            this.recordDecision({
                input,
                intent,
                decision,
                task: prioritized,
                agent: assignedAgent,
                result,
                duration: Date.now() - startTime
            });
            
            this.systemState = 'idle';
            this.emitSuprimeEvent('EXECUTION_COMPLETE', { result });
            
            return {
                type: 'success',
                intent,
                decision,
                task: prioritized,
                agent: assignedAgent,
                result,
                message: `✅ Supreme Agent: Task completed via ${assignedAgent}`
            };
            
        } catch (error) {
            console.error('❌ Supreme Agent execution error:', error);
            this.systemState = 'idle';
            
            this.emitSuprimeEvent('EXECUTION_ERROR', { 
                error: error.message,
                input 
            });
            
            // Reflexion: Learn from this error
            if (this.enableAutoReflection) {
                await this.reflectOnError(error, input);
            }
            
            return {
                type: 'error',
                message: `❌ Supreme Agent error: ${error.message}`,
                error: error.message
            };
        }
    }
    
    /**
     * 🔍 Gather full system context
     */
    async gatherSystemContext(input) {
        const context = {
            // SessionContext data
            session: this.sessionContext ? {
                activeMission: this.sessionContext.context?.activeMission,
                currentProject: this.sessionContext.context?.currentProject,
                errors: this.sessionContext.context?.errors || [],
                operationHistory: this.sessionContext.context?.operationHistory || []
            } : null,
            
            // LearningStore patterns
            learning: this.learningStore ? {
                stats: this.learningStore.getStats(),
                recentPatterns: this.learningStore.getTopPatterns(5),
                similarErrors: this.learningStore.search(input).slice(0, 3)
            } : null,
            
            // Current system state
            system: {
                state: this.systemState,
                activeTask: this.activeTask,
                queueLength: this.taskQueue.length,
                agentAssignments: Array.from(this.agentAssignments.entries())
            }
        };
        
        return context;
    }
    
    /**
     * ✅ Validate decision before execution
     */
    async validateDecision(decision, context) {
        // Developer mode - auto approve
        if (window.kodCanavari?.developerMode) {
            return { approved: true, reason: 'Developer mode active' };
        }
        
        // Check if decision was already rejected by Luma Core
        if (decision.approved === false) {
            return { 
                approved: false, 
                reason: decision.reasoning || 'Rejected by Luma Core'
            };
        }
        
        // High risk decisions need extra validation
        if (decision.metadata?.riskLevel === 'HIGH') {
            // Check if similar high-risk decision failed before
            if (context.learning?.similarErrors?.length > 0) {
                const failedBefore = context.learning.similarErrors.some(
                    err => err.result === 'FAIL'
                );
                
                if (failedBefore) {
                    return {
                        approved: false,
                        reason: 'Similar high-risk operation failed before. Manual review required.'
                    };
                }
            }
        }
        
        return { approved: true, reason: 'Validation passed' };
    }
    
    /**
     * 📋 Create structured task from decision
     */
    createTask(input, intent, decision, context) {
        return {
            id: `task-${Date.now()}`,
            input,
            intent,
            decision,
            priority: this.calculatePriority(intent, decision, context),
            created: Date.now(),
            status: 'pending',
            context: {
                projectName: context.session?.currentProject?.name,
                missionGoal: context.session?.activeMission?.goal,
                hasErrors: context.session?.errors?.length > 0
            }
        };
    }
    
    /**
     * 🎯 Calculate task priority (0-10, higher = more urgent)
     */
    calculatePriority(intent, decision, context) {
        let priority = 5; // Base priority
        
        // Intent-based priority
        if (intent === 'reflection') priority += 3; // Errors are urgent
        if (intent === 'command') priority += 2; // Commands need quick execution
        if (intent === 'idea') priority += 0; // Ideas can wait
        
        // Context-based priority
        if (context.session?.errors?.length > 0) priority += 2;
        if (context.system?.queueLength > 5) priority -= 1; // Queue is full
        
        // Risk-based priority
        if (decision.metadata?.riskLevel === 'HIGH') priority -= 1; // Slow down risky ops
        
        return Math.max(0, Math.min(10, priority)); // Clamp to 0-10
    }
    
    /**
     * 📊 Prioritize task in queue
     */
    prioritizeTask(task) {
        // Add to queue
        this.taskQueue.push(task);
        
        // Sort by priority (descending)
        this.taskQueue.sort((a, b) => b.priority - a.priority);
        
        // Limit queue size
        if (this.taskQueue.length > this.maxQueueSize) {
            const dropped = this.taskQueue.pop();
            console.warn('⚠️ Task queue full, dropped:', dropped.id);
        }
        
        return task;
    }
    
    /**
     * 🎯 Assign appropriate agent for task
     */
    assignAgent(task) {
        const { intent, decision } = task;
        
        // Intent-based assignment
        if (intent === 'command') {
            if (decision.message?.includes('build') || decision.message?.includes('npm')) {
                return 'BuildAgent';
            }
            if (decision.message?.includes('git')) {
                return 'GitAgent';
            }
            return 'ExecutorAgent';
        }
        
        if (intent === 'reflection') {
            return 'AnalyzerAgent';
        }
        
        if (intent === 'idea') {
            return 'GeneratorAgent';
        }
        
        if (intent === 'exploration') {
            return 'NarratorAgent';
        }
        
        // Default fallback
        return 'GeneratorAgent';
    }
    
    /**
     * 🚀 Execute task via Multi-Agent Coordinator
     */
    async executeViaCoordinator(agentName, task, decision) {
        // Track assignment
        this.agentAssignments.set(task.id, agentName);
        this.activeTask = task;
        
        try {
            // If coordinator available, use it
            if (this.multiAgentCoordinator) {
                return await this.multiAgentCoordinator.assign(agentName, {
                    task,
                    decision,
                    context: task.context
                });
            }
            
            // Fallback: Direct execution
            return await this.directExecution(task, decision);
            
        } finally {
            this.agentAssignments.delete(task.id);
            this.activeTask = null;
        }
    }
    
    /**
     * 🔧 Direct execution fallback (when coordinator not available)
     */
    async directExecution(task, decision) {
        console.log('⚙️ Supreme Agent: Direct execution mode');
        
        // Emit event for logging
        this.emitSuprimeEvent('DIRECT_EXECUTION', { task, decision });
        
        return {
            success: true,
            message: decision.message,
            agent: 'SuprimeAgent-Direct',
            timestamp: Date.now()
        };
    }
    
    /**
     * 📊 Process execution result and learn
     */
    async processResult(result, task, decision) {
        const success = result?.success !== false;
        
        // Update task status
        task.status = success ? 'completed' : 'failed';
        task.result = result;
        
        // Save to LearningStore if applicable
        if (this.learningStore && !success) {
            this.learningStore.saveReflection({
                mission: task.context?.missionGoal || 'Unknown',
                step: task.intent,
                tool: 'suprime-agent',
                error: result?.error || result?.message || 'Unknown error',
                rootCause: decision.reasoning || '',
                fix: decision.fix || '',
                result: 'FAIL',
                pattern: `suprime-${task.intent}-${Date.now()}`,
                metadata: {
                    taskId: task.id,
                    agent: this.agentAssignments.get(task.id) || 'unknown',
                    projectContext: task.context?.projectName
                }
            });
        }
        
        // Update SessionContext
        if (this.sessionContext) {
            this.sessionContext.recordOperation(
                task.intent,
                result?.message || decision.message,
                success
            );
        }
        
        // Emit result event
        this.emitSuprimeEvent('RESULT_PROCESSED', { 
            task, 
            result, 
            success 
        });
    }
    
    /**
     * 🔍 Reflect on execution error
     */
    async reflectOnError(error, input) {
        console.log('🔍 Supreme Agent: Reflecting on error...');
        
        if (this.learningStore) {
            this.learningStore.saveReflection({
                mission: 'Supreme Agent Execution',
                step: 'execute',
                tool: 'suprime-agent',
                error: error.message,
                rootCause: error.stack || 'Unknown',
                fix: 'Error during supreme agent execution',
                result: 'FAIL',
                pattern: `suprime-error-${Date.now()}`,
                metadata: {
                    input,
                    systemState: this.systemState
                }
            });
        }
    }
    
    /**
     * 💾 Record decision to history
     */
    recordDecision(record) {
        this.decisionHistory.push({
            ...record,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.decisionHistory.length > this.maxHistorySize) {
            this.decisionHistory = this.decisionHistory.slice(-this.maxHistorySize);
        }
    }
    
    /**
     * 📡 Emit Supreme Agent event
     */
    emitSuprimeEvent(eventType, data) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit(`SUPRIME_${eventType}`, {
                source: 'luma-suprime-agent',
                systemState: this.systemState,
                timestamp: Date.now(),
                ...data
            });
        } catch (error) {
            console.error('❌ Supreme event emit error:', error);
        }
    }
    
    /**
     * 📊 Get Supreme Agent statistics
     */
    getStats() {
        const total = this.decisionHistory.length;
        const successful = this.decisionHistory.filter(d => d.result?.success !== false).length;
        const failed = total - successful;
        
        const intentCounts = {};
        const agentCounts = {};
        
        this.decisionHistory.forEach(d => {
            intentCounts[d.intent] = (intentCounts[d.intent] || 0) + 1;
            agentCounts[d.agent] = (agentCounts[d.agent] || 0) + 1;
        });
        
        return {
            totalDecisions: total,
            successful,
            failed,
            successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
            intentDistribution: intentCounts,
            agentDistribution: agentCounts,
            currentState: this.systemState,
            queueLength: this.taskQueue.length,
            activeAssignments: this.agentAssignments.size
        };
    }
    
    /**
     * 🔄 Reset Supreme Agent state
     */
    reset() {
        this.activeTask = null;
        this.taskQueue = [];
        this.agentAssignments.clear();
        this.decisionHistory = [];
        this.systemState = 'idle';
        
        console.log('🔄 Supreme Agent reset complete');
    }
}

export default LumaSuprimeAgent;
