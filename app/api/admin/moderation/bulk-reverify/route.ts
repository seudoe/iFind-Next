import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";
import { verifyApplyLink } from "@/lib/pipeline/linkVerifier";
import { scoreInternship } from "@/lib/pipeline/scorer";

async function requireAdmin() {
    const session = await getSession();
    if (!session)
        return {
            error: NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 },
            ),
        };
    await connectDB();
    const user = await UserModel.findById(session.userId).lean();
    if (!user || (user as { role?: string }).role !== "admin")
        return {
            error: NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            ),
        };
    return { error: null };
}

/**
 * POST /api/admin/moderation/bulk-reverify
 * Re-verifies all pending_review internships whose links haven't been checked yet.
 * Processes sequentially to avoid hammering external servers.
 */
export async function POST(req: NextRequest) {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        await connectDB();

        // Find all pending internships with unverified links
        const internships = await InternshipModel.find({
            "moderation.status": "pending_review",
            "linkVerification.reachable": null,
        })
            .limit(100)
            .lean();

        let processed = 0;
        let updated = 0;

        for (const internship of internships) {
            try {
                const linkResult = await verifyApplyLink(
                    internship.applyLink,
                    8000,
                );

                const { score, flags } = scoreInternship(
                    {
                        name: internship.name,
                        company: internship.company,
                        applyLink: internship.applyLink,
                        stipend: internship.stipend,
                        duration: internship.duration,
                        summary: internship.summary,
                        skills: internship.skills,
                        deadlineDate:
                            internship.deadlineDate?.toISOString() ?? undefined,
                    },
                    linkResult,
                );

                const nextCheckAt = new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                );

                // If scam detected, keep as pending_review but flag it
                const newStatus = linkResult.isScamSuspected
                    ? "pending_review"
                    : (internship.moderation?.status ?? "pending_review");

                await InternshipModel.findByIdAndUpdate(
                    (internship as { _id: unknown })._id,
                    {
                        $set: {
                            linkVerification: {
                                reachable: linkResult.reachable,
                                statusCode: linkResult.statusCode ?? null,
                                redirectedTo: linkResult.redirectedTo ?? null,
                                isScamSuspected: linkResult.isScamSuspected,
                                isExpired: linkResult.isExpired,
                                scamSignals: linkResult.scamSignals,
                                checkedAt: linkResult.checkedAt,
                                nextCheckAt,
                            },
                            "moderation.score": score,
                            "moderation.flags": flags,
                            "moderation.status": newStatus,
                        },
                    },
                );

                updated++;
            } catch {
                // continue on individual failure
            }
            processed++;
        }

        return NextResponse.json({ success: true, processed, updated });
    } catch (err) {
        console.error("[bulk-reverify POST]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
