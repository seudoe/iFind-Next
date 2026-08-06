/**
 * HNSW Index Manager Types
 * 
 * Type definitions for HNSW vector index operations.
 * Phase 3: Infrastructure only, not yet integrated with recommendation engine.
 */

/**
 * Configuration for HNSW index
 */
export interface HNSWConfig {
  /**
   * Maximum number of connections per node (M parameter)
   * Higher values = better recall, more memory
   * Typical values: 12-48
   */
  M: number;

  /**
   * Size of dynamic candidate list during construction (efConstruction)
   * Higher values = better quality index, slower construction
   * Typical values: 100-500
   */
  efConstruction: number;

  /**
   * Size of dynamic candidate list during search (efSearch)
   * Higher values = better recall, slower search
   * Typical values: 50-500
   */
  efSearch: number;

  /**
   * Vector dimensionality
   */
  dimensions: number;

  /**
   * Distance metric
   */
  metric: 'cosine' | 'euclidean' | 'dotProduct';
}

/**
 * Vector data with metadata
 */
export interface VectorEntry {
  /**
   * Unique identifier for this vector
   */
  id: string;

  /**
   * Vector data (must match dimensions in config)
   */
  vector: number[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Search result from HNSW index
 */
export interface SearchResult {
  /**
   * ID of the matched vector
   */
  id: string;

  /**
   * Distance/similarity score
   * For cosine: 0 = identical, 2 = opposite
   * For euclidean: 0 = identical, higher = more distant
   */
  distance: number;

  /**
   * Optional metadata from the vector entry
   */
  metadata?: Record<string, any>;
}

/**
 * Statistics about the HNSW index
 */
export interface IndexStats {
  /**
   * Number of vectors in index
   */
  vectorCount: number;

  /**
   * Vector dimensionality
   */
  dimensions: number;

  /**
   * Index configuration
   */
  config: HNSWConfig;

  /**
   * Size in bytes (if available)
   */
  sizeInBytes?: number;

  /**
   * Last updated timestamp
   */
  lastUpdated?: Date;
}

/**
 * Options for saving/loading index
 */
export interface IndexPersistenceOptions {
  /**
   * File path to save/load index
   */
  path: string;

  /**
   * Whether to compress the index
   */
  compress?: boolean;
}

/**
 * Batch insert/delete operations
 */
export interface BatchOperation {
  type: 'insert' | 'delete';
  entries?: VectorEntry[];  // For insert
  ids?: string[];           // For delete
}
