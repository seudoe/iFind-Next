/**
 * RecommendationStrategy Interface
 * 
 * Defines the contract for all recommendation strategies.
 * This allows swapping between different algorithms (brute-force, HNSW, etc.)
 * without changing client code.
 */

import type {
  InternshipCandidate,
  UserRecommendationInput,
  RecommendationCandidate,
} from "../types";

/**
 * Strategy interface for computing recommendations
 */
export interface RecommendationStrategy {
  /**
   * Name of the strategy (for logging/debugging)
   */
  readonly name: string;

  /**
   * Compute recommendations for a user given a set of candidates
   * 
   * @param user - User data including vectors
   * @param candidates - All available internship candidates
   * @param topN - Number of recommendations to return
   * @param threshold - Minimum similarity score
   * @returns Array of recommended internships with scores
   */
  computeRecommendations(
    user: UserRecommendationInput,
    candidates: InternshipCandidate[],
    topN: number,
    threshold: number
  ): Promise<RecommendationCandidate[]>;

  /**
   * Optional: Initialize or prepare the strategy
   * Can be used for building indexes, loading models, etc.
   */
  initialize?(): Promise<void>;

  /**
   * Optional: Clean up resources
   */
  destroy?(): Promise<void>;
}
