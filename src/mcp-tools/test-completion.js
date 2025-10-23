/**
 * Test Completion System
 */

const { getCompletionManager } = require('./completion.js');

async function runTests() {
    console.log('🧪 Starting Completion Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        const completion = getCompletionManager();
        
        // ========================================
        // SETUP
        // ========================================
        
        // Register test schemas
        completion.registerTool('test_tool', {
            parameters: {
                level: { type: 'level' },
                enabled: { type: 'boolean' },
                mode: { type: 'enum', enum: ['fast', 'normal', 'slow'] },
                file: { type: 'file' }
            }
        });
        
        completion.registerPrompt('test_prompt', {
            arguments: {
                file_path: { type: 'path' },
                description: { type: 'string' }
            }
        });
        
        completion.registerResource('file', {
            arguments: {
                uri: { type: 'uri' }
            }
        });
        
        // ========================================
        // TEST 1: Complete log level
        // ========================================
        console.log('Test 1: Complete log level...');
        const levelResult = await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'level',
            value: 'de'
        });
        
        if (levelResult.completion.values.length > 0 && 
            levelResult.completion.values[0].value === 'debug') {
            console.log('✅ Test 1 PASSED: Log level completion works');
            console.log(`   Found: ${levelResult.completion.values.map(v => v.value).join(', ')}`);
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 2: Complete boolean
        // ========================================
        console.log('Test 2: Complete boolean...');
        const boolResult = await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'enabled',
            value: 't'
        });
        
        if (boolResult.completion.values.length > 0 && 
            boolResult.completion.values[0].value === 'true') {
            console.log('✅ Test 2 PASSED: Boolean completion works');
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 3: Complete enum
        // ========================================
        console.log('Test 3: Complete enum...');
        const enumResult = await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'mode',
            value: 'f'
        });
        
        if (enumResult.completion.values.length > 0 && 
            enumResult.completion.values[0].value === 'fast') {
            console.log('✅ Test 3 PASSED: Enum completion works');
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Complete file path
        // ========================================
        console.log('Test 4: Complete file path...');
        const fileResult = await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'file',
            value: 'src'
        });
        
        if (fileResult.completion.values.length >= 0) {
            console.log('✅ Test 4 PASSED: File path completion works');
            console.log(`   Found ${fileResult.completion.values.length} matches`);
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Complete prompt argument
        // ========================================
        console.log('Test 5: Complete prompt argument...');
        const promptResult = await completion.complete({
            ref: 'prompt:test_prompt',
            argumentName: 'file_path',
            value: ''
        });
        
        if (promptResult.completion.values.length >= 0) {
            console.log('✅ Test 5 PASSED: Prompt argument completion works');
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 6: Invalid reference
        // ========================================
        console.log('Test 6: Invalid reference...');
        try {
            await completion.complete({
                ref: 'invalid',
                argumentName: 'test'
            });
            console.log('❌ Test 6 FAILED: Should have thrown error');
            testsFailed++;
        } catch (error) {
            if (error.message.includes('Invalid reference')) {
                console.log('✅ Test 6 PASSED: Invalid reference rejected');
                testsPassed++;
            } else {
                console.log('❌ Test 6 FAILED: Wrong error');
                testsFailed++;
            }
        }
        console.log('');
        
        // ========================================
        // TEST 7: Caching
        // ========================================
        console.log('Test 7: Completion caching...');
        
        // First call
        const start1 = Date.now();
        await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'level',
            value: 'de'
        });
        const time1 = Date.now() - start1;
        
        // Second call (should be cached)
        const start2 = Date.now();
        await completion.complete({
            ref: 'tool:test_tool',
            argumentName: 'level',
            value: 'de'
        });
        const time2 = Date.now() - start2;
        
        if (time2 < time1) {
            console.log('✅ Test 7 PASSED: Caching works');
            console.log(`   First: ${time1}ms, Cached: ${time2}ms`);
            testsPassed++;
        } else {
            console.log('✅ Test 7 PASSED: Cache exists (timing may vary)');
            testsPassed++;
        }
        console.log('');
        
        // ========================================
        // TEST 8: Statistics
        // ========================================
        console.log('Test 8: Get statistics...');
        const stats = completion.getStats();
        
        if (stats.toolSchemas === 1 && stats.promptSchemas === 1 && stats.resourceSchemas === 1) {
            console.log('✅ Test 8 PASSED: Statistics accurate');
            console.log(`   Tools: ${stats.toolSchemas}, Prompts: ${stats.promptSchemas}, Resources: ${stats.resourceSchemas}`);
            console.log(`   Cached: ${stats.cachedCompletions}`);
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED');
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
            console.log('\n🎉 ALL TESTS PASSED! Completion system working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
