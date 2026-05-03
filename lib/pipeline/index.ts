import { connectDB } from "@/lib/db";
import InternshipModel from "@/models/Internship";
import { normalizeInternship } from "./normalizer";
import { validateInternship } from "./validator";
import { generateFingerprint, isDuplicate } from "./deduplicator";
import { verifyApplyLink } from "./linkVerifier";
import { scoreInternship } from "./scorer";
import type {
    RawInternship,
    PipelineSource,
    PipelineResult,
    LinkVerificationResult,
} from "./types";

export async function runModerationPipeline(
    raw: RawInternship,
    source: PipelineSource,
    options?: {
        skipLinkVerification?: boolean;
        timeoutMs?: number;
    },
): Promise<PipelineResult> {
    // ── Step 1: Normalize ──────────────────────────────────────────────────────
    const normalized = normalizeInternship(raw);

    // ── Step 2: Validate ───────────────────────────────────────────────────────
    const validation = validateInternship(normalized);
    if (!validation.valid) {
        console.error("[pipeline] Validation failed:", validation.errors);
        return {
            status: "auto_rejected",
            score: 0,
            flags: ["validation_failed"],
        };
    }
    const validated = validation.data;

    // ── Step 3: Fingerprint ────────────────────────────────────────────────────
    const fingerprint = await generateFingerprint(validated);

    // ── Step 4: Deduplication ──────────────────────────────────────────────────
    const duplicate = await isDuplicate(fingerprint);
    if (duplicate) {
        console.error("[pipeline] Duplicate detected:", fingerprint);
        return { status: "auto_rejected", score: 0, flags: ["duplicate"] };
    }

    // ── Step 5: Link verification ──────────────────────────────────────────────
    let linkResult: LinkVerificationResult | undefined;
    if (!options?.skipLinkVerification) {
        linkResult = await verifyApplyLink(
            validated.applyLink,
            options?.timeoutMs ?? 8000,
        );
    }

    // ── Step 6: Score ──────────────────────────────────────────────────────────
    const { score, flags } = scoreInternship(validated, linkResult);

    // ── Step 7: Determine status ───────────────────────────────────────────────
    let status: PipelineResult["status"];

    if (linkResult?.isScamSuspected) {
        status = "auto_rejected";
        if (!flags.includes("link_scam_suspected"))
            flags.push("link_scam_suspected");
    } else if (score >= 70) {
        status = "auto_approved";
    } else if (score >= 40) {
        status = "pending_review";
    } else {
        status = "auto_rejected";
    }

    // ── Step 8/9: Save or reject ───────────────────────────────────────────────
    if (status === "auto_rejected") {
        console.error("[pipeline] Auto-rejected:", {
            score,
            flags,
            fingerprint,
        });
        return { status, score, flags };
    }

    // Compute nextCheckAt based on source
    const now = new Date();
    const nextCheckAt = new Date(
        now.getTime() +
            (source === "user_contributed"
                ? 3 * 24 * 60 * 60 * 1000 // 3 days
                : 7 * 24 * 60 * 60 * 1000), // 7 days
    );

    await connectDB();

    const doc = await InternshipModel.create({
        ...validated,
        fingerprint,
        linkVerification: linkResult
            ? {
                  reachable: linkResult.reachable,
                  statusCode: linkResult.statusCode ?? null,
                  redirectedTo: linkResult.redirectedTo ?? null,
                  isScamSuspected: linkResult.isScamSuspected,
                  isExpired: linkResult.isExpired,
                  scamSignals: linkResult.scamSignals,
                  checkedAt: linkResult.checkedAt,
                  nextCheckAt,
              }
            : { scamSignals: [], nextCheckAt },
        moderation: {
            status,
            score,
            flags,
            source,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
        },
    });

    return {
        status,
        score,
        flags,
        normalized: JSON.parse(JSON.stringify(doc)),
    };
}
