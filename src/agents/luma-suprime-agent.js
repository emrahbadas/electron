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

// 🧠 v2.1 Adaptive Evolution Components
import { AdaptiveReflexionMemory } from './adaptive-memory.js';
import { ContextReplayEngine } from './context-replay-engine.js';
import { CognitiveDivergenceLayer } from './cognitive-divergence-layer.js';
import { SelfDivergenceProtocol } from './self-divergence-protocol.js';

export class LumaSuprimeAgent {
    constructor(options = {}) {
        // Core systems
        this.lumaCore = options.lumaCore || new LumaCore();
        this.lumaBridge = options.lumaBridge || null; // Will be set externally
        
        // System integrations (set early for v2.1 dependencies)
        this.sessionContext = options.sessionContext || null;
        this.learningStore = options.learningStore || null;
        this.eventBus = options.eventBus || null;
        
        // 🧠 v2.1 Adaptive Evolution Systems (after dependencies)
        this.adaptiveMemory = new AdaptiveReflexionMemory();
        this.contextReplay = new ContextReplayEngine(this.learningStore, this.adaptiveMemory);
        this.cognitiveDivergence = new CognitiveDivergenceLayer();
        this.selfDivergence = new SelfDivergenceProtocol();
        
        console.log('🧠 v2.1 Adaptive Components initialized:');
        console.log('  ✅ AdaptiveReflexionMemory (weighted pattern learning)');
        console.log('  ✅ ContextReplayEngine (smart fix replay)');
        console.log('  ✅ CognitiveDivergenceLayer (novelty detection)');
        console.log('  ✅ SelfDivergenceProtocol (internal questioning)');
        
        // Additional system integrations
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
            
            // � v2.1 INTEGRATION POINT 1: Self-Divergence (Internal Questioning)
            console.log('🤔 v2.1: Activating Self-Divergence Protocol...');
            const selfCheck = await this.selfDivergence.questionDecision(
                { type: 'preliminary', intent, input },
                context
            );
            
            if (selfCheck.recommendation === 'DIVERGE') {
                console.log('⚠️ Self-Divergence detected potential issue!');
                if (selfCheck.questions && selfCheck.questions.length > 0) {
                    console.log('   Questions:', selfCheck.questions.map(q => q.question).join(', '));
                }
                if (selfCheck.concerns && selfCheck.concerns.length > 0) {
                    console.log('   Concerns:', selfCheck.concerns);
                }
                
                // Add self-reflection to context for better reasoning
                context.selfReflection = selfCheck;
            } else {
                console.log('✅ Self-Divergence: Decision looks good');
            }
            
            // �🤔 STEP 3: Reasoning (Luma Core with full context)
            const decision = this.lumaCore.reason(intent, {
                prompt: input,
                context,
                learningStore: this.learningStore,
                sessionContext: this.sessionContext
            });
            
            console.log(`🧠 Supreme Decision:`, decision);
            this.emitSuprimeEvent('DECISION_MADE', { decision });
            
            // 🧠 v2.1 INTEGRATION POINT 2: Cognitive Divergence (Novelty Detection)
            console.log('🔍 v2.1: Activating Cognitive Divergence Layer...');
            const projectContext = {
                input,
                intent,
                decision,
                sessionData: context.session
            };
            
            const strategy = await this.cognitiveDivergence.decideStrategy(projectContext);
            console.log(`🎯 Cognitive Strategy: ${strategy.strategy}`);
            
            if (strategy.hybridDetected) {
                console.log('⚡ HYBRID PROJECT DETECTED!');
                console.log('   Categories:', strategy.categories);
                console.log('   Guidance:', strategy.guidance);
                
                // Add strategy guidance to decision metadata
                if (!decision.metadata) decision.metadata = {};
                decision.metadata.cognitiveStrategy = strategy;
            }
            
            if (strategy.strategy === 'EXPLORE_NEW') {
                console.log('🚀 Novel scenario detected - exploring new patterns');
            } else if (strategy.strategy === 'REUSE_PATTERN') {
                console.log('♻️ Similar pattern found - reusing knowledge');
            } else {
                console.log('⚖️ Balanced approach - combining learned + novel');
            }
            
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
            
            // 🧠 v2.1 INTEGRATION POINT 3: Context Replay (Pattern Injection)
            console.log('📚 v2.1: Activating Context Replay Engine...');
            const replay = await this.contextReplay.replayPatternsFor(projectContext);
            
            if (replay && replay.patterns.length > 0) {
                console.log(`✨ Found ${replay.patterns.length} relevant patterns!`);
                console.log('   Auto-applying learned fixes...');
                
                // Add replay guidance to task context
                prioritized.replayGuidance = {
                    patterns: replay.patterns,
                    recommendation: replay.recommendation,
                    autoApply: replay.autoApply
                };
                
                if (replay.autoApply) {
                    console.log('🤖 AUTO-APPLY MODE: Fixes will be injected automatically');
                }
            } else {
                console.log('📝 No patterns found - learning from scratch');
            }
            
            const result = await this.executeViaCoordinator(
                assignedAgent, 
                prioritized,
                decision
            );
            
            // 📊 STEP 8: Result Analysis and Learning
            this.systemState = 'reflecting';
            await this.processResult(result, task, decision);
            
            // 🧠 v2.1 INTEGRATION POINT 4: Adaptive Memory (Store Pattern)
            console.log('💾 v2.1: Storing pattern in Adaptive Memory...');
            const success = result?.success !== false;
            // 4️⃣ Adaptive Memory ile pattern kaydet
            await this.adaptiveMemory.storePattern(
                {
                    input,
                    intent,
                    projectType: context.session?.currentProject?.name || 'unknown',
                    errorContext: context.session?.errors || [],
                    strategy: decision.metadata?.cognitiveStrategy?.strategy || 'unknown'
                },
                [
                    {
                        type: 'decision',
                        path: context.session?.currentProject?.path || '',
                        content: JSON.stringify(decision),
                        reasoning: decision.reasoning || ''
                    },
                    {
                        type: 'task',
                        path: context.session?.currentProject?.path || '',
                        content: JSON.stringify(prioritized),
                        reasoning: prioritized.replayGuidance || ''
                    },
                    {
                        type: 'result',
                        path: context.session?.currentProject?.path || '',
                        content: JSON.stringify(result),
                        reasoning: success ? 'Execution completed successfully' : 'Execution failed'
                    }
                ],
                success
            );
            
            const memoryStats = this.adaptiveMemory.getStats();
            console.log(`📊 Adaptive Memory Stats: ${memoryStats.totalPatterns} patterns, avg score: ${memoryStats.averageScore.toFixed(2)}`);
            
            // 💾 STEP 9: Save Decision to History
            this.recordDecision({
                input,
                intent,
                decision,
                task: prioritized,
                agent: assignedAgent,
                result,
                duration: Date.now() - startTime,
                v21Metadata: {
                    selfCheck,
                    strategy,
                    replay,
                    memoryStats
                }
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
        // 🧠 Extract phase context from KodCanavari if available
        const phaseContext = context.phaseContext || {};
        
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
                hasErrors: context.session?.errors?.length > 0,
                // 🔄 PHASE COORDINATION: Share phase context across all agents
                currentPhase: phaseContext.currentPhase || 1,
                totalPhases: phaseContext.totalPhases || 1,
                lastMission: phaseContext.lastMission || null,
                projectContinuation: phaseContext.projectContinuation || false
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
                // 🧠 CRITICAL: Pass phase context to ALL agents for coordination
                const sharedContext = {
                    task,
                    decision,
                    priority: task.priority,
                    ...task.context,
                    // 🔄 Phase coordination context
                    currentPhase: task.context?.currentPhase || 1,
                    totalPhases: task.context?.totalPhases || 1,
                    lastMission: task.context?.lastMission || null,
                    projectContinuation: task.context?.projectContinuation || false
                };
                
                const sessionId = await this.multiAgentCoordinator.startSession(
                    agentName, 
                    task.description, 
                    sharedContext
                );
                
                return {
                    fromCoordinator: true,
                    sessionId,
                    agent: agentName,
                    message: `Task delegated to ${agentName} via coordinator`,
                    sharedContext // Return for verification
                };
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
        
        // 🧠 v2.1 Statistics
        const v21Stats = {
            adaptiveMemory: this.adaptiveMemory.getStats(),
            cognitiveDivergence: {
                totalDecisions: this.decisionHistory.filter(d => d.v21Metadata?.strategy).length,
                hybridDetections: this.decisionHistory.filter(d => d.v21Metadata?.strategy?.hybridDetected).length,
                strategyDistribution: {
                    explore: this.decisionHistory.filter(d => d.v21Metadata?.strategy?.strategy === 'EXPLORE_NEW').length,
                    reuse: this.decisionHistory.filter(d => d.v21Metadata?.strategy?.strategy === 'REUSE_PATTERN').length,
                    balanced: this.decisionHistory.filter(d => d.v21Metadata?.strategy?.strategy === 'BALANCED_APPROACH').length
                }
            },
            contextReplay: {
                totalReplays: this.decisionHistory.filter(d => d.v21Metadata?.replay?.patterns?.length > 0).length,
                autoApplied: this.decisionHistory.filter(d => d.v21Metadata?.replay?.autoApply).length
            },
            selfDivergence: {
                totalChecks: this.decisionHistory.filter(d => d.v21Metadata?.selfCheck).length,
                divergenceTriggered: this.decisionHistory.filter(d => d.v21Metadata?.selfCheck?.recommendation === 'DIVERGE').length
            }
        };
        
        return {
            totalDecisions: total,
            successful,
            failed,
            successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
            intentDistribution: intentCounts,
            agentDistribution: agentCounts,
            currentState: this.systemState,
            queueLength: this.taskQueue.length,
            activeAssignments: this.agentAssignments.size,
            v21: v21Stats
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
