/**
 * Bridge script: reads scraped JSON output and pushes each internship
 * through the moderation pipeline so results appear in the dashboard.
 *
 * Usage:
 *   node scripts/run-scraper-pipeline.mjs [path-to-json] [source]
 *
 * Examples:
 *   node scripts/run-scraper-pipeline.mjs data/internships_dataset_2026.json web_scraping
 *   node scripts/run-scraper-pipeline.mjs data/internships_internshala.json web_scraping
 *   node scripts/run-scraper-pipeline.mjs data/internships_indeed.json web_scraping
 */

import mongoose from "mongoose";
import { readFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load env ─────────────────────────────────────────────────────────────────
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

// ─── Args ─────────────────────────────────────────────────────────────────────
const inputFile = process.argv[2] || "data/internships_dataset_2026.json";
const source = process.argv[3] || "web_scraping";

const VALID_SOURCES = [
    "web_scraping",
    "api",
    "user_contributed",
    "email_parsing",
    "rss",
    "community_bot",
];
if (!VALID_SOURCES.includes(source)) {
    console.error(
        `❌ Invalid source "${source}". Must be one of: ${VALID_SOURCES.join(", ")}`,
    );
    process.exit(1);
}

const filePath = resolve(inputFile);
if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
}

// ─── Load scraped data ────────────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(filePath, "utf-8"));
console.log(`\n📂 Loaded ${raw.length} internships from ${inputFile}`);
console.log(`📡 Source: ${source}\n`);

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set");
    process.exit(1);
}

await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
});
console.log("✅ Connected to MongoDB\n");

const db = mongoose.connection.db;
const col = db.collection("internships");

// ─── Pipeline logic (inline — avoids TS compilation) ─────────────────────────

function generateFingerprint(company, name, city) {
    const raw = `${company.toLowerCase().trim()}:${name.toLowerCase().trim()}:${(city || "remote").toLowerCase().trim()}`;
    return createHash("sha256").update(raw).digest("hex");
}

function normalizeDuration(raw) {
    if (raw?.value && raw?.unit) return raw;
    return { value: 3, unit: "months" }; // default for scraped data
}

function normalizeStipend(raw) {
    if (raw?.type) return raw;
    return { type: "unpaid", amount: null, currency: "USD", period: null };
}

// ─── Process each internship ──────────────────────────────────────────────────
const stats = { saved: 0, duplicate: 0, rejected: 0, errors: 0 };

for (const item of raw) {
    try {
        const name = (item.name || "").trim();
        const company = (item.company || "").trim();
        const applyLink = (item.apply_link || item.applyLink || "").trim();
        const summary = (item.summary || item.description || "").trim();
        const city = (item.city || "remote").trim();
        const country = (item.country || "").trim();
        const skills = Array.isArray(item.skills) ? item.skills : [];

        // Basic validation
        if (!name || !company || !applyLink || !summary) {
            console.log(
                `  ⚠️  Skipping "${name || "unnamed"}" — missing required fields`,
            );
            stats.rejected++;
            continue;
        }

        if (!applyLink.startsWith("http")) {
            console.log(
                `  ⚠️  Skipping "${name}" — invalid applyLink: ${applyLink}`,
            );
            stats.rejected++;
            continue;
        }

        // Deduplication
        const fingerprint = generateFingerprint(company, name, city);
        const existing = await col.findOne({ fingerprint });
        if (existing) {
            console.log(`  ⏭️  Duplicate: "${name}" @ ${company}`);
            stats.duplicate++;
            continue;
        }

        // Determine stipend
        const stipend = normalizeStipend(item.stipend);

        // Determine duration
        const duration = normalizeDuration(item.duration);

        // Score (simplified — no live link check for bulk import)
        let score = 0;
        if (name && company && applyLink && summary && stipend && duration)
            score += 25;
        if (skills.length >= 1) score += 10;
        if (summary.length >= 80) score += 10;
        score += 5; // no deadline = full points
        // No link verification for bulk import (skipLinkVerification)
        // Max possible without link check = 50

        const status = score >= 40 ? "pending_review" : "auto_rejected";

        if (status === "auto_rejected") {
            console.log(`  ❌ Auto-rejected: "${name}" (score: ${score})`);
            stats.rejected++;
            continue;
        }

        // nextCheckAt: 7 days for web_scraping
        const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const doc = {
            name,
            company,
            applyLink,
            summary,
            city: city || null,
            country: country || null,
            state: item.state || null,
            isRemote: /remote|wfh|work from home/i.test(city) || false,
            skills,
            degree: Array.isArray(item.degree)
                ? item.degree
                : item.degree
                  ? [item.degree]
                  : null,
            field: Array.isArray(item.field)
                ? item.field
                : item.field
                  ? [item.field]
                  : null,
            source: source,
            isActive: true,
            datePublished: new Date(),
            stipend,
            duration,
            experienceRequired: { unit: "months" },
            fingerprint,
            linkVerification: {
                reachable: null,
                statusCode: null,
                redirectedTo: null,
                isScamSuspected: null,
                isExpired: null,
                scamSignals: [],
                checkedAt: null,
                nextCheckAt,
            },
            moderation: {
                status,
                score,
                flags: skills.length === 0 ? ["missing_skills"] : [],
                source,
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await col.insertOne(doc);
        console.log(
            `  ✅ Saved [${status}] (score: ${score}): "${name}" @ ${company}`,
        );
        stats.saved++;
    } catch (err) {
        console.error(`  ❌ Error processing "${item.name}":`, err.message);
        stats.errors++;
    }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────");
console.log(`✅ Saved to DB:    ${stats.saved}`);
console.log(`⏭️  Duplicates:    ${stats.duplicate}`);
console.log(`❌ Rejected:       ${stats.rejected}`);
console.log(`💥 Errors:         ${stats.errors}`);
console.log("─────────────────────────────────────────");
console.log(
    "\n🎯 Open the dashboard → Moderation tab to review pending internships.",
);

await mongoose.disconnect();
