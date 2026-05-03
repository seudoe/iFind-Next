import type { Internship } from "@/types";
import type { LinkVerificationResult, QualityFlag } from "./types";

export type { QualityFlag };

const SCAM_SCORE_CAP = 30;
const EXPIRED_SCORE_CAP = 45;

export function scoreInternship(
    internship: Partial<Internship>,
    linkResult?: LinkVerificationResult,
): { score: number; flags: QualityFlag[] } {
    const flags: QualityFlag[] = [];
    let score = 0;

    // ── Required fields (25 pts) ─────────────────────────────────────────────
    const hasRequired =
        !!internship.name &&
        !!internship.company &&
        !!internship.applyLink &&
        !!internship.stipend &&
        !!internship.duration &&
        !!internship.summary;

    if (hasRequired) {
        score += 25;
    } else {
        // Granular flags
        if (!internship.applyLink) flags.push("invalid_apply_link");
    }

    // ── Skills (10 pts) ──────────────────────────────────────────────────────
    if (internship.skills && internship.skills.length >= 1) {
        score += 10;
    } else {
        flags.push("missing_skills");
    }

    // ── Summary quality (10 pts) ─────────────────────────────────────────────
    if (internship.summary && internship.summary.length >= 80) {
        score += 10;
    } else {
        flags.push("short_summary");
    }

    // ── Stipend amount (flag only, no point deduction) ───────────────────────
    if (
        internship.stipend?.type === "paid" &&
        (internship.stipend.amount === null ||
            internship.stipend.amount === undefined)
    ) {
        flags.push("missing_stipend_amount");
    }

    // ── Deadline validity (5 pts) ────────────────────────────────────────────
    if (internship.deadlineDate) {
        const deadline = new Date(internship.deadlineDate);
        if (deadline > new Date()) {
            score += 5;
        } else {
            flags.push("deadline_in_past");
        }
    } else {
        // No deadline — award points (not penalized)
        score += 5;
    }

    // ── Link checks ──────────────────────────────────────────────────────────
    if (!linkResult) {
        // Not yet verified — neutral, no points awarded or deducted
        flags.push("link_unverified");
        // Rescale: max possible is 50 (required + skills + summary + deadline)
        // Already computed above, just return without link points
    } else {
        // Reachable (20 pts)
        if (linkResult.reachable) {
            score += 20;
        } else {
            flags.push("link_unreachable");
        }

        // Not expired (15 pts)
        if (!linkResult.isExpired) {
            score += 15;
        } else {
            flags.push("link_expired");
        }

        // Not scam (15 pts)
        if (!linkResult.isScamSuspected) {
            score += 15;
        } else {
            flags.push("link_scam_suspected");
        }
    }

    // ── Score caps ───────────────────────────────────────────────────────────
    if (linkResult?.isScamSuspected) {
        score = Math.min(score, SCAM_SCORE_CAP);
    } else if (linkResult?.isExpired) {
        score = Math.min(score, EXPIRED_SCORE_CAP);
    }

    return { score, flags };
}
