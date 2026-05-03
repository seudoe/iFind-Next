import { describe, it, expect } from "vitest";
import { validateInternship } from "@/lib/pipeline/validator";
import type { Internship } from "@/types";

const VALID_BASE: Partial<Internship> = {
    name: "Frontend Intern",
    company: "Acme Corp",
    applyLink: "https://acme.com/apply",
    summary:
        "A great internship opportunity at Acme Corp for frontend developers.",
    stipend: {
        type: "paid",
        amount: 10000,
        currency: "INR",
        period: "monthly",
    },
    duration: { value: 3, unit: "months" },
};

describe("validateInternship", () => {
    it("passes a fully valid internship", () => {
        const result = validateInternship(VALID_BASE);
        expect(result.valid).toBe(true);
    });

    it("merges validated fields back with partial data", () => {
        const result = validateInternship({ ...VALID_BASE, skills: ["React"] });
        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.data.skills).toEqual(["React"]);
        }
    });

    // ── Required field failures ──────────────────────────────────────────────────

    it("fails when name is missing", () => {
        const { name: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
        if (!result.valid)
            expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("fails when company is missing", () => {
        const { company: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
    });

    it("fails when applyLink is missing", () => {
        const { applyLink: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
    });

    it("fails when summary is missing", () => {
        const { summary: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
    });

    it("fails when stipend is missing", () => {
        const { stipend: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
    });

    it("fails when duration is missing", () => {
        const { duration: _, ...rest } = VALID_BASE;
        const result = validateInternship(rest);
        expect(result.valid).toBe(false);
    });

    // ── URL validation ───────────────────────────────────────────────────────────

    it("fails when applyLink is not a valid URL", () => {
        const result = validateInternship({
            ...VALID_BASE,
            applyLink: "not-a-url",
        });
        expect(result.valid).toBe(false);
        if (!result.valid)
            expect(result.errors.some((e) => e.includes("applyLink"))).toBe(
                true,
            );
    });

    it("accepts https URLs", () => {
        const result = validateInternship({
            ...VALID_BASE,
            applyLink: "https://jobs.example.co.in/apply",
        });
        expect(result.valid).toBe(true);
    });

    it("accepts http URLs", () => {
        const result = validateInternship({
            ...VALID_BASE,
            applyLink: "http://example.com/job",
        });
        expect(result.valid).toBe(true);
    });

    // ── Stipend validation ───────────────────────────────────────────────────────

    it("fails when stipend.type is paid but amount is null", () => {
        const result = validateInternship({
            ...VALID_BASE,
            stipend: { type: "paid", amount: null },
        });
        expect(result.valid).toBe(false);
        if (!result.valid)
            expect(result.errors.some((e) => e.includes("amount"))).toBe(true);
    });

    it("passes when stipend.type is unpaid with no amount", () => {
        const result = validateInternship({
            ...VALID_BASE,
            stipend: { type: "unpaid" },
        });
        expect(result.valid).toBe(true);
    });

    it("passes when stipend.type is performance-based with no amount", () => {
        const result = validateInternship({
            ...VALID_BASE,
            stipend: { type: "performance-based" },
        });
        expect(result.valid).toBe(true);
    });

    it("fails when stipend.type is invalid", () => {
        const result = validateInternship({
            ...VALID_BASE,
            // @ts-expect-error intentional invalid value
            stipend: { type: "barter" },
        });
        expect(result.valid).toBe(false);
    });

    // ── Duration validation ──────────────────────────────────────────────────────

    it("fails when duration.value is 0", () => {
        const result = validateInternship({
            ...VALID_BASE,
            duration: { value: 0, unit: "months" },
        });
        expect(result.valid).toBe(false);
    });

    it("fails when duration.value exceeds 52", () => {
        const result = validateInternship({
            ...VALID_BASE,
            duration: { value: 53, unit: "weeks" },
        });
        expect(result.valid).toBe(false);
    });

    it("passes duration.value of 52", () => {
        const result = validateInternship({
            ...VALID_BASE,
            duration: { value: 52, unit: "weeks" },
        });
        expect(result.valid).toBe(true);
    });

    it("fails when duration.unit is invalid", () => {
        const result = validateInternship({
            ...VALID_BASE,
            // @ts-expect-error intentional invalid value
            duration: { value: 3, unit: "days" },
        });
        expect(result.valid).toBe(false);
    });
});
