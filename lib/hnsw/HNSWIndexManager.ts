/**
 * HNSW Index Manager
 * 
 * Manages HNSW vector index operations for fast nearest neighbor search.
 * Uses Vectra library for HNSW implementation.
 * 
 * Phase 3: Infrastructure only, isolated from recommendation engine.
 * 
 * Features:
 * - Load/save index to disk
 * - Insert/delete vectors
 * - Rebuild index from scratch
 * - K-nearest neighbor search
 * - Index statistics
 */

import { LocalIndex } from 'vectra';
import type {
  HNSWConfig,
  VectorEntry,
  SearchResult,
  IndexStats,
  IndexPersistenceOptions,
  BatchOperation,
} from './types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Default HNSW configuration
 * 
 * Based on typical values for recommendation systems:
 * - M=16: Balanced accuracy/memory tradeoff
 * - efConstruction=200: Good quality index
 * - efSearch=50: Fast search with good recall
 */
const DEFAULT_CONFIG: HNSWConfig = {
  M: 16,
  efConstruction: 200,
  efSearch: 50,
  dimensions: 768, // BERT embedding dimension
  metric: 'cosine',
};

/**
 * HNSW Index Manager
 * 
 * Provides high-level API for HNSW index operations.
 */
export class HNSWIndexManager {
  private index: LocalIndex | null = null;
  private config: HNSWConfig;
  private indexPath: string;
  private vectorMap: Map<string, VectorEntry> = new Map();

  /**
   * Create a new HNSW Index Manager
   * 
   * @param indexPath - Directory path where index will be stored
   * @param config - Optional HNSW configuration (uses defaults if not provided)
   */
  constructor(indexPath: string, config?: Partial<HNSWConfig>) {
    this.indexPath = indexPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the index
   * 
   * Creates a new empty index with configured parameters.
   * Call this before any other operations.
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.indexPath, { recursive: true });

      // Create new index
      this.index = new LocalIndex(this.indexPath);

      // Note: Vectra handles its own configuration internally
      // We store our config for reference and stats
      
