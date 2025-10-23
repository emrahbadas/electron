/**
 * Test suite for MCP Resources endpoints
 */

const { ResourceManager } = require('./resources');
const path = require('path');

// Test workspace root
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

async function testResourcesEndpoint() {
  console.log('🧪 Testing MCP Resources Endpoint\n');

  const manager = new ResourceManager(WORKSPACE_ROOT);

  // Test 1: resources/list
  console.log('📋 Test 1: resources/list');
  try {
    const result = await manager.list();
    console.log(`✅ Found ${result.resources.length} resources`);
    console.log(`   Pagination: ${result.nextCursor ? 'Has more' : 'No more'}`);
    
    // Show first 5 resources
    console.log('   First 5 resources:');
    result.resources.slice(0, 5).forEach(r => {
      console.log(`   - ${r.uri}`);
      console.log(`     Name: ${r.name}`);
      console.log(`     MIME: ${r.mimeType}`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ resources/list failed:', error.message);
  }

  // Test 2: resources/read (file://)
  console.log('📖 Test 2: resources/read (file://)');
  try {
    const packageJsonPath = path.join(WORKSPACE_ROOT, 'package.json');
    const result = await manager.read({ uri: `file://${packageJsonPath}` });
    console.log(`✅ Read ${result.contents[0].uri}`);
    console.log(`   MIME: ${result.contents[0].mimeType}`);
    console.log(`   Size: ${result.contents[0].text.length} bytes`);
    console.log('');
  } catch (error) {
    console.error('❌ resources/read (file) failed:', error.message);
  }

  // Test 3: resources/read (git://)
  console.log('🔀 Test 3: resources/read (git://)');
  try {
    const result = await manager.read({ uri: 'git://status' });
    console.log(`✅ Read ${result.contents[0].uri}`);
    console.log(`   Content:\n${result.contents[0].text.slice(0, 200)}...`);
    console.log('');
  } catch (error) {
    console.error('❌ resources/read (git) failed:', error.message);
  }

  // Test 4: resources/subscribe
  console.log('👁️ Test 4: resources/subscribe');
  try {
    const testUri = `file://${path.join(WORKSPACE_ROOT, 'README.md')}`;
    const result = await manager.subscribe({ uri: testUri });
    console.log(`✅ Subscribed to ${testUri}`);
    console.log(`   Subscriber ID: ${result.subscriberId}`);
    console.log('');

    // Test 5: resources/unsubscribe
    console.log('🚫 Test 5: resources/unsubscribe');
    await manager.unsubscribe({ uri: testUri, subscriberId: result.subscriberId });
    console.log(`✅ Unsubscribed from ${testUri}`);
    console.log('');
  } catch (error) {
    console.error('❌ resources/subscribe/unsubscribe failed:', error.message);
  }

  // Test 6: Pagination
  console.log('📄 Test 6: Pagination');
  try {
    const page1 = await manager.list();
    console.log(`✅ Page 1: ${page1.resources.length} items`);
    
    if (page1.nextCursor) {
      const page2 = await manager.list({ cursor: page1.nextCursor });
      console.log(`✅ Page 2: ${page2.resources.length} items`);
      console.log(`   Has more: ${page2.nextCursor ? 'Yes' : 'No'}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Pagination failed:', error.message);
  }

  // Test 7: Invalid URI
  console.log('⚠️ Test 7: Invalid URI (should fail gracefully)');
  try {
    await manager.read({ uri: 'invalid://bad/uri' });
    console.error('❌ Should have thrown error for invalid URI');
  } catch (error) {
    console.log(`✅ Correctly rejected invalid URI: ${error.message}`);
  }
  console.log('');

  console.log('🎉 All tests completed!\n');
}

// Run tests
testResourcesEndpoint().catch(console.error);
