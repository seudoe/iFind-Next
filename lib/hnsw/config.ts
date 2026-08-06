/**
 * HNSW Configuration
 * 
 * Centralized configuration for HNSW vector indices.
 * Phase 3: Infrastructure only, not yet used by recommendation engine.
 */

import type { HNSWConfig } from './types';
import path from 'path';

/**
 * HNSW Index configurations for different use cases
 */
export const HNSW_CONFIGS = {
  /**
   * Configuration for internship vectors
   * Optimized for ~1M internships with 768-dimensional BERT vectors
   */
  internships: {
    M: 16,                    // Balanced connections
    efConstruction: 200,      // Good quality index
    efSearch: 50,             // Fast search
    dimensions: 768,          // BERT embedding size
    metric: 'cosine' as const, // Cosine similarity for text embeddings
  } satisfies HNSWConfig,

  /**
   * Configuration for user resume vectors
   * Optimized for ~500K users with 768-dimensional BERT vectors
   */
  users: {
    M: 16,
    efConstruction: 200,
    efSearch: 50,
    dimensions: 768,
    metric: 'cosine' as const,
  } satisfies HNSWConfig,

  /**
   * High-performance configuration
   * Better recall, slower search, more memory
   */
  highPerformance: {
    M: 32,
    efConstruction: 400,
    efSearch: 100,
    dimensions: 768,
    metric: 'cosine' as const,
  } satisfies HNSWConfig,

  /**
   * Memory-efficient configuration
   * Lower memory usage, faster search, slightly lower recall
   */
  memoryEfficient: {
    M: 8,
    efConstruction: 100,
    efSearch: 30,
    dimensions: 768,
    metric: 'cosine' as const,
  } satisfies HNSWConfig,
} as const;

/**
 * Index storage paths
 */
export const HNSW_PATHS = {
  /**
   * Base directory for all HNSW indices
   */
  baseDir: path.join(process.cwd(), 'data', 'hnsw'),

  /**
   * Internship vectors index
   */
  internships: path.join(process.cwd(), 'data', 'hnsw', 'internships'),

  /**
   * User resume vectors index
   */
  users: path.join(process.cwd(), 'data', 'hnsw', 'users'),
} as const;

/**
 * HNSW feature flags
 * Control which HNSW features are enabled
 */
export const HNSW_FEATURES = {
  /**
   * Enable HNSW index for internships
   * Phase 3: true (infrastructure ready)
   * Will be used in Phase 4 when integrated with recommendation engine
   */
  enableInternshipIndex: true,

  /**
   * Enable HNSW index for users
   * Phase 3: false (not needed for current recommendation flow)
   */
  enableUserIndex: false,

  /**
   * Enable automatic index rebuilding
   * Phase 3: false (manual control preferred during testing)
   */
  enableAutoRebuild: false,

  /**
   * Enable index persistence to disk
   * Phase 3: true (save/load from disk)
   */
  enablePersistence: true,
} as const;

/**
 * Performance tuning parameters
 */
export const HNSW_PERFORMANCE = {
  /**
   * Batch size for bulk operations
   */
  batchSize: 1000,

  /**
   * Number of search results to retrieve (K)
   * This is the initial candidate set before re-ranking
   */
  searchK: 100,

  /**
   * Maximum number of vectors in memory before forcing persistence
   */
  maxVectorsInMemory: 100_000,
} as const;
