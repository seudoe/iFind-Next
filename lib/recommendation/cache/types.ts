/**
 * Recommendation Cache Types
 * 
 * Phase 5: Caching layer to avoid unnecessary recommendation computation
 */

import type { RecommendationCandidate } from "../types";

/**
 * Cached recommendation entry
 */
export interface CachedRecommendation {
  /**
   * User ID
   */
  userId: string;

  /**
   * Cached recommendation IDs and scores
   */
  recommendations: RecommendationCandidate[];

  /**
   * When these recommendations were generated
   */
  generatedAt: Date;

  /**
   * When this cache entry expires
   */
  expiresAt: Date;

  /**
   * Cache metadata
   */
  metadata?: {
    /**
     * Strategy used to generate recommendations
     */
    strategy?: string;

    /**
     * Number of candidates processed
     */
    candidateCount?: number;

    /**
     * Configuration hash (for invalidation)
     */
    configHash?: string;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Cache TTL in milliseconds
   * Default: 24 hours
   */
  ttl: number;

  /**
   * Enable cache
   */
  enabled: boolean;

  /**
   * Invalidate cache on resume update
   */
  invalidateOnResumeUpdate: boolean;

  /**
   * Invalidate cache on profile update
   */
  invalidateOnProfileUpdate: boolean;

  /**
   * Invalidate cache on config change
   */
  invalidateOnConfigChange: boolean;
}

/**
 * Cache invalidation reason
 */
export enum InvalidationReason {
  RESUME_UPDATED = "resume_updated",
  PROFILE_UPDATED = "profile_updated",
  CONFIG_CHANGED = "config_changed",
  EXPIRED = "expired",
  MANUAL = "manual",
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  totalCached: number;
}
