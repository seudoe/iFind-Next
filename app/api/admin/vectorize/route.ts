import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";
import mongoose from "mongoose";
import { onInternshipsAddedBatch } from "@/lib/recommendation/events/InternshipEvents";

// ─── Config ───────────────────────────────────────────────────────────────────
const HF_BASE = "https://seudoe-vectorisationResume.hf.space";
const BATCH_SIZE = 70; // HF Space max per request
const BOOST_WEIGHT = 0.15;

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

// ─── Phase 1: Vectorize the given internship IDs ──────────────────────────────

async function vectorizeInternships(ids: string[]): Promise<{
    encoded: number;
    skipped: number;
    errors: string[];
    vectorizedIds: string[];
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
    const vectorizedIds: string[] = [];
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
            vectorizedIds.push(...result.vectors.map((v) => v.id));
        }
    }

    return { encoded, skipped, errors, vectorizedIds };
}

// ─── Phase 2: Insert vectorized internships into HNSW index (Event-driven) ────

// Phase 6: No longer regenerates all recommendations globally.
// Instead, inserts new internships into HNSW index.
// Recommendations are generated lazily when users request them.

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/vectorize
 * Body: { ids: string[] }
 *
 * Phase 6 Behavior:
 * 1. Encodes the given internship IDs via HF Space (in batches of 70)
 * 2. Writes tfidf_vector + bert_vector back to each internship document
 * 3. Triggers event handler to insert vectorized internships into HNSW index
 * 4. Does NOT regenerate recommendations globally (lazy generation on request)
 *
 * Returns:
 *   { success, vectorized, skipped, indexInserted, errors }
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
        const { encoded, skipped, errors, vectorizedIds } = await vectorizeInternships(ids);

        // Phase 2: insert into HNSW index (event-driven)
        let indexInserted = 0;
        if (vectorizedIds.length > 0) {
            try {
                console.log(`📥 Triggering HNSW index insertion for ${vectorizedIds.length} internships...`);
                await onInternshipsAddedBatch(vectorizedIds);
                indexInserted = vectorizedIds.length;
                console.log(`✅ HNSW index updated with ${indexInserted} internships`);
            } catch (indexError) {
                console.error("❌ Failed to update HNSW index:", indexError);
                errors.push(`HNSW index update failed: ${indexError instanceof Error ? indexError.message : String(indexError)}`);
            }
        }

        return NextResponse.json({
            success: true,
            vectorized: encoded,
            skipped,
            indexInserted,
            message: "Internships vectorized and inserted into HNSW index. Recommendations will be generated lazily on user request.",
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
