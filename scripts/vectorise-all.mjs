/**
 * vectorise-all.mjs
 * ─────────────────
 * Sends every internship and every user's resume to the HF Space encoder API
 * and saves the returned tfidf + bert vectors back into MongoDB.
 *
 * Run:
 *   node scripts/vectorise-all.mjs
 *
 * Optional flags:
 *   --only=internships   only encode internships
 *   --only=resumes       only encode user resumes
 *   --batch=50           internship batch size (default 70, max 70)
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
const HF_BASE   = "https://seudoe-vectorisationResume.hf.space";
const BATCH     = Math.min(parseInt(process.argv.find(a => a.startsWith("--batch="))?.split("=")[1] ?? "70"), 70);
const ONLY      = process.argv.find(a => a.startsWith("--only="))?.split("=")[1]; // "internships" | "resumes"

// ─── DB connection ────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  family: 4,
});
console.log("✅ MongoDB connected\n");

const db = mongoose.connection.db;

// ─── Helper: POST to HF Space ─────────────────────────────────────────────────
async function hfPost(path, body) {
  const res = await fetch(`${HF_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HF ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── 1. Encode internships ────────────────────────────────────────────────────
async function encodeInternships() {
  const col = db.collection("internships");
  const total = await col.countDocuments({ isActive: true });
  console.log(`📦 Internships to encode: ${total}`);

  let encoded = 0;
  let skipped = 0;
  let cursor  = col.find({ isActive: true });

  let batch = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;

    let result;
    try {
      result = await hfPost("/encode-internships", {
        internships: batch.map(doc => ({
          id:          doc._id.toString(),
          title:       doc.name,
          description: doc.summary,
        })),
        boost_weight: 0.15,
      });
    } catch (err) {
      console.error(`  ❌ Batch failed: ${err.message}`);
      batch.forEach(doc => console.log(`     skipped internship: ${doc._id}`));
      skipped += batch.length;
      batch = [];
      return;
    }

    // Write vectors back to each internship document
    const ops = result.vectors.map(v => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(v.id) },
        update: { $set: { tfidf_vector: v.tfidf, bert_vector: v.bert } },
      },
    }));

    if (ops.length > 0) {
      await col.bulkWrite(ops);
      encoded += ops.length;
      process.stdout.write(`  ✅ ${encoded}/${total} encoded\r`);
    }

    batch = [];
  };

  for await (const doc of cursor) {
    if (!doc.name || !doc.summary) {
      console.log(`  ⚠️  Internship ${doc._id} missing name or summary — skipped`);
      skipped++;
      continue;
    }
    batch.push(doc);
    if (batch.length >= BATCH) await flushBatch();
  }
  await flushBatch(); // flush remainder

  console.log(`\n  Done — encoded: ${encoded}, skipped: ${skipped}\n`);
}

// ─── 2. Encode user resumes ───────────────────────────────────────────────────
async function encodeResumes() {
  const col = db.collection("users");
  const total = await col.countDocuments({ "resume.parsedData": { $ne: null } });
  console.log(`👤 Users with parsedData to encode: ${total}`);

  let encoded = 0;
  let skipped = 0;
  const cursor = col.find({ "resume.parsedData": { $ne: null } });

  for await (const user of cursor) {
    const parsedData = user.resume?.parsedData;

    if (!parsedData) {
      console.log(`  ⚠️  User ${user._id} (${user.username}) has no parsedData — skipped`);
      skipped++;
      continue;
    }

    let result;
    try {
      result = await hfPost("/encode-resume", {
        resume: parsedData,
        boost_weight: 0.15,
      });
    } catch (err) {
      console.log(`  ❌ User ${user._id} (${user.username}) encoding failed: ${err.message}`);
      skipped++;
      continue;
    }

    await col.updateOne(
      { _id: user._id },
      { $set: {
        "resume.tfidf_vector": result.tfidf,
        "resume.bert_vector":  result.bert,
      }},
    );

    encoded++;
    process.stdout.write(`  ✅ ${encoded}/${total} encoded\r`);
  }

  console.log(`\n  Done — encoded: ${encoded}, skipped: ${skipped}\n`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
if (!ONLY || ONLY === "internships") {
  console.log("── Encoding internships ─────────────────────────────────────");
  await encodeInternships();
}

if (!ONLY || ONLY === "resumes") {
  console.log("── Encoding user resumes ────────────────────────────────────");
  await encodeResumes();
}

await mongoose.disconnect();
console.log("🔌 Done");
