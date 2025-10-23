/**
 * Test Prompts Implementation
 */

const { PromptsManager } = require('./prompts.js');

async function runTests() {
    console.log('🧪 Starting Prompts Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        const prompts = new PromptsManager();
        
        // ========================================
        // TEST 1: List all prompts
        // ========================================
        console.log('Test 1: List all prompts...');
        const listResult = await prompts.list();
        
        if (listResult.prompts && listResult.prompts.length > 0) {
            console.log(`✅ Test 1 PASSED: Found ${listResult.prompts.length} prompts`);
            console.log(`   Prompts: ${listResult.prompts.map(p => p.name).join(', ')}`);
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED: No prompts found');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 2: Get Night Orders prompt
        // ========================================
        console.log('Test 2: Get Night Orders prompt...');
        const nightOrders = await prompts.get({
            name: 'night_orders',
            arguments: {
                mission: 'Create a blog platform',
                context: 'Using React and Node.js',
                acceptance: 'build: exit 0, lint: pass'
            }
        });
        
        if (nightOrders.messages && nightOrders.messages[0].content.text.includes('Night Orders')) {
            console.log('✅ Test 2 PASSED: Night Orders prompt generated');
            console.log(`   Length: ${nightOrders.messages[0].content.text.length} chars`);
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED: Invalid prompt content');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 3: Get Refactor Plan prompt
        // ========================================
        console.log('Test 3: Get Refactor Plan prompt...');
        const refactorPlan = await prompts.get({
            name: 'refactor_plan',
            arguments: {
                file_path: '/src/app.js',
                issues: 'Duplicate code, poor naming, missing error handling'
            }
        });
        
        if (refactorPlan.messages[0].content.text.includes('Refactoring Plan')) {
            console.log('✅ Test 3 PASSED: Refactor Plan prompt generated');
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Get Repair Plan prompt
        // ========================================
        console.log('Test 4: Get Repair Plan prompt...');
        const repairPlan = await prompts.get({
            name: 'repair_plan',
            arguments: {
                error_message: 'TypeError: Cannot read property "length" of undefined',
                file_path: '/src/utils.js'
            }
        });
        
        if (repairPlan.messages[0].content.text.includes('Error Repair')) {
            console.log('✅ Test 4 PASSED: Repair Plan prompt generated');
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Missing required argument
        // ========================================
        console.log('Test 5: Missing required argument validation...');
        try {
            await prompts.get({
                name: 'night_orders',
                arguments: {} // Missing required 'mission'
            });
            console.log('❌ Test 5 FAILED: Should have thrown error');
            testsFailed++;
        } catch (error) {
            if (error.message.includes('Missing required argument')) {
                console.log('✅ Test 5 PASSED: Required argument validation works');
                testsPassed++;
            } else {
                console.log('❌ Test 5 FAILED: Wrong error type');
                testsFailed++;
            }
        }
        console.log('');
        
        // ========================================
        // TEST 6: Unknown prompt
        // ========================================
        console.log('Test 6: Unknown prompt handling...');
        try {
            await prompts.get({
                name: 'unknown_prompt',
                arguments: {}
            });
            console.log('❌ Test 6 FAILED: Should have thrown error');
            testsFailed++;
        } catch (error) {
            if (error.message.includes('Prompt not found')) {
                console.log('✅ Test 6 PASSED: Unknown prompt detected');
                testsPassed++;
            } else {
                console.log('❌ Test 6 FAILED: Wrong error type');
                testsFailed++;
            }
        }
        console.log('');
        
        // ========================================
        // TEST 7: All prompt templates
        // ========================================
        console.log('Test 7: Generate all prompt templates...');
        const allPrompts = ['night_orders', 'refactor_plan', 'repair_plan', 
                           'code_review', 'test_generation', 'architecture_design'];
        
        let allGenerated = true;
        for (const promptName of allPrompts) {
            try {
                const args = {};
                // Set required args based on prompt
                switch (promptName) {
                    case 'night_orders':
                        args.mission = 'Test mission';
                        break;
                    case 'refactor_plan':
                        args.file_path = '/test.js';
                        args.issues = 'Test issues';
                        break;
                    case 'repair_plan':
                        args.error_message = 'Test error';
                        break;
                    case 'code_review':
                        args.file_path = '/test.js';
                        break;
                    case 'test_generation':
                        args.file_path = '/test.js';
                        break;
                    case 'architecture_design':
                        args.feature_description = 'Test feature';
                        break;
                }
                
                await prompts.get({ name: promptName, arguments: args });
            } catch (error) {
                console.log(`   ❌ Failed to generate: ${promptName}`);
                allGenerated = false;
            }
        }
        
        if (allGenerated) {
            console.log('✅ Test 7 PASSED: All prompt templates work');
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED: Some templates failed');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 8: Pagination
        // ========================================
        console.log('Test 8: Pagination support...');
        const page1 = await prompts.list({ cursor: '0' });
        
        if (page1.prompts.length > 0) {
            console.log('✅ Test 8 PASSED: Pagination works');
            console.log(`   Page 1: ${page1.prompts.length} prompts`);
            console.log(`   Next cursor: ${page1.nextCursor || 'none'}`);
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
            console.log('\n🎉 ALL TESTS PASSED! Prompts system is working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
