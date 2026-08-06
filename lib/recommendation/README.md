# Recommendation Service

A reusable service layer for generating personalized internship recommendations using hybrid TF-IDF + BERT vector similarity.

## Overview

This service encapsulates all recommendation logic, making it easy to:
- Generate recommendations from any part of the application
- Test recommendation logic in isolation
- Swap algorithms (e.g., brute-force → HNSW) without changing client code

## Architecture

```
recommendation/
├── types.ts        - TypeScript interfaces and types
├── scoring.ts      - Vector similarity functions
├── engine.ts       - Main RecommendationEngine class
├── index.ts        - Public API exports
└── README.md       - This file
```

## Quick Start

### Basic Usage

```typescript
import { RecommendationEngine } from '@/lib/recommendation';

// Create engine with default config
const engine = new RecommendationEngine();

// Generate recommendations for a user
const result = await engine.generateAndSaveRecommendations(userId);

if (result) {
  console.log(`Generated ${result.recommendations.length} recommendations`);
}
```

### Custom Configuration

```typescript
const engine = new RecommendationEngine({
  topN: 10,           // Return top 10 recommendations
  threshold: 0.2,     // Minimum similarity score
  tfidfWeight: 0.3,   // TF-IDF weight (30%)
  bertWeight: 0.7     // BERT weight (70%)
});
```

## API Reference

### RecommendationEngine

The main class for generating recommendations.

#### Constructor

```typescript
new RecommendationEngine(config?: RecommendationConfig)
```

**Parameters:**
- `config` (optional) - Configuration object:
  - `topN?: number` - Number of recommendations to return (default: 20)
  - `threshold?: number` - Minimum similarity score (default: 0.1)
  - `tfidfWeight?: number` - TF-IDF weight in hybrid score (default: 0.4)
  - `bertWeight?: number` - BERT weight in hybrid score (default: 0.6)

#### Methods

##### `loadInternshipCandidates()`

Loads all active internships with vectors from the database.

```typescript
async loadInternshipCandidates(): Promise<InternshipCandidate[]>
```

**Returns:** Array of internship candidates with vector data

**Example:**
```typescript
const candidates = await engine.loadInternshipCandidates();
console.log(`Loaded ${candidates.length} internships`);
```

##### `computeUserRecommendations()`

Computes recommendations for a single user (pure function - no DB access).

```typescript
computeUserRecommendations(
  user: UserRecommendationInput,
  candidates: InternshipCandidate[]
): RecommendationResult
```

**Parameters:**
- `user` - User data including vectors
- `candidates` - Array of internship candidates to score

**Returns:** Recommendation result with top-N candidates

**Example:**
```typescript
const result = engine.computeUserRecommendations(
  {
    userId: 'user123',
    vectors: {
      tfidfVector: [/* 768 dimensions */],
      bertVector: [/* 768 dimensions */]
    }
  },
  candidates
);
```

##### `generateRecommendationsForUser()`

Generates recommendations by loading user vectors and computing scores.

```typescript
async generateRecommendationsForUser(
  userId: string
): Promise<RecommendationResult | null>
```

**Parameters:**
- `userId` - User ID

**Returns:** Recommendation result or null if user has no vectors

**Example:**
```typescript
const result = await engine.generateRecommendationsForUser('user123');
if (result) {
  console.log(`Score: ${result.recommendations[0].score}`);
}
```

##### `saveRecommendations()`

Saves recommendation result to user document in database.

```typescript
async saveRecommendations(result: RecommendationResult): Promise<void>
```

**Parameters:**
- `result` - Recommendation result to save

**Example:**
```typescript
await engine.saveRecommendations(result);
```

##### `generateAndSaveRecommendations()`

Convenience method that generates and saves in one call.

```typescript
async generateAndSaveRecommendations(
  userId: string
): Promise<RecommendationResult | null>
```

**Parameters:**
- `userId` - User ID

**Returns:** Recommendation result or null

**Example:**
```typescript
const result = await engine.generateAndSaveRecommendations('user123');
```

##### `getStoredRecommendations()`

Fetches previously computed recommendations from database.

