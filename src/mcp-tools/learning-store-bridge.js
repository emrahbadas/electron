/**
 * 🌉 LEARNING STORE → KNOWLEDGE GRAPH BRIDGE
 * 
 * Migration pipeline between legacy Learning Store and new Memory System.
 * Converts reflections to entities/relations/observations.
 * 
 * Architecture:
 * - Reflection → Error Entity + Fix Entity + Relation
 * - Pattern → Pattern Entity with observation history
 * - Mission → Session Entity with step observations
 * - Bidirectional sync for backwards compatibility
 */

const fs = require('fs').promises;
const path = require('path');
const { KnowledgeGraphManager } = require('./memory.js');

class LearningStoreBridge {
    constructor(options = {}) {
        this.learningDir = options.learningDir || path.join(process.cwd(), 'learn');
        this.reflectionsFile = path.join(this.learningDir, 'reflections.jsonl');
        this.patternsFile = path.join(this.learningDir, 'patterns.json');
        
        // Initialize Knowledge Graph Manager
        const memoryFile = options.memoryFile || path.join(process.cwd(), 'memory.jsonl');
        this.memory = new KnowledgeGraphManager(memoryFile);
        
        console.log('🌉 Learning Store Bridge initialized');
    }
    
    /**
     * Convert a single reflection to Knowledge Graph entities
     * 
     * Maps:
     * - Reflection → Error Entity
     * - Fix → Fix Entity
     * - Pattern → Pattern Entity
     * - Relations: error FIXED_BY fix, error BELONGS_TO pattern
     * 
     * @param {Object} reflection - Learning Store reflection
     * @returns {Promise<Object>} Created entities and relations
     */
    async convertReflectionToKG(reflection) {
        const entities = [];
        const relations = [];
        const observations = [];
        
        // 1. Create Error Entity
        const errorId = `error_${reflection.timestamp}`;
        entities.push({
            name: errorId,
            entityType: 'error',
            observations: [
                `Occurred in mission: ${reflection.mission}`,
                `Step: ${reflection.step}`,
                `Tool: ${reflection.tool}`,
                `Error message: ${reflection.error}`,
                `Root cause: ${reflection.rootCause}`,
                `Timestamp: ${new Date(reflection.timestamp).toISOString()}`
            ]
        });
        
        // 2. Create Fix Entity (if successful)
        if (reflection.result === 'PASS' && reflection.fix) {
            const fixId = `fix_${reflection.timestamp}`;
            entities.push({
                name: fixId,
                entityType: 'fix',
                observations: [
                    `Fix applied: ${reflection.fix}`,
                    `Result: ${reflection.result}`,
                    `Mission: ${reflection.mission}`,
                    `Timestamp: ${new Date(reflection.timestamp).toISOString()}`
                ]
            });
            
            // Relation: error FIXED_BY fix
            relations.push({
                from: errorId,
                to: fixId,
                relationType: 'FIXED_BY'
            });
        }
        
        // 3. Create or link Pattern Entity
        if (reflection.pattern) {
            const patternId = `pattern_${reflection.pattern}`;
            
            // Check if pattern entity already exists
            const graph = await this.memory.readGraph();
            const existingPattern = graph.entities.find(e => e.name === patternId);
            
            if (!existingPattern) {
                // Create new pattern entity
                entities.push({
                    name: patternId,
                    entityType: 'pattern',
                    observations: [
                        `Pattern ID: ${reflection.pattern}`,
                        `Root cause: ${reflection.rootCause}`,
                        `First seen: ${new Date(reflection.timestamp).toISOString()}`
                    ]
                });
            } else {
                // Add observation to existing pattern
                observations.push({
                    entityName: patternId,
                    contents: [
                        `Occurred again in ${reflection.mission} at ${new Date(reflection.timestamp).toISOString()}`
                    ]
                });
            }
            
            // Relation: error BELONGS_TO pattern
            relations.push({
                from: errorId,
                to: patternId,
                relationType: 'BELONGS_TO'
            });
        }
        
        // 4. Create Mission Entity (if not exists)
        const missionId = `mission_${reflection.mission.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const graph = await this.memory.readGraph();
        const existingMission = graph.entities.find(e => e.name === missionId);
        
        if (!existingMission) {
            entities.push({
                name: missionId,
                entityType: 'mission',
                observations: [
                    `Mission: ${reflection.mission}`,
                    `Created: ${new Date(reflection.timestamp).toISOString()}`
                ]
            });
        } else {
            // Add step observation to existing mission
            observations.push({
                entityName: missionId,
                contents: [
                    `Step ${reflection.step} executed at ${new Date(reflection.timestamp).toISOString()}`,
                    `Tool: ${reflection.tool}`,
                    `Result: ${reflection.result}`
                ]
            });
        }
        
        // Relation: mission HAS_ERROR error
        relations.push({
            from: missionId,
            to: errorId,
            relationType: 'HAS_ERROR'
        });
        
        // 5. Save to Knowledge Graph
        const result = {
            entities: [],
            relations: [],
            observations: []
        };
        
        if (entities.length > 0) {
            result.entities = await this.memory.createEntities({ entities });
        }
        
        if (relations.length > 0) {
            result.relations = await this.memory.createRelations({ relations });
        }
        
        if (observations.length > 0) {
            result.observations = await this.memory.addObservations({ observations });
        }
        
        return result;
    }
    
    /**
     * Migrate all Learning Store reflections to Knowledge Graph
     * 
     * @param {Object} options - Migration options
     * @returns {Promise<Object>} Migration statistics
     */
    async migrateAllReflections(options = {}) {
        const { 
            batchSize = 10,
            skipExisting = true,
            dryRun = false 
        } = options;
        
        console.log('🚀 Starting Learning Store → Memory migration...');
        console.log(`Options: batchSize=${batchSize}, skipExisting=${skipExisting}, dryRun=${dryRun}`);
        
        // 1. Load all reflections from JSONL
        const reflections = await this.loadAllReflections();
        console.log(`📚 Loaded ${reflections.length} reflections from Learning Store`);
        
        if (reflections.length === 0) {
            console.log('⚠️ No reflections to migrate');
            return { total: 0, migrated: 0, skipped: 0, errors: 0 };
        }
        
        // 2. Check existing entities if skipExisting
        let existingErrorIds = new Set();
        if (skipExisting) {
            const graph = await this.memory.readGraph();
            existingErrorIds = new Set(
                graph.entities
                    .filter(e => e.entityType === 'error')
                    .map(e => e.name)
            );
            console.log(`🔍 Found ${existingErrorIds.size} existing error entities`);
        }
        
        // 3. Migrate in batches
        const stats = {
            total: reflections.length,
            migrated: 0,
            skipped: 0,
            errors: 0,
            entities: 0,
            relations: 0,
            observations: 0
        };
        
        for (let i = 0; i < reflections.length; i += batchSize) {
            const batch = reflections.slice(i, i + batchSize);
            console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reflections.length / batchSize)} (${batch.length} reflections)`);
            
