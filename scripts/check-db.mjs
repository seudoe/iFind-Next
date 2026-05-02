import mongoose from "mongoose";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
});

const uri = process.env.MONGODB_URI;
console.log("URI:", uri ? uri.slice(0, 50) + "..." : "NOT FOUND");

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
console.log("✅ Connected");

const db = mongoose.connection.db;

// List all collections
const collections = await db.listCollections().toArray();
console.log("\n📦 Collections:", collections.map((c) => c.name));

// Check internships
const col = db.collection("internships");
const count = await col.countDocuments();
console.log("\n📊 internships count:", count);

if (count > 0) {
  const sample = await col.findOne();
  console.log("\n🔑 Sample doc keys:", Object.keys(sample));
  console.log("📝 name:", sample.name);
  console.log("🏢 company:", sample.company);
  console.log("🔗 apply_link / applyLink:", sample.apply_link || sample.applyLink);
  console.log("📅 date_published / datePublished:", sample.date_published || sample.datePublished);
  console.log("🌍 city:", sample.city, "| country:", sample.country, "| location:", sample.location);
  console.log("💰 stipend:", JSON.stringify(sample.stipend));
  console.log("⏱  duration:", JSON.stringify(sample.duration));
  console.log("✅ isActive:", sample.isActive);
} else {
  console.log("⚠️  No documents in internships collection!");
  
  // Check if data might be in a differently named collection
  for (const c of collections) {
    const cnt = await db.collection(c.name).countDocuments();
    console.log(`   ${c.name}: ${cnt} docs`);
  }
}

await mongoose.disconnect();
console.log("\n🔌 Done");
