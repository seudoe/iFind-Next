import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { deleteResumeFileById } from "@/lib/gridfs";

// ─── Inline vectorization (called after commit, non-blocking) ─────────────────
const HF_BASE      = "https://seudoe-vectorisationResume.hf.space";
const BOOST_WEIGHT = 0.15;
const W_TFIDF      = 0.4;
const W_BERT       = 0.6;
const TOP_N        = 20;
const THRESHOLD    = 0.1;

async function vectorizeAndRecommend(userId: string, parsedData: unknown) {
  try {
    await connectDB();
    const mongoose = (await import("mongoose")).default;
    const db = mongoose.connection.db!;

    // 1. Encode resume via HF Space
    const hfRes = await fetch(`${HF_BASE}/encode-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: parsedData, boost_weight: BOOST_WEIGHT }),
    });

    if (!hfRes.ok) {
      const text = await hfRes.text();
      console.error(`[resume/commit] HF encode-resume failed ${hfRes.status}: ${text.slice(0, 200)}`);
      return;
    }

    const { tfidf, bert } = await hfRes.json();

    if (!tfidf || !bert) {
      console.error("[resume/commit] HF returned no tfidf/bert vectors");
      return;
    }

    // 2. Save vectors to user doc
    const userOid = new mongoose.Types.ObjectId(userId);
    await db.collection("users").updateOne(
      { _id: userOid },
      { $set: { "resume.tfidf_vector": tfidf, "resume.bert_vector": bert } },
    );

    // 3. Score all active internships with vectors
    const internships = await db
      .collection("internships")
      .find({ isActive: true, tfidf_vector: { $exists: true }, bert_vector: { $exists: true } })
      .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
      .toArray();

    if (internships.length === 0) {
      console.log("[resume/commit] No vectorized internships yet — skipping recommendations");
      return;
    }

    function dot(a: number[], b: number[]) {
      if (!a || !b || a.length !== b.length) return 0;
      let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
    }

    const scored = internships
      .map((intern) => ({
        id:    intern._id,
        score: dot(tfidf, intern.tfidf_vector) * W_TFIDF + dot(bert, intern.bert_vector) * W_BERT,
      }))
      .filter((s) => s.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    await db.collection("users").updateOne(
      { _id: userOid },
      {
        $set: {
          recommendedInternships: scored.map((r) => r.id),
          recommendedScores:      scored.map((r) => ({ id: r.id, score: Math.round(r.score * 1000) / 1000 })),
          recommendedUpdatedAt:   new Date(),
        },
      },
    );

    console.log(`[resume/commit] Vectorized user ${userId} — ${scored.length} recommendations saved`);
  } catch (err) {
    // Non-blocking — log but don't fail the commit
    console.error("[resume/commit] vectorizeAndRecommend error:", err);
  }
}

/**
 * POST /api/user/resume/commit
 *
 * User confirmed "Apply new data".
 * - Deletes the old live GridFS file
 * - Promotes pending* fields to live fields
 * - Clears pending* fields
 * - Recomputes profile score
 * - Kicks off vectorization + recommendations in the background (non-blocking)
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    if (!user.resume?.pendingFileId)
      return NextResponse.json({ success: false, error: "No pending resume to commit" }, { status: 400 });

    // Delete the old live file from GridFS (if one exists)
    if (user.resume.driveFileId) {
      await deleteResumeFileById(user.resume.driveFileId);
    }

    const parsedData = user.resume.pendingParsedData;

    // Promote pending → live
    user.resume.driveFileId   = user.resume.pendingFileId;
    user.resume.driveViewLink = user.resume.pendingViewLink;
    user.resume.uploadedAt    = new Date();
    user.resume.parsedData    = parsedData;

    // Clear pending slot
    user.resume.pendingFileId     = null;
    user.resume.pendingViewLink   = null;
    user.resume.pendingParsedData = null;

    // Recompute profile score
    let score = 20;
    if (user.profilePicture) score += 10;
    if (user.resume.driveFileId) score += 20;
    if (parsedData?.skills?.length >= 3) score += 15;
    if (parsedData?.education?.length > 0) score += 15;
    if (parsedData?.workHistory?.length > 0) score += 10;
    if (user.phone) score += 5;
    if (user.city) score += 5;
    user.profileCompletionScore = Math.min(score, 100);

    await user.save();

    // Kick off vectorization server-side — non-blocking, runs after response is sent
    const userId    = session.userId;
    const dataToVec = parsedData;
    // Use void to explicitly not await — response returns immediately
    void vectorizeAndRecommend(userId, dataToVec);

    return NextResponse.json({
      success: true,
      data: {
        fileId:    user.resume.driveFileId,
        viewLink:  user.resume.driveViewLink,
        uploadedAt: user.resume.uploadedAt,
        parsedData,
      },
    });
  } catch (err) {
    console.error("[resume/commit POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Commit failed" },
      { status: 500 },
    );
  }
}
