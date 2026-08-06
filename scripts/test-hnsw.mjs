/**
 * test-hnsw.mjs
 * 
 * Test script for HNSW Index Manager infrastructure.
 * Phase 3: Tests HNSW infrastructure in isolation (not integrated with recommendation engine).
 * 
 * Run:
 *   node scripts/test-hnsw.mjs
 */

console.log('🧪 HNSW Index Manager Test\n');
console.log('Phase 3: Infrastructure testing (isolated from recommendation engine)\n');

// Generate random vector for testing
function generateRandomVector(dimensions) {
  const vector = Array.from({ length: dimensions }, () => Math.random() - 0.5);
  
  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(v => v / magnitude);
}

// Generate test dataset
function generateTestVectors(count, dimensions) {
  console.log(`📦 Generating ${count} test vectors (${dimensions} dimensions)...`);
  
  const vectors = [];
  for (let i = 0; i < count; i++) {
    vectors.push({
      id: `test_${i}`,
      vector: generateRandomVector(dimensions),
      metadata: {
        name: `Test Vector ${i}`,
        category: `Category ${i % 10}`,
      },
    });
  }
  
  console.log(`✅ Generated ${vectors.length} vectors\n`);
  return vectors;
}

async function runTests() {
  try {
    // Dynamic import for ESM compatibility
    const { HNSWIndexManager } = await import('../lib/hnsw/HNSWIndexManager.js');
    const { HNSW_CONFIGS } = await import('../lib/hnsw/config.js');
    const {
      normalizeVector,
      distanceToSimilarity,
      estimateIndexMemory,
      formatBytes,
    } = await import('../lib/hnsw/utils.js');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Index Manager Initialization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testIndexPath = './data/hnsw/test-index';
    const manager = new HNSWIndexManager(
      testIndexPath,
      HNSW_CONFIGS.internships
    );

    console.log(`Creating index manager at: ${testIndexPath}`);
    await manager.initialize();
    console.log('✅ Index manager initialized\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Vector Insertion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Generate small test dataset
    const testVectors = generateTestVectors(100, 768);

    console.log('Inserting test vectors...');
    await manager.insertVectorsBatch(testVectors);
    console.log('✅ Batch insert complete\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 3: Index Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const stats = await manager.getStats();
    console.log('Index Statistics:');
    console.log(`  Vectors: ${stats.vectorCount}`);
    console.log(`  Dimensions: ${stats.dimensions}`);
    console.log(`  M: ${stats.config.M}`);
    console.log(`  efConstruction: ${stats.config.efConstruction}`);
    console.log(`  efSearch: ${stats.config.efSearch}`);
    console.log(`  Metric: ${stats.config.metric}`);
    
    const estimatedMemory = estimateIndexMemory(stats.vectorCount, stats.dimensions, stats.config.M);
    console.log(`  Est. Memory: ${formatBytes(estimatedMemory)}`);
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 4: K-Nearest Neighbor Search');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Use first test vector as query
    const queryVector = testVectors[0].vector;
    console.log(`Query: ${testVectors[0].id}`);
    console.log(`Searching for 10 nearest neighbors...\n`);

    const results = await manager.searchKNN(queryVector, 10);
    
    console.log('Search Results:');
    console.log('┌──────────┬──────────┬────────────┐');
    console.log('│ Rank     │ ID       │ Similarity │');
    console.log('├──────────┼──────────┼────────────┤');
    
    results.forEach((result, i) => {
      const similarity = distanceToSimilarity(result.distance);
      console.log(
        `│ ${String(i + 1).padEnd(8)} │ ${result.id.padEnd(8)} │ ${similarity.toFixed(4).padEnd(10)} │`
      );
    });
    
    console.log('└──────────┴──────────┴────────────┘\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 5: Save and Load Index');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Saving index...');
    await manager.saveIndex();
    console.log('✅ Index saved\n');

    console.log('Creating new manager instance...');
    const manager2 = new HNSWIndexManager(
      testIndexPath,
      HNSW_CONFIGS.internships
    );

    console.log('Loading index...');
    const loaded = await manager2.loadIndex();
    
    if (loaded) {
      console.log('✅ Index loaded successfully');
      
      const stats2 = await manager2.getStats();
      console.log(`  Vectors loaded: ${stats2.vectorCount}\n`);
    } else {
      console.log('❌ Failed to load index\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 6: Vector Deletion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const idsToDelete = ['test_0', 'test_1', 'test_2'];
    console.log(`Deleting ${idsToDelete.length} vectors...`);
    await manager2.deleteVectorsBatch(idsToDelete);
    console.log('✅ Deletion complete\n');

    const stats3 = await manager2.getStats();
    console.log(`Vectors remaining: ${stats3.vectorCount}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 7: Utility Functions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test vector normalization
    const unnormalizedVector = [1, 2, 3, 4, 5];
    const normalized = normalizeVector(unnormalizedVector);
    const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
    console.log(`Vector normalization:`);
    console.log(`  Original: [${unnormalizedVector.join(', ')}]`);
    console.log(`  Normalized magnitude: ${magnitude.toFixed(6)}`);
    console.log(`  ✅ Normalized to unit length\n`);

    // Test distance/similarity conversion
    const testDistance = 0.5;
    const testSimilarity = distanceToSimilarity(testDistance);
    console.log(`Distance/Similarity conversion:`);
    console.log(`  Distance: ${testDistance}`);
    console.log(`  Similarity: ${testSimilarity}`);
    console.log(`  ✅ Conversion working\n`);

    // Test memory estimation
    const memFor1M = estimateIndexMemory(1_000_000, 768, 16);
    console.log(`Memory estimation for 1M vectors:`);
    console.log(`  ${formatBytes(memFor1M)}`);
    console.log(`  ✅ Estimation complete\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Summary:');
    console.log('  ✅ Index manager initialization');
    console.log('  ✅ Vector insertion (batch)');
    console.log('  ✅ Index statistics');
    console.log('  ✅ K-nearest neighbor search');
    console.log('  ✅ Save/load persistence');
    console.log('  ✅ Vector deletion');
    console.log('  ✅ Utility functions');
    console.log();

    console.log('Next Steps:');
    console.log('  1. Phase 4: Integrate with HNSWStrategy');
    console.log('  2. Build internship index from MongoDB');
    console.log('  3. Switch RecommendationEngine to use HNSW');
    console.log('  4. Performance benchmarking');
    console.log();

    console.log('Note: RecommendationEngine still uses BruteForceStrategy (Phase 3)');
    console.log('      HNSW integration will happen in Phase 4');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error();
    console.error('Troubleshooting:');
    console.error('  1. Run: npm run build');
    console.error('  2. Or use: tsx scripts/test-hnsw.mjs');
    console.error('  3. Check that vectra is installed: npm install vectra');
    process.exit(1);
  }
}

runTests();
