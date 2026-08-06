/**
 * Scoring utilities for computing similarity between vectors
 */

import type { VectorData } from "./types";

/**
 * Compute dot product between two vectors
 * For L2-normalized vectors, this equals cosine similarity
 */
export function dotProduct(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  
  return sum;
}

/**
 * Compute hybrid similarity score between user and internship vectors
 * 
 * Formula: score = dot(user.tfidf, intern.tfidf) * tfidfWeight
 *                + dot(user.bert, intern.bert) * bertWeight
 * 
 * Default weights: TF-IDF = 0.4, BERT = 0.6
 */
export function computeHybridScore(
  userVectors: VectorData,
  internshipVectors: VectorData,
  tfidfWeight: number = 0.4,
  bertWeight: number = 0.6
): number {
  const tfidfScore = dotProduct(userVectors.tfidfVector, internshipVectors.tfidfVector);
  const bertScore = dotProduct(userVectors.bertVector, internshipVectors.bertVector);
  
  return tfidfScore * tfidfWeight + bertScore * bertWeight;
}
