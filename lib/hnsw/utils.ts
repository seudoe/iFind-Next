/**
 * HNSW Utilities
 * 
 * Helper functions for HNSW index operations.
 * Phase 3: Infrastructure utilities, not yet used by recommendation engine.
 */

import type { VectorEntry, SearchResult } from './types';

/**
 * Validate vector dimensions
 * 
 * @param vector - Vector to validate
 * @param expectedDimensions - Expected dimensionality
 * @throws Error if dimensions don't match
 */
export function validateVectorDimensions(
  vector: number[],
  expectedDimensions: number
): void {
  if (vector.length !== expectedDimensions) {
    throw new Error(
      `Vector dimension mismatch: expected ${expectedDimensions}, got ${vector.length}`
    );
  }
}

/**
 * Validate that vector is normalized (for cosine similarity)
 * 
 * @param vector - Vector to validate
 * @returns true if vector is normalized (magnitude ~1.0)
 */
export function isVectorNormalized(vector: number[]): boolean {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return Math.abs(magnitude - 1.0) < 0.01; // Allow 1% tolerance
}

/**
 * Normalize a vector (L2 normalization)
 * 
 * @param vector - Vector to normalize
 * @returns Normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return vector.map(() => 0);
  }
  
  return vector.map((val) => val / magnitude);
}

/**
 * Compute cosine similarity between two vectors
 * Assumes vectors are already normalized
 * 
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity (1 = identical, -1 = opposite)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  return dotProduct;
}

/**
 * Convert cosine distance to similarity score
 * 
 * HNSW typically returns distances where lower = more similar
 * This converts to similarity scores where higher = more similar
 * 
 * @param distance - Cosine distance from HNSW (0-2 range)
 * @returns Similarity score (0-1 range, 1 = most similar)
 */
export function distanceToSimilarity(distance: number): number {
  // Cosine distance = 1 - cosine similarity
  // So: similarity = 1 - distance
  return Math.max(0, Math.min(1, 1 - distance));
}

/**
 * Convert similarity score to cosine distance
 * 
 * @param similarity - Similarity score (0-1 range)
 * @returns Cosine distance (0-2 range)
 */
export function similarityToDistance(similarity: number): number {
  return 1 - similarity;
}

/**
 * Filter search results by minimum similarity threshold
 * 
 * @param results - Search results from HNSW
 * @param minSimilarity - Minimum similarity threshold (0-1)
 * @returns Filtered results
 */
export function filterResultsBySimilarity(
  results: SearchResult[],
  minSimilarity: number
): SearchResult[] {
  return results.filter((result) => {
    const similarity = distanceToSimilarity(result.distance);
    return similarity >= minSimilarity;
  });
}

/**
 * Convert search results to similarity scores
 * 
 * @param results - Search results with distances
 * @returns Results with similarity scores added
 */
export function addSimilarityScores(
  results: SearchResult[]
): Array<SearchResult & { similarity: number }> {
  return results.map((result) => ({
    ...result,
    similarity: distanceToSimilarity(result.distance),
  }));
}

/**
 * Batch vectors into chunks for processing
 * 
 * @param vectors - Array of vectors to batch
 * @param batchSize - Size of each batch
 * @returns Array of batches
 */
export function batchVectors<T>(vectors: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  
  for (let i = 0; i < vectors.length; i += batchSize) {
    batches.push(vectors.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * Create a vector entry from components
 * 
 * @param id - Vector ID
 * @param vector - Vector data
 * @param metadata - Optional metadata
 * @returns VectorEntry
 */
export function createVectorEntry(
  id: string,
  vector: number[],
  metadata?: Record<string, any>
): VectorEntry {
  return {
    id,
    vector,
    metadata,
  };
}

/**
 * Merge two vector arrays (TF-IDF + BERT) with weights
 * Useful for creating hybrid vectors
 * 
 * @param tfidfVector - TF-IDF vector
 * @param bertVector - BERT vector
 * @param tfidfWeight - Weight for TF-IDF (0-1)
 * @param bertWeight - Weight for BERT (0-1)
 * @returns Weighted combined vector
 */
export function mergeWeightedVectors(
  tfidfVector: number[],
  bertVector: number[],
  tfidfWeight: number = 0.4,
  bertWeight: number = 0.6
): number[] {
  if (tfidfVector.length !== bertVector.length) {
    throw new Error('Vectors must have same dimensions for merging');
  }

  const merged = new Array(tfidfVector.length);
  
  for (let i = 0; i < tfidfVector.length; i++) {
    merged[i] = tfidfVector[i] * tfidfWeight + bertVector[i] * bertWeight;
  }

  // Normalize the merged vector
  return normalizeVector(merged);
}

/**
 * Calculate index memory usage estimate
 * 
 * @param vectorCount - Number of vectors
 * @param dimensions - Vector dimensionality
 * @param M - HNSW M parameter
 * @returns Estimated memory usage in bytes
 */
export function estimateIndexMemory(
  vectorCount: number,
  dimensions: number,
  M: number
): number {
  // Rough estimate:
  // - Vector storage: vectorCount * dimensions * 4 bytes (float32)
  // - Graph structure: vectorCount * M * 8 bytes (pointers + distances)
  const vectorStorage = vectorCount * dimensions * 4;
  const graphStorage = vectorCount * M * 8;
  
  return vectorStorage + graphStorage;
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Validate vector entry
 * 
 * @param entry - Vector entry to validate
 * @param expectedDimensions - Expected dimensions
 * @throws Error if entry is invalid
 */
export function validateVectorEntry(
  entry: VectorEntry,
  expectedDimensions: number
): void {
  if (!entry.id) {
    throw new Error('Vector entry must have an id');
  }

  if (!entry.vector || !Array.isArray(entry.vector)) {
    throw new Error('Vector entry must have a vector array');
  }

  validateVectorDimensions(entry.vector, expectedDimensions);
}

/**
 * Calculate optimal efSearch value based on K
 * Rule of thumb: efSearch should be >= K and typically 1.5-2x K
 * 
 * @param k - Number of results desired
 * @returns Recommended efSearch value
 */
export function calculateOptimalEfSearch(k: number): number {
  return Math.max(k, Math.ceil(k * 1.5));
}
