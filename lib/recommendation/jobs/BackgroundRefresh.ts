/**
 * Background Refresh Service
 * 
 * Phase 6: Proactive cache refresh for active users
 * 
 * Refreshes expired recommendation caches for recently active users only.
 * Inactive users are skipped - their recommendations will be generated lazily on next request.
 * 
 * Features:
 * - Only processes recently active users (e.g., logged in within 7 days)
 * - Batch processing with configurable batch size
 * - Fault-tolerant: errors on individual users don't stop the process
 * - Records metrics for monitoring
 * - Skips users without resume vectors
 */

import { connectDB } from "@/lib/db";
import { RecommendationEngine } from "../engine";
import { globalMetrics } from "@/lib/monitoring/RecommendationMetrics";
import mongoose from "mongoose";

export interface BackgroundRefreshConfig {
  /**
   * Only refresh users who logged in within this many days
   * Default: 7 days
   */
  activeWithinDays?: number;

  /**
   * Process users in batches of this size
   * Default: 50
   */
  batchSize?: number;

  /**
   * Maximum number of users to process in one run
   * Default: 1000 (unlimited if 0)
   */
  maxUsers?: number;

  /**
   * Only refresh caches older than this many hours
   * Default: 23 hours (just before 24h TTL expires)
   */
  cacheOlderThanHours?: number;
}

export interface BackgroundRefreshResult {
  success: boolean;
  processed: number;
  refreshed: number;
  skipped: number;
  errors: number;
  durationMs: number;
  message?: string;
}

const DEFAULT_CONFIG: Required<BackgroundRefreshConfig> = {
  activeWithinDays: 7,
  batchSize: 50,
  maxUsers: 1000,
  cacheOlderThanHours: 23,
};

/**
 * Background refresh service
 * 
 * Refreshes expired recommendation caches for active users
 */
export class BackgroundRefreshService {
  private config: Required<BackgroundRefreshConfig>;
  private engine: RecommendationEngine;

  constructor(config?: BackgroundRefreshConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.engine = new RecommendationEngine();
  }

  /**
   * Find recently active users with expired or missing caches
   * 
   * @returns Array of user IDs to refresh
   */
  async findUsersToRefresh(): Promise<string[]> {
    await connectDB();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    // Calculate cutoff date for "active" users
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() - this.config.activeWithinDays);

    // Calculate cutoff date for cache expiration
    const cacheExpiredDate = new Date();
    cacheExpiredDate.setHours(
      cacheExpiredDate.getHours() - this.config.cacheOlderThanHours
    );

    // Query: Recently active users with vectors and expired/missing cache
    const query: any = {
      // Has resume vectors (required for recommendations)
      "resume.tfidf_vector": { $exists: true },
      "resume.bert_vector": { $exists: true },
      
      // Recently active
      lastLoginAt: { $gte: activeDate },

      // Cache is missing or expired
      $or: [
        { recommendedUpdatedAt: { $exists: false } },
        { recommendedUpdatedAt: { $lt: cacheExpiredDate } },
      ],
    };

    const users = await db
      .collection("users")
      .find(query)
      .project({ _id: 1 })
      .limit(this.config.maxUsers || 0)
      .toArray();

    return users.map((u) => u._id.toString());
  }

  /**
   * Refresh recommendations for a single user
   * 
   * @param userId - User ID to refresh
   * @returns True if refreshed, false if skipped/failed
   */
  async refreshUser(userId: string): Promise<boolean> {
    try {
      const result = await this.engine.generateAndSaveRecommendations(userId);
      
      if (!result) {
        console.log(`⚠️  Skipped user ${userId} (no vectors)`);
        return false;
      }

      console.log(`✅ Refreshed recommendations for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to refresh user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Run background refresh
   * 
   * Finds active users with expired caches and refreshes them in batches.
   * 
   * @returns Result summary
   */
  async run(): Promise<BackgroundRefreshResult> {
    const startTime = Date.now();
    let processed = 0;
    let refreshed = 0;
    let skipped = 0;
    let errors = 0;

    try {
      console.log("🔄 Starting background refresh...");
      console.log(`📊 Config:`, this.config);

      // Find users to refresh
      const userIds = await this.findUsersToRefresh();

      if (userIds.length === 0) {
        console.log("✅ No users need refresh");
        return {
          success: true,
          processed: 0,
          refreshed: 0,
          skipped: 0,
          errors: 0,
          durationMs: Date.now() - startTime,
          message: "No users need refresh",
        };
      }

      console.log(`📋 Found ${userIds.length} users to refresh`);

      // Process in batches
      for (let i = 0; i < userIds.length; i += this.config.batchSize) {
        const batch = userIds.slice(i, i + this.config.batchSize);
        const batchNum = Math.floor(i / this.config.batchSize) + 1;
        const totalBatches = Math.ceil(userIds.length / this.config.batchSize);

        console.log(`🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);

        // Process batch concurrently
        const results = await Promise.allSettled(
          batch.map((userId) => this.refreshUser(userId))
        );

        // Count results
        for (const result of results) {
          processed++;
          
          if (result.status === "fulfilled") {
            if (result.value) {
              refreshed++;
            } else {
              skipped++;
            }
          } else {
            errors++;
          }
        }

        console.log(
          `✅ Batch ${batchNum} complete: ` +
          `${refreshed} refreshed, ${skipped} skipped, ${errors} errors`
        );
      }

      const durationMs = Date.now() - startTime;
      
      // Record metrics
      globalMetrics.recordRefresh(durationMs);

      console.log("✅ Background refresh completed");
      console.log(`📊 Summary: ${refreshed} refreshed, ${skipped} skipped, ${errors} errors`);
      console.log(`⏱️  Duration: ${(durationMs / 1000).toFixed(2)}s`);

      return {
        success: true,
        processed,
        refreshed,
        skipped,
        errors,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error("❌ Background refresh failed:", error);
      
      return {
        success: false,
        processed,
        refreshed,
        skipped,
        errors,
        durationMs,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Run background refresh with default configuration
 * 
 * Convenience function for cron jobs and manual triggers
 */
export async function runBackgroundRefresh(
  config?: BackgroundRefreshConfig
): Promise<BackgroundRefreshResult> {
  const service = new BackgroundRefreshService(config);
  return await service.run();
}
