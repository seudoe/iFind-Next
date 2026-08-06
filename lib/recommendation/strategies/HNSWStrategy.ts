/**
 * HNSWStrategy
 * 
 * HNSW-based recommendation strategy.
 * 
 * Strategy:
 * 1. Use HNSW index to retrieve Top K nearest neighbors (fast approximate search)
 * 2. Compute exact cosine similarity only for those K candidates
 * 3. Sort by similarity and return top N recommendations
 * 
 * Complexity: O(log I + K) vs O(I) brute-force
 * Where I = total internships, K = candidate set size (typically 100-500)
 * 
 * Phase 4: Full implementation with HNSW index integration
 */

import type { RecommendationStrategy } from "./RecommendationStrategy";
import type {
  InternshipCandidate,
  UserRecommendationInput,
  RecommendationCandidate,
} from "../types";
import { HNSWIndexManager } from "@/lib/hnsw/HNSWIndexManager";
import { HNSW_PATHS, HNSW_CONFIGS, HNSW_PERFORMANCE } from "@/lib/hnsw/config";
import { computeHybridScore } from "../scoring";
import { globalMetrics } from "@/lib/monitoring/RecommendationMetrics";

export class HNSWStrategy implements RecommendationStrategy {
  readonly name = "HNSW";

  private tfidfWeight: number;
  private bertWeight: number;
  private indexManager: HNSWIndexManager | null = null;
  private indexInitialized: boolean = false;
  private candidateK: number;

  /**
   * Create HNSW strategy
   * 
   * @param tfidfWeight - Weight for TF-IDF similarity (default: 0.4)
   * @param bertWeight - Weight for BERT similarity (default: 0.6)
   * @param candidateK - Number of candidates to retrieve from HNSW (default: 100)
   */
  constructor(
    tfidfWeight: number = 0.4,
    bertWeight: number = 0.6,
    candidateK?: number
  ) {
    this.tfidfWeight = tfidfWeight;
    this.bertWeight = bertWeight;
    this.candidateK = candidateK ?? HNSW_PERFORMANCE.searchK;
  }

  /**
   * Initialize HNSW index manager
   * Called lazily on first use
   */
  private async ensureIndexInitialized(): Promise<void> {
    if (this.indexInitialized) {
      return;
    }

    try {
      // Create index manager
      this.indexManager = new HNSWIndexManager(
        HNSW_PATHS.internships,
        HNSW_CONFIGS.internships
      );

      // Try to load existing index
      const loaded = await this.indexManager.loadIndex();

      if (!loaded) {
        console.warn(
          "⚠️  HNSW index not found. " +
          "Falling back to in-memory index built from candidates. " +
          "Run index builder script to create persistent index."
        );
        // Index will be built from candidates in computeRecommendations
      }

      this.indexInitialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize HNSW index:", error);
      throw new Error(
        `HNSW index initialization failed. Use BruteForceStrategy as fallback. Error: ${error}`
      );
    }
  }

  /**
   * Build in-memory index from candidates
   * Used as fallback when persistent index is not available
   */
  private async buildIndexFromCandidates(
    candidates: InternshipCandidate[]
  ): Promise<void> {
    if (!this.indexManager) {
      throw new Error("Index manager not initialized");
    }

    console.log(`📦 Building in-memory HNSW index from ${candidates.length} candidates...`);

    // Check if index already has vectors
    const stats = await this.indexManager.getStats();
    if (stats.vectorCount > 0) {
      console.log(`✅ Index already has ${stats.vectorCount} vectors, skipping rebuild`);
      return;
    }

    // Initialize if needed
    await this.indexManager.initialize();

    // Convert candidates to vector entries
    // We'll use BERT vectors for HNSW search as they typically have better semantic quality
    const vectorEntries = candidates.map((candidate) => ({
      id: candidate.id.toString(),
      vector: candidate.vectors.bertVector,
      metadata: {
        name: candidate.name,
      },
    }));

    // Insert in batches
    await this.indexManager.insertVectorsBatch(vectorEntries);

    console.log(`✅ In-memory index built with ${vectorEntries.length} vectors`);
  }

