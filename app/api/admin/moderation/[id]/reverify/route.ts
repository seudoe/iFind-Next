import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InternshipModel from "@/models/Internship";
import UserModel from "@/models/User";
import { verifyApplyLink } from "@/lib/pipeline/linkVerifier";
import { scoreInternship } from "@/lib/pipeline/scorer";
import type { LinkVerificationResult } from "@/lib/pipeline/types";

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
    if (!user || (user as { role?: string }).role !== "admin") {
        return {
            error: NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            ),
        };
    }
    return { error: null };
}

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        const { id } = await params;
        await connectDB();

        const internship = await InternshipModel.findById(id);
        if (!internship) {
            return NextResponse.json(
                { success: false, error: "Not found" },
                { status: 404 },
            );
        }

        // Run fresh link verification
        const linkResult: LinkVerificationResult = await verifyApplyLink(
            internship.applyLink,
            8000,
        );

        // Re-score with fresh link result
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

        const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const updated = await InternshipModel.findByIdAndUpdate(
            id,
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
                },
            },
            { new: true },
        ).lean();

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(updated)),
        });
    } catch (err) {
        console.error("[admin/moderation/[id]/reverify POST]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
