/**
 * Cache Invalidation Middleware
 * 
 * Phase 5: Automatic cache invalidation hooks
 * 
 * These functions should be called from API routes that update user data
 */

import { RecommendationCache } from "./RecommendationCache";
import { InvalidationReason } from "./types";

/**
 * Global cache instance
 */
const globalCache = new RecommendationCache();

/**
 * Invalidate cache when user updates resume
 * 
 * @param userId - User ID
 */
export async function invalidateCacheOnResumeUpdate(userId: string): Promise<void> {
  if (globalCache.shouldInvalidateOnResumeUpdate()) {
    await globalCache.invalidate(userId, InvalidationReason.RESUME_UPDATED);
  }
}

/**
 * Invalidate cache when user updates profile
 * 
 * @param userId - User ID
 */
export async function invalidateCacheOnProfileUpdate(userId: string): Promise<void> {
  if (globalCache.shouldInvalidateOnProfileUpdate()) {
    await globalCache.invalidate(userId, InvalidationReason.PROFILE_UPDATED);
  }
}

/**
 * Invalidate all caches when recommendation config changes
 */
export async function invalidateCacheOnConfigChange(): Promise<void> {
  if (globalCache.shouldInvalidateOnConfigChange()) {
    await globalCache.clearAll();
    console.log("All caches invalidated due to config change");
  }
}

/**
 * Manual cache invalidation
 * 
 * @param userId - User ID
 */
export async function invalidateCacheManually(userId: string): Promise<void> {
  await globalCache.invalidate(userId, InvalidationReason.MANUAL);
}

/**
 * Get global cache instance
 */
export function getGlobalCache(): RecommendationCache {
  return globalCache;
}
