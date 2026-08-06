/**
 * build-hnsw-index.mjs
 * 
 * Build HNSW index from internship vectors in MongoDB.
 * This creates a persistent index that can be loaded by HNSWStrategy.
 * 
 * Run:
 *   node scripts/build-hnsw-index.mjs
 * 
 * Options:
 *   --rebuild    Force rebuild even if index exists
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

// Parse arguments
const FORCE_REBUILD = process.argv.includes("--rebuild");

console.log("🔨 HNSW Index Builder\n");
console.log("Building internship vector index for fast recommendation search\n");

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  family: 4,
});
console.log("✅ MongoDB connected\n");

const db = mongoose.connection.db;

// Import HNSW modules
let HNSWIndexManager, HNSW_PATHS, HNSW_CONFIGS;
try {
  const hnswModule = await import("../lib/hnsw/HNSWIndexManager.js");
  const configModule = await import("../lib/hnsw/config.js");
  
  HNSWIndexManager = hnswModule.HNSWIndexManager;
  HNSW_PATHS = configModule.HNSW_PATHS;
  HNSW_CONFIGS = configModule.HNSW_CONFIGS;
} catch (err) {
  console.error("⚠️  Could not import HNSW modules.");
  console.error("    Run 'npm run build' first or use 'tsx scripts/build-hnsw-index.mjs'");
  console.error(err);
  process.exit(1);
}

console.log("📦 Loading internships from MongoDB...\n");

// Load internships with vectors
const internships = await db
  .collection("internships")
  .find({ isActive: true })
  .project({ _id: 1, name: 1, bert_vector: 1 })
  .toArray();

const internshipsWithVectors = internships.filter(
  (intern) => intern.bert_vector && Array.isArray(intern.bert_vector)
);

console.log(`  Total active internships: ${internships.length}`);
console.log(`  With BERT vectors: ${internshipsWithVectors.length}`);

if (internshipsWithVectors.length === 0) {
  console.error("\n❌ No internships have BERT vectors.");
  console.error("    Run vectorization scripts first:");
  console.error("    1. node scripts/vectorise-all.mjs --only=internships");
  await mongoose.disconnect();
  process.exit(1);
}

const missing = internships.length - internshipsWithVectors.length;
if (missing > 0) {
  console.warn(`\n⚠️  ${missing} internships missing BERT vectors (will be skipped)`);
}

console.log();

// Create index manager
console.log("🏗️  Initializing HNSW index manager...\n");
const manager = new HNSWIndexManager(
  HNSW_PATHS.internships,
  HNSW_CONFIGS.internships
);

// Check if index already exists
const indexLoaded = await manager.loadIndex();

if (indexLoaded && !FORCE_REBUILD) {
  const stats = await manager.getStats();
  console.log("ℹ️  HNSW index already exists:");
  console.log(`   Path: ${HNSW_PATHS.internships}`);
  console.log(`   Vectors: ${stats.vectorCount}`);
  console.log(`   Dimensions: ${stats.dimensions}`);
  console.log();
  console.log("Use --rebuild flag to force rebuild");
  await mongoose.disconnect();
  process.exit(0);
}

if (FORCE_REBUILD) {
  console.log("🔄 Rebuilding index (--rebuild flag)\n");
}

// Initialize new index
await manager.initialize();

// Convert internships to vector entries
console.log("📦 Preparing vector entries...\n");

const vectorEntries = internshipsWithVectors.map((intern) => ({
  id: intern._id.toString(),
  vector: intern.bert_vector,
  metadata: {
    name: intern.name || "Unknown",
  },
}));

console.log(`  Prepared ${vectorEntries.length} vector entries`);
console.log();

// Build index
console.log("🔨 Building HNSW index...\n");
console.log(`  Configuration:`);
console.log(`    M: ${HNSW_CONFIGS.internships.M}`);
console.log(`    efConstruction: ${HNSW_CONFIGS.internships.efConstruction}`);
console.log(`    efSearch: ${HNSW_CONFIGS.internships.efSearch}`);
console.log(`    Metric: ${HNSW_CONFIGS.internships.metric}`);
console.log();

await manager.insertVectorsBatch(vectorEntries);

// Save index
console.log("\n💾 Saving index to disk...\n");
await manager.saveIndex();

// Get final stats
const finalStats = await manager.getStats();

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("✅ HNSW Index Build Complete");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("Index Statistics:");
console.log(`  Location: ${HNSW_PATHS.internships}`);
console.log(`  Vectors: ${finalStats.vectorCount}`);
console.log(`  Dimensions: ${finalStats.dimensions}`);
console.log(`  Configuration: M=${finalStats.config.M}, efC=${finalStats.config.efConstruction}, efS=${finalStats.config.efSearch}`);
console.log();

console.log("Next Steps:");
console.log("  1. Index is ready for use by HNSWStrategy");
console.log("  2. RecommendationEngine will automatically load this index");
console.log("  3. Test recommendations: node scripts/run-recommender.mjs");
console.log();

console.log("Note:");
console.log("  • Index is persisted to disk");
console.log("  • Rebuild index when internships are added/updated");
console.log("  • Use --rebuild flag to force rebuild");

await mongoose.disconnect();
console.log("\n🔌 Done");
