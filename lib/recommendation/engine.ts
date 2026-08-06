/**
 * Recommendation Engine
 * 
 * Core service for generating personalized internship recommendations.
 * Uses pluggable recommendation strategies for flexible algorithm selection.
 * 
 * Phase 2: Strategy pattern introduced
 * - Supports multiple recommendation algorithms via strategy interface
 * - Current strategy: BruteForceStrategy (original O(U × I) algorithm)
 * - Future strategy: HNSWStrategy (Phase 3)
 */

import { connectDB } from "@/lib/db";
import type {
  RecommendationResult,
  RecommendationCandidate,
  InternshipCandidate,
  UserRecommendationInput,
  RecommendationConfig,
} from "./types";
import type { RecommendationStrategy } from "./strategies/RecommendationStrategy";
import { createRecommendationStrategy, RECOMMENDATION_CONFIG } from "./config";
import { RecommendationCache } from "./cache/RecommendationCache";
import { globalMetrics } from "@/lib/monitoring/RecommendationMetrics";

/**
 * Default recommendation configuration
 */
const DEFAULT_CONFIG: Required<RecommendationConfig> = {
  topN: 20,
  threshold: 0.1,
  tfidfWeight: 0.4,
  bertWeight: 0.6,
};

export class RecommendationEngine {
  private config: Required<RecommendationConfig>;
  private strategy: RecommendationStrategy;
  private cache: RecommendationCache;

  /**
   * Create a new RecommendationEngine
   * 
   * @param config - Optional configuration overrides
   * @param strategy - Optional strategy instance (if not provided, uses configured strategy from config.ts)
   */
  constructor(config?: RecommendationConfig, strategy?: RecommendationStrategy) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Use provided strategy, or create from configuration
    this.strategy = strategy ?? createRecommendationStrategy(
      undefined, // Use activeStrategy from RECOMMENDATION_CONFIG
      this.config.tfidfWeight,
      this.config.bertWeight
    );
    
    // Initialize cache
    this.cache = new RecommendationCache();
    
