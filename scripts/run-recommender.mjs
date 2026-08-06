/**
 * run-recommender.mjs
 * ───────────────────
 * Computes hybrid recommendation scores for every user against every
 * active internship using pre-computed tfidf + bert vectors stored in MongoDB.
 *
 * This script has been refactored to use the RecommendationEngine service.
 * The core logic is now in lib/recommendation/engine.ts
 *
 * Formula:  score = dot(user.tfidf, intern.tfidf) * 0.4
 *                 + dot(user.bert,  intern.bert)  * 0.6
 *
 * Vectors must be L2-normalised (they are, from the HF encoder),
 * so dot product == cosine similarity.
 *
 * Saves top-N internship IDs to user.recommendedInternships.
 *
 * Run:
 *   node scripts/run-recommender.mjs
 *
 * Optional flags:
 *   --top=20          how many recommendations to save per user (default 20)
 *   --threshold=0.1   minimum score to be included (default 0.1)
 *   --user=<id>       run for a single user only
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ─── Dynamic import for RecommendationEngine (ESM compatibility) ──────────────
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

// ─── Config ───────────────────────────────────────────────────────────────────
const TOP_N     = parseInt(process.argv.find(a => a.startsWith("--top="))?.split("=")[1]       ?? "20");
const THRESHOLD = parseFloat(process.argv.find(a => a.startsWith("--threshold="))?.split("=")[1] ?? "0.1");
const ONLY_USER = process.argv.find(a => a.startsWith("--user="))?.split("=")[1];

const W_TFIDF = 0.4;
const W_BERT  = 0.6;

// ─── DB connection ────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  family: 4,
});
console.log("✅ MongoDB connected\n");

const db = mongoose.connection.db;

// ─── Import RecommendationEngine (compile TypeScript on-the-fly using tsx) ────
// Note: This requires @types/node and tsx to be installed, or we use the compiled JS
let RecommendationEngine;
try {
  // Try to import from compiled dist (if built)
  const module = await import("../lib/recommendation/engine.js");
  RecommendationEngine = module.RecommendationEngine;
} catch {
  // Fallback: Use node with --loader or tsx
  console.error("⚠️  Could not import RecommendationEngine.");
  console.error("    Run 'npm run build' or use 'tsx scripts/run-recommender.mjs'");
  process.exit(1);
}

// ─── Initialize engine with config ────────────────────────────────────────────
const engine = new RecommendationEngine({
  topN: TOP_N,
  threshold: THRESHOLD,
  tfidfWeight: W_TFIDF,
  bertWeight: W_BERT,
});

// ─── Load all internship candidates ───────────────────────────────────────────
console.log("📦 Loading internship vectors…");
const candidates = await engine.loadInternshipCandidates();

// Count total internships
const totalInternships = await db.collection("internships").countDocuments({ isActive: true });
const internshipsMissingVectors = totalInternships - candidates.length;

console.log(`  Total active: ${totalInternships}`);
console.log(`  With vectors: ${candidates.length}`);

if (internshipsMissingVectors > 0) {
  console.log(`  ⚠️  Missing vectors: ${internshipsMissingVectors} (run vectorise-all.mjs first)`);
}

if (candidates.length === 0) {
  console.error("\n❌ No internships have vectors. Run vectorise-all.mjs --only=internships first.");
  await mongoose.disconnect();
  process.exit(1);
}

console.log();

// ─── Process users ────────────────────────────────────────────────────────────
const userFilter = ONLY_USER
  ? { _id: new mongoose.Types.ObjectId(ONLY_USER) }
  : { "resume.tfidf_vector": { $exists: true }, "resume.bert_vector": { $exists: true } };

const totalUsers = await db.collection("users").countDocuments(userFilter);
console.log(`👤 Users to process: ${totalUsers}\n`);

let processed = 0;
let skipped   = 0;

const userCursor = db.collection("users")
  .find(userFilter)
  .project({ _id: 1, username: 1, "resume.tfidf_vector": 1, "resume.bert_vector": 1 });

for await (const user of userCursor) {
  const userTfidf = user.resume?.tfidf_vector;
  const userBert  = user.resume?.bert_vector;

  if (!userTfidf || !userBert) {
    console.log(`  ⚠️  User ${user._id} (${user.username ?? "?"}) missing resume vectors — skipped`);
    skipped++;
    continue;
  }

  // Use RecommendationEngine to compute recommendations
  const userInput = {
    userId: user._id,
    username: user.username,
    vectors: {
      tfidfVector: userTfidf,
      bertVector: userBert,
    },
  };

  const result = await engine.computeUserRecommendations(userInput, candidates);

  // Save to database
  await engine.saveRecommendations(result);

  processed++;
  process.stdout.write(
    `  ✅ ${processed}/${totalUsers}  ${user.username ?? user._id}  → ${result.recommendations.length} recommendations\r`
  );
}

console.log(`\n\n── Summary ──────────────────────────────────────────────────`);
console.log(`  Processed : ${processed}`);
console.log(`  Skipped   : ${skipped}`);
console.log(`  Top N     : ${TOP_N}`);
console.log(`  Threshold : ${THRESHOLD}`);
console.log(`  Weights   : TF-IDF×${W_TFIDF}  BERT×${W_BERT}`);

await mongoose.disconnect();
console.log("\n🔌 Done");
