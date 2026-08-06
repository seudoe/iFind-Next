/**
 * Recommendation Service - Public API
 * 
 * This module provides a unified interface for the recommendation system.
 * It exports the core engine, strategies, cache, and utilities needed by API routes.
 * 
 * Phase 2: Added strategy pattern exports
 * Phase 5: Added caching layer exports
 */

export { RecommendationEngine } from "./engine";
export { computeHybridScore, dotProduct } from "./scoring";
export type {
  RecommendationResult,
  RecommendationCandidate,
  InternshipCandidate,
  UserRecommendationInput,
  RecommendationConfig,
  VectorData,
  GenerateRecommendationsOptions,
} from "./types";

// Strategy exports
export type { RecommendationStrategy } from "./strategies/RecommendationStrategy";
export { BruteForceStrategy } from "./strategies/BruteForceStrategy";
export { HNSWStrategy } from "./strategies/HNSWStrategy";

// Configuration exports
export {
  RECOMMENDATION_CONFIG,
  createRecommendationStrategy,
  StrategyType,
} from "./config";

// Cache exports (Phase 5)
export { RecommendationCache } from "./cache/RecommendationCache";
export type { CachedRecommendation, CacheConfig, CacheStats } from "./cache/types";
export { InvalidationReason } from "./cache/types";