    console.log(`RecommendationEngine initialized with strategy: ${this.strategy.name}`);
  }

  /**
   * Load all active internships with vectors from database
   * 
   * @returns Array of internship candidates with vector data
   */
  async loadInternshipCandidates(): Promise<InternshipCandidate[]> {
    await connectDB();
    const db = (await import("mongoose")).connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    const internships = await db
      .collection("internships")
      .find({ isActive: true })
      .project({ _id: 1, name: 1, tfidf_vector: 1, bert_vector: 1 })
      .toArray();

    // Filter out internships without vectors
    const candidates: InternshipCandidate[] = [];
    
    for (const intern of internships) {
      if (intern.tfidf_vector && intern.bert_vector) {
        candidates.push({
          id: intern._id,
          name: intern.name,
          vectors: {
            tfidfVector: intern.tfidf_vector,
            bertVector: intern.bert_vector,
          },
        });
      }
    }

    return candidates;
  }

  /**
   * Compute recommendations for a single user
   * 
   * Delegates to the configured recommendation strategy.
   * Strategy determines the algorithm (brute-force, HNSW, etc.)
   * 
   * @param user - User data including vectors
   * @param candidates - Array of internship candidates to score
   * @returns Recommendation result with top-N candidates
   */
  async computeUserRecommendations(
    user: UserRecommendationInput,
    candidates: InternshipCandidate[]
  ): Promise<RecommendationResult> {
    // Delegate to strategy
    const recommendations = await this.strategy.computeRecommendations(
      user,
      candidates,
      this.config.topN,
      this.config.threshold
    );

    return {
      userId: user.userId,
      recommendations,
      updatedAt: new Date(),
      metadata: {
        totalCandidates: candidates.length,
        processedCandidates: candidates.length,
        threshold: this.config.threshold,
        topN: this.config.topN,
        strategy: this.strategy.name,
      },
    };
  }

  /**
   * Generate recommendations for a single user
   * 
   * Phase 5: Now uses caching - returns cached results if valid, regenerates only if expired
   * Phase 6: Records metrics for cache hits/misses and generation time
   * 
   * @param userId - User ID to generate recommendations for
   * @returns Recommendation result or null if user has no vectors
   */
  async generateRecommendationsForUser(
    userId: string
  ): Promise<RecommendationResult | null> {
    await connectDB();
    const mongoose = await import("mongoose");
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    // Check cache first
    const cached = await this.cache.get(userId);
    if (cached) {
      console.log(`✅ Cache hit for user ${userId}`);
      globalMetrics.recordCacheHit();
      return {
        userId,
        recommendations: cached,
        updatedAt: new Date(),
        metadata: {
          totalCandidates: 0,
          processedCandidates: 0,
          threshold: this.config.threshold,
          topN: this.config.topN,
          strategy: this.strategy.name,
          cached: true,
        },
      };
    }

    console.log(`⚠️ Cache miss for user ${userId}, generating recommendations...`);
    globalMetrics.recordCacheMiss();

    // Start timing
    const startTime = Date.now();

    // Load user vectors
    const user = await db
      .collection("users")
      .findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { _id: 1, username: 1, "resume.tfidf_vector": 1, "resume.bert_vector": 1 } }
      );

    if (!user || !user.resume?.tfidf_vector || !user.resume?.bert_vector) {
      return null;
    }

    const userInput: UserRecommendationInput = {
      userId: user._id,
      username: user.username,
      vectors: {
        tfidfVector: user.resume.tfidf_vector,
        bertVector: user.resume.bert_vector,
      },
    };

    // Load all internship candidates
    const candidates = await this.loadInternshipCandidates();

    if (candidates.length === 0) {
      return {
        userId: user._id,
        recommendations: [],
        updatedAt: new Date(),
        metadata: {
          totalCandidates: 0,
          processedCandidates: 0,
          threshold: this.config.threshold,
          topN: this.config.topN,
          strategy: this.strategy.name,
        },
      };
    }

    // Compute recommendations
    const result = await this.computeUserRecommendations(userInput, candidates);

    // Record generation time
    const generationTime = Date.now() - startTime;
    globalMetrics.recordGeneration(generationTime);

    return result;
  }

  /**
   * Save recommendations to user document in database
   * 
   * Phase 5: Now also caches recommendations
   * 
   * @param result - Recommendation result to save
   */
  async saveRecommendations(result: RecommendationResult): Promise<void> {
    await connectDB();
    const mongoose = await import("mongoose");
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    // Save to database and cache
    await this.cache.set(
      result.userId.toString(),
      result.recommendations,
      result.metadata
    );
  }

  /**
   * Generate and save recommendations for a single user
   * 
   * @param userId - User ID to generate recommendations for
   * @returns Recommendation result or null if user has no vectors
   */
  async generateAndSaveRecommendations(
    userId: string
  ): Promise<RecommendationResult | null> {
    const result = await this.generateRecommendationsForUser(userId);
    
    if (result) {
      await this.saveRecommendations(result);
    }
    
    return result;
  }

  /**
   * Get stored recommendations for a user from database
   * 
   * @param userId - User ID to fetch recommendations for
   * @returns Array of recommendation candidates or null if none found
   */
  async getStoredRecommendations(
    userId: string
  ): Promise<RecommendationCandidate[] | null> {
    // Try cache first
    const cached = await this.cache.get(userId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    await connectDB();
    const mongoose = await import("mongoose");
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    const user = await db
      .collection("users")
      .findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { recommendedScores: 1 } }
      );

    if (!user || !user.recommendedScores || user.recommendedScores.length === 0) {
      return null;
    }

    return user.recommendedScores;
  }

  /**
   * Get cache instance for advanced operations
   */
  getCache(): RecommendationCache {
    return this.cache;
  }
}
