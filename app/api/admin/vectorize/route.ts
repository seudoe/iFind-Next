import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";
import mongoose from "mongoose";

// ─── Config ───────────────────────────────────────────────────────────────────
const HF_BASE = "https://seudoe-vectorisationResume.hf.space";
const BATCH_SIZE = 70; // HF Space max per request
const BOOST_WEIGHT = 0.15;

// Recommender weights (must match run-recommender.mjs)
const W_TFIDF = 0.4;
const W_BERT = 0.6;
const TOP_N = 20;
const THRESHOLD = 0.1;

async function requireAdmin() {
    const session = await getSession();
    if (!session)
        return {
            error: NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 },
            ),
            session: null,
        };
    await connectDB();
    const user = await UserModel.findById(session.userId).lean();
    if (!user || (user as { role?: string }).role !== "admin")
        return {
            error: NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            ),
            session: null,
        };
    return { error: null, session };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hfPost(path: string, body: unknown) {
    const res = await fetch(`${HF_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HF ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

function dot(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

// ─── Phase 1: Vectorize the given internship IDs ──────────────────────────────

async function vectorizeInternships(ids: string[]): Promise<{
    encoded: number;
    skipped: number;
    errors: string[];
}> {
    await connectDB();
    const db = mongoose.connection.db!;
    const col = db.collection("internships");

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const docs = await col
        .find({ _id: { $in: objectIds } })
        .project({ _id: 1, name: 1, summary: 1 })
        .toArray();

    const valid = docs.filter((d) => d.name && d.summary);
    const skipped = docs.length - valid.length;
    const errors: string[] = [];
    let encoded = 0;

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE);

        let result: { vectors: { id: string; tfidf: number[]; bert: number[] }[] };
        try {
            result = await hfPost("/encode-internships", {
                internships: batch.map((doc) => ({
                    id: doc._id.toString(),
                    title: doc.name,
                    description: doc.summary,
                })),
                boost_weight: BOOST_WEIGHT,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Batch ${i / BATCH_SIZE + 1}: ${msg}`);
            continue;
        }

        const ops = result.vectors.map((v) => ({
            updateOne: {
                filter: { _id: new mongoose.Types.ObjectId(v.id) },
                update: { $set: { tfidf_vector: v.tfidf, bert_vector: v.bert } },
            },
        }));

        if (ops.length > 0) {
            await col.bulkWrite(ops);
            encoded += ops.length;
        }
    }

    return { encoded, skipped, errors };
}

// ─── Phase 2: Re-run recommender for all users against newly vectorized internships ──

async function updateRecommendations(newInternshipIds: string[]): Promise<{
    processed: number;
    skipped: number;
}> {
    await connectDB();
    const db = mongoose.connection.db!;

    // Load only the newly vectorized internships
    const objectIds = newInternshipIds.map(
        (id) => new mongoose.Types.ObjectId(id),
    );
    const newInternships = await db
        .collection("internships")
        .find({
            _id: { $in: objectIds },
            tfidf_vector: { $exists: true },
            bert_vector: { $exists: true },
        })
        .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
        .toArray();

    if (newInternships.length === 0) return { processed: 0, skipped: 0 };

    // Process all users who have resume vectors
    const userCursor = db
        .collection("users")
        .find({
            "resume.tfidf_vector": { $exists: true },
            "resume.bert_vector": { $exists: true },
        })
        .project({
            _id: 1,
            "resume.tfidf_vector": 1,
            "resume.bert_vector": 1,
            recommendedInternships: 1,
            recommendedScores: 1,
        });

    let processed = 0;
    let skipped = 0;

    for await (const user of userCursor) {
        const userTfidf: number[] = user.resume?.tfidf_vector;
        const userBert: number[] = user.resume?.bert_vector;

        if (!userTfidf || !userBert) {
            skipped++;
            continue;
        }

        // Score only the new internships
        const newScored = newInternships.map((intern) => ({
            id: intern._id,
            score:
                dot(userTfidf, intern.tfidf_vector) * W_TFIDF +
                dot(userBert, intern.bert_vector) * W_BERT,
        }));

        // Merge with existing recommendations
        const existingScores: { id: mongoose.Types.ObjectId; score: number }[] =
            user.recommendedScores ?? [];

        // Build a map of existing scores, keyed by string ID
        const scoreMap = new Map<string, number>(
            existingScores.map((s) => [s.id.toString(), s.score]),
        );

        // Upsert new scores
        for (const s of newScored) {
            if (s.score >= THRESHOLD) {
                const key = s.id.toString();
                // Keep the higher score if already present
                if (!scoreMap.has(key) || scoreMap.get(key)! < s.score) {
                    scoreMap.set(key, s.score);
                }
            }
        }

        // Re-sort and take top N
        const merged = Array.from(scoreMap.entries())
            .map(([id, score]) => ({ id: new mongoose.Types.ObjectId(id), score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, TOP_N);

        await db.collection("users").updateOne(
            { _id: user._id },
            {
                $set: {
                    recommendedInternships: merged.map((r) => r.id),
                    recommendedScores: merged.map((r) => ({
                        id: r.id,
                        score: Math.round(r.score * 1000) / 1000,
                    })),
                    recommendedUpdatedAt: new Date(),
                },
            },
        );

        processed++;
    }

    return { processed, skipped };
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/vectorize
 * Body: { ids: string[] }
 *
 * 1. Encodes the given internship IDs via HF Space (in batches of 70)
 * 2. Writes tfidf_vector + bert_vector back to each internship document
 * 3. Re-runs the recommender for all users, merging new scores into existing ones
 *
 * Returns:
 *   { success, vectorized, skipped, recommendationsUpdated, errors }
 */
export async function POST(req: NextRequest) {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        const body = await req.json().catch(() => ({}));
        const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

        if (ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "No internship IDs provided" },
                { status: 400 },
            );
        }

        // Phase 1: vectorize
        const { encoded, skipped, errors } = await vectorizeInternships(ids);

        // Phase 2: update recommendations (only for successfully vectorized ones)
        // We re-query to get only those that now have vectors
        const { processed: recommendationsUpdated } =
            await updateRecommendations(ids);

        return NextResponse.json({
            success: true,
            vectorized: encoded,
            skipped,
            recommendationsUpdated,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err) {
        console.error("[admin/vectorize POST]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
