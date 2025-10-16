/**
 * 🧪 Multi-Edit Tool Test
 * 
 * Test atomic file editing with rollback
 */

const fs = require('fs');
const path = require('path');

// Create test file
const testFile = path.join(__dirname, 'test-multi-edit.txt');
const originalContent = `const oldVar = 'value1';
const anotherVar = 'value2';
console.log(oldVar);
console.log(anotherVar);
console.log(oldVar);`;

fs.writeFileSync(testFile, originalContent, 'utf8');
console.log('📝 Created test file:', testFile);
console.log('Original content:');
console.log(originalContent);
console.log('');

// Simulate executeMultiEdit function
async function executeMultiEdit(filepath, edits) {
    console.log(`✏️ Multi-Edit: ${filepath} (${edits.length} edits)`);

    let currentContent = fs.readFileSync(filepath, 'utf8');
    const originalContent = currentContent;
    const appliedEdits = [];

    try {
        for (let i = 0; i < edits.length; i++) {
            const edit = edits[i];
            const { old_string, new_string, replace_all = false } = edit;

            if (!currentContent.includes(old_string)) {
                throw new Error(
                    `Edit ${i}: old_string not found in file:\n` +
                    `Looking for: ${old_string}`
                );
            }

            if (replace_all) {
                const occurrences = (currentContent.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                currentContent = currentContent.split(old_string).join(new_string);
                console.log(`  ✅ Edit ${i + 1}/${edits.length}: Replaced ${occurrences} occurrences`);
                appliedEdits.push({ index: i, occurrences, type: 'replace_all' });
            } else {
                const index = currentContent.indexOf(old_string);
                currentContent = currentContent.substring(0, index) + 
                                 new_string + 
                                 currentContent.substring(index + old_string.length);
                console.log(`  ✅ Edit ${i + 1}/${edits.length}: Replaced first occurrence`);
                appliedEdits.push({ index: i, occurrences: 1, type: 'replace_first' });
            }
        }

        fs.writeFileSync(filepath, currentContent, 'utf8');
        console.log(`✅ Multi-Edit complete: ${appliedEdits.length} edits applied`);
        
        return { success: true, editsApplied: appliedEdits.length };

    } catch (error) {
        console.error(`❌ Multi-Edit failed, rolling back: ${error.message}`);
        fs.writeFileSync(filepath, originalContent, 'utf8');
        console.log(`🔄 Rollback successful`);
        throw error;
    }
}

// Test 1: Successful multi-edit
console.log('🧪 Test 1: Successful multi-edit');
(async () => {
    try {
        await executeMultiEdit(testFile, [
            { old_string: 'oldVar', new_string: 'newVar', replace_all: true },
            { old_string: 'console.log', new_string: 'console.error', replace_all: true }
        ]);
        
        const result = fs.readFileSync(testFile, 'utf8');
        console.log('\nResult:');
        console.log(result);
        console.log('\n✅ Test 1 PASSED\n');
        
        // Restore for next test
        fs.writeFileSync(testFile, originalContent, 'utf8');
        
    } catch (error) {
        console.log('❌ Test 1 FAILED:', error.message);
    }

    // Test 2: Failed edit with rollback
    console.log('🧪 Test 2: Failed edit with rollback (old_string not found)');
    try {
        await executeMultiEdit(testFile, [
            { old_string: 'oldVar', new_string: 'newVar' },
            { old_string: 'NONEXISTENT', new_string: 'replacement' } // Will fail
        ]);
        console.log('❌ Test 2 FAILED: Should have thrown error');
    } catch (error) {
        console.log('✅ Test 2 PASSED: Error caught and rollback executed');
        
        // Verify rollback
        const content = fs.readFileSync(testFile, 'utf8');
        if (content === originalContent) {
            console.log('✅ Rollback successful: File restored to original state');
        } else {
            console.log('❌ Rollback failed: File content differs');
        }
    }

    // Cleanup
    fs.unlinkSync(testFile);
    console.log('\n🧹 Test file cleaned up');
    console.log('✅ All tests completed!');
})();
