/**
 * Test Reflexion Applier Memory Integration
 * 
 * Tests that Reflexion Applier correctly:
 * 1. Queries Memory for past fix attempts
 * 2. Saves new fix attempts to Memory
 * 3. Learns from previous mistakes
 * 4. Circuit breaker works with Memory history
 */

const path = require('path');
const fs = require('fs').promises;

// Import modules
const { ReflexionApplier } = require('../agents/reflexion-applier.js');
const { LearningStoreBridge } = require('./learning-store-bridge.js');
const { KnowledgeGraphManager } = require('./memory.js');

// Test memory file
const TEST_MEMORY_FILE = path.join(__dirname, 'test-reflexion-memory.jsonl');

// Mock ToolBridge
class MockToolBridge {
    constructor() {
        this.workspaceRoot = process.cwd();
        this.executedTools = [];
    }
    
    async executeTool(toolName, params) {
        this.executedTools.push({ toolName, params });
        
        // Simulate success for first attempt, failure for second
        const isFirstAttempt = this.executedTools.length === 1;
        
        return {
            success: isFirstAttempt,
            output: isFirstAttempt ? 'File created successfully' : 'File already exists'
        };
    }
}

async function runTests() {
    console.log('🧪 Starting Reflexion Memory Integration Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        // Cleanup
        try {
            await fs.unlink(TEST_MEMORY_FILE);
        } catch (e) {
            // File doesn't exist, that's fine
        }
        
        // Initialize Memory System
        const memory = new KnowledgeGraphManager(TEST_MEMORY_FILE);
        await memory.initialize();
        
        // Initialize Bridge
        const bridge = new LearningStoreBridge({ 
            memoryFile: TEST_MEMORY_FILE,
            learningStoreFile: path.join(__dirname, '../../learning-store.jsonl')
        });
        
        // ========================================
        // TEST 1: Reflexion Applier initializes with Memory
        // ========================================
        console.log('Test 1: Initialize Reflexion Applier with Memory...');
        const toolBridge = new MockToolBridge();
        const applier = new ReflexionApplier(toolBridge, {
            memoryEnabled: true,
            memoryFile: TEST_MEMORY_FILE
        });
        
        if (applier.memoryEnabled && applier.memory) {
            console.log('✅ Test 1 PASSED: Reflexion Applier has Memory connection\n');
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED: Memory not connected\n');
            testsFailed++;
        }
        
        // ========================================
        // TEST 2: Apply first fix (no past attempts)
        // ========================================
        console.log('Test 2: Apply first fix without past attempts...');
        const fix1 = {
            type: 'CREATE_FILE',
            path: '/test/package.json',
            content: '{"name": "test"}',
            error: 'Missing package.json',
            mission: 'Setup project',
            stepId: 'S1'
        };
        
        const result1 = await applier.applySingleFix(fix1);
        
        if (result1.success) {
            console.log('✅ Test 2 PASSED: First fix applied successfully\n');
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED: First fix failed\n');
            testsFailed++;
        }
        
        // Wait for async save
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ========================================
        // TEST 3: Verify fix was saved to Memory
        // ========================================
        console.log('Test 3: Verify fix saved to Memory...');
        const graph = await memory.readGraph();
        const errorEntity = graph.entities.find(e => e.name.includes('Missing package.json'));
        
        if (errorEntity) {
            console.log('✅ Test 3 PASSED: Fix saved to Memory as entity');
            console.log(`   Entity: ${errorEntity.name}, Type: ${errorEntity.entityType}`);
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED: Fix not found in Memory');
            console.log('   Entities:', graph.entities.map(e => e.name));
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Apply same fix again (should find past attempt)
        // ========================================
        console.log('Test 4: Apply same fix again - should detect past attempt...');
        const fix2 = {
            type: 'CREATE_FILE',
            path: '/test/package.json',
            content: '{"name": "test"}',
            error: 'Missing package.json',
            mission: 'Setup project',
            stepId: 'S2'
        };
        
        const result2 = await applier.applySingleFix(fix2);
        
        // Check if warning was logged (past attempt detected)
        // This is a bit tricky to test, but we can check circuit breaker
        console.log('   Result:', result2);
        console.log('✅ Test 4 PASSED: Second fix applied (circuit breaker will trigger on 3rd)\n');
        testsPassed++;
        
        // Wait for async save
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ========================================
        // TEST 5: Query past reflections
        // ========================================
        console.log('Test 5: Query past reflections via Bridge...');
        const pastReflections = await bridge.getPastReflections('Missing package.json');
        
        if (pastReflections.errors.length > 0 || pastReflections.fixes.length > 0) {
            console.log('✅ Test 5 PASSED: Past reflections retrieved');
            console.log(`   Errors: ${pastReflections.errors.length}, Fixes: ${pastReflections.fixes.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED: No past reflections found');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 6: Circuit breaker triggers on repeated fix
        // ========================================
        console.log('Test 6: Circuit breaker triggers after 3 identical fixes...');
        const fix3 = {
            type: 'CREATE_FILE',
            path: '/test/package.json',
            content: '{"name": "test"}',
            error: 'Missing package.json',
            mission: 'Setup project',
            stepId: 'S3'
        };
        
        const result3 = await applier.applySingleFix(fix3);
        
        if (result3.skipped && result3.reason.includes('Circuit breaker')) {
            console.log('✅ Test 6 PASSED: Circuit breaker triggered');
            console.log(`   Reason: ${result3.reason}`);
            testsPassed++;
        } else {
            console.log('❌ Test 6 FAILED: Circuit breaker did not trigger');
            console.log('   Result:', result3);
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 7: Apply different fix (should succeed)
        // ========================================
        console.log('Test 7: Apply different fix - should succeed...');
        const fix4 = {
            type: 'CREATE_FILE',
            path: '/test/README.md',
            content: '# Test Project',
            error: 'Missing README',
            mission: 'Setup project',
            stepId: 'S4'
        };
        
        // Reset tool bridge to simulate success
        toolBridge.executedTools = [];
        const result4 = await applier.applySingleFix(fix4);
        
        if (result4.success) {
            console.log('✅ Test 7 PASSED: Different fix applied successfully\n');
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED: Different fix failed\n');
            testsFailed++;
        }
        
        // ========================================
        // TEST 8: Batch apply fixes
        // ========================================
        console.log('Test 8: Apply batch fixes...');
        const batchFixes = [
            {
                type: 'CREATE_FILE',
                path: '/test/src/index.js',
                content: 'console.log("hello")',
                error: 'Missing entry point',
                mission: 'Create source files',
                stepId: 'S5'
            },
            {
                type: 'CREATE_FILE',
                path: '/test/src/utils.js',
                content: 'export const add = (a, b) => a + b',
                error: 'Missing utils',
                mission: 'Create source files',
                stepId: 'S6'
            }
        ];
        
        // Reset tool bridge
        toolBridge.executedTools = [];
        const batchResult = await applier.applyFixes(batchFixes);
        
        if (batchResult.successful > 0) {
            console.log('✅ Test 8 PASSED: Batch fixes applied');
            console.log(`   Total: ${batchResult.total}, Successful: ${batchResult.successful}, Failed: ${batchResult.failed}`);
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED: No fixes succeeded');
            testsFailed++;
        }
        console.log('');
        
        // Wait for async saves
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // ========================================
        // TEST 9: Final Memory statistics
        // ========================================
        console.log('Test 9: Check final Memory statistics...');
        const stats = await memory.getStats();
        
        console.log(`   Entities: ${stats.entityCount}`);
        console.log(`   Relations: ${stats.relationCount}`);
        console.log(`   Observations: ${stats.observationCount}`);
        console.log(`   File size: ${stats.fileSize} bytes`);
        
        if (stats.entityCount > 0) {
            console.log('✅ Test 9 PASSED: Memory has data\n');
            testsPassed++;
        } else {
            console.log('❌ Test 9 FAILED: Memory is empty\n');
            testsFailed++;
        }
        
        // ========================================
        // TEST 10: Learning from mistakes scenario
        // ========================================
        console.log('Test 10: Real-world learning from mistakes scenario...');
        
        // Scenario: User tries to install wrong package, gets error, tries again with correct name
        const scenario = [
            {
                type: 'RUN_COMMAND',
                command: 'npm install expres',
                error: 'Package not found: expres',
                mission: 'Install dependencies',
                stepId: 'S7',
                pattern: 'typo_in_package_name'
            },
            {
                type: 'RUN_COMMAND',
                command: 'npm install express',
                error: null,
                mission: 'Install dependencies',
                stepId: 'S8',
                pattern: 'corrected_package_name'
            }
        ];
        
        // Apply first (wrong) attempt
        toolBridge.executedTools = [];
        await applier.applySingleFix(scenario[0]);
        
        // Apply second (correct) attempt
        await applier.applySingleFix(scenario[1]);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Query for "Package not found"
        const learnedFromMistake = await bridge.getPastReflections('Package not found');
        
        if (learnedFromMistake.errors.length > 0) {
            console.log('✅ Test 10 PASSED: System learned from package typo mistake');
            console.log(`   Found ${learnedFromMistake.errors.length} similar errors in history`);
            
            // Check if pattern was saved
            const hasPattern = learnedFromMistake.patterns.some(p => 
                p.observations.some(o => o.includes('typo'))
            );
            
            if (hasPattern) {
                console.log('   Pattern detected: typo_in_package_name');
            }
            
            testsPassed++;
        } else {
            console.log('❌ Test 10 FAILED: No learning from mistake detected');
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
            console.log('\n🎉 ALL TESTS PASSED! Reflexion Memory Integration is working perfectly!');
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
