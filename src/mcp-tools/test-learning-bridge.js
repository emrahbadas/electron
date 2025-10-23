/**
 * 🧪 Learning Store Bridge Test Suite
 * 
 * Tests migration between Learning Store and Knowledge Graph
 */

const path = require('path');
const fs = require('fs').promises;
const { LearningStoreBridge } = require('./learning-store-bridge.js');

// Test helper: Create temp learning store with sample data
async function createTestLearningStore() {
    const testDir = path.join(process.cwd(), 'test-learn');
    const reflectionsFile = path.join(testDir, 'reflections.jsonl');
    
    // Create directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Sample reflections
    const reflections = [
        {
            timestamp: Date.now() - 10000,
            mission: 'Create Blog Platform',
            step: 'S1',
            tool: 'fs.write',
            error: 'ENOENT: package.json not found',
            rootCause: 'Target directory does not exist',
            fix: 'Create directory first with mkdir -p',
            result: 'PASS',
            pattern: 'missing_directory',
            metadata: {}
        },
        {
            timestamp: Date.now() - 5000,
            mission: 'Create Blog Platform',
            step: 'S2',
            tool: 'run_cmd',
            error: 'npm install failed: missing package.json',
            rootCause: 'package.json was not created',
            fix: 'Create package.json before npm install',
            result: 'PASS',
            pattern: 'dependency_order',
            metadata: {}
        },
        {
            timestamp: Date.now() - 2000,
            mission: 'Setup React App',
            step: 'S1',
            tool: 'fs.write',
            error: 'Invalid JSON in package.json',
            rootCause: 'Trailing comma in JSON',
            fix: 'Remove trailing comma from package.json',
            result: 'PASS',
            pattern: 'json_syntax',
            metadata: {}
        }
    ];
    
    // Write JSONL
    const lines = reflections.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(reflectionsFile, lines, 'utf8');
    
    console.log(`✅ Created test Learning Store with ${reflections.length} reflections`);
    
    return { testDir, reflectionsFile, reflections };
}

// Test helper: Cleanup
async function cleanup(testDir, memoryFile) {
    try {
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.unlink(memoryFile);
        console.log('🧹 Cleanup complete');
    } catch (error) {
        // Ignore cleanup errors
    }
}