  /**
   * Compute recommendations using HNSW search
   * 
   * Flow:
   * 1. Ensure HNSW index is initialized
   * 2. Search HNSW index for Top K nearest neighbors (using BERT vectors)
   * 3. Map HNSW results back to candidate objects
   * 4. Compute exact hybrid similarity scores (TF-IDF + BERT)
   * 5. Filter by threshold
   * 6. Sort descending by score
   * 7. Take top N
   * 8. Round scores to 3 decimals
   * 
   * @param user - User with vectors
   * @param candidates - All internship candidates (used for fallback or exact scoring)
   * @param topN - Number of recommendations to return
   * @param threshold - Minimum similarity threshold
   * @returns Sorted recommendations
   */
  async computeRecommendations(
    user: UserRecommendationInput,
    candidates: InternshipCandidate[],
    topN: number,
    threshold: number
  ): Promise<RecommendationCandidate[]> {
    // Initialize index if needed
    await this.ensureIndexInitialized();

    if (!this.indexManager) {
      throw new Error("HNSW index manager not available");
    }

    // Build index from candidates if empty (fallback)
    const stats = await this.indexManager.getStats();
    if (stats.vectorCount === 0) {
      await this.buildIndexFromCandidates(candidates);
    }

    // Use BERT vector for HNSW search (typically better semantic quality)
    const queryVector = user.vectors.bertVector;

    // Determine how many candidates to retrieve
    // Retrieve more candidates than needed to account for filtering
    const retrievalK = Math.min(
      Math.max(this.candidateK, topN * 5), // At least 5x topN
      candidates.length // But not more than total candidates
    );

    try {
      // Step 1: HNSW approximate search - retrieve Top K nearest neighbors
      const searchStartTime = Date.now();
      const hnswResults = await this.indexManager.searchKNN(queryVector, retrievalK);
      const searchLatency = Date.now() - searchStartTime;
      globalMetrics.recordSearch(searchLatency);

      if (hnswResults.length === 0) {
        console.warn("⚠️  HNSW search returned no results");
        return [];
      }

      // Step 2: Map HNSW result IDs back to candidate objects
      const candidateMap = new Map(
        candidates.map((c) => [c.id.toString(), c])
      );

      const retrievedCandidates = hnswResults
        .map((result) => candidateMap.get(result.id))
        .filter((c): c is InternshipCandidate => c !== undefined);

      if (retrievedCandidates.length === 0) {
        console.warn("⚠️  No candidates found matching HNSW results");
        return [];
      }

      // Step 3: Compute exact hybrid scores for retrieved candidates only
      const scored: RecommendationCandidate[] = retrievedCandidates.map((candidate) => ({
        id: candidate.id,
        score: computeHybridScore(
          user.vectors,
          candidate.vectors,
          this.tfidfWeight,
          this.bertWeight
        ),
      }));

      // Step 4: Filter by threshold, sort descending, take top N, round scores
      const recommendations = scored
        .filter((s) => s.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((s) => ({
          id: s.id,
          score: Math.round(s.score * 1000) / 1000, // Round to 3 decimal places
        }));

      // Update index metrics
      const stats = await this.indexManager.getStats();
      globalMetrics.updateIndexSize(stats.sizeInBytes ?? 0, stats.vectorCount);

      return recommendations;

    } catch (error) {
      console.error("❌ HNSW search failed:", error);
      console.warn("⚠️  Falling back to brute-force for this request");
      
      // Fallback: use brute-force on all candidates
      const { BruteForceStrategy } = await import("./BruteForceStrategy");
      const fallback = new BruteForceStrategy(this.tfidfWeight, this.bertWeight);
      return await fallback.computeRecommendations(user, candidates, topN, threshold);
    }
  }

  /**
   * Get the underlying index manager (for advanced operations)
   */
  getIndexManager(): HNSWIndexManager | null {
    return this.indexManager;
  }

  /**
   * Set the candidate retrieval size
   */
  setCandidateK(k: number): void {
    this.candidateK = k;
  }

  /**
   * Get current candidate retrieval size
   */
  getCandidateK(): number {
    return this.candidateK;
  }
}
