/**
 * Night Orders Memory Integration
 * 
 * Automatically saves Night Orders execution to Knowledge Graph Memory.
 * Tracks steps, phases, file operations, and errors for context preservation.
 * 
 * 🧠 This solves the context loss problem by persisting all execution history.
 */

const path = require('path');
const { KnowledgeGraphManager } = require('./memory.js');

class NightOrdersMemory {
    constructor(options = {}) {
        this.memoryFile = options.memoryFile || path.join(process.cwd(), 'memory.jsonl');
        this.memory = new KnowledgeGraphManager(this.memoryFile);
        
        // Track current session
        this.currentSession = null;
        this.currentMission = null;
        this.stepCache = new Map(); // stepId → step data
        
        // Initialize on construction
        this.initialize().catch(err => {
            console.error('❌ [NightOrdersMemory] Initialization failed:', err.message);
        });
    }
    
    async initialize() {
        await this.memory.initialize();
        console.log('🧠 [NightOrdersMemory] Initialized with memory file:', this.memoryFile);
    }
    
    /**
     * Start a new Night Orders session
     */
    async startSession(mission, orders) {
        const sessionId = `session_${Date.now()}`;
        this.currentSession = sessionId;
        this.currentMission = mission;
        
        try {
            // Create session entity
            await this.memory.createEntities({
                entities: [{
                    name: sessionId,
                    entityType: 'night_orders_session',
                    observations: [
                        `Mission: ${mission}`,
                        `Started: ${new Date().toISOString()}`,
                        `Total steps: ${orders.steps?.length || 0}`,
                        `Acceptance criteria: ${orders.acceptance?.join(', ') || 'None'}`
                    ]
                }]
            });
            
            // Create mission entity if not exists
            const missionEntityName = `mission_${this.normalizeName(mission)}`;
            const graph = await this.memory.readGraph();
            
            if (!graph.entities.find(e => e.name === missionEntityName)) {
                await this.memory.createEntities({
                    entities: [{
                        name: missionEntityName,
                        entityType: 'mission',
                        observations: [
                            `Name: ${mission}`,
                            `First session: ${sessionId}`
                        ]
                    }]
                });
            } else {
                // Add observation to existing mission
                await this.memory.addObservations({
                    observations: [{
                        entityName: missionEntityName,
                        contents: [`New session started: ${sessionId}`]
                    }]
                });
            }
            
            // Create relation
            await this.memory.createRelations({
                relations: [{
                    from: sessionId,
                    to: missionEntityName,
                    relationType: 'belongs_to_mission'
                }]
            });
            
            console.log(`🧠 [NightOrdersMemory] Session started: ${sessionId} for mission "${mission}"`);
            
            return sessionId;
            
        } catch (error) {
            console.error('❌ [NightOrdersMemory] Failed to start session:', error.message);
            throw error;
        }
    }
    
    /**
     * Handle NARRATION_BEFORE event (step starting)
     */
    async onStepBefore(event) {
        if (!this.currentSession) {
            console.warn('⚠️ [NightOrdersMemory] No active session, skipping step before');
            return;
        }
        
        const { stepId, explain } = event.data;
        
        // Cache step data
        this.stepCache.set(stepId, {
            id: stepId,
            startTime: event.timestamp,
            explain: explain,
            goal: explain?.goal || 'Unknown',
            rationale: explain?.rationale || null
        });
        
        try {
            // Create step entity
            const stepEntityName = `step_${this.currentSession}_${stepId}`;
            
            await this.memory.createEntities({
                entities: [{
                    name: stepEntityName,
                    entityType: 'night_orders_step',
                    observations: [
                        `Step ID: ${stepId}`,
                        `Goal: ${explain?.goal || 'Unknown'}`,
                        `Rationale: ${explain?.rationale || 'Not specified'}`,
                        `Status: in_progress`,
                        `Started: ${new Date(event.timestamp).toISOString()}`
                    ]
                }]
            });
            
            // Create relation to session
            await this.memory.createRelations({
                relations: [{
                    from: this.currentSession,
                    to: stepEntityName,
                    relationType: 'contains_step'
                }]
            });
            
            console.log(`🧠 [NightOrdersMemory] Step started: ${stepId}`);
            
        } catch (error) {
            console.error(`❌ [NightOrdersMemory] Failed to save step before: ${stepId}`, error.message);
        }
    }
    
