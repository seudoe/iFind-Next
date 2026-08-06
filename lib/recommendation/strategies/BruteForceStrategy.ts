/**
 * BruteForceStrategy
 * 
 * Original brute-force recommendation algorithm.
 * Compares user vector against every internship vector.
 * 
 * Complexity: O(I × 768) per user where I = number of internships
 * 
 * This is the current production algorithm extracted from the original
 * implementation. Behavior is preserved exactly.
 */

import type { RecommendationStrategy } from "./RecommendationStrategy";
import type {
  InternshipCandidate,
  UserRecommendationInput,
  RecommendationCandidate,
} from "../types";
import { computeHybridScore } from "../scoring";

export class BruteForceStrategy implements RecommendationStrategy {
  readonly name = "BruteForce";

  private tfidfWeight: number;
  private bertWeight: number;

  constructor(tfidfWeight: number = 0.4, bertWeight: number = 0.6) {
    this.tfidfWeight = tfidfWeight;
    this.bertWeight = bertWeight;
  }

  /**
   * Compute recommendations using brute-force comparison
   * 
   * Algorithm:
   * 1. Score user against every candidate
   * 2. Filter by threshold
   * 3. Sort descending by score
   * 4. Take top N
   * 5. Round scores to 3 decimals
   * 
   * This is the exact original algorithm from run-recommender.mjs
   */
  async computeRecommendations(
    user: UserRecommendationInput,
    candidates: InternshipCandidate[],
    topN: number,
    threshold: number
  ): Promise<RecommendationCandidate[]> {
    // Score every candidate (brute-force)
    const scored: RecommendationCandidate[] = candidates.map((candidate) => ({
      id: candidate.id,
      score: computeHybridScore(
        user.vectors,
        candidate.vectors,
        this.tfidfWeight,
        this.bertWeight
      ),
    }));

    // Filter by threshold, sort descending, take top N, round scores
    const recommendations = scored
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((s) => ({
        id: s.id,
        score: Math.round(s.score * 1000) / 1000, // Round to 3 decimal places
      }));

    return recommendations;
  }
}
