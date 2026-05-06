import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

// ─── Config ───────────────────────────────────────────────────────────────────
const HF_BASE      = "https://seudoe-vectorisationResume.hf.space";
const BOOST_WEIGHT = 0.15;
const W_TFIDF      = 0.4;
const W_BERT       = 0.6;
const TOP_N        = 20;
const THRESHOLD    = 0.1;

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

/**
 * POST /api/user/resume/vectorize
 *
 * Called after a user uploads/commits their resume.
 * 1. Encodes the user's parsedData via HF Space /encode-resume
 * 2. Saves tfidf_vector + bert_vector to user.resume
 * 3. Scores all active internships that have vectors against the user's vectors
 * 4. Saves top-N recommendations to user.recommendedInternships
 *
 * Fire-and-forget from the client — returns quickly, heavy work runs server-side.
 */
export async function POST() {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

        await connectDB();
        const db = mongoose.connection.db!;
        const usersCol = db.collection("users");

        const user = await usersCol.findOne(
            { _id: new mongoose.Types.ObjectId(session.userId) },
            { projection: { _id: 1, "resume.parsedData": 1 } },
        );

        if (!user)
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

        const parsedData = user.resume?.parsedData;
        if (!parsedData)
            return NextResponse.json(
                { success: false, error: "No parsed resume data to vectorize" },
                { status: 400 },
            );

        // ── Phase 1: encode resume ────────────────────────────────────────────
        let tfidf: number[];
        let bert: number[];
        try {
            const result = await hfPost("/encode-resume", {
                resume:       parsedData,
                boost_weight: BOOST_WEIGHT,
            });
            tfidf = result.tfidf;
            bert  = result.bert;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[resume/vectorize] HF encode failed:", msg);
            return NextResponse.json(
                { success: false, error: `Vectorization failed: ${msg}` },
                { status: 502 },
            );
        }

        // Save vectors to user doc
        await usersCol.updateOne(
            { _id: user._id },
            {
                $set: {
                    "resume.tfidf_vector": tfidf,
                    "resume.bert_vector":  bert,
                },
            },
        );

        // ── Phase 2: score all active internships with vectors ────────────────
        const internships = await db
            .collection("internships")
            .find({
                isActive:     true,
                tfidf_vector: { $exists: true },
                bert_vector:  { $exists: true },
            })
            .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
            .toArray();

        if (internships.length === 0) {
            return NextResponse.json({
                success: true,
                vectorized: true,
                recommendations: 0,
                note: "No vectorized internships found yet — run the moderation pipeline first.",
            });
        }

        const scored = internships
            .map((intern) => ({
                id:    intern._id,
                score: dot(tfidf, intern.tfidf_vector) * W_TFIDF
                     + dot(bert,  intern.bert_vector)  * W_BERT,
            }))
            .filter((s) => s.score >= THRESHOLD)
            .sort((a, b) => b.score - a.score)
            .slice(0, TOP_N);

        await usersCol.updateOne(
            { _id: user._id },
            {
                $set: {
                    recommendedInternships: scored.map((r) => r.id),
                    recommendedScores:      scored.map((r) => ({
                        id:    r.id,
                        score: Math.round(r.score * 1000) / 1000,
                    })),
                    recommendedUpdatedAt: new Date(),
                },
            },
        );

        return NextResponse.json({
            success:         true,
            vectorized:      true,
            recommendations: scored.length,
        });
    } catch (err) {
        console.error("[resume/vectorize POST]", err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Server error" },
            { status: 500 },
        );
    }
}
