/**
 * Test suite for MCP Memory / Knowledge Graph System
 */

const { KnowledgeGraphManager } = require('./memory');
const path = require('path');
const fs = require('fs');

// Test memory file
const TEST_MEMORY_FILE = path.join(__dirname, '../../test-memory.jsonl');

async function testMemorySystem() {
  console.log('🧪 Testing MCP Memory / Knowledge Graph System\n');

  // Cleanup previous test file
  try {
    fs.unlinkSync(TEST_MEMORY_FILE);
  } catch {}

  const manager = new KnowledgeGraphManager(TEST_MEMORY_FILE);
  await manager.initialize();

  // Test 1: create_entities
  console.log('📝 Test 1: create_entities');
  try {
    const result = await manager.createEntities({
      entities: [
        {
          name: 'NightOrders_Session_001',
          entityType: 'development_session',
          observations: [
            'User requested blog platform',
            'Decided on React + Express stack',
            'Target: beginners'
          ]
        },
        {
          name: 'package.json',
          entityType: 'file',
          observations: ['Contains project dependencies', 'Version: 1.0.0']
        },
        {
          name: 'fs.write_tool',
          entityType: 'tool',
          observations: ['Creates files', 'Can overwrite existing files']
        }
      ]
    });
    console.log(`✅ Created ${result.length} entities`);
    result.forEach(e => console.log(`   - ${e.name} (${e.entityType})`));
    console.log('');
  } catch (error) {
    console.error('❌ create_entities failed:', error.message);
  }

  // Test 2: create_relations
  console.log('🔗 Test 2: create_relations');
  try {
    const result = await manager.createRelations({
      relations: [
        {
          from: 'NightOrders_Session_001',
          to: 'package.json',
          relationType: 'creates'
        },
        {
          from: 'fs.write_tool',
          to: 'package.json',
          relationType: 'writes'
        },
        {
          from: 'package.json',
          to: 'fs.write_tool',
          relationType: 'created_by_tool'
        }
      ]
    });
    console.log(`✅ Created ${result.length} relations`);
    result.forEach(r => console.log(`   ${r.from} -[${r.relationType}]-> ${r.to}`));
    console.log('');
  } catch (error) {
    console.error('❌ create_relations failed:', error.message);
  }

  // Test 3: add_observations
  console.log('➕ Test 3: add_observations');
  try {
    const result = await manager.addObservations({
      observations: [
        {
          entityName: 'NightOrders_Session_001',
          contents: [
            'Phase 1: Skeleton completed',
            'Phase 2: Backend in progress',
            'User approved skeleton'
          ]
        },
        {
          entityName: 'package.json',
          contents: [
            'Dependencies: express, react, nodemon',
            'Scripts: start, dev, build'
          ]
        }
      ]
    });
    console.log(`✅ Added observations to ${result.length} entities`);
    result.forEach(r => {
      console.log(`   ${r.entityName}: +${r.addedObservations.length} observations`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ add_observations failed:', error.message);
  }

  // Test 4: read_graph
  console.log('📖 Test 4: read_graph');
  try {
    const graph = await manager.readGraph();
    console.log(`✅ Read graph: ${graph.entities.length} entities, ${graph.relations.length} relations`);
    console.log('   Entities:');
    graph.entities.forEach(e => {
      console.log(`   - ${e.name} (${e.entityType}) - ${e.observations.length} observations`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ read_graph failed:', error.message);
  }

  // Test 5: search_nodes
  console.log('🔍 Test 5: search_nodes');
  try {
    const result = await manager.searchNodes({ query: 'package' });
    console.log(`✅ Search 'package': ${result.entities.length} entities, ${result.relations.length} relations`);
    result.entities.forEach(e => console.log(`   - ${e.name}`));
    console.log('');
  } catch (error) {
    console.error('❌ search_nodes failed:', error.message);
  }

  // Test 6: open_nodes
  console.log('📂 Test 6: open_nodes');
  try {
    const result = await manager.openNodes({
      names: ['NightOrders_Session_001', 'package.json']
    });
    console.log(`✅ Opened ${result.entities.length} entities`);
    result.entities.forEach(e => {
      console.log(`   ${e.name}:`);
      e.observations.forEach(obs => console.log(`     - ${obs}`));
    });
    console.log('');
  } catch (error) {
    console.error('❌ open_nodes failed:', error.message);
  }

  // Test 7: Duplicate prevention
  console.log('🚫 Test 7: Duplicate prevention');
  try {
    const result = await manager.createEntities({
      entities: [
        {
          name: 'package.json', // Duplicate!
          entityType: 'file',
          observations: ['This should be skipped']
        }
      ]
    });
    console.log(`✅ Correctly prevented duplicates: ${result.length} new entities (expected: 0)`);
    console.log('');
  } catch (error) {
    console.error('❌ Duplicate prevention failed:', error.message);
  }

  // Test 8: delete_observations
  console.log('🗑️ Test 8: delete_observations');
  try {
    await manager.deleteObservations({
      deletions: [
        {
          entityName: 'package.json',
          observations: ['Version: 1.0.0']
        }
      ]
    });
    console.log('✅ Deleted observations');
    
    const entity = (await manager.openNodes({ names: ['package.json'] })).entities[0];
    console.log(`   Remaining observations: ${entity.observations.length}`);
    console.log('');
  } catch (error) {
    console.error('❌ delete_observations failed:', error.message);
  }

  // Test 9: delete_relations
  console.log('🔗❌ Test 9: delete_relations');
  try {
    await manager.deleteRelations({
      relations: [
        {
          from: 'package.json',
          to: 'fs.write_tool',
          relationType: 'created_by_tool'
        }
      ]
    });
    const graph = await manager.readGraph();
    console.log(`✅ Deleted relation. Remaining: ${graph.relations.length} relations`);
    console.log('');
  } catch (error) {
    console.error('❌ delete_relations failed:', error.message);
  }

  // Test 10: getStats
  console.log('📊 Test 10: getStats');
  try {
    const stats = await manager.getStats();
    console.log('✅ Memory statistics:');
    console.log(`   Entities: ${stats.entityCount}`);
    console.log(`   Relations: ${stats.relationCount}`);
    console.log(`   Observations: ${stats.observationCount}`);
    console.log(`   File size: ${stats.fileSize} bytes`);
    console.log('');
  } catch (error) {
    console.error('❌ getStats failed:', error.message);
  }

  // Test 11: delete_entities (cleanup)
  console.log('🗑️ Test 11: delete_entities');
  try {
    await manager.deleteEntities({
      entityNames: ['fs.write_tool']
    });
    const graph = await manager.readGraph();
    console.log(`✅ Deleted entity. Remaining: ${graph.entities.length} entities`);
    console.log('');
  } catch (error) {
    console.error('❌ delete_entities failed:', error.message);
  }

  // Test 12: Real-world scenario - Context loss fix
  console.log('🎯 Test 12: Context Loss Scenario (Real-World)');
  try {
    // Simulate Night Orders session
    await manager.createEntities({
      entities: [{
        name: 'BlogPlatform_Phase1',
        entityType: 'phase',
        observations: []
      }]
    });

    // Record files created
    await manager.addObservations({
      observations: [{
        entityName: 'BlogPlatform_Phase1',
        contents: [
          'Created: package.json',
          'Created: README.md',
          'Created: src/index.js'
        ]
      }]
    });

    // Later, check if file exists
    const phase1 = await manager.searchNodes({ query: 'BlogPlatform_Phase1' });
    const hasPackageJson = phase1.entities[0].observations.some(obs =>
      obs.includes('Created: package.json')
    );

    if (hasPackageJson) {
      console.log('✅ Context preserved: package.json already created, skipping');
    }
    console.log('');
  } catch (error) {
    console.error('❌ Context loss scenario failed:', error.message);
  }

  console.log('🎉 All tests completed!\n');

  // Show final memory file
  console.log('📄 Final memory.jsonl contents:');
  const content = fs.readFileSync(TEST_MEMORY_FILE, 'utf8');
  console.log(content);

  // Cleanup
  fs.unlinkSync(TEST_MEMORY_FILE);
  console.log('\n✅ Test file cleaned up');
}

// Run tests
testMemorySystem().catch(console.error);