      console.log(`✅ HNSW index initialized at: ${this.indexPath}`);
      console.log(`   Dimensions: ${this.config.dimensions}`);
      console.log(`   Metric: ${this.config.metric}`);
    } catch (error) {
      throw new Error(`Failed to initialize HNSW index: ${error}`);
    }
  }

  /**
   * Load an existing index from disk
   * 
   * @param options - Load options (path, compression, etc.)
   * @returns true if loaded successfully, false if no index exists
   */
  async loadIndex(options?: Partial<IndexPersistenceOptions>): Promise<boolean> {
    const loadPath = options?.path || this.indexPath;

    try {
      // Check if index exists
      const indexExists = await this.indexExists(loadPath);
      
      if (!indexExists) {
        console.log(`ℹ️  No existing index found at: ${loadPath}`);
        return false;
      }

      // Load index
      this.index = new LocalIndex(loadPath);

      // Check if index is created
      const isCreated = await this.index.isIndexCreated();
      
      if (!isCreated) {
        console.log(`ℹ️  Index directory exists but not created, initializing...`);
        await this.initialize();
        return false;
      }

      // Rebuild vector map from index
      await this.rebuildVectorMap();

      console.log(`✅ HNSW index loaded from: ${loadPath}`);
      console.log(`   Vectors: ${this.vectorMap.size}`);
      
      return true;
    } catch (error) {
      console.error(`⚠️  Failed to load HNSW index:`, error);
      return false;
    }
  }

  /**
   * Save the index to disk
   * 
   * @param options - Save options (path, compression, etc.)
   */
  async saveIndex(options?: Partial<IndexPersistenceOptions>): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    const savePath = options?.path || this.indexPath;

    try {
      // Vectra automatically persists to disk
      // We just need to ensure the directory exists
      await fs.mkdir(savePath, { recursive: true });

      console.log(`✅ HNSW index saved to: ${savePath}`);
      console.log(`   Vectors: ${this.vectorMap.size}`);
    } catch (error) {
      throw new Error(`Failed to save HNSW index: ${error}`);
    }
  }

  /**
   * Insert a single vector into the index
   * 
   * @param entry - Vector entry with id, vector, and optional metadata
   */
  async insertVector(entry: VectorEntry): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    if (entry.vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.dimensions}, got ${entry.vector.length}`
      );
    }

    try {
      // Add to Vectra index
      await this.index.insertItem({
        id: entry.id,
        vector: entry.vector,
        metadata: entry.metadata || {},
      });

      // Update our vector map
      this.vectorMap.set(entry.id, entry);

      console.log(`✅ Vector inserted: ${entry.id}`);
    } catch (error) {
      throw new Error(`Failed to insert vector ${entry.id}: ${error}`);
    }
  }

  /**
   * Insert multiple vectors in batch
   * 
   * @param entries - Array of vector entries
   */
  async insertVectorsBatch(entries: VectorEntry[]): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    console.log(`📦 Batch inserting ${entries.length} vectors...`);

    let inserted = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        await this.insertVector(entry);
        inserted++;
        
        if (inserted % 100 === 0) {
          process.stdout.write(`\r   Progress: ${inserted}/${entries.length}`);
        }
      } catch (error) {
        errors.push(`${entry.id}: ${error}`);
      }
    }

    console.log(`\n✅ Batch insert complete: ${inserted}/${entries.length} vectors`);
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} errors occurred during batch insert`);
    }
  }

  /**
   * Delete a vector from the index
   * 
   * @param id - ID of vector to delete
   */
  async deleteVector(id: string): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    try {
      // Remove from Vectra index
      await this.index.deleteItem(id);

      // Update our vector map
      this.vectorMap.delete(id);

      console.log(`✅ Vector deleted: ${id}`);
    } catch (error) {
      throw new Error(`Failed to delete vector ${id}: ${error}`);
    }
  }

  /**
   * Delete multiple vectors in batch
   * 
   * @param ids - Array of vector IDs to delete
   */
  async deleteVectorsBatch(ids: string[]): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    console.log(`🗑️  Batch deleting ${ids.length} vectors...`);

    let deleted = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.deleteVector(id);
        deleted++;
      } catch (error) {
        errors.push(`${id}: ${error}`);
      }
    }

    console.log(`✅ Batch delete complete: ${deleted}/${ids.length} vectors`);
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} errors occurred during batch delete`);
    }
  }

  /**
   * Rebuild the entire index from scratch
   * 
   * @param entries - All vectors to include in rebuilt index
   */
  async rebuildIndex(entries: VectorEntry[]): Promise<void> {
    console.log(`🔄 Rebuilding HNSW index with ${entries.length} vectors...`);

    // Clear existing index
    await this.clearIndex();

    // Re-initialize
    await this.initialize();

    // Batch insert all vectors
    await this.insertVectorsBatch(entries);

    console.log(`✅ Index rebuild complete`);
  }

  /**
   * Search for k-nearest neighbors
   * 
   * @param queryVector - Query vector to search for
   * @param k - Number of nearest neighbors to return
   * @returns Array of search results sorted by distance (closest first)
   */
  async searchKNN(queryVector: number[], k: number = 10): Promise<SearchResult[]> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initialize() first.');
    }

    if (queryVector.length !== this.config.dimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.config.dimensions}, got ${queryVector.length}`
      );
    }

    try {
      // Search using Vectra
      const results = await this.index.queryItems(queryVector, k);

      // Convert to our SearchResult format
      return results.map((result) => ({
        id: result.item.id,
        distance: result.score, // Vectra uses score (lower = more similar for cosine)
        metadata: result.item.metadata,
      }));
    } catch (error) {
      throw new Error(`Failed to search index: ${error}`);
    }
  }

  /**
   * Get index statistics
   * 
   * @returns Index statistics and configuration
   */
  async getStats(): Promise<IndexStats> {
    return {
      vectorCount: this.vectorMap.size,
      dimensions: this.config.dimensions,
      config: this.config,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear the entire index
   */
  async clearIndex(): Promise<void> {
    if (!this.index) {
      return;
    }

    try {
      // Clear vector map
      this.vectorMap.clear();

      // Reset index (Vectra doesn't have a clear method, so we'll reinitialize)
      this.index = null;

      console.log(`✅ Index cleared`);
    } catch (error) {
      throw new Error(`Failed to clear index: ${error}`);
    }
  }

  /**
   * Check if index exists at path
   * 
   * @param checkPath - Path to check
   * @returns true if index exists
   */
  private async indexExists(checkPath: string): Promise<boolean> {
    try {
      await fs.access(checkPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rebuild vector map from index
   * (Helper method for loading)
   */
  private async rebuildVectorMap(): Promise<void> {
    if (!this.index) {
      return;
    }

    try {
      // Vectra doesn't provide a way to list all items
      // We'll need to maintain the vector map separately
      // For now, just clear it (will be populated as vectors are accessed)
      this.vectorMap.clear();
    } catch (error) {
      console.warn(`⚠️  Failed to rebuild vector map:`, error);
    }
  }

  /**
   * Get the underlying Vectra index (for advanced use)
   * 
   * @returns The Vectra LocalIndex instance
   */
  getUnderlyingIndex(): LocalIndex | null {
    return this.index;
  }
}
