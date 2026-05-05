/**
 * run-recommender.mjs
 * ───────────────────
 * Computes hybrid recommendation scores for every user against every
 * active internship using pre-computed tfidf + bert vectors stored in MongoDB.
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

// ─── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
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

// ─── Dot product (cosine similarity for L2-normalised vectors) ────────────────
function dot(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function hybridScore(userTfidf, userBert, internTfidf, internBert) {
  return dot(userTfidf, internTfidf) * W_TFIDF
       + dot(userBert,  internBert)  * W_BERT;
}

// ─── Load all active internships with vectors into memory ─────────────────────
console.log("📦 Loading internship vectors…");
const internships = await db.collection("internships")
  .find({ isActive: true })
  .project({ _id: 1, name: 1, tfidf_vector: 1, bert_vector: 1 })
  .toArray();

const internshipsWithVectors = internships.filter(i => i.tfidf_vector && i.bert_vector);
const internshipsMissingVectors = internships.filter(i => !i.tfidf_vector || !i.bert_vector);

console.log(`  Total active: ${internships.length}`);
console.log(`  With vectors: ${internshipsWithVectors.length}`);

if (internshipsMissingVectors.length > 0) {
  console.log(`  ⚠️  Missing vectors (run vectorise-all.mjs first):`);
  internshipsMissingVectors.forEach(i =>
    console.log(`     ${i._id}  ${i.name}`)
  );
}

if (internshipsWithVectors.length === 0) {
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

  // Score every internship
  const scored = internshipsWithVectors.map(intern => ({
    id:    intern._id,
    score: hybridScore(userTfidf, userBert, intern.tfidf_vector, intern.bert_vector),
  }));

  // Sort descending, apply threshold, take top N
  const recommendations = scored
    .filter(s => s.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map(s => ({ id: s.id, score: Math.round(s.score * 1000) / 1000 }));

  // Save to user document — store as array of {id, score} objects
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: {
      recommendedInternships:    recommendations.map(r => r.id),
      recommendedScores:         recommendations,   // [{ id, score }]
      recommendedUpdatedAt:      new Date(),
    }},
  );

  processed++;
  process.stdout.write(
    `  ✅ ${processed}/${totalUsers}  ${user.username ?? user._id}  → ${recommendations.length} recommendations\r`
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
