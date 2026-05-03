import { describe, it, expect } from "vitest";
import { normalizeInternship } from "@/lib/pipeline/normalizer";

describe("normalizeInternship", () => {
    // ── snake_case → camelCase mapping ──────────────────────────────────────────

    it("maps apply_link to applyLink", () => {
        const result = normalizeInternship({
            apply_link: "https://example.com/apply",
        });
        expect(result.applyLink).toBe("https://example.com/apply");
    });

    it("prefers applyLink over apply_link", () => {
        const result = normalizeInternship({
            applyLink: "https://new.com",
            apply_link: "https://old.com",
        });
        expect(result.applyLink).toBe("https://new.com");
    });

    it("maps date_published to datePublished as ISO string", () => {
        const result = normalizeInternship({ date_published: "2024-01-15" });
        expect(result.datePublished).toBe(new Date("2024-01-15").toISOString());
    });

    it("maps deadline_date to deadlineDate", () => {
        const result = normalizeInternship({ deadline_date: "2025-06-01" });
        expect(result.deadlineDate).toBe(new Date("2025-06-01").toISOString());
    });

    it("maps is_remote to isRemote", () => {
        const result = normalizeInternship({ is_remote: true });
        expect(result.isRemote).toBe(true);
    });

    it("maps description to summary", () => {
        const result = normalizeInternship({
            description: "A great internship",
        });
        expect(result.summary).toBe("A great internship");
    });

    it("prefers summary over description", () => {
        const result = normalizeInternship({
            summary: "Primary summary",
            description: "Fallback description",
        });
        expect(result.summary).toBe("Primary summary");
    });

    // ── Remote inference ─────────────────────────────────────────────────────────

    it("infers isRemote from city containing 'Work from Home'", () => {
        const result = normalizeInternship({ city: "Work from Home" });
        expect(result.isRemote).toBe(true);
    });

    it("infers isRemote from location containing 'remote'", () => {
        const result = normalizeInternship({ location: "Remote" });
        expect(result.isRemote).toBe(true);
    });

    it("infers isRemote from location containing 'wfh'", () => {
        const result = normalizeInternship({ location: "WFH" });
        expect(result.isRemote).toBe(true);
    });

    it("does not infer isRemote for a normal city", () => {
        const result = normalizeInternship({ city: "Mumbai" });
        expect(result.isRemote).toBe(false);
    });

    // ── Stipend normalization ────────────────────────────────────────────────────

    it("maps stipend_type '0' to unpaid", () => {
        const result = normalizeInternship({ stipend_type: "0" });
        expect(result.stipend?.type).toBe("unpaid");
    });

    it("maps stipend_type 'unpaid' to unpaid", () => {
        const result = normalizeInternship({ stipend_type: "unpaid" });
        expect(result.stipend?.type).toBe("unpaid");
    });

    it("maps numeric stipend_amount to paid with amount", () => {
        const result = normalizeInternship({
            stipend_type: "paid",
            stipend_amount: 15000,
        });
        expect(result.stipend?.type).toBe("paid");
        expect(result.stipend?.amount).toBe(15000);
    });

    it("infers paid type from numeric string in stipend.type", () => {
        const result = normalizeInternship({ stipend: { type: "5000" } });
        expect(result.stipend?.type).toBe("paid");
        expect(result.stipend?.amount).toBe(5000);
    });

    it("upgrades unpaid to paid when amount is provided", () => {
        const result = normalizeInternship({
            stipend: { type: "unpaid", amount: 8000 },
        });
        expect(result.stipend?.type).toBe("paid");
        expect(result.stipend?.amount).toBe(8000);
    });

    it("handles performance-based stipend", () => {
        const result = normalizeInternship({
            stipend: { type: "performance-based" },
        });
        expect(result.stipend?.type).toBe("performance-based");
    });

    // ── Duration normalization ───────────────────────────────────────────────────

    it("parses duration_string '3 months'", () => {
        const result = normalizeInternship({ duration_string: "3 months" });
        expect(result.duration).toEqual({ value: 3, unit: "months" });
    });

    it("parses duration_string '12 weeks'", () => {
        const result = normalizeInternship({ duration_string: "12 weeks" });
        expect(result.duration).toEqual({ value: 12, unit: "weeks" });
    });

    it("parses nested duration object", () => {
        const result = normalizeInternship({
            duration: { value: 6, unit: "months" },
        });
        expect(result.duration).toEqual({ value: 6, unit: "months" });
    });

    it("parses flat duration_value + duration_unit", () => {
        const result = normalizeInternship({
            duration_value: 8,
            duration_unit: "weeks",
        });
        expect(result.duration).toEqual({ value: 8, unit: "weeks" });
    });

    it("parses duration value as string '3 months' inside nested object", () => {
        const result = normalizeInternship({ duration: { value: "3 months" } });
        expect(result.duration).toEqual({ value: 3, unit: "months" });
    });

    it("returns undefined duration when unparseable", () => {
        const result = normalizeInternship({ duration: { value: "unknown" } });
        expect(result.duration).toBeUndefined();
    });

    // ── Skills trimming ──────────────────────────────────────────────────────────

    it("trims whitespace from skills", () => {
        const result = normalizeInternship({
            skills: ["  React  ", " Node.js"],
        });
        expect(result.skills).toEqual(["React", "Node.js"]);
    });

    it("filters out empty skill strings", () => {
        const result = normalizeInternship({ skills: ["React", "", "  "] });
        expect(result.skills).toEqual(["React"]);
    });

    // ── Defaults ─────────────────────────────────────────────────────────────────

    it("defaults isActive to true", () => {
        const result = normalizeInternship({});
        expect(result.isActive).toBe(true);
    });

    it("respects explicit isActive: false", () => {
        const result = normalizeInternship({ isActive: false });
        expect(result.isActive).toBe(false);
    });

    it("defaults experienceRequired unit to months", () => {
        const result = normalizeInternship({});
        expect(result.experienceRequired?.unit).toBe("months");
    });
});
