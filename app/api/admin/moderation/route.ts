import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
    const session = await getSession();
    if (!session) {
        return {
            error: NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 },
            ),
            session: null,
        };
    }
    await connectDB();
    const user = await UserModel.findById(session.userId).lean();
    if (!user || (user as { role?: string }).role !== "admin") {
        return {
            error: NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            ),
            session: null,
        };
    }
    return { error: null, session };
}

// ─── GET — paginated pending queue with stats ─────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        // connectDB already called inside requireAdmin
        const { searchParams } = req.nextUrl;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(
            100,
            parseInt(searchParams.get("limit") || "20"),
        );
        const skip = (page - 1) * limit;
        const filter = searchParams.get("filter") || "all";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: Record<string, any> = {
            "moderation.status": "pending_review",
        };

        if (filter === "scam_suspected") {
            query["linkVerification.isScamSuspected"] = true;
        } else if (filter === "link_issues") {
            query.$or = [
                { "linkVerification.isExpired": true },
                { "linkVerification.reachable": false },
            ];
        } else if (filter === "low_score") {
            query["moderation.score"] = { $lt: 50 };
        }

        const [docs, total] = await Promise.all([
            InternshipModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            InternshipModel.countDocuments(query),
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            pendingCount,
            scamSuspectedCount,
            linkIssuesCount,
            autoApprovedToday,
            autoRejectedToday,
        ] = await Promise.all([
            InternshipModel.countDocuments({
                "moderation.status": "pending_review",
            }),
            InternshipModel.countDocuments({
                "moderation.status": "pending_review",
                "linkVerification.isScamSuspected": true,
            }),
            InternshipModel.countDocuments({
                "moderation.status": "pending_review",
                $or: [
                    { "linkVerification.isExpired": true },
                    { "linkVerification.reachable": false },
                ],
            }),
            InternshipModel.countDocuments({
                "moderation.status": "auto_approved",
                createdAt: { $gte: today },
            }),
            InternshipModel.countDocuments({
                "moderation.status": "auto_rejected",
                createdAt: { $gte: today },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(docs)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            stats: {
                pendingCount,
                scamSuspectedCount,
                linkIssuesCount,
                autoApprovedToday,
                autoRejectedToday,
            },
        });
    } catch (err) {
        console.error("[admin/moderation GET]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}

// ─── PATCH — bulk approve / reject ───────────────────────────────────────────

export async function PATCH(req: NextRequest) {
    try {
        const { error, session } = await requireAdmin();
        if (error) return error;

        const body = await req.json();
        const { ids, action, reason } = body as {
            ids: string[];
            action: "approve" | "reject";
            reason?: string;
        };

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "ids array required" },
                { status: 400 },
            );
        }
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json(
                { success: false, error: "action must be approve or reject" },
                { status: 400 },
            );
        }

        const now = new Date();
        const update =
            action === "approve"
                ? {
                      "moderation.status": "manually_approved",
                      "moderation.reviewedBy": session!.userId,
                      "moderation.reviewedAt": now,
                  }
                : {
                      "moderation.status": "manually_rejected",
                      "moderation.reviewedBy": session!.userId,
                      "moderation.reviewedAt": now,
                      "moderation.rejectionReason": reason ?? null,
                  };

        const result = await InternshipModel.updateMany(
            { _id: { $in: ids } },
            { $set: update },
        );

        return NextResponse.json({
            success: true,
            data: { modifiedCount: result.modifiedCount },
        });
    } catch (err) {
        console.error("[admin/moderation PATCH]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
