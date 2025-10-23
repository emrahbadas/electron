/**
 * Test Sequential Thinking
 */

const { getSequentialThinking } = require('./sequential-thinking.js');

async function runTests() {
    console.log('🧪 Starting Sequential Thinking Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        const thinking = getSequentialThinking();
        
        // ========================================
        // TEST 1: Start session
        // ========================================
        console.log('Test 1: Start thinking session...');
        
        const sessionResult = await thinking.startSession({
            problem: 'How to optimize database queries?'
        });
        
        const sessionId = sessionResult.sessionId;
        
        if (sessionResult.success && sessionId) {
            console.log('✅ Test 1 PASSED: Session started');
            console.log(`   Session ID: ${sessionId}`);
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 2: Add thoughts
        // ========================================
        console.log('Test 2: Add thoughts to chain...');
        
        await thinking.addThought({
            sessionId,
            content: 'First, analyze current query patterns',
            type: 'analysis'
        });
        
        await thinking.addThought({
            sessionId,
            content: 'Hypothesis: Adding indexes will improve performance',
            type: 'hypothesis',
            confidence: 0.8
        });
        
        const thought3 = await thinking.addThought({
            sessionId,
            content: 'Verify by running EXPLAIN on slow queries',
            type: 'verification'
        });
        
        if (thought3.success && thought3.chainLength === 3) {
            console.log('✅ Test 2 PASSED: Thoughts added');
            console.log(`   Chain length: ${thought3.chainLength}`);
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 3: Create branch
        // ========================================
        console.log('Test 3: Create reasoning branch...');
        
        const branchResult = await thinking.createBranch({
            sessionId,
            fromThoughtIndex: 1,
            branchReason: 'Explore alternative: caching strategy'
        });
        
        if (branchResult.success && branchResult.branchId) {
            console.log('✅ Test 3 PASSED: Branch created');
            console.log(`   Branch ID: ${branchResult.branchId}`);
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Add to branch
        // ========================================
        console.log('Test 4: Add thoughts to branch...');
        
        const branchThought = await thinking.addToBranch({
            sessionId,
            branchId: branchResult.branchId,
            content: 'Cache frequently accessed data in Redis',
            type: 'hypothesis'
        });
        
        if (branchThought.success) {
            console.log('✅ Test 4 PASSED: Branch thought added');
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Revise thought
        // ========================================
        console.log('Test 5: Revise thought...');
        
        const reviseResult = await thinking.reviseThought({
            sessionId,
            thoughtIndex: 0,
            newContent: 'First, analyze current query patterns AND measure baseline performance',
            revisionReason: 'Added baseline measurement step'
        });
        
        if (reviseResult.success) {
            console.log('✅ Test 5 PASSED: Thought revised');
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 6: Get chain
        // ========================================
        console.log('Test 6: Get thinking chain...');
        
        const chainResult = await thinking.getChain({ sessionId });
        
        if (chainResult.success && chainResult.session.thoughts.length > 0) {
            console.log('✅ Test 6 PASSED: Chain retrieved');
            console.log(`   Thoughts: ${chainResult.session.thoughts.length}`);
            console.log(`   Branches: ${chainResult.session.branches.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 6 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 7: Visualize
        // ========================================
        console.log('Test 7: Visualize thinking chain...');
        
        const visualResult = await thinking.visualize({ sessionId });
        
        if (visualResult.success && visualResult.visual) {
            console.log('✅ Test 7 PASSED: Visualization generated');
            console.log(visualResult.visual);
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 8: End session
        // ========================================
        console.log('Test 8: End thinking session...');
        
        const endResult = await thinking.endSession({
            sessionId,
            conclusion: 'Combine indexing + caching for optimal performance'
        });
        
        if (endResult.success && endResult.conclusion) {
            console.log('✅ Test 8 PASSED: Session ended');
            console.log(`   Conclusion: ${endResult.conclusion}`);
            console.log(`   Duration: ${endResult.duration}ms`);
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 9: Statistics
        // ========================================
        console.log('Test 9: Get statistics...');
        
        const stats = thinking.getStats();
        
        if (stats.totalThoughts > 0) {
            console.log('✅ Test 9 PASSED: Statistics available');
            console.log(`   Total thoughts: ${stats.totalThoughts}`);
            console.log(`   Completed sessions: ${stats.completedSessions}`);
            testsPassed++;
        } else {
            console.log('❌ Test 9 FAILED');
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
            console.log('\n🎉 ALL TESTS PASSED! Sequential thinking working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
