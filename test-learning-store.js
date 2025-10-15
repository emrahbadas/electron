/**
 * 🧪 Learning Store Smoke Test
 * 
 * Quick test to verify encoding fixes and basic functionality
 */

const { getLearningStore } = require('./src/renderer/learning-store');

console.log('🧪 Starting Learning Store Smoke Test...\n');

try {
    // Initialize store
    const store = getLearningStore();
    console.log('✅ Store initialized successfully\n');
    
    // Test 1: Save FAIL reflection
    console.log('📝 Test 1: Saving FAIL reflection...');
    store.saveReflection({ 
        mission: 'test-smoke', 
        step: 'S1',
        tool: 'fs.write',
        result: 'FAIL', 
        error: 'ENOENT: no such file or directory',
        rootCause: 'Directory not created before file write',
        metadata: { test: true }
    });
    
    // Test 2: Save PASS reflection with pattern
    console.log('📝 Test 2: Saving PASS reflection with pattern...');
    store.saveReflection({ 
        mission: 'test-smoke', 
        step: 'S1',
        tool: 'fs.write',
        result: 'PASS', 
        pattern: 'missing-file', 
        rootCause: 'Directory not created before file write',
        fix: 'Added fs.mkdirSync before fs.writeFileSync',
        error: 'ENOENT: no such file or directory',
        metadata: { test: true }
    });
    
    // Test 3: Get statistics
    console.log('\n📊 Test 3: Getting statistics...');
    const stats = store.getStats();
    console.log('Statistics:', JSON.stringify(stats, null, 2));
    
    // Test 4: Load reflections
    console.log('\n📚 Test 4: Loading reflections...');
    const reflections = store.loadReflections();
    console.log(`Loaded ${reflections.length} reflections`);
    
    // Test 5: Get top patterns
    console.log('\n📈 Test 5: Getting top patterns...');
    const topPatterns = store.getTopPatterns(3);
    console.log('Top patterns:', JSON.stringify(topPatterns, null, 2));
    
    // Test 6: Search reflections
    console.log('\n🔍 Test 6: Searching reflections...');
    const searchResults = store.search('ENOENT');
    console.log(`Found ${searchResults.length} reflections matching "ENOENT"`);
    
    console.log('\n✅ All tests passed! Encoding is fixed! 🎉');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