            for (const reflection of batch) {
                try {
                    const errorId = `error_${reflection.timestamp}`;
                    
                    // Skip if already exists
                    if (skipExisting && existingErrorIds.has(errorId)) {
                        stats.skipped++;
                        console.log(`  ⏭️ Skipped: ${errorId} (already exists)`);
                        continue;
                    }
                    
                    // Convert to KG
                    if (!dryRun) {
                        const result = await this.convertReflectionToKG(reflection);
                        stats.entities += result.entities?.length || 0;
                        stats.relations += result.relations?.length || 0;
                        stats.observations += result.observations?.length || 0;
                    }
                    
                    stats.migrated++;
                    console.log(`  ✅ Migrated: ${errorId} (mission: ${reflection.mission})`);
                    
                } catch (error) {
                    stats.errors++;
                    console.error(`  ❌ Error migrating reflection:`, error.message);
                }
            }
        }
        
        console.log('\n✨ Migration complete!');
        console.log(`📊 Statistics:`);
        console.log(`  - Total reflections: ${stats.total}`);
        console.log(`  - Migrated: ${stats.migrated}`);
        console.log(`  - Skipped: ${stats.skipped}`);
        console.log(`  - Errors: ${stats.errors}`);
        console.log(`  - Entities created: ${stats.entities}`);
        console.log(`  - Relations created: ${stats.relations}`);
        console.log(`  - Observations added: ${stats.observations}`);
        
        return stats;
    }
    
    /**
     * Load all reflections from Learning Store JSONL
     * 
     * @returns {Promise<Array>} All reflections
     */
    async loadAllReflections() {
        try {
            const data = await fs.readFile(this.reflectionsFile, 'utf8');
            const lines = data.trim().split('\n').filter(line => line.length > 0);
            
            const reflections = [];
            for (const line of lines) {
                try {
                    const reflection = JSON.parse(line);
                    reflections.push(reflection);
                } catch (e) {
                    console.error('❌ Invalid JSONL line:', line.substring(0, 50) + '...');
                }
            }
            
            return reflections;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('⚠️ reflections.jsonl not found, returning empty array');
                return [];
            }
            throw error;
        }
    }
    
    /**
     * Query Knowledge Graph for past reflections related to an error
     * 
     * Use this in Reflexion module to avoid repeating mistakes.
     * 
     * @param {string} errorQuery - Error message or pattern to search
     * @returns {Promise<Object>} Related entities and fixes
     */
    async getPastReflections(errorQuery) {
        console.log(`🔍 Searching for past reflections: "${errorQuery}"`);
        
        // Search for related errors
        const searchResult = await this.memory.searchNodes({ query: errorQuery });
        
        // Filter error entities
        const errorEntities = searchResult.entities.filter(e => e.entityType === 'error');
        
        if (errorEntities.length === 0) {
            console.log('ℹ️ No past reflections found');
            return { errors: [], fixes: [], patterns: [] };
        }
        
        // Get full graph to traverse relations
        const graph = await this.memory.readGraph();
        
        // Find related fixes and patterns
        const fixes = [];
        const patterns = [];
        
        for (const errorEntity of errorEntities) {
            // Find FIXED_BY relations
            const fixRelations = graph.relations.filter(
                r => r.from === errorEntity.name && r.relationType === 'FIXED_BY'
            );
            
            for (const rel of fixRelations) {
                const fixEntity = graph.entities.find(e => e.name === rel.to);
                if (fixEntity) {
                    fixes.push(fixEntity);
                }
            }
            
            // Find BELONGS_TO pattern relations
            const patternRelations = graph.relations.filter(
                r => r.from === errorEntity.name && r.relationType === 'BELONGS_TO'
            );
            
            for (const rel of patternRelations) {
                const patternEntity = graph.entities.find(e => e.name === rel.to);
                if (patternEntity && !patterns.some(p => p.name === patternEntity.name)) {
                    patterns.push(patternEntity);
                }
            }
        }
        
        console.log(`✅ Found ${errorEntities.length} errors, ${fixes.length} fixes, ${patterns.length} patterns`);
        
        return {
            errors: errorEntities,
            fixes,
            patterns
        };
    }
    
    /**
     * Get migration statistics
     * 
     * @returns {Promise<Object>} Stats comparing Learning Store and Memory
     */
    async getStats() {
        // Learning Store stats
        const reflections = await this.loadAllReflections();
        const learningStoreStats = {
            totalReflections: reflections.length,
            successfulFixes: reflections.filter(r => r.result === 'PASS').length,
            failedFixes: reflections.filter(r => r.result === 'FAIL').length
        };
        
        // Memory stats
        const memoryStats = await this.memory.getStats();
        const graph = await this.memory.readGraph();
        
        const errorEntities = graph.entities.filter(e => e.entityType === 'error').length;
        const fixEntities = graph.entities.filter(e => e.entityType === 'fix').length;
        const patternEntities = graph.entities.filter(e => e.entityType === 'pattern').length;
        const missionEntities = graph.entities.filter(e => e.entityType === 'mission').length;
        
        return {
            learningStore: learningStoreStats,
            memory: {
                ...memoryStats,
                errorEntities,
                fixEntities,
                patternEntities,
                missionEntities
            }
        };
    }
}

// Export
module.exports = { LearningStoreBridge };
