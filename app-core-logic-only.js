/**
 * KayraDeniz - Core Agent Logic ONLY
 * 
 * This is a STRIPPED version of app.js containing ONLY:
 * - Agent initialization
 * - Night Orders execution
 * - Phase context management
 * - Event coordination
 * - Tool execution
 * - Learning integration
 * 
 * UI methods, templates, and helpers are REMOVED for ChatGPT analysis.
 */

class KodCanavari {
    constructor() {
        // ===== AGENT SYSTEMS INITIALIZATION =====
        this.messageMutex = new AsyncMutex('ChatMessage');
        this.nightOrdersMutex = new AsyncMutex('NightOrders');
        
        this.toolsSystem = null; // Temporarily disabled
        this.multiEditSystem = typeof MultiEditSystem !== 'undefined' ? new MultiEditSystem() : null;
        this.viewDiffSystem = typeof ViewDiffSystem !== 'undefined' ? new ViewDiffSystem() : null;
        this.viewRepoMapSystem = typeof ViewRepoMapSystem !== 'undefined' ? new ViewRepoMapSystem() : null;
        
        // Elysion Chamber
        this.approvalSystem = typeof ApprovalSystem !== 'undefined' ? new ApprovalSystem() : null;
        this.policyEngine = typeof PolicyEngine !== 'undefined' ? new PolicyEngine() : null;
        this.eventBus = typeof EventBus !== 'undefined' ? new EventBus() : null;
        this.developerMode = localStorage.getItem('developerMode') === 'true' || false;
        
        // Phase Context Tracking
        this.phaseContext = {
            currentPhase: 0,
            phaseHistory: [],
            completedFiles: new Set(),
            lastMission: null,
            phaseStartTime: Date.now(),
            totalPhases: 0
        };
        
        this.probeMatrix = typeof ProbeMatrix !== 'undefined' ? new ProbeMatrix() : null;
        
        // Learning Store
        this.learningStore = null;
        try {
            const { getLearningStore } = require('./learning-store');
            this.learningStore = getLearningStore();
        } catch (error) {
            console.warn('⚠️ Learning Store initialization failed:', error.message);
        }
        
        // Session Context & Memory
        this.sessionContext = new SessionContext();
        this.contextMemory = getContextMemory();
        
        // Agent Trace & Gating
        this.traceSystem = new AgentTraceSystem(this.eventBus);
        this.gatingSystem = new ArtifactGatingSystem(this.workspaceRoot, window.electronAPI);
        
        // Multi-Agent Coordinator
        this.multiAgentCoordinator = new MultiAgentCoordinator({
            traceSystem: this.traceSystem,
            gatingSystem: this.gatingSystem,
            approvalSystem: this.approvalSystem,
            policyEngine: this.policyEngine
        });
        
        // Luma Core
        this.lumaCore = null;
        this.lumaBridge = null;
        this.lumaSuprimeAgent = null;
        
        // Narrator Agent
        this.narratorAgent = null;
        this.criticAgent = typeof CriticAgent !== 'undefined' ? new CriticAgent() : null;
        
        this.currentMission = null;
        this.settings = {
            teachWhileDoing: localStorage.getItem('teachWhileDoing') !== 'false'
        };
    }
    
    // ===== NIGHT ORDERS EXECUTION =====
    async executeNightOrders(orders, options = {}) {
        console.log('🌙 Starting Night Orders execution:', orders.mission);
        
        // Acquire mutex
        const release = await this.nightOrdersMutex.acquire('executeNightOrders');
        
        try {
            const { mission, steps, acceptance } = orders;
            
            // Track mission
            this.currentMission = mission;
            this.phaseContext.lastMission = mission;
            
            // Execute steps
            for (const step of steps) {
                await this.executeOrderStep(step);
            }
            
            // Verify acceptance criteria
            const verificationResults = await this.verifyAcceptanceCriteria(acceptance);
            
            return {
                success: verificationResults.allPassed,
                results: verificationResults
            };
            
        } catch (error) {
            console.error('❌ Night Orders execution failed:', error);
            
            // Trigger Reflexion if enabled
            if (this.criticAgent) {
                await this.triggerReflexion(error, orders);
            }
            
            throw error;
            
        } finally {
            release();
        }
    }
    
    async executeOrderStep(step) {
        const { id, tool, args, explain, verify } = step;
        
        // USTA MODU: Before narration
        if (this.settings?.teachWhileDoing && explain) {
            this.eventBus.emit({
                type: 'NARRATION_BEFORE',
                stepId: id,
                message: {
                    goal: explain.goal,
                    rationale: explain.rationale,
                    tradeoffs: explain.tradeoffs,
                    checklist: explain.checklist
                }
            });
        }
        
        // Tool execution
        const result = await this.executeToolCall(tool, args);
        
        // USTA MODU: After narration
        if (this.settings?.teachWhileDoing && explain?.showDiff && result?.diff) {
            this.eventBus.emit({
                type: 'NARRATION_AFTER',
                stepId: id,
                diff: result.diff,
                message: result.summary || '...'
            });
        }
        
        // Verification
        if (verify && verify.length > 0) {
            const probeResults = await this.runVerificationCheck(step, verify);
            
            if (this.settings?.teachWhileDoing) {
                this.eventBus.emit({
                    type: 'NARRATION_VERIFY',
                    stepId: id,
                    probes: probeResults
                });
            }
        }
        
        return result;
    }
    
