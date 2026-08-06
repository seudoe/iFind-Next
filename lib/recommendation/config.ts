/**
 * Recommendation Configuration
 * 
 * Single source of truth for recommendation system configuration.
 * Change strategy here to switch between algorithms globally.
 */

import { BruteForceStrategy, HNSWStrategy } from "./strategies";
import type { RecommendationStrategy } from "./strategies/RecommendationStrategy";

/**
 * Strategy type enum
 */
export enum StrategyType {
  BRUTE_FORCE = "brute_force",
  HNSW = "hnsw",
}

/**
 * Global recommendation configuration
 */
export const RECOMMENDATION_CONFIG = {
  /**
   * Active strategy - Change this to switch algorithms globally
   * 
   * Options:
   * - StrategyType.BRUTE_FORCE (Phase 1-3, O(U × I))
   * - StrategyType.HNSW (Phase 4, O(log I + K))
   */
  activeStrategy: StrategyType.HNSW,

  /**
   * Default configuration values
   */
  defaults: {
    topN: 20,
    threshold: 0.1,
    tfidfWeight: 0.4,
    bertWeight: 0.6,
  },

  /**
   * Strategy-specific configuration
   */
  strategies: {
    bruteForce: {
      // No special config needed
    },
    hnsw: {
      /**
       * Number of candidates to retrieve from HNSW index (K parameter)
       * Higher = better recall, slower
       * Typical values: 50-500
       * Recommendation: 5-10x topN
       */
      candidateK: 100,

      /**
       * HNSW parameters (from lib/hnsw/config.ts)
       * M: 16, efConstruction: 200, efSearch: 50
       */
    },
  },
} as const;

/**
 * Factory function to create the configured strategy instance
 * 
 * @param strategyType - Type of strategy to create (optional, uses activeStrategy if not provided)
 * @param tfidfWeight - TF-IDF weight (default: 0.4)
 * @param bertWeight - BERT weight (default: 0.6)
 * @returns Configured strategy instance
 */
export function createRecommendationStrategy(
  strategyType?: StrategyType,
  tfidfWeight?: number,
  bertWeight?: number
): RecommendationStrategy {
  const type = strategyType ?? RECOMMENDATION_CONFIG.activeStrategy;
  const tfidf = tfidfWeight ?? RECOMMENDATION_CONFIG.defaults.tfidfWeight;
  const bert = bertWeight ?? RECOMMENDATION_CONFIG.defaults.bertWeight;

  switch (type) {
    case StrategyType.BRUTE_FORCE:
      return new BruteForceStrategy(tfidf, bert);

    case StrategyType.HNSW:
      return new HNSWStrategy(
        tfidf,
        bert,
        RECOMMENDATION_CONFIG.strategies.hnsw.candidateK
      );

    default:
      // Fallback to brute-force for safety
      console.warn(`Unknown strategy type: ${type}, falling back to BruteForce`);
      return new BruteForceStrategy(tfidf, bert);
  }
}
