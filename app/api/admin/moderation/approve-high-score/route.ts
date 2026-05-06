import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";

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

/**
 * POST /api/admin/moderation/approve-high-score
 * Bulk-approves all pending_review internships with score >= threshold (default 80).
 * Body: { threshold?: number }
 */
export async function POST(req: NextRequest) {
    try {
        const { error, session } = await requireAdmin();
        if (error) return error;

        const body = await req.json().catch(() => ({}));
        const threshold =
            typeof body.threshold === "number" ? body.threshold : 80;

        await connectDB();

        const now = new Date();

        // Fetch matching IDs first so we can return them for vectorization
        const toApprove = await InternshipModel.find(
            {
                "moderation.status": "pending_review",
                "moderation.score": { $gte: threshold },
                $or: [
                    { "linkVerification.isScamSuspected": false },
                    { "linkVerification.isScamSuspected": null },
                ],
            },
            { _id: 1 },
        ).lean();

        const ids = toApprove.map((d) => (d._id as { toString(): string }).toString());

        await InternshipModel.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    "moderation.status": "manually_approved",
                    "moderation.reviewedBy": session!.userId,
                    "moderation.reviewedAt": now,
                },
            },
        );

        return NextResponse.json({
            success: true,
            approved: ids.length,
            threshold,
            ids, // returned so the client can trigger vectorization
        });
    } catch (err) {
        console.error("[approve-high-score POST]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
