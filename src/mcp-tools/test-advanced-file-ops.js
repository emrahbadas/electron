/**
 * Test Advanced File Operations
 */

const { getAdvancedFileOps } = require('./advanced-file-ops.js');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('🧪 Starting Advanced File Operations Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    const testDir = path.join(process.cwd(), '.temp', 'advanced-ops-tests');
    
    try {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const ops = getAdvancedFileOps();
        
        // ========================================
        // TEST 1: Read media file (image simulation)
        // ========================================
        console.log('Test 1: Read media file...');
        
        const imageFile = path.join(testDir, 'test.png');
        fs.writeFileSync(imageFile, Buffer.from('fake-png-data'));
        
        const mediaResult = await ops.readMediaFile({
            path: imageFile
        });
        
        if (mediaResult.success && mediaResult.base64) {
            console.log('✅ Test 1 PASSED: Media file read as base64');
            console.log(`   Media type: ${mediaResult.mediaType}`);
            console.log(`   MIME type: ${mediaResult.mimeType}`);
            console.log(`   Size: ${mediaResult.size} bytes`);
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 2: Directory tree
        // ========================================
        console.log('Test 2: Generate directory tree...');
        
        // Create test structure
        const testStructure = path.join(testDir, 'structure');
        fs.mkdirSync(path.join(testStructure, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testStructure, 'src', 'components'));
        fs.writeFileSync(path.join(testStructure, 'package.json'), '{}');
        fs.writeFileSync(path.join(testStructure, 'src', 'index.js'), '');
        fs.writeFileSync(path.join(testStructure, 'src', 'components', 'App.js'), '');
        
        const treeResult = await ops.directoryTree({
            path: testStructure,
            maxDepth: 5
        });
        
        if (treeResult.success && treeResult.tree) {
            console.log('✅ Test 2 PASSED: Directory tree generated');
            console.log(`   Root children: ${treeResult.tree.children.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 3: Read multiple files
        // ========================================
        console.log('Test 3: Read multiple files...');
        
        const file1 = path.join(testDir, 'file1.txt');
        const file2 = path.join(testDir, 'file2.txt');
        const file3 = path.join(testDir, 'nonexistent.txt');
        
        fs.writeFileSync(file1, 'Content 1');
        fs.writeFileSync(file2, 'Content 2');
        
        const multiResult = await ops.readMultipleFiles({
            paths: [file1, file2, file3]
        });
        
        if (multiResult.success && multiResult.succeeded === 2 && multiResult.failed === 1) {
            console.log('✅ Test 3 PASSED: Multiple files read');
            console.log(`   Succeeded: ${multiResult.succeeded}, Failed: ${multiResult.failed}`);
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 4: Head file
        // ========================================
        console.log('Test 4: Head file (first N lines)...');
        
        const headFile = path.join(testDir, 'head.txt');
        const headContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
        fs.writeFileSync(headFile, headContent);
        
        const headResult = await ops.headFile({
            path: headFile,
            lines: 5
        });
        
        if (headResult.success && headResult.linesRead === 5 && headResult.hasMore) {
            console.log('✅ Test 4 PASSED: Head file works');
            console.log(`   Lines read: ${headResult.linesRead}/${headResult.totalLines}`);
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // TEST 5: Tail file
        // ========================================
        console.log('Test 5: Tail file (last N lines)...');
        
        const tailFile = path.join(testDir, 'tail.txt');
        const tailContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
        fs.writeFileSync(tailFile, tailContent);
        
        const tailResult = await ops.tailFile({
            path: tailFile,
            lines: 5
        });
        
        if (tailResult.success && tailResult.linesRead === 5 && tailResult.content.includes('Line 20')) {
            console.log('✅ Test 5 PASSED: Tail file works');
            console.log(`   Lines read: ${tailResult.linesRead}/${tailResult.totalLines}`);
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // CLEANUP
        // ========================================
        console.log('Cleaning up test files...');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        
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
            console.log('\n🎉 ALL TESTS PASSED! Advanced file operations working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