    /**
     * Handle NARRATION_AFTER event (step completed)
     */
    async onStepAfter(event) {
        if (!this.currentSession) {
            console.warn('⚠️ [NightOrdersMemory] No active session, skipping step after');
            return;
        }
        
        const { stepId, summary, diff } = event.data;
        const stepData = this.stepCache.get(stepId);
        
        if (!stepData) {
            console.warn(`⚠️ [NightOrdersMemory] No cached data for step: ${stepId}`);
            return;
        }
        
        try {
            const stepEntityName = `step_${this.currentSession}_${stepId}`;
            const executionTime = event.timestamp - stepData.startTime;
            
            // Add completion observations
            await this.memory.addObservations({ observations: [{
                entityName: stepEntityName,
                contents: [
                    `Status: completed`,
                    `Completed: ${new Date(event.timestamp).toISOString()}`,
                    `Execution time: ${executionTime}ms`,
                    `Summary: ${summary || 'Success'}`,
                    diff ? `Diff available: Yes` : `Diff available: No`
                ]
            }] });
            
            console.log(`🧠 [NightOrdersMemory] Step completed: ${stepId} (${executionTime}ms)`);
            
        } catch (error) {
            console.error(`❌ [NightOrdersMemory] Failed to save step after: ${stepId}`, error.message);
        }
    }
    
    /**
     * Handle NARRATION_VERIFY event (verification results)
     */
    async onStepVerify(event) {
        if (!this.currentSession) {
            console.warn('⚠️ [NightOrdersMemory] No active session, skipping step verify');
            return;
        }
        
        const { stepId, probes } = event.data;
        
        try {
            const stepEntityName = `step_${this.currentSession}_${stepId}`;
            
            // Add verification observations
            const verifyObservations = probes.map(probe => 
                `Verification [${probe.type}]: ${probe.status.toUpperCase()}`
            );
            
            await this.memory.addObservations({ observations: [{
                entityName: stepEntityName,
                contents: verifyObservations
            }] });
            
            // Track verification failures
            const failures = probes.filter(p => p.status === 'fail');
            if (failures.length > 0) {
                await this.memory.addObservations({ observations: [{
                    entityName: stepEntityName,
                    contents: [`⚠️ ${failures.length} verification(s) failed`]
                }] });
            }
            
            console.log(`🧠 [NightOrdersMemory] Step verified: ${stepId} (${probes.length} checks)`);
            
        } catch (error) {
            console.error(`❌ [NightOrdersMemory] Failed to save step verify: ${stepId}`, error.message);
        }
    }
    
    /**
     * Handle step error
     */
    async onStepError(stepId, error) {
        if (!this.currentSession) {
            console.warn('⚠️ [NightOrdersMemory] No active session, skipping step error');
            return;
        }
        
        try {
            const stepEntityName = `step_${this.currentSession}_${stepId}`;
            
            // Create error entity
            const errorEntityName = `error_${Date.now()}`;
            
            await this.memory.createEntities({ entities: [{
                name: errorEntityName,
                entityType: 'execution_error',
                observations: [
                    `Error: ${error.message}`,
                    `Step: ${stepId}`,
                    `Timestamp: ${new Date().toISOString()}`,
                    `Stack: ${error.stack?.substring(0, 200) || 'N/A'}`
                ]
            }] });
            
            // Link error to step
            await this.memory.createRelations({ relations: [{
                from: stepEntityName,
                to: errorEntityName,
                relationType: 'encountered_error'
            }] });
            
            // Add error observation to step
            await this.memory.addObservations({ observations: [{
                entityName: stepEntityName,
                contents: [
                    `Status: failed`,
                    `Error: ${error.message}`
                ]
            }] });
            
            console.log(`🧠 [NightOrdersMemory] Step error saved: ${stepId}`);
            
        } catch (err) {
            console.error(`❌ [NightOrdersMemory] Failed to save step error: ${stepId}`, err.message);
        }
    }
    
