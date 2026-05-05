/**
 * Master scraper orchestrator.
 *
 * Runs all Python scrapers sequentially, then pushes each output JSON
 * through the moderation pipeline into MongoDB.
 *
 * Usage:
 *   node scripts/scrape-and-moderate.mjs [--skip-scrape] [--scrapers github,internshala,indeed]
 *
 * Flags:
 *   --skip-scrape   Skip running Python scrapers (use existing JSON files)
 *   --scrapers      Comma-separated list of scrapers to run (default: all)
 *                   Options: github, internshala, indeed
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import mongoose from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Parse flags ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const skipScrape = args.includes("--skip-scrape");
const scrapersArg = args
    .find((a) => a.startsWith("--scrapers="))
    ?.split("=")[1];
const selectedScrapers = scrapersArg
    ? scrapersArg.split(",")
    : ["github", "internshala", "indeed"];

// ─── Scraper config ───────────────────────────────────────────────────────────
const SCRAPERS = [
    {
        id: "github",
        label: "GitHub (2026 SWE Jobs)",
        script: "src/scrapers/github_scraper.py",
        output: "data/internships_dataset_2026.json",
        source: "web_scraping",
    },
    {
        id: "internshala",
        label: "Internshala",
        script: "src/scrapers/internshala_scraper.py",
        output: "data/internships_internshala.json",
        source: "web_scraping",
    },
    {
        id: "indeed",
        label: "Indeed",
        script: "src/scrapers/indeed_scraper.py",
        output: "data/internships_indeed.json",
        source: "web_scraping",
    },
];

// ─── Load env ─────────────────────────────────────────────────────────────────
let envContent;
try {
    envContent = readFileSync(join(ROOT, ".env.local"), "utf-8");
} catch {
    envContent = readFileSync(join(ROOT, ".env"), "utf-8");
}
envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
});

// ─── Ensure data/ dir exists ──────────────────────────────────────────────────
mkdirSync(join(ROOT, "data"), { recursive: true });

// ─── Pipeline helpers (inline) ────────────────────────────────────────────────
function generateFingerprint(company, name, city) {
    const raw = `${(company || "").toLowerCase().trim()}:${(name || "").toLowerCase().trim()}:${(city || "remote").toLowerCase().trim()}`;
    return createHash("sha256").update(raw).digest("hex");
}

async function pushToPipeline(items, source, label) {
    const col = mongoose.connection.db.collection("internships");
    const stats = { saved: 0, duplicate: 0, rejected: 0, errors: 0 };

    for (const item of items) {
        try {
            const name = (item.name || "").trim();
            const company = (item.company || "").trim();
            const applyLink = (item.apply_link || item.applyLink || "").trim();
            const summary = (item.summary || item.description || "").trim();
            const city = (item.city || "remote").trim();
            const country = (item.country || "").trim();
            const skills = Array.isArray(item.skills) ? item.skills : [];

            if (!name || !company || !applyLink || !summary) {
                console.log(
                    `    ⚠️  Skipping "${name || "unnamed"}" — missing required fields`,
                );
                stats.rejected++;
                continue;
            }
            if (!applyLink.startsWith("http")) {
                console.log(`    ⚠️  Skipping "${name}" — invalid URL`);
                stats.rejected++;
                continue;
            }

            const fingerprint = generateFingerprint(company, name, city);
            const existing = await col.findOne({ fingerprint });
            if (existing) {
                console.log(`    ⏭️  Duplicate: "${name}" @ ${company}`);
                stats.duplicate++;
                continue;
            }

            let score = 0;
            if (name && company && applyLink && summary) score += 25;
            if (skills.length >= 1) score += 10;
            if (summary.length >= 80) score += 10;
            score += 5; // no deadline

            const status = score >= 40 ? "pending_review" : "auto_rejected";

            if (status === "auto_rejected") {
                console.log(
                    `    ❌ Auto-rejected: "${name}" (score: ${score})`,
                );
                stats.rejected++;
                continue;
            }

            // Parse duration from duration_string if duration object not provided
            let duration = item.duration;
            if (!duration && item.duration_string) {
                const match =
                    item.duration_string.match(/(\d+)\s*(week|month)/i);
                if (match) {
                    duration = {
                        value: parseInt(match[1], 10),
                        unit: match[2].toLowerCase().startsWith("week")
                            ? "weeks"
                            : "months",
                    };
                }
            }
            if (!duration) {
                duration = { value: 3, unit: "months" }; // fallback
            }

            const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            // Parse deadline_date if provided
            let deadlineDate = null;
            if (item.deadline_date) {
                try {
                    deadlineDate = new Date(item.deadline_date);
                } catch (e) {
                    // Invalid date, leave as null
                }
            }

            await col.insertOne({
                name,
                company,
                applyLink,
                summary,
                city: city || null,
                country: country || null,
                state: item.state || null,
                isRemote: /remote|wfh|work from home/i.test(city),
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
                responsibilities: Array.isArray(item.responsibilities)
                    ? item.responsibilities
                    : null,
                perks: Array.isArray(item.perks) ? item.perks : null,
                tags: Array.isArray(item.tags) ? item.tags : null,
                openings: item.openings || null,
                source,
                isActive: true,
                datePublished: new Date(),
                deadlineDate,
                stipend: item.stipend || {
                    type: "unpaid",
                    amount: null,
                    currency: null,
                    period: null,
                },
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
            });

            console.log(
                `    ✅ [${status}] score:${score} — "${name}" @ ${company}`,
            );
            stats.saved++;
        } catch (err) {
            console.error(`    💥 Error: "${item.name}" — ${err.message}`);
            stats.errors++;
        }
    }

    return stats;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════╗");
console.log("║       iFind Scraper + Moderation Pipeline        ║");
console.log("╚══════════════════════════════════════════════════╝\n");

const active = SCRAPERS.filter((s) => selectedScrapers.includes(s.id));
console.log(`Scrapers: ${active.map((s) => s.label).join(", ")}`);
console.log(`Skip scrape: ${skipScrape}\n`);

// ── Phase 1: Run Python scrapers ──────────────────────────────────────────────
if (!skipScrape) {
    console.log("━━━ Phase 1: Scraping ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const scraper of active) {
        console.log(`▶ Running ${scraper.label}...`);
        const result = spawnSync("python", [scraper.script], {
            cwd: ROOT,
            stdio: "inherit",
            encoding: "utf-8",
        });
        if (result.status !== 0) {
            console.error(
                `  ❌ ${scraper.label} failed (exit ${result.status}) — skipping\n`,
            );
        } else {
            console.log(`  ✓ Done → ${scraper.output}\n`);
        }
    }
} else {
    console.log("⏭️  Skipping scrape phase (--skip-scrape)\n");
}

// ── Phase 2: Push through pipeline ───────────────────────────────────────────
console.log("━━━ Phase 2: Moderation Pipeline ━━━━━━━━━━━━━━━━━━\n");

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

const totals = { saved: 0, duplicate: 0, rejected: 0, errors: 0 };

for (const scraper of active) {
    const filePath = resolve(ROOT, scraper.output);
    if (!existsSync(filePath)) {
        console.log(
            `⚠️  ${scraper.label}: output file not found (${scraper.output}) — skipping\n`,
        );
        continue;
    }

    let items;
    try {
        items = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
        console.error(`❌ Failed to parse ${scraper.output}: ${err.message}\n`);
        continue;
    }

    console.log(`▶ ${scraper.label} — ${items.length} internships`);
    const stats = await pushToPipeline(items, scraper.source, scraper.label);

    console.log(
        `  → saved:${stats.saved} dupes:${stats.duplicate} rejected:${stats.rejected} errors:${stats.errors}\n`,
    );
    totals.saved += stats.saved;
    totals.duplicate += stats.duplicate;
    totals.rejected += stats.rejected;
    totals.errors += stats.errors;
}

await mongoose.disconnect();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log(`✅ Saved to DB:   ${totals.saved}`);
console.log(`⏭️  Duplicates:   ${totals.duplicate}`);
console.log(`❌ Rejected:      ${totals.rejected}`);
console.log(`💥 Errors:        ${totals.errors}`);
console.log("\n🎯 Open the Moderation tab in the dashboard to review.");
