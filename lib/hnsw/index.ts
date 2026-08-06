/**
 * HNSW Module - Public API
 * 
 * Phase 3: HNSW infrastructure isolated from recommendation engine.
 * This module provides HNSW vector index capabilities but is not yet
 * integrated with the recommendation system.
 */

export { HNSWIndexManager } from './HNSWIndexManager';
export type {
  HNSWConfig,
  VectorEntry,
  SearchResult,
  IndexStats,
  IndexPersistenceOptions,
  BatchOperation,
} from './types';