    async executeToolCall(tool, args) {
        // Route to appropriate tool system
        switch (tool) {
            case 'fs.write':
                return await this.executeFileWrite(args);
            case 'fs.read':
                return await this.executeFileRead(args);
            case 'run_cmd':
                return await this.executeCommand(args);
            default:
                throw new Error(`Unknown tool: ${tool}`);
        }
    }
    
    // ===== PHASE MANAGEMENT =====
    startNewPhase(phaseNumber, description) {
        this.phaseContext.currentPhase = phaseNumber;
        this.phaseContext.phaseStartTime = Date.now();
        this.phaseContext.completedFiles = new Set();
        
        this.phaseContext.phaseHistory.push({
            phase: phaseNumber,
            description,
            startTime: Date.now(),
            files: []
        });
        
        console.log(`🎯 Starting Phase ${phaseNumber}: ${description}`);
    }
    
    markFileCompleted(filePath) {
        const normalized = this.path.normalize(filePath);
        this.phaseContext.completedFiles.add(normalized);
        
        const currentPhase = this.phaseContext.phaseHistory[this.phaseContext.phaseHistory.length - 1];
        if (currentPhase) {
            currentPhase.files.push(normalized);
        }
    }
    
    // ===== REFLEXION & LEARNING =====
    async triggerReflexion(error, orders) {
        if (!this.criticAgent) return;
        
        console.log('🔬 Triggering Reflexion Module...');
        
        try {
            const analysis = await this.criticAgent.analyzeFailure({
                error,
                orders,
                phaseContext: this.phaseContext,
                sessionContext: this.sessionContext.getSnapshot()
            });
            
            // Store in Learning Store
            if (this.learningStore && analysis.success) {
                await this.learningStore.recordReflection({
                    mission: orders.mission,
                    error: error.message,
                    rootCause: analysis.rootCause,
                    fixes: analysis.proposedFixes,
                    timestamp: Date.now()
                });
            }
            
            // Auto-trigger Phase 2 if fix available
            if (analysis.proposedFixes && analysis.proposedFixes.length > 0) {
                this.eventBus.emit({
                    type: 'executor:start',
                    orders: analysis.proposedFixes[0],
                    isPhase2: true
                });
            }
            
        } catch (reflexionError) {
            console.error('❌ Reflexion failed:', reflexionError);
        }
    }
    
    // ===== APPROVAL & POLICY =====
    async requestApproval(proposal) {
        // Developer Mode bypass
        if (this.developerMode) {
            console.log('🔓 Developer Mode: Auto-approved');
            return { approved: true, bypassReason: 'developer_mode' };
        }
        
        // Policy check
        if (this.policyEngine) {
            const canAutoApprove = this.policyEngine.canAutoApprove(proposal);
            if (canAutoApprove) {
                console.log('✅ Policy: Auto-approved');
                return { approved: true, bypassReason: 'policy_whitelist' };
            }
        }
        
        // Manual approval via Elysion Chamber
        if (this.approvalSystem) {
            return await this.approvalSystem.requestApproval(proposal);
        }
        
        // Fallback: Auto-approve
        return { approved: true, bypassReason: 'no_approval_system' };
    }
    
    // ===== EVENT COORDINATION =====
    setupEventListeners() {
        if (!this.eventBus) return;
        
        // Reflexion Bridge
        this.eventBus.on('executor:start', async (payload) => {
            try {
                if (payload?.orders) {
                    if (payload.isPhase2) {
                        this.phaseContext.currentPhase = 2;
                        this.phaseContext.lastMission = payload.orders.mission;
                    }
                    
                    await this.executeNightOrders(payload.orders, payload.options || {});
                }
            } catch (error) {
                console.error('❌ EventBus executor:start handler failed:', error);
            }
        });
        
        // Narrator events
        this.eventBus.on('NARRATION_BEFORE', (data) => {
            if (this.narratorAgent) {
                this.narratorAgent.showBefore(data);
            }
        });
        
        this.eventBus.on('NARRATION_AFTER', (data) => {
            if (this.narratorAgent) {
                this.narratorAgent.showAfter(data);
            }
        });
        
        this.eventBus.on('NARRATION_VERIFY', (data) => {
            if (this.narratorAgent) {
                this.narratorAgent.showVerify(data);
            }
        });
    }
}

// Export for analysis
module.exports = { KodCanavari };
