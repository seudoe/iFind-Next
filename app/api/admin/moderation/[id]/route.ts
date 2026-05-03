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

// ─── GET — single internship detail ──────────────────────────────────────────

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        const { id } = await params;
        await connectDB();

        const doc = await InternshipModel.findById(id).lean();
        if (!doc) {
            return NextResponse.json(
                { success: false, error: "Not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(doc)),
        });
    } catch (err) {
        console.error("[admin/moderation/[id] GET]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}

// ─── PATCH — approve or reject single internship ─────────────────────────────

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { error, session } = await requireAdmin();
        if (error) return error;

        const { id } = await params;
        const body = await req.json();
        const { action, reason } = body as {
            action: "approve" | "reject";
            reason?: string;
        };

        if (action !== "approve" && action !== "reject") {
            return NextResponse.json(
                { success: false, error: "action must be approve or reject" },
                { status: 400 },
            );
        }

        await connectDB();

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

        const doc = await InternshipModel.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true },
        ).lean();

        if (!doc) {
            return NextResponse.json(
                { success: false, error: "Not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(doc)),
        });
    } catch (err) {
        console.error("[admin/moderation/[id] PATCH]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
