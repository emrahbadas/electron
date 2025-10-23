/**
 * Test Night Orders Memory Integration
 * 
 * Tests automatic Memory saving during Night Orders execution.
 */

const path = require('path');
const fs = require('fs').promises;
const { NightOrdersMemory } = require('./night-orders-memory.js');
const { KnowledgeGraphManager } = require('./memory.js');

const TEST_MEMORY_FILE = path.join(__dirname, 'test-night-orders-memory.jsonl');

async function runTests() {
    console.log('🧪 Starting Night Orders Memory Integration Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        // Cleanup
        try {
            await fs.unlink(TEST_MEMORY_FILE);
        } catch (e) {
            // File doesn't exist
        }
        
        // ========================================
        // TEST 1: Initialize Night Orders Memory
        // ========================================
        console.log('Test 1: Initialize Night Orders Memory...');
        const nom = new NightOrdersMemory({ memoryFile: TEST_MEMORY_FILE });
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async init
        
        console.log('✅ Test 1 PASSED: Night Orders Memory initialized\n');
        testsPassed++;
        
        // ========================================
        // TEST 2: Start a session
        // ========================================
        console.log('Test 2: Start Night Orders session...');
        const sessionId = await nom.startSession('Create Blog Platform', {
            mission: 'Create Blog Platform',
            steps: [
                { id: 'S1', tool: 'fs.write', args: { path: 'package.json' } },
                { id: 'S2', tool: 'fs.write', args: { path: 'README.md' } }
            ],
            acceptance: ['build: exit 0', 'lint: pass']
        });
        
        if (sessionId && sessionId.startsWith('session_')) {
            console.log(`✅ Test 2 PASSED: Session started: ${sessionId}\n`);
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED: Invalid session ID\n');
            testsFailed++;
        }
        
        // ========================================
        // TEST 3: Simulate NARRATION_BEFORE event
        // ========================================
        console.log('Test 3: Handle step BEFORE event...');
        await nom.onStepBefore({
            data: {
                stepId: 'S1',
                explain: {
                    goal: 'Create package.json file',
                    rationale: 'Project needs dependency management'
                }
            },
            timestamp: Date.now()
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const memory = new KnowledgeGraphManager(TEST_MEMORY_FILE);
        await memory.initialize();
        const graph = await memory.readGraph();
        
        const stepEntity = graph.entities.find(e => e.name.includes('S1'));
        
        if (stepEntity) {
            console.log('✅ Test 3 PASSED: Step entity created');
            console.log(`   Entity: ${stepEntity.name}`);
            console.log(`   Observations: ${stepEntity.observations.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED: Step entity not found');
            console.log('   Entities:', graph.entities.map(e => e.name));
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Simulate NARRATION_AFTER event
        // ========================================
        console.log('Test 4: Handle step AFTER event...');
        await nom.onStepAfter({
            data: {
                stepId: 'S1',
                summary: 'File created successfully',
                diff: null
            },
            timestamp: Date.now() + 1000
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const graphAfter = await memory.readGraph();
        const stepAfter = graphAfter.entities.find(e => e.name.includes('S1'));
        
        const hasCompletionStatus = stepAfter.observations.some(o => 
            o.includes('Status: completed')
        );
        
        if (hasCompletionStatus) {
            console.log('✅ Test 4 PASSED: Step completion tracked');
            console.log(`   Observations: ${stepAfter.observations.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED: Completion status not found');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Simulate NARRATION_VERIFY event
        // ========================================
        console.log('Test 5: Handle step VERIFY event...');
        await nom.onStepVerify({
            data: {
                stepId: 'S1',
                probes: [
                    { type: 'lint', status: 'pass', target: 'package.json' },
                    { type: 'build', status: 'pass', target: 'package.json' }
                ]
            },
            timestamp: Date.now()
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const graphVerify = await memory.readGraph();
        const stepVerify = graphVerify.entities.find(e => e.name.includes('S1'));
        
        const hasVerification = stepVerify.observations.some(o => 
            o.includes('Verification')
        );
        
        if (hasVerification) {
            console.log('✅ Test 5 PASSED: Verification results saved');
            console.log(`   Total observations: ${stepVerify.observations.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED: No verification observations');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 6: Track file operation
        // ========================================
        console.log('Test 6: Track file operation...');
        await nom.onFileOperation('S1', 'create', '/project/package.json', true);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const graphFile = await memory.readGraph();
        const fileEntity = graphFile.entities.find(e => 
            e.entityType === 'project_file' && e.name.includes('package')
        );
        
        if (fileEntity) {
            console.log('✅ Test 6 PASSED: File entity created');
            console.log(`   File: ${fileEntity.name}`);
            console.log(`   Observations: ${fileEntity.observations.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 6 FAILED: File entity not found');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 7: Check relations
        // ========================================
        console.log('Test 7: Verify entity relations...');
        const graphRelations = await memory.readGraph();
        
        const sessionToMission = graphRelations.relations.find(r => 
            r.relationType === 'belongs_to_mission'
        );
        
        const sessionToStep = graphRelations.relations.find(r => 
            r.relationType === 'contains_step'
        );
        
        const stepToFile = graphRelations.relations.find(r => 
            r.relationType === 'created_file'
        );
        
        if (sessionToMission && sessionToStep && stepToFile) {
            console.log('✅ Test 7 PASSED: All relations created');
            console.log(`   Total relations: ${graphRelations.relations.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED: Missing relations');
            console.log('   Relations:', graphRelations.relations.map(r => r.relationType));
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 8: Handle step error
        // ========================================
        console.log('Test 8: Track step error...');
        await nom.onStepError('S1', new Error('Test error'));
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const graphError = await memory.readGraph();
        const errorEntity = graphError.entities.find(e => 
            e.entityType === 'execution_error'
        );
        
        if (errorEntity) {
            console.log('✅ Test 8 PASSED: Error entity created');
            console.log(`   Error: ${errorEntity.name}`);
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED: Error entity not found');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 9: End session
        // ========================================
        console.log('Test 9: End session...');
        const endedSessionId = await nom.endSession('Mission completed successfully');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (endedSessionId === sessionId) {
            console.log('✅ Test 9 PASSED: Session ended');
            console.log(`   Session: ${endedSessionId}`);
            testsPassed++;
        } else {
            console.log('❌ Test 9 FAILED: Session ID mismatch');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 10: Get statistics
        // ========================================
        console.log('Test 10: Get Memory statistics...');
        const stats = await nom.getStats();
        
        console.log(`   Sessions: ${stats.sessions}`);
        console.log(`   Steps: ${stats.steps}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Files: ${stats.files}`);
        console.log(`   Entities: ${stats.entityCount}`);
        console.log(`   Relations: ${stats.relationCount}`);
        
        if (stats.sessions > 0 && stats.steps > 0) {
            console.log('✅ Test 10 PASSED: Statistics retrieved\n');
            testsPassed++;
        } else {
            console.log('❌ Test 10 FAILED: Invalid statistics\n');
            testsFailed++;
        }
        
        // ========================================
        // TEST 11: Multi-step scenario
        // ========================================
        console.log('Test 11: Full multi-step scenario...');
        
        // Start new session
        const session2 = await nom.startSession('Setup React App', {
            mission: 'Setup React App',
            steps: [
                { id: 'S1', tool: 'fs.write' },
                { id: 'S2', tool: 'fs.write' },
                { id: 'S3', tool: 'run_cmd' }
            ],
            acceptance: ['build: exit 0']
        });
        
        // Execute steps
        for (let i = 1; i <= 3; i++) {
            const stepId = `S${i}`;
            
            // Before
            await nom.onStepBefore({
                data: { stepId, explain: { goal: `Step ${i}`, rationale: 'Test' } },
                timestamp: Date.now()
            });
            
            // After
            await nom.onStepAfter({
                data: { stepId, summary: 'Success', diff: null },
                timestamp: Date.now() + 100
            });
            
            // Verify
            await nom.onStepVerify({
                data: {
                    stepId,
                    probes: [{ type: 'lint', status: 'pass', target: 'test' }]
                },
                timestamp: Date.now()
            });
        }
        
        await nom.endSession('All steps completed');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const finalStats = await nom.getStats();
        
        if (finalStats.sessions >= 2 && finalStats.steps >= 4) {
            console.log('✅ Test 11 PASSED: Multi-step scenario executed');
            console.log(`   Total sessions: ${finalStats.sessions}`);
            console.log(`   Total steps: ${finalStats.steps}`);
            testsPassed++;
        } else {
            console.log('❌ Test 11 FAILED: Scenario incomplete');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // SUMMARY
        // ========================================
        console.log('='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${testsPassed}`);
        console.log(`❌ Failed: ${testsFailed}`);
        console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (testsFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Night Orders Memory Integration is working!');
        } else {
            console.log(`\n⚠️ ${testsFailed} test(s) failed. Review errors above.`);
        }
        
        // Cleanup
        console.log('\n🧹 Cleaning up test files...');
        try {
            await fs.unlink(TEST_MEMORY_FILE);
            console.log('✅ Test files removed');
        } catch (e) {
            console.log('⚠️ Cleanup failed:', e.message);
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
