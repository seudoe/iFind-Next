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
console.log("Connecting...");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, family: 4 });

const adminDb = mongoose.connection.getClient().db("admin");
const { databases } = await adminDb.admin().listDatabases();
console.log("All databases:", databases.map(d => `${d.name} (${d.sizeOnDisk} bytes)`));

// Check each DB for internships
for (const { name } of databases) {
  if (name === "admin" || name === "local" || name === "config") continue;
  const db = mongoose.connection.getClient().db(name);
  const cols = await db.listCollections().toArray();
  const colNames = cols.map(c => c.name);
  if (colNames.includes("internships")) {
    const count = await db.collection("internships").countDocuments();
    console.log(`\n✅ DB "${name}" has internships: ${count} docs`);
    if (count > 0) {
      const s = await db.collection("internships").findOne();
      console.log("   Keys:", Object.keys(s).slice(0, 8));
      console.log("   name:", s.name, "| company:", s.company);
    }
  }
}

await mongoose.disconnect();
