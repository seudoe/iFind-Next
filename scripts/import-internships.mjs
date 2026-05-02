/**
 * Imports internship JSON files from iFind-IPD-Project/data/ into MongoDB.
 * Run: node scripts/import-internships.mjs
 */

import mongoose from "mongoose";
import { readFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
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

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("❌ MONGODB_URI not found"); process.exit(1); }

// JSON files to import — relative to workspace root
const DATA_FILES = [
  "iFind-IPD-Project/data/internships_dataset.json",
  "iFind-IPD-Project/data/internships_dataset_2026.json",
  "iFind-IPD-Project/data/internships_internshala.json",
];

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, family: 4 });
console.log("✅ Connected to MongoDB");

const db = mongoose.connection.db;
const col = db.collection("internships");

// Count existing
const existing = await col.countDocuments();
console.log(`📊 Existing documents: ${existing}`);

let totalInserted = 0;

for (const relPath of DATA_FILES) {
  const filePath = resolve(__dirname, "../../", relPath);

  if (!existsSync(filePath)) {
    console.log(`⚠️  File not found, skipping: ${filePath}`);
    continue;
  }

  console.log(`\n📂 Reading: ${relPath}`);
  let docs;
  try {
    docs = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error(`❌ Failed to parse ${relPath}:`, e.message);
    continue;
  }

  if (!Array.isArray(docs)) {
    console.log(`⚠️  Not an array, skipping`);
    continue;
  }

  console.log(`   Found ${docs.length} records`);

  // Add isActive flag and timestamps if missing
  const prepared = docs.map((doc) => ({
    ...doc,
    isActive: doc.isActive ?? true,
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
  }));

  // Use insertMany with ordered:false so duplicates don't stop the batch
  try {
    const result = await col.insertMany(prepared, { ordered: false });
    console.log(`   ✅ Inserted: ${result.insertedCount}`);
    totalInserted += result.insertedCount;
  } catch (err) {
    // ordered:false — some may have inserted even if others failed (e.g. duplicates)
    if (err.result?.insertedCount) {
      console.log(`   ✅ Inserted: ${err.result.insertedCount} (some skipped as duplicates)`);
      totalInserted += err.result.insertedCount;
    } else {
      console.error(`   ❌ Insert error:`, err.message);
    }
  }
}

const finalCount = await col.countDocuments();
console.log(`\n🎉 Done! Total inserted this run: ${totalInserted}`);
console.log(`📊 Total documents in collection: ${finalCount}`);

await mongoose.disconnect();
