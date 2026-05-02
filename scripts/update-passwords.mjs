/**
 * One-time script: sets every user's password to bcrypt("password")
 * Run with: node scripts/update-passwords.mjs
 */

import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) return;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (key) process.env[key] = val;
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not found in .env.local");
  process.exit(1);
}

const PLAIN_PASSWORD = "password";

async function main() {
  console.log("🔌  Connecting to MongoDB Atlas...");
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  await client.connect();
  console.log("✅  Connected");

  const db = client.db();
  const users = db.collection("users");

  const count = await users.countDocuments();
  console.log(`📋  Found ${count} user(s)`);

  if (count === 0) {
    console.log("⚠️   No users found — nothing to update.");
    await client.close();
    return;
  }

  const hashed = await bcrypt.hash(PLAIN_PASSWORD, 10);
  const result = await users.updateMany({}, { $set: { password: hashed } });
  console.log(`✅  Updated ${result.modifiedCount} user(s) — password is now "${PLAIN_PASSWORD}"`);

  await client.close();
  console.log("🔌  Done");
}

main().catch((err) => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
