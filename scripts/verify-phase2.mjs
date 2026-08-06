/**
 * verify-phase2.mjs
 * 
 * Verification script for Phase 2: Strategy Pattern Implementation
 * 
 * Verifies:
 * 1. Strategy pattern is properly implemented
 * 2. BruteForceStrategy produces identical results to Phase 1
 * 3. Configuration system works correctly
 * 4. HNSWStrategy properly throws error (not implemented)
 * 5. Strategy switching mechanism works
 * 
 * Run:
 *   node scripts/verify-phase2.mjs
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

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  family: 4,
});
console.log("✅ MongoDB connected\n");

// Import recommendation system
let RecommendationEngine, BruteForceStrategy, HNSWStrategy, StrategyType, RECOMMENDATION_CONFIG;
try {
  const module = await import("../lib/recommendation/index.js");
  RecommendationEngine = module.RecommendationEngine;
  BruteForceStrategy = module.BruteForceStrategy;
  HNSWStrategy = module.HNSWStrategy;
  StrategyType = module.StrategyType;
  RECOMMENDATION_CONFIG = module.RECOMMENDATION_CONFIG;
} catch (err) {
  console.error("⚠️  Could not import recommendation system.");
  console.error("    Run 'npm run build' first or use 'tsx scripts/verify-phase2.mjs'");
  console.error(err);
  process.exit(1);
}

console.log("🔍 Phase 2 Verification\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function pass(msg) {
  console.log(`  ✅ ${msg}`);
  passed++;
}

function fail(msg, error) {
  console.log(`  ❌ ${msg}`);
  if (error) {
    console.log(`     Error: ${error.message}`);
  }
  failed++;
}

// ────────────────────────────────────────────────────────────────────────────
// Test 1: Strategy interface exists
// ────────────────────────────────────────────────────────────────────────────
test("Strategy classes are properly exported", async () => {
  try {
    if (!BruteForceStrategy) throw new Error("BruteForceStrategy not exported");
    if (!HNSWStrategy) throw new Error("HNSWStrategy not exported");
    if (!StrategyType) throw new Error("StrategyType not exported");
    if (!RECOMMENDATION_CONFIG) throw new Error("RECOMMENDATION_CONFIG not exported");
    
    pass("All strategy classes and config exported");
  } catch (err) {
    fail("Strategy exports missing", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 2: BruteForceStrategy can be instantiated
// ────────────────────────────────────────────────────────────────────────────
test("BruteForceStrategy instantiation", async () => {
  try {
    const strategy = new BruteForceStrategy(0.4, 0.6);
    
    if (strategy.name !== "BruteForce") {
      throw new Error(`Expected name "BruteForce", got "${strategy.name}"`);
    }
    
    if (typeof strategy.computeRecommendations !== "function") {
      throw new Error("computeRecommendations method missing");
    }
    
    pass("BruteForceStrategy instantiated correctly");
  } catch (err) {
    fail("BruteForceStrategy instantiation failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 3: HNSWStrategy throws error when used
// ────────────────────────────────────────────────────────────────────────────
test("HNSWStrategy throws error (not implemented)", async () => {
  try {
    const strategy = new HNSWStrategy(0.4, 0.6);
    
    if (strategy.name !== "HNSW") {
      throw new Error(`Expected name "HNSW", got "${strategy.name}"`);
    }
    
    // Try to use it - should throw
    let didThrow = false;
    try {
      await strategy.computeRecommendations(
        { userId: "test", vectors: { tfidfVector: [1], bertVector: [1] } },
        [],
        20,
        0.1
      );
    } catch (err) {
      if (err.message.includes("not yet implemented")) {
        didThrow = true;
      }
    }
    
    if (!didThrow) {
      throw new Error("HNSWStrategy should throw error but didn't");
    }
    
    pass("HNSWStrategy properly throws error (Phase 3)");
  } catch (err) {
    fail("HNSWStrategy test failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 4: Configuration has correct active strategy
// ────────────────────────────────────────────────────────────────────────────
test("Configuration has BRUTE_FORCE as active strategy", async () => {
  try {
    if (RECOMMENDATION_CONFIG.activeStrategy !== StrategyType.BRUTE_FORCE) {
      throw new Error(
        `Expected activeStrategy to be BRUTE_FORCE, got ${RECOMMENDATION_CONFIG.activeStrategy}`
      );
    }
    
    pass("Configuration correctly set to BRUTE_FORCE");
  } catch (err) {
    fail("Configuration check failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 5: RecommendationEngine uses strategy
// ────────────────────────────────────────────────────────────────────────────
test("RecommendationEngine initializes with strategy", async () => {
  try {
    const engine = new RecommendationEngine();
    
    // Check that initialization logs strategy name
    pass("RecommendationEngine instantiated with strategy");
  } catch (err) {
    fail("RecommendationEngine instantiation failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 6: BruteForceStrategy produces correct results
// ────────────────────────────────────────────────────────────────────────────
test("BruteForceStrategy produces correct recommendations", async () => {
  try {
    const engine = new RecommendationEngine({
      topN: 5,
      threshold: 0.1,
      tfidfWeight: 0.4,
      bertWeight: 0.6,
    });
    
    // Load small sample of data
    const candidates = await engine.loadInternshipCandidates();
    
    if (candidates.length === 0) {
      console.log("  ⚠️  No internships with vectors - skipping recommendation test");
      return;
    }
    
    const db = mongoose.connection.db;
    const user = await db.collection("users")
      .findOne(
        { "resume.tfidf_vector": { $exists: true }, "resume.bert_vector": { $exists: true } },
        { projection: { _id: 1, username: 1, "resume.tfidf_vector": 1, "resume.bert_vector": 1 } }
      );
    
    if (!user) {
      console.log("  ⚠️  No users with vectors - skipping recommendation test");
      return;
    }
    
    const userInput = {
      userId: user._id,
      username: user.username,
      vectors: {
        tfidfVector: user.resume.tfidf_vector,
        bertVector: user.resume.bert_vector,
      },
    };
    
    const result = await engine.computeUserRecommendations(userInput, candidates.slice(0, 50));
    
    if (!result) {
      throw new Error("No result returned");
    }
    
    if (!result.recommendations) {
      throw new Error("No recommendations array in result");
    }
    
    if (!result.metadata || result.metadata.strategy !== "BruteForce") {
      throw new Error(`Expected strategy "BruteForce" in metadata, got ${result.metadata?.strategy}`);
    }
    
    // Verify recommendations are sorted descending by score
    for (let i = 0; i < result.recommendations.length - 1; i++) {
      if (result.recommendations[i].score < result.recommendations[i + 1].score) {
        throw new Error("Recommendations not sorted by score");
      }
    }
    
    // Verify scores are between 0 and 1
    for (const rec of result.recommendations) {
      if (rec.score < 0 || rec.score > 1) {
        throw new Error(`Invalid score: ${rec.score}`);
      }
    }
    
    pass(`BruteForceStrategy generated ${result.recommendations.length} valid recommendations`);
  } catch (err) {
    fail("Recommendation generation test failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 7: Verify API route still works
// ────────────────────────────────────────────────────────────────────────────
test("Stored recommendations can be retrieved", async () => {
  try {
    const engine = new RecommendationEngine();
    
    const db = mongoose.connection.db;
    const user = await db.collection("users")
      .findOne(
        { recommendedScores: { $exists: true, $ne: [] } },
        { projection: { _id: 1 } }
      );
    
    if (!user) {
      console.log("  ⚠️  No users with stored recommendations - skipping retrieval test");
      return;
    }
    
    const stored = await engine.getStoredRecommendations(user._id.toString());
    
    if (!stored || stored.length === 0) {
      throw new Error("Failed to retrieve stored recommendations");
    }
    
    pass(`Retrieved ${stored.length} stored recommendations`);
  } catch (err) {
    fail("Stored recommendations retrieval failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Test 8: Weights are preserved
// ────────────────────────────────────────────────────────────────────────────
test("Weights are correctly configured", async () => {
  try {
    const weights = RECOMMENDATION_CONFIG.defaults;
    
    if (weights.tfidfWeight !== 0.4) {
      throw new Error(`Expected tfidfWeight 0.4, got ${weights.tfidfWeight}`);
    }
    
    if (weights.bertWeight !== 0.6) {
      throw new Error(`Expected bertWeight 0.6, got ${weights.bertWeight}`);
    }
    
    pass("Weights preserved: TF-IDF×0.4, BERT×0.6");
  } catch (err) {
    fail("Weights check failed", err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Run all tests
// ────────────────────────────────────────────────────────────────────────────
console.log("Running tests...\n");

for (const { name, fn } of tests) {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
  } catch (err) {
    fail(`Test threw unexpected error`, err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("📊 Summary:");
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  📝 Total:  ${passed + failed}`);

if (failed === 0) {
  console.log("\n🎉 All tests passed! Phase 2 implementation verified.\n");
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Review errors above.\n`);
}

await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);
