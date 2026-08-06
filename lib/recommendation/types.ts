/**
 * Types and interfaces for the recommendation engine
 */

/**
 * Vector representation of a user's resume or internship
 */
export interface VectorData {
  tfidfVector: number[];
  bertVector: number[];
}

/**
 * User data needed for recommendation computation
 */
export interface UserRecommendationInput {
  userId: string | any; // ObjectId or string
  vectors: VectorData;
  username?: string;
}

/**
 * Internship candidate with vector data
 */
export interface InternshipCandidate {
  id: string | any; // ObjectId or string
  name?: string;
  vectors: VectorData;
}

/**
 * A single recommendation result with score
 */
export interface RecommendationCandidate {
  id: string | any; // ObjectId or string
  score: number;
}

/**
 * Complete recommendation result for a user
 */
export interface RecommendationResult {
  userId: string | any; // ObjectId or string
  recommendations: RecommendationCandidate[];
  updatedAt: Date;
  metadata?: {
    totalCandidates: number;
    processedCandidates: number;
    threshold: number;
    topN: number;
    strategy?: string; // Phase 2: Strategy name (e.g., "BruteForce", "HNSW")
    cached?: boolean; // Phase 5: Whether result came from cache
  };
}

/**
 * Configuration for recommendation computation
 */
export interface RecommendationConfig {
  topN?: number;
  threshold?: number;
  tfidfWeight?: number;
  bertWeight?: number;
}

/**
 * Options for generating recommendations
 */
export interface GenerateRecommendationsOptions {
  userIds?: string[];
  config?: RecommendationConfig;
}