    /**
     * Handle file operation (track created/modified files)
     */
    async onFileOperation(stepId, operation, filePath, result) {
        if (!this.currentSession) {
            return;
        }
        
        try {
            const stepEntityName = `step_${this.currentSession}_${stepId}`;
            const fileEntityName = `file_${this.normalizeName(filePath)}`;
            
            // Create or update file entity
            const graph = await this.memory.readGraph();
            const fileExists = graph.entities.find(e => e.name === fileEntityName);
            
            if (!fileExists) {
                await this.memory.createEntities({ entities: [{
                    name: fileEntityName,
                    entityType: 'project_file',
                    observations: [
                        `Path: ${filePath}`,
                        `First seen: ${new Date().toISOString()}`,
                        `Created by: ${stepId}`
                    ]
                }] });
            }
            
            // Add operation observation
            await this.memory.addObservations({ observations: [{
                entityName: fileEntityName,
                contents: [
                    `Operation: ${operation}`,
                    `Step: ${stepId}`,
                    `Result: ${result ? 'success' : 'failed'}`,
                    `Timestamp: ${new Date().toISOString()}`
                ]
            }] });
            
            // Create relation
            await this.memory.createRelations({ relations: [{
                from: stepEntityName,
                to: fileEntityName,
                relationType: operation === 'create' ? 'created_file' : 'modified_file'
            }] });
            
            console.log(`🧠 [NightOrdersMemory] File operation tracked: ${operation} ${filePath}`);
            
        } catch (error) {
            console.error('❌ [NightOrdersMemory] Failed to track file operation:', error.message);
        }
    }
    
    /**
     * End current session
     */
    async endSession(summary) {
        if (!this.currentSession) {
            console.warn('⚠️ [NightOrdersMemory] No active session to end');
            return;
        }
        
        try {
            // Add final observations to session
            await this.memory.addObservations({ observations: [{
                entityName: this.currentSession,
                contents: [
                    `Status: completed`,
                    `Ended: ${new Date().toISOString()}`,
                    `Summary: ${summary || 'Mission completed'}`,
                    `Total steps: ${this.stepCache.size}`
                ]
            }] });
            
            console.log(`🧠 [NightOrdersMemory] Session ended: ${this.currentSession}`);
            
            // Clear state
            this.stepCache.clear();
            const sessionId = this.currentSession;
            this.currentSession = null;
            this.currentMission = null;
            
            return sessionId;
            
        } catch (error) {
            console.error('❌ [NightOrdersMemory] Failed to end session:', error.message);
            throw error;
        }
    }
    
    /**
     * Query past sessions for a mission
     */
    async getPastSessions(missionName) {
        try {
            const results = await this.memory.searchNodes(missionName);
            return results.filter(e => e.entityType === 'night_orders_session');
        } catch (error) {
            console.error('❌ [NightOrdersMemory] Failed to query past sessions:', error.message);
            return [];
        }
    }
    
    /**
     * Get statistics
     */
    async getStats() {
        try {
            const stats = await this.memory.getStats();
            const graph = await this.memory.readGraph();
            
            const sessions = graph.entities.filter(e => e.entityType === 'night_orders_session');
            const steps = graph.entities.filter(e => e.entityType === 'night_orders_step');
            const errors = graph.entities.filter(e => e.entityType === 'execution_error');
            const files = graph.entities.filter(e => e.entityType === 'project_file');
            
            return {
                ...stats,
                sessions: sessions.length,
                steps: steps.length,
                errors: errors.length,
                files: files.length,
                currentSession: this.currentSession
            };
        } catch (error) {
            console.error('❌ [NightOrdersMemory] Failed to get stats:', error.message);
            return null;
        }
    }
    
    /**
     * Normalize entity names (remove special chars)
     */
    normalizeName(name) {
        return name
            .replace(/[^a-zA-Z0-9_\-\.\/]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
}

// Export
module.exports = { NightOrdersMemory };

