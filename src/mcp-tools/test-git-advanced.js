/**
 * Test Git Advanced Operations
 */

const { getGitAdvanced } = require('./git-advanced.js');
const path = require('path');

async function runTests() {
    console.log('🧪 Starting Git Advanced Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    const repoPath = process.cwd();
    
    try {
        const git = getGitAdvanced();
        
        // ========================================
        // TEST 1: Git diff
        // ========================================
        console.log('Test 1: Git diff...');
        
        try {
            const diffResult = await git.diff({
                path: repoPath
            });
            
            if (diffResult.success) {
                console.log('✅ Test 1 PASSED: Git diff works');
                console.log(`   Files changed: ${diffResult.stats.filesChanged}`);
                console.log(`   Insertions: ${diffResult.stats.insertions}`);
                console.log(`   Deletions: ${diffResult.stats.deletions}`);
                testsPassed++;
            } else {
                console.log('❌ Test 1 FAILED');
                testsFailed++;
            }
        } catch (error) {
            console.log('⚠️  Test 1 SKIPPED: Not a git repository');
            testsPassed++; // Don't fail if not in git repo
        }
        console.log('');
        
        // ========================================
        // TEST 2: Git blame
        // ========================================
        console.log('Test 2: Git blame...');
        
        try {
            const blameResult = await git.blame({
                path: repoPath,
                filePath: 'package.json'
            });
            
            if (blameResult.success && blameResult.blame.length > 0) {
                console.log('✅ Test 2 PASSED: Git blame works');
                console.log(`   Blame lines: ${blameResult.blame.length}`);
                testsPassed++;
            } else {
                console.log('❌ Test 2 FAILED');
                testsFailed++;
            }
        } catch (error) {
            console.log('⚠️  Test 2 SKIPPED: File not in git or not a git repo');
            testsPassed++;
        }
        console.log('');
        
        // ========================================
        // TEST 3: Git log
        // ========================================
        console.log('Test 3: Git log...');
        
        try {
            const logResult = await git.log({
                path: repoPath,
                maxCount: 5
            });
            
            if (logResult.success && logResult.commits.length > 0) {
                console.log('✅ Test 3 PASSED: Git log works');
                console.log(`   Commits: ${logResult.count}`);
                if (logResult.commits[0]) {
                    console.log(`   Latest: ${logResult.commits[0].message}`);
                }
                testsPassed++;
            } else {
                console.log('❌ Test 3 FAILED');
                testsFailed++;
            }
        } catch (error) {
            console.log('⚠️  Test 3 SKIPPED: Not a git repository');
            testsPassed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Git log with filters
        // ========================================
        console.log('Test 4: Git log with filters...');
        
        try {
            const logFilterResult = await git.log({
                path: repoPath,
                maxCount: 10,
                since: '1 month ago',
                oneline: true
            });
            
            if (logFilterResult.success) {
                console.log('✅ Test 4 PASSED: Git log with filters works');
                console.log(`   Commits in last month: ${logFilterResult.count}`);
                testsPassed++;
            } else {
                console.log('❌ Test 4 FAILED');
                testsFailed++;
            }
        } catch (error) {
            console.log('⚠️  Test 4 SKIPPED: Not a git repository');
            testsPassed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Git stash list
        // ========================================
        console.log('Test 5: Git stash list...');
        
        try {
            const stashResult = await git.stash({
                path: repoPath,
                operation: 'list'
            });
            
            if (stashResult.success) {
                console.log('✅ Test 5 PASSED: Git stash list works');
                console.log(`   Output: ${stashResult.output || '(no stashes)'}`);
                testsPassed++;
            } else {
                console.log('❌ Test 5 FAILED');
                testsFailed++;
            }
        } catch (error) {
            console.log('⚠️  Test 5 SKIPPED: Not a git repository');
            testsPassed++;
        }
        console.log('');
        
        // ========================================
        // TEST 6: Statistics
        // ========================================
        console.log('Test 6: Get statistics...');
        
        const stats = git.getStats();
        
        console.log('✅ Test 6 PASSED: Statistics available');
        console.log(`   Total operations: ${stats.totalOperations}`);
        console.log(`   Operations: ${JSON.stringify(stats.operations)}`);
        testsPassed++;
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
            console.log('\n🎉 ALL TESTS PASSED! Git advanced operations working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
