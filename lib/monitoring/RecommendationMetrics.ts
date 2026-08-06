/**
 * Recommendation Metrics
 * 
 * Phase 6: Monitoring and metrics collection for recommendation system
 */

export interface MetricSnapshot {
  // Recommendation generation
  avgGenerationTime: number;
  maxGenerationTime: number;
  minGenerationTime: number;
  totalGenerations: number;

  // HNSW search
  avgSearchLatency: number;
  maxSearchLatency: number;
  minSearchLatency: number;
  totalSearches: number;

  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  cacheMissRatio: number;

  // Background refresh
  avgRefreshDuration: number;
  totalRefreshes: number;
  lastRefreshAt?: Date;

  // HNSW index
  indexSize: number;
  indexVectorCount: number;

  // Timestamp
  timestamp: Date;
}

export class RecommendationMetrics {
  private generationTimes: number[] = [];
  private searchLatencies: number[] = [];
  private refreshDurations: number[] = [];

  private cacheHits = 0;
  private cacheMisses = 0;

  private indexSize = 0;
  private indexVectorCount = 0;

  private lastRefreshAt?: Date;

  /**
   * Record recommendation generation time
   */
  recordGeneration(durationMs: number): void {
    this.generationTimes.push(durationMs);
    // Keep only last 1000 samples
    if (this.generationTimes.length > 1000) {
      this.generationTimes.shift();
    }
  }

  /**
   * Record HNSW search latency
   */
  recordSearch(latencyMs: number): void {
    this.searchLatencies.push(latencyMs);
    if (this.searchLatencies.length > 1000) {
      this.searchLatencies.shift();
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Record background refresh duration
   */
  recordRefresh(durationMs: number): void {
    this.refreshDurations.push(durationMs);
    if (this.refreshDurations.length > 100) {
      this.refreshDurations.shift();
    }
    this.lastRefreshAt = new Date();
  }

  /**
   * Update HNSW index size
   */
  updateIndexSize(sizeBytes: number, vectorCount: number): void {
    this.indexSize = sizeBytes;
    this.indexVectorCount = vectorCount;
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricSnapshot {
    const avgGeneration =
      this.generationTimes.length > 0
        ? this.generationTimes.reduce((a, b) => a + b, 0) / this.generationTimes.length
        : 0;

    const avgSearch =
      this.searchLatencies.length > 0
        ? this.searchLatencies.reduce((a, b) => a + b, 0) / this.searchLatencies.length
        : 0;

    const avgRefresh =
      this.refreshDurations.length > 0
        ? this.refreshDurations.reduce((a, b) => a + b, 0) / this.refreshDurations.length
        : 0;

    const total = this.cacheHits + this.cacheMisses;
    const hitRatio = total > 0 ? this.cacheHits / total : 0;
    const missRatio = total > 0 ? this.cacheMisses / total : 0;

    return {
      avgGenerationTime: Math.round(avgGeneration * 100) / 100,
      maxGenerationTime: this.generationTimes.length > 0 ? Math.max(...this.generationTimes) : 0,
      minGenerationTime: this.generationTimes.length > 0 ? Math.min(...this.generationTimes) : 0,
      totalGenerations: this.generationTimes.length,

      avgSearchLatency: Math.round(avgSearch * 100) / 100,
      maxSearchLatency: this.searchLatencies.length > 0 ? Math.max(...this.searchLatencies) : 0,
      minSearchLatency: this.searchLatencies.length > 0 ? Math.min(...this.searchLatencies) : 0,
      totalSearches: this.searchLatencies.length,

      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio: Math.round(hitRatio * 10000) / 100,
      cacheMissRatio: Math.round(missRatio * 10000) / 100,

      avgRefreshDuration: Math.round(avgRefresh * 100) / 100,
      totalRefreshes: this.refreshDurations.length,
      lastRefreshAt: this.lastRefreshAt,

      indexSize: this.indexSize,
      indexVectorCount: this.indexVectorCount,

      timestamp: new Date(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.generationTimes = [];
    this.searchLatencies = [];
    this.refreshDurations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.indexSize = 0;
    this.indexVectorCount = 0;
    this.lastRefreshAt = undefined;
  }

  /**
   * Log current metrics to console
   */
  logMetrics(): void {
    const snapshot = this.getSnapshot();

    console.log("\n📊 Recommendation Metrics:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nGeneration:");
    console.log(`  Avg: ${snapshot.avgGenerationTime}ms`);
    console.log(`  Min: ${snapshot.minGenerationTime}ms`);
    console.log(`  Max: ${snapshot.maxGenerationTime}ms`);
    console.log(`  Total: ${snapshot.totalGenerations}`);

    console.log("\nHNSW Search:");
    console.log(`  Avg Latency: ${snapshot.avgSearchLatency}ms`);
    console.log(`  Min Latency: ${snapshot.minSearchLatency}ms`);
    console.log(`  Max Latency: ${snapshot.maxSearchLatency}ms`);
    console.log(`  Total Searches: ${snapshot.totalSearches}`);

    console.log("\nCache:");
    console.log(`  Hits: ${snapshot.cacheHits}`);
    console.log(`  Misses: ${snapshot.cacheMisses}`);
    console.log(`  Hit Ratio: ${snapshot.cacheHitRatio}%`);
    console.log(`  Miss Ratio: ${snapshot.cacheMissRatio}%`);

    console.log("\nBackground Refresh:");
    console.log(`  Avg Duration: ${snapshot.avgRefreshDuration}ms`);
    console.log(`  Total Refreshes: ${snapshot.totalRefreshes}`);
    console.log(`  Last Refresh: ${snapshot.lastRefreshAt?.toISOString() || "Never"}`);

    console.log("\nHNSW Index:");
    console.log(`  Size: ${this.formatBytes(snapshot.indexSize)}`);
    console.log(`  Vectors: ${snapshot.indexVectorCount}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

// Global metrics instance
export const globalMetrics = new RecommendationMetrics();
