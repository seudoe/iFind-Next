/**
 * clear-cache.mjs
 * 
 * Clear all recommendation caches.
 * Useful after config changes or for testing.
 * 
 * Run:
 *   node scripts/clear-cache.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
});

console.log("🧹 Clear Recommendation Cache\n");

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  family: 4,
});
console.log("✅ MongoDB connected\n");

const db = mongoose.connection.db;

// Import cache
let RecommendationCache;
try {
  const cacheModule = await import("../lib/recommendation/cache/RecommendationCache.js");
  RecommendationCache = cacheModule.RecommendationCache;
} catch (err) {
  console.error("⚠️  Could not import RecommendationCache.");
  console.error("    Run 'npm run build' first or use 'tsx scripts/clear-cache.mjs'");
  console.error(err);
  process.exit(1);
}

// Create cache instance
const cache = new RecommendationCache();

console.log("🧹 Clearing all recommendation caches...\n");

// Clear all
await cache.clearAll();

// Get stats
const stats = cache.getStats();

console.log("✅ Cache cleared successfully\n");
console.log("Cache Statistics:");
console.log(`  Total cached: ${stats.totalCached}`);
console.log(`  Hits: ${stats.hits}`);
console.log(`  Misses: ${stats.misses}`);
console.log(`  Invalidations: ${stats.invalidations}`);

await mongoose.disconnect();
console.log("\n🔌 Done");
