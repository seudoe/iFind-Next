import mongoose from "mongoose";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ─── Load .env (same pattern as check-db.mjs) ─────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// Try .env.local first, fall back to .env
let envContent;
try {
    envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
} catch {
    envContent = readFileSync(join(__dirname, "../.env"), "utf-8");
}

envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
});

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("❌ MONGODB_URI not found");
    process.exit(1);
}

// ─── Connect ──────────────────────────────────────────────────────────────────
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
console.log("✅ Connected to MongoDB");

const db = mongoose.connection.db;
const col = db.collection("internships");

// ─── Find docs missing moderation field ───────────────────────────────────────
const total = await col.countDocuments({ moderation: { $exists: false } });
console.log(`\n📊 Found ${total} documents missing moderation field`);

if (total === 0) {
    console.log("✅ Nothing to backfill");
    await mongoose.disconnect();
    process.exit(0);
}

// ─── Build bulk operations ────────────────────────────────────────────────────
const cursor = col.find({ moderation: { $exists: false } });
const ops = [];
let count = 0;
let updated = 0;

const nextCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs from now

for await (const doc of cursor) {
    const company = (doc.company ?? "").toLowerCase().trim();
    const name = (doc.name ?? "").toLowerCase().trim();
    const city = (doc.city ?? "remote").toLowerCase().trim();
    const fingerprint = createHash("sha256")
        .update(`${company}:${name}:${city}`)
        .digest("hex");

    ops.push({
        updateOne: {
            filter: { _id: doc._id },
            update: {
                $set: {
                    fingerprint,
                    moderation: {
                        status: "auto_approved",
                        score: null,
                        flags: [],
                        source: "manual",
                        reviewedBy: null,
                        reviewedAt: null,
                        rejectionReason: null,
                    },
                    "linkVerification.nextCheckAt": nextCheckAt,
                    "linkVerification.scamSignals":
                        doc.linkVerification?.scamSignals ?? [],
                },
            },
        },
    });

    count++;

    // Flush every 100 docs
    if (ops.length === 100) {
        const result = await col.bulkWrite(ops, { ordered: false });
        updated += result.modifiedCount;
        ops.length = 0;
        console.log(
            `  ↳ Progress: ${count}/${total} processed, ${updated} updated`,
        );
    }
}

// Flush remainder
if (ops.length > 0) {
    const result = await col.bulkWrite(ops, { ordered: false });
    updated += result.modifiedCount;
}

console.log(`\n✅ Backfill complete: ${updated}/${total} documents updated`);

await mongoose.disconnect();
console.log("🔌 Done");
