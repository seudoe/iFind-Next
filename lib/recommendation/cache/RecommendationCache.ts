/**
 * Recommendation Cache Service
 * 
 * Phase 5: Caching layer to avoid unnecessary recommendation computation
 * 
 * Features:
 * - Store recommendations with expiration
 * - Automatic cache invalidation on updates
 * - Cache statistics
 */

import { connectDB } from "@/lib/db";
import type { RecommendationCandidate } from "../types";
import type {
  CachedRecommendation,
  CacheConfig,
  CacheStats,
  InvalidationReason,
} from "./types";
import { InvalidationReason as Reason } from "./types";

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  enabled: true,
  invalidateOnResumeUpdate: true,
  invalidateOnProfileUpdate: true,
  invalidateOnConfigChange: true,
};

/**
 * Recommendation Cache Service
 */
export class RecommendationCache {
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    totalCached: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached recommendations for a user
   * 
   * @param userId - User ID
   * @returns Cached recommendations or null if not found/expired
   */
  async get(userId: string): Promise<RecommendationCandidate[] | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return null;
      }

      const user = await db
        .collection("users")
        .findOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          {
            projection: {
              recommendedScores: 1,
              recommendedUpdatedAt: 1,
              recommendationCacheExpiresAt: 1,
            },
          }
        );

      if (!user || !user.recommendedScores || user.recommendedScores.length === 0) {
        this.stats.misses++;
        return null;
      }

      // Check if cache is expired
      const expiresAt = user.recommendationCacheExpiresAt
        ? new Date(user.recommendationCacheExpiresAt)
        : null;

      if (!expiresAt || expiresAt < new Date()) {
        this.stats.misses++;
        return null;
      }

      // Cache hit
      this.stats.hits++;
      return user.recommendedScores;
    } catch (error) {
      console.error("Cache get error:", error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store recommendations in cache
   * 
   * @param userId - User ID
   * @param recommendations - Recommendations to cache
   * @param metadata - Optional metadata
   */
  async set(
    userId: string,
    recommendations: RecommendationCandidate[],
    metadata?: CachedRecommendation["metadata"]
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.ttl);

      await db.collection("users").updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            recommendedInternships: recommendations.map((r) => r.id),
            recommendedScores: recommendations,
            recommendedUpdatedAt: now,
            recommendationCacheExpiresAt: expiresAt,
            recommendationCacheMetadata: metadata,
          },
        }
      );

      this.stats.totalCached++;
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  /**
   * Check if cache is valid for a user
   * 
   * @param userId - User ID
   * @returns true if cache exists and is not expired
   */
  async isValid(userId: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return false;
      }

      const user = await db
        .collection("users")
        .findOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          {
            projection: {
              recommendedScores: 1,
              recommendationCacheExpiresAt: 1,
            },
          }
        );

      if (!user || !user.recommendedScores || user.recommendedScores.length === 0) {
        return false;
      }

      const expiresAt = user.recommendationCacheExpiresAt
        ? new Date(user.recommendationCacheExpiresAt)
        : null;

      return expiresAt !== null && expiresAt >= new Date();
    } catch (error) {
      console.error("Cache isValid error:", error);
      return false;
    }
  }

  /**
   * Invalidate cache for a user
   * 
   * @param userId - User ID
   * @param reason - Reason for invalidation
   */
  async invalidate(userId: string, reason: InvalidationReason): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return;
      }

      await db.collection("users").updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            recommendationCacheExpiresAt: new Date(0), // Expire immediately
          },
        }
      );

      this.stats.invalidations++;
      console.log(`Cache invalidated for user ${userId}: ${reason}`);
    } catch (error) {
      console.error("Cache invalidate error:", error);
    }
  }

  /**
   * Invalidate cache for multiple users
   * 
   * @param userIds - Array of user IDs
   * @param reason - Reason for invalidation
   */
  async invalidateBatch(
    userIds: string[],
    reason: InvalidationReason
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return;
      }

      const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

      const result = await db.collection("users").updateMany(
        { _id: { $in: objectIds } },
        {
          $set: {
            recommendationCacheExpiresAt: new Date(0),
          },
        }
      );

      this.stats.invalidations += result.modifiedCount;
      console.log(
        `Cache invalidated for ${result.modifiedCount} users: ${reason}`
      );
    } catch (error) {
      console.error("Cache invalidateBatch error:", error);
    }
  }

  /**
   * Clear all cached recommendations
   */
  async clearAll(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await connectDB();
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;

      if (!db) {
        return;
      }

      const result = await db.collection("users").updateMany(
        { recommendationCacheExpiresAt: { $exists: true } },
        {
          $set: {
            recommendationCacheExpiresAt: new Date(0),
          },
        }
      );

      console.log(`Cleared cache for ${result.modifiedCount} users`);
    } catch (error) {
      console.error("Cache clearAll error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      totalCached: 0,
    };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if cache should be invalidated based on config
   */
  shouldInvalidateOnResumeUpdate(): boolean {
    return this.config.enabled && this.config.invalidateOnResumeUpdate;
  }

  shouldInvalidateOnProfileUpdate(): boolean {
    return this.config.enabled && this.config.invalidateOnProfileUpdate;
  }

  shouldInvalidateOnConfigChange(): boolean {
    return this.config.enabled && this.config.invalidateOnConfigChange;
  }
}
