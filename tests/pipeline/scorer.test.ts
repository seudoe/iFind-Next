import { describe, it, expect } from "vitest";
import { scoreInternship } from "@/lib/pipeline/scorer";
import type { Internship } from "@/types";
import type { LinkVerificationResult } from "@/lib/pipeline/types";

const FULL_INTERNSHIP: Partial<Internship> = {
    name: "Backend Intern",
    company: "TechCorp",
    applyLink: "https://techcorp.com/apply",
    summary:
        "A comprehensive backend internship at TechCorp working on scalable Node.js services and APIs.",
    stipend: {
        type: "paid",
        amount: 20000,
        currency: "INR",
        period: "monthly",
    },
    duration: { value: 3, unit: "months" },
    skills: ["Node.js", "MongoDB"],
};

const GOOD_LINK: LinkVerificationResult = {
    reachable: true,
    statusCode: 200,
    isScamSuspected: false,
    isExpired: false,
    scamSignals: [],
    checkedAt: new Date(),
};

const SCAM_LINK: LinkVerificationResult = {
    reachable: false,
    statusCode: undefined,
    isScamSuspected: true,
    isExpired: false,
    scamSignals: ["domain_on_blocklist"],
    checkedAt: new Date(),
};

const EXPIRED_LINK: LinkVerificationResult = {
    reachable: false,
    statusCode: 410,
    isScamSuspected: false,
    isExpired: true,
    scamSignals: [],
    checkedAt: new Date(),
};

describe("scoreInternship", () => {
    // ── Perfect score ────────────────────────────────────────────────────────────

    it("gives 100 for a perfect internship with good link", () => {
        const { score, flags } = scoreInternship(FULL_INTERNSHIP, GOOD_LINK);
        expect(score).toBe(100);
        expect(flags).toHaveLength(0);
    });

    // ── Required fields (25 pts) ─────────────────────────────────────────────────

    it("awards 25 pts when all required fields present", () => {
        const { score } = scoreInternship(FULL_INTERNSHIP, GOOD_LINK);
        expect(score).toBeGreaterThanOrEqual(25);
    });

    it("does not award required-field points when applyLink missing", () => {
        const { score, flags } = scoreInternship(
            { ...FULL_INTERNSHIP, applyLink: undefined },
            GOOD_LINK,
        );
        expect(score).toBeLessThan(100);
        expect(flags).toContain("invalid_apply_link");
    });

    // ── Skills (10 pts) ──────────────────────────────────────────────────────────

    it("awards 10 pts for skills present", () => {
        const withSkills = scoreInternship(FULL_INTERNSHIP, GOOD_LINK);
        const withoutSkills = scoreInternship(
            { ...FULL_INTERNSHIP, skills: [] },
            GOOD_LINK,
        );
        expect(withSkills.score - withoutSkills.score).toBe(10);
    });

    it("flags missing_skills when skills array is empty", () => {
        const { flags } = scoreInternship(
            { ...FULL_INTERNSHIP, skills: [] },
            GOOD_LINK,
        );
        expect(flags).toContain("missing_skills");
    });

    // ── Summary quality (10 pts) ─────────────────────────────────────────────────

    it("awards 10 pts for summary >= 80 chars", () => {
        const { flags } = scoreInternship(FULL_INTERNSHIP, GOOD_LINK);
        expect(flags).not.toContain("short_summary");
    });

    it("flags short_summary when summary < 80 chars", () => {
        const { flags } = scoreInternship(
            { ...FULL_INTERNSHIP, summary: "Short." },
            GOOD_LINK,
        );
        expect(flags).toContain("short_summary");
    });

    // ── Stipend flag ─────────────────────────────────────────────────────────────

    it("flags missing_stipend_amount when paid but no amount", () => {
        const { flags } = scoreInternship(
            { ...FULL_INTERNSHIP, stipend: { type: "paid", amount: null } },
            GOOD_LINK,
        );
        expect(flags).toContain("missing_stipend_amount");
    });

    it("does not flag missing_stipend_amount for unpaid", () => {
        const { flags } = scoreInternship(
            { ...FULL_INTERNSHIP, stipend: { type: "unpaid" } },
            GOOD_LINK,
        );
        expect(flags).not.toContain("missing_stipend_amount");
    });

    // ── Deadline (5 pts) ─────────────────────────────────────────────────────────

    it("awards 5 pts when no deadline", () => {
        const withDeadline = scoreInternship(
            {
                ...FULL_INTERNSHIP,
                deadlineDate: new Date(Date.now() + 86400000).toISOString(),
            },
            GOOD_LINK,
        );
        const withoutDeadline = scoreInternship(
            { ...FULL_INTERNSHIP, deadlineDate: undefined },
            GOOD_LINK,
        );
        expect(withDeadline.score).toBe(withoutDeadline.score);
    });

    it("flags deadline_in_past when deadline has passed", () => {
        const { flags } = scoreInternship(
            { ...FULL_INTERNSHIP, deadlineDate: "2020-01-01T00:00:00.000Z" },
            GOOD_LINK,
        );
        expect(flags).toContain("deadline_in_past");
    });

    // ── Link checks ──────────────────────────────────────────────────────────────

    it("flags link_unverified when no linkResult provided", () => {
        const { flags } = scoreInternship(FULL_INTERNSHIP);
        expect(flags).toContain("link_unverified");
    });

    it("does not award link points when linkResult is undefined", () => {
        const withLink = scoreInternship(FULL_INTERNSHIP, GOOD_LINK);
        const withoutLink = scoreInternship(FULL_INTERNSHIP);
        expect(withLink.score - withoutLink.score).toBe(50); // 20+15+15
    });

    it("flags link_unreachable when reachable is false", () => {
        const { flags } = scoreInternship(FULL_INTERNSHIP, {
            ...GOOD_LINK,
            reachable: false,
        });
        expect(flags).toContain("link_unreachable");
    });

    it("flags link_expired when isExpired is true", () => {
        const { flags } = scoreInternship(FULL_INTERNSHIP, EXPIRED_LINK);
        expect(flags).toContain("link_expired");
    });

    it("flags link_scam_suspected when isScamSuspected is true", () => {
        const { flags } = scoreInternship(FULL_INTERNSHIP, SCAM_LINK);
        expect(flags).toContain("link_scam_suspected");
    });

    // ── Score caps ───────────────────────────────────────────────────────────────

    it("caps score at 30 when scam suspected", () => {
        const { score } = scoreInternship(FULL_INTERNSHIP, SCAM_LINK);
        expect(score).toBeLessThanOrEqual(30);
    });

    it("caps score at 45 when link is expired", () => {
        const { score } = scoreInternship(FULL_INTERNSHIP, EXPIRED_LINK);
        expect(score).toBeLessThanOrEqual(45);
    });

    it("scam cap takes priority over expired cap", () => {
        const { score } = scoreInternship(FULL_INTERNSHIP, {
            ...SCAM_LINK,
            isExpired: true,
        });
        expect(score).toBeLessThanOrEqual(30);
    });
});
