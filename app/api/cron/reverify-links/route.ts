import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InternshipModel from "@/models/Internship";
import { verifyApplyLink } from "@/lib/pipeline/linkVerifier";

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 },
        );
    }

    try {
        await connectDB();

        const now = new Date();

        // Find up to 50 approved internships due for re-verification
        const internships = await InternshipModel.find({
            "moderation.status": {
                $in: ["auto_approved", "manually_approved"],
            },
            $or: [
                { "linkVerification.nextCheckAt": { $lte: now } },
                { "linkVerification.nextCheckAt": { $exists: false } },
                { "linkVerification.nextCheckAt": null },
            ],
            $and: [
                {
                    $or: [
                        { deadlineDate: null },
                        { deadlineDate: { $gt: now } },
                    ],
                },
            ],
        })
            .limit(50)
            .lean();

        let processed = 0;
        let flagged = 0;

        // Process sequentially — avoid hammering external servers
        for (const internship of internships) {
            try {
                const linkResult = await verifyApplyLink(
                    internship.applyLink,
                    6000,
                );

                const hasIssues =
                    linkResult.isScamSuspected ||
                    !linkResult.reachable ||
                    linkResult.isExpired;
                const nextCheckAt = new Date(
                    now.getTime() + (hasIssues ? 3 : 7) * 24 * 60 * 60 * 1000,
                );

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const update: Record<string, any> = {
                    "linkVerification.reachable": linkResult.reachable,
                    "linkVerification.statusCode":
                        linkResult.statusCode ?? null,
                    "linkVerification.redirectedTo":
                        linkResult.redirectedTo ?? null,
                    "linkVerification.isScamSuspected":
                        linkResult.isScamSuspected,
                    "linkVerification.isExpired": linkResult.isExpired,
                    "linkVerification.scamSignals": linkResult.scamSignals,
                    "linkVerification.checkedAt": linkResult.checkedAt,
                    "linkVerification.nextCheckAt": nextCheckAt,
                };

                const currentStatus = (
                    internship as { moderation?: { status?: string } }
                ).moderation?.status;
                const currentFlags: string[] =
                    (internship as { moderation?: { flags?: string[] } })
                        .moderation?.flags ?? [];

                if (linkResult.isScamSuspected) {
                    update["moderation.status"] = "pending_review";
                    if (!currentFlags.includes("link_scam_suspected")) {
                        update["moderation.flags"] = [
                            ...currentFlags,
                            "link_scam_suspected",
                        ];
                    }
                    flagged++;
                } else if (linkResult.isExpired) {
                    // Both auto_approved and manually_approved get flagged for review
                    if (
                        currentStatus === "auto_approved" ||
                        currentStatus === "manually_approved"
                    ) {
                        update["moderation.status"] = "pending_review";
                    }
                    if (!currentFlags.includes("link_expired")) {
                        update["moderation.flags"] = [
                            ...currentFlags,
                            "link_expired",
                        ];
                    }
                    flagged++;
                }

                await InternshipModel.findByIdAndUpdate(
                    (internship as { _id: unknown })._id,
                    { $set: update },
                );

                processed++;
            } catch (err) {
                console.error(
                    "[cron/reverify-links] Error processing internship:",
                    err,
                );
            }
        }

        console.log(
            `[cron/reverify-links] processed=${processed} flagged=${flagged}`,
        );

        return NextResponse.json({ success: true, processed, flagged });
    } catch (err) {
        console.error("[cron/reverify-links]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
