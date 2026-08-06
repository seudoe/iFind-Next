# HNSW Index Manager

**Phase 3 Infrastructure** - HNSW vector index management for fast nearest neighbor search.

## Overview

This module provides HNSW (Hierarchical Navigable Small World) index infrastructure for efficient similarity search over large vector collections. In Phase 3, this is **infrastructure only** and is **not yet integrated** with the recommendation engine.

## Current Status

- ✅ **HNSW library installed** (vectra)
- ✅ **Index manager implemented**
- ✅ **Configuration system ready**
- ✅ **Utility functions available**
- ❌ **Not yet used by RecommendationEngine** (still uses BruteForceStrategy)

## Architecture

```
lib/hnsw/
├── HNSWIndexManager.ts    # Main index manager class
├── types.ts               # TypeScript type definitions
├── config.ts              # HNSW configuration
├── utils.ts               # Helper utilities
├── index.ts               # Public API exports
└── README.md              # This file
```

## Features

### Index Operations
- ✅ Load index from disk
- ✅ Save index to disk
- ✅ Insert vectors (single or batch)
- ✅ Delete vectors (single or batch)
- ✅ Rebuild index from scratch
- ✅ K-nearest neighbor search
- ✅ Index statistics

### Configuration
- Multiple preset configs (internships, users, high-performance, memory-efficient)
- Customizable HNSW parameters (M, efConstruction, efSearch)
- Configurable paths and feature flags

### Utilities
- Vector validation and normalization
- Similarity/distance conversions
- Batch processing helpers
- Memory estimation

## Usage Examples

### Basic Usage

```typescript
import { HNSWIndexManager } from '@/lib/hnsw';
import { HNSW_PATHS, HNSW_CONFIGS } from '@/lib/hnsw/config';

// Create index manager
const manager = new HNSWIndexManager(
  HNSW_PATHS.internships,
  HNSW_CONFIGS.internships
);

// Initialize new index
await manager.initialize();

// Insert vectors
await manager.insertVector({
  id: 'internship_123',
  vector: [...768 dimensions...],
  metadata: { name: 'Software Engineering Intern' }
});

// Search for similar vectors
const results = await manager.searchKNN(queryVector, 10);
console.log(results); // Top 10 nearest neighbors
```

### Batch Operations

```typescript
// Batch insert
const vectors = [
  { id: '1', vector: [/* 768 dims */] },
  { id: '2', vector: [/* 768 dims */] },
  // ... more vectors
];

await manager.insertVectorsBatch(vectors);

// Batch delete
await manager.deleteVectorsBatch(['1', '2', '3']);
```

### Save and Load

```typescript
// Save index to disk
await manager.saveIndex();

// Load existing index
const loaded = await manager.loadIndex();
if (loaded) {
  console.log('Index loaded successfully');
} else {
  console.log('No existing index, starting fresh');
}
```

### Rebuild Index

```typescript
// Rebuild entire index
const allVectors = await loadVectorsFromDatabase();
await manager.rebuildIndex(allVectors);
```

## Configuration

### HNSW Parameters

| Parameter | Description | Default | Typical Range |
|-----------|-------------|---------|---------------|
| `M` | Max connections per node | 16 | 12-48 |
| `efConstruction` | Construction quality | 200 | 100-500 |
| `efSearch` | Search quality | 50 | 50-500 |
| `dimensions` | Vector size | 768 | Fixed |
| `metric` | Distance metric | cosine | cosine, euclidean |

### Presets

```typescript
import { HNSW_CONFIGS } from '@/lib/hnsw/config';

// Balanced (default)
HNSW_CONFIGS.internships  // M=16, efC=200, efS=50

// High performance (better recall)
HNSW_CONFIGS.highPerformance  // M=32, efC=400, efS=100

// Memory efficient (faster, less memory)
HNSW_CONFIGS.memoryEfficient  // M=8, efC=100, efS=30
```

## Integration Status

### Phase 3 (Current)
- ✅ HNSW infrastructure built
- ✅ Index manager ready
- ❌ Not integrated with recommendation engine
- ❌ RecommendationEngine still uses BruteForceStrategy

### Phase 4 (Next)
- ⏳ Integrate HNSWStrategy with index manager
- ⏳ Build internship index from database
- ⏳ Switch RecommendationEngine to use HNSW
- ⏳ Performance testing and optimization

## Performance Characteristics

### Brute-Force (Current)
- Complexity: O(N) - compare against all vectors
- Speed: Slow for large N
- Accuracy: Perfect (exact match)

### HNSW (Phase 4)
- Complexity: O(log N) - graph traversal
- Speed: Fast even for large N
- Accuracy: Approximate (99%+ recall typical)

### Expected Speedup
- 10-100x faster for 100K+ vectors
- Sub-second search for millions of vectors
- Scalable to billions with proper tuning

## Memory Estimates

| Vectors | Dimensions | M | Memory Usage |
|---------|------------|---|--------------|
| 10K | 768 | 16 | ~25 MB |
| 100K | 768 | 16 | ~250 MB |
| 1M | 768 | 16 | ~2.5 GB |
| 10M | 768 | 16 | ~25 GB |

## Not Yet Implemented

These features are **NOT** included in Phase 3:

- ❌ Integration with RecommendationEngine
- ❌ HNSWStrategy implementation (still placeholder)
- ❌ Automatic index rebuilding on data changes
- ❌ Index sharding for very large datasets
- ❌ Distributed index management
- ❌ Real-time incremental updates
- ❌ Index versioning and rollback

## Testing

Phase 3 focuses on infrastructure. Test the index manager independently:

```typescript
// Example test
const manager = new HNSWIndexManager('./test-index');
await manager.initialize();

// Insert test vectors
const testVectors = generateRandomVectors(1000, 768);
await manager.insertVectorsBatch(testVectors);

// Search
const query = generateRandomVector(768);
const results = await manager.searchKNN(query, 10);

console.log(`Found ${results.length} results`);
```

## Troubleshooting

### Index not loading
- Check if index directory exists
- Verify file permissions
- Ensure index was properly saved

### Dimension mismatch errors
- All vectors must be 768 dimensions
- Check BERT/TF-IDF vector generation

### Out of memory
- Use memory-efficient config
- Process vectors in smaller batches
- Consider index sharding (Phase 4)

## Next Steps (Phase 4)

1. Implement HNSWStrategy.computeRecommendations()
2. Build internship index from MongoDB
3. Load index on server startup
4. Switch config to use HNSW
5. Performance benchmarking
6. Production deployment

## References

- [HNSW Paper](https://arxiv.org/abs/1603.09320)
- [Vectra Library](https://www.npmjs.com/package/vectra)
- Project: Phase 2 Strategy Pattern (completed)
- Project: Phase 3 HNSW Infrastructure (current)

---

**Phase 3 Status**: Infrastructure complete, not yet integrated with recommendation engine.
