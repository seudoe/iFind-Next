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

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
console.log("✅ Connected — DB:", mongoose.connection.db.databaseName);

// Test 1: raw native driver
const raw = await mongoose.connection.db.collection("internships").find({}).limit(2).toArray();
console.log("\n📦 Native driver count:", await mongoose.connection.db.collection("internships").countDocuments());
console.log("Raw sample name:", raw[0]?.name);
console.log("Raw isActive:", raw[0]?.isActive);

// Test 2: Mongoose model — no filter
const InternshipSchema = new mongoose.Schema({}, { strict: false });
const InternshipModel = mongoose.models.InternshipTest || mongoose.model("InternshipTest", InternshipSchema, "internships");

const all = await InternshipModel.find({}).limit(2).lean();
console.log("\n🔍 Mongoose (no filter) count:", await InternshipModel.countDocuments({}));
console.log("Mongoose sample name:", all[0]?.name);

// Test 3: Mongoose model — with isActive: true
const active = await InternshipModel.find({ isActive: true }).limit(2).lean();
console.log("\n✅ Mongoose (isActive:true) count:", await InternshipModel.countDocuments({ isActive: true }));
console.log("Active sample:", active[0]?.name);

await mongoose.disconnect();
