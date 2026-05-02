/**
 * Removes the snake_case imported docs (they have apply_link field).
 * Keeps the properly structured camelCase docs.
 */
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
const col = mongoose.connection.db.collection("internships");

const before = await col.countDocuments();
console.log(`Before: ${before} docs`);

// Delete docs that have apply_link (snake_case — the bad imports)
const result = await col.deleteMany({ apply_link: { $exists: true } });
console.log(`Deleted ${result.deletedCount} snake_case docs`);

const after = await col.countDocuments();
console.log(`After: ${after} docs remaining`);

// Show a sample of what's left
const sample = await col.findOne();
if (sample) {
  console.log("\nSample remaining doc keys:", Object.keys(sample));
  console.log("name:", sample.name);
  console.log("company:", sample.company);
}

await mongoose.disconnect();
console.log("Done");