// Main test runner
async function runTests() {
    console.log('🧪 Starting Learning Store Bridge Tests\n');
    
    let testCount = 0;
    let passCount = 0;
    
    const testMemoryFile = path.join(process.cwd(), 'test-bridge-memory.jsonl');
    let testLearn = null;
    
    try {
        // Setup
        testLearn = await createTestLearningStore();
        
        // Initialize bridge
        const bridge = new LearningStoreBridge({
            learningDir: testLearn.testDir,
            memoryFile: testMemoryFile
        });
        
        // Test 1: Load reflections
        testCount++;
        console.log('Test 1: Load reflections from Learning Store');
        const reflections = await bridge.loadAllReflections();
        if (reflections.length === 3) {
            console.log('✅ PASS - Loaded 3 reflections');
            passCount++;
        } else {
            console.log(`❌ FAIL - Expected 3, got ${reflections.length}`);
        }
        
        // Test 2: Convert single reflection
        testCount++;
        console.log('\nTest 2: Convert single reflection to KG');
        const result = await bridge.convertReflectionToKG(reflections[0]);
        if (result.entities && result.relations) {
            console.log(`✅ PASS - Created ${result.entities.length} entities, ${result.relations.length} relations`);
            console.log(`  Entities: ${result.entities.map(e => e.name).join(', ')}`);
            passCount++;
        } else {
            console.log('❌ FAIL - Conversion failed');
        }
        
        // Test 3: Migrate all reflections
        testCount++;
        console.log('\nTest 3: Migrate all reflections');
        const stats = await bridge.migrateAllReflections({ batchSize: 5 });
        if (stats.migrated === 2 && stats.entities > 0) { // 2 more because 1 already migrated in test 2
            console.log(`✅ PASS - Migrated ${stats.migrated} reflections`);
            console.log(`  Total entities: ${stats.entities}`);
            console.log(`  Total relations: ${stats.relations}`);
            passCount++;
        } else {
            console.log(`❌ FAIL - Expected 2 migrated, got ${stats.migrated}`);
        }
        
        // Test 4: Search past reflections
        testCount++;
        console.log('\nTest 4: Search past reflections');
        const pastReflections = await bridge.getPastReflections('package.json');
        if (pastReflections.errors.length > 0) {
            console.log(`✅ PASS - Found ${pastReflections.errors.length} related errors`);
            console.log(`  Fixes: ${pastReflections.fixes.length}`);
            console.log(`  Patterns: ${pastReflections.patterns.length}`);
            passCount++;
        } else {
            console.log('❌ FAIL - No past reflections found');
        }
        
        // Test 5: Get statistics
        testCount++;
        console.log('\nTest 5: Get migration statistics');
        const bridgeStats = await bridge.getStats();
        console.log('Learning Store:', bridgeStats.learningStore);
        console.log('Memory:', bridgeStats.memory);
        if (bridgeStats.learningStore.totalReflections === 3 && 
            bridgeStats.memory.errorEntities > 0) {
            console.log('✅ PASS - Statistics accurate');
            passCount++;
        } else {
            console.log('❌ FAIL - Statistics mismatch');
        }
        
        // Test 6: Skip existing entities
        testCount++;
        console.log('\nTest 6: Skip existing entities on re-migration');
        const stats2 = await bridge.migrateAllReflections({ skipExisting: true });
        if (stats2.skipped === 3 && stats2.migrated === 0) {
            console.log(`✅ PASS - Skipped ${stats2.skipped} existing entities`);
            passCount++;
        } else {
            console.log(`❌ FAIL - Expected 3 skipped, got ${stats2.skipped}`);
        }
        
        // Test 7: Dry run mode
        testCount++;
        console.log('\nTest 7: Dry run mode');
        const dryRunStats = await bridge.migrateAllReflections({ dryRun: true, skipExisting: false });
        if (dryRunStats.entities === 0 && dryRunStats.relations === 0) {
            console.log('✅ PASS - Dry run did not create entities');
            passCount++;
        } else {
            console.log('❌ FAIL - Dry run created entities');
        }
        
        // Test 8: Pattern entity deduplication
        testCount++;
        console.log('\nTest 8: Pattern entity deduplication');
        const graph = await bridge.memory.readGraph();
        const patterns = graph.entities.filter(e => e.entityType === 'pattern');
        const uniquePatterns = new Set(patterns.map(p => p.name));
        if (patterns.length === uniquePatterns.size) {
            console.log(`✅ PASS - No duplicate patterns (${patterns.length} unique)`);
            passCount++;
        } else {
            console.log(`❌ FAIL - Found duplicate patterns`);
        }
        
        // Test 9: Mission entity consolidation
        testCount++;
        console.log('\nTest 9: Mission entity consolidation');
        const missions = graph.entities.filter(e => e.entityType === 'mission');
        console.log(`Missions found: ${missions.map(m => m.name).join(', ')}`);
        const blogMission = missions.find(m => m.name.includes('Blog_Platform'));
        if (blogMission && blogMission.observations.length > 1) {
            console.log(`✅ PASS - Mission consolidated with ${blogMission.observations.length} observations`);
            passCount++;
        } else {
            console.log('❌ FAIL - Mission not consolidated');
        }
        
        // Test 10: Relation integrity
        testCount++;
        console.log('\nTest 10: Relation integrity check');
        const entityNames = new Set(graph.entities.map(e => e.name));
        const invalidRelations = graph.relations.filter(
            r => !entityNames.has(r.from) || !entityNames.has(r.to)
        );
        if (invalidRelations.length === 0) {
            console.log('✅ PASS - All relations have valid entities');
            passCount++;
        } else {
            console.log(`❌ FAIL - Found ${invalidRelations.length} invalid relations`);
        }
        
        // Summary
        console.log('\n' + '='.repeat(50));
        console.log(`📊 Test Results: ${passCount}/${testCount} passed`);
        console.log('='.repeat(50));
        
        if (passCount === testCount) {
            console.log('🎉 ALL TESTS PASSED!');
        } else {
            console.log(`⚠️ ${testCount - passCount} test(s) failed`);
        }
        
    } catch (error) {
        console.error('❌ Test suite error:', error);
    } finally {
        // Cleanup
        if (testLearn) {
            await cleanup(testLearn.testDir, testMemoryFile);
        }
    }
}

// Run tests
runTests().catch(console.error);