```typescript
async getStoredRecommendations(
  userId: string
): Promise<RecommendationCandidate[] | null>
```

**Parameters:**
- `userId` - User ID

**Returns:** Array of recommendation candidates or null if none found

**Example:**
```typescript
const stored = await engine.getStoredRecommendations('user123');
if (stored) {
  console.log(`Found ${stored.length} stored recommendations`);
}
```

### Scoring Functions

Pure functions for computing vector similarity.

#### `dotProduct()`

Computes dot product of two vectors.

```typescript
dotProduct(a: number[], b: number[]): number
```

For L2-normalized vectors, dot product equals cosine similarity.

**Example:**
```typescript
import { dotProduct } from '@/lib/recommendation';

const similarity = dotProduct(
  [0.1, 0.2, 0.3],
  [0.2, 0.3, 0.4]
);
```

#### `computeHybridScore()`

Computes hybrid similarity score between user and internship vectors.

```typescript
computeHybridScore(
  userVectors: VectorData,
  internshipVectors: VectorData,
  tfidfWeight?: number,
  bertWeight?: number
): number
```

**Formula:**
```
score = dot(user.tfidf, intern.tfidf) × tfidfWeight
      + dot(user.bert, intern.bert) × bertWeight
```

**Default weights:** TF-IDF = 0.4, BERT = 0.6

**Example:**
```typescript
import { computeHybridScore } from '@/lib/recommendation';

const score = computeHybridScore(
  {
    tfidfVector: userTfidf,
    bertVector: userBert
  },
  {
    tfidfVector: internTfidf,
    bertVector: internBert
  },
  0.4, // TF-IDF weight
  0.6  // BERT weight
);
```

## Types

### VectorData

```typescript
interface VectorData {
  tfidfVector: number[];  // 768-dimensional TF-IDF vector
  bertVector: number[];   // 768-dimensional BERT vector
}
```

### RecommendationCandidate

```typescript
interface RecommendationCandidate {
  id: string | any;  // Internship ID
  score: number;     // Similarity score (0-1, rounded to 3 decimals)
}
```

### RecommendationResult

```typescript
interface RecommendationResult {
  userId: string | any;
  recommendations: RecommendationCandidate[];
  updatedAt: Date;
  metadata?: {
    totalCandidates: number;
    processedCandidates: number;
    threshold: number;
    topN: number;
  };
}
```

### RecommendationConfig

```typescript
interface RecommendationConfig {
  topN?: number;        // Default: 20
  threshold?: number;   // Default: 0.1
  tfidfWeight?: number; // Default: 0.4
  bertWeight?: number;  // Default: 0.6
}
```

## Usage Examples

### In API Routes

```typescript
import { NextResponse } from 'next/server';
import { RecommendationEngine } from '@/lib/recommendation';
import Internship from '@/models/Internship';

export async function GET(req: Request) {
  const userId = getUserIdFromSession(req);
  
  const engine = new RecommendationEngine({ topN: 6 });
  const recommendations = await engine.getStoredRecommendations(userId);
  
  if (recommendations && recommendations.length > 0) {
    const internshipIds = recommendations.map(r => r.id);
    const internships = await Internship.find({ _id: { $in: internshipIds } });
    
    return NextResponse.json({
      success: true,
      data: internships
    });
  }
  
  // Fallback logic...
}
```

### In Background Jobs

```typescript
import { RecommendationEngine } from '@/lib/recommendation';

async function updateRecommendations() {
  const engine = new RecommendationEngine();
  
  // Get all users with vectors
  const users = await User.find({ 'resume.tfidf_vector': { $exists: true } });
  
  for (const user of users) {
    await engine.generateAndSaveRecommendations(user._id.toString());
  }
}
```

### In Scripts

```typescript
// scripts/run-recommender.mjs
import { RecommendationEngine } from './lib/recommendation/engine.js';

const engine = new RecommendationEngine({
  topN: 20,
  threshold: 0.1
});

const candidates = await engine.loadInternshipCandidates();

// Process each user...
```

## Algorithm Details

### Current Implementation: Brute-Force

The current implementation uses brute-force O(U × I) comparison:

1. Load all active internships with vectors
2. For each user with vectors:
   - Compute similarity score against every internship
   - Filter by threshold
   - Sort descending
   - Take top N

**Complexity:** O(U × I × 768) where:
- U = number of users
- I = number of internships
- 768 = vector dimensions

### Hybrid Scoring

```
score = dotProduct(user.tfidf, intern.tfidf) × 0.4
      + dotProduct(user.bert, intern.bert) × 0.6
```

**Why hybrid?**
- **TF-IDF** captures exact keyword matches (e.g., "Python", "React")
- **BERT** captures semantic meaning (e.g., "scalable systems" ≈ "infrastructure")
- Weighted combination provides best of both worlds

### Future: HNSW Vector Search

In Phase 2, the brute-force algorithm will be replaced with HNSW (Hierarchical Navigable Small World) graph search:

1. Build HNSW index of internship vectors
2. For each user:
   - Search HNSW for top K nearest neighbors (e.g., K=100)
   - Rerank with exact cosine similarity
   - Take top N

**Complexity:** O(log N + K) per user

This change will be transparent to clients - the `RecommendationEngine` API remains the same.

## Testing

### Unit Tests

```typescript
import { dotProduct, computeHybridScore } from '@/lib/recommendation';

describe('dotProduct', () => {
  it('computes dot product correctly', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('computeHybridScore', () => {
  it('computes hybrid score with default weights', () => {
    const score = computeHybridScore(
      { tfidfVector: [1, 0], bertVector: [0, 1] },
      { tfidfVector: [1, 0], bertVector: [0, 1] }
    );
    expect(score).toBe(1.0); // Perfect match
  });
});
```

### Integration Tests

```typescript
import { RecommendationEngine } from '@/lib/recommendation';

describe('RecommendationEngine', () => {
  it('generates recommendations for user', async () => {
    const engine = new RecommendationEngine();
    const result = await engine.generateRecommendationsForUser('testUser123');
    
    expect(result).not.toBeNull();
    expect(result.recommendations.length).toBeLessThanOrEqual(20);
  });
});
```

## Performance

### Current Performance (Brute-Force)

| Users | Internships | Time per User | Total Time |
|-------|-------------|---------------|------------|
| 1K    | 10K         | ~100ms        | ~2 min     |
| 10K   | 100K        | ~1s           | ~3 hours   |
| 100K  | 1M          | ~10s          | ~12 days   |

### Expected Performance (HNSW - Phase 2)

| Users | Internships | Time per User | Total Time |
|-------|-------------|---------------|------------|
| 1K    | 10K         | ~5ms          | ~5s        |
| 10K   | 100K        | ~10ms         | ~2 min     |
| 100K  | 1M          | ~20ms         | ~30 min    |

## Troubleshooting

### No recommendations generated

**Symptom:** `generateRecommendationsForUser()` returns null

**Causes:**
- User has no vectors (`tfidf_vector` or `bert_vector` missing)
- No active internships with vectors

**Solution:**
1. Run vectorization script: `node scripts/vectorise-all.mjs`
2. Verify user has uploaded and parsed resume
3. Check internships are active and vectorized

### All recommendations below threshold

**Symptom:** `recommendations` array is empty

**Cause:** All similarity scores below threshold (default 0.1)

**Solution:**
- Lower threshold: `new RecommendationEngine({ threshold: 0.05 })`
- Check if vectors are properly normalized
- Verify resume and internships are in same domain

### Script import errors

**Symptom:** `Cannot find module '@/lib/recommendation'`

**Cause:** TypeScript paths not resolved in Node.js

**Solution:**
- Use compiled JavaScript: Build project first
- Use `tsx` or `ts-node`: `tsx scripts/run-recommender.mjs`
- Use relative imports in .mjs files

## Contributing

When modifying the recommendation service:

1. **Preserve behavior** - Update tests to ensure no regressions
2. **Update types** - Keep TypeScript interfaces in sync
3. **Document changes** - Update this README
4. **Test thoroughly** - Test with real data before deploying

## License

Internal use only - DJ Sanghvi College of Engineering
