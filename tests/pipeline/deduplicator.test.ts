import { describe, it, expect, vi } from "vitest";

// Mock lib/db before importing deduplicator — prevents module-level throw
// when MONGODB_URI is not set in the test environment.
vi.mock("@/lib/db", () => ({
    connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Internship model so isDuplicate doesn't need a real DB
// findOne must return a chainable object with .lean()
vi.mock("@/models/Internship", () => {
    const lean = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn().mockReturnValue({ lean });
    return { default: { findOne, _lean: lean } };
});

import { generateFingerprint, isDuplicate } from "@/lib/pipeline/deduplicator";

// Note: generateFingerprint is pure (no I/O). isDuplicate is tested with mocks.

describe("generateFingerprint", () => {
    it("produces a 64-char hex SHA-256 string", async () => {
        const fp = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });

    it("is deterministic — same input gives same fingerprint", async () => {
        const a = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        const b = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        expect(a).toBe(b);
    });

    it("is case-insensitive — uppercase and lowercase produce same fingerprint", async () => {
        const a = await generateFingerprint({
            company: "ACME",
            name: "DEV INTERN",
            city: "MUMBAI",
        });
        const b = await generateFingerprint({
            company: "acme",
            name: "dev intern",
            city: "mumbai",
        });
        expect(a).toBe(b);
    });

    it("trims whitespace before hashing", async () => {
        const a = await generateFingerprint({
            company: "  Acme  ",
            name: "  Dev Intern  ",
            city: "  Mumbai  ",
        });
        const b = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        expect(a).toBe(b);
    });

    it("defaults missing city to 'remote'", async () => {
        const a = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
        });
        const b = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "remote",
        });
        expect(a).toBe(b);
    });

    it("produces different fingerprints for different companies", async () => {
        const a = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        const b = await generateFingerprint({
            company: "Beta",
            name: "Dev Intern",
            city: "Mumbai",
        });
        expect(a).not.toBe(b);
    });

    it("produces different fingerprints for different role names", async () => {
        const a = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        const b = await generateFingerprint({
            company: "Acme",
            name: "Design Intern",
            city: "Mumbai",
        });
        expect(a).not.toBe(b);
    });

    it("produces different fingerprints for different cities", async () => {
        const a = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Mumbai",
        });
        const b = await generateFingerprint({
            company: "Acme",
            name: "Dev Intern",
            city: "Delhi",
        });
        expect(a).not.toBe(b);
    });
});

describe("isDuplicate", () => {
    it("returns false when no matching document found", async () => {
        // Default mock: lean() resolves to null (no doc found)
        const result = await isDuplicate("abc123fingerprint");
        expect(result).toBe(false);
    });

    it("returns true when a matching document exists", async () => {
        const { default: InternshipModel } =
            await import("@/models/Internship");
        // Override lean to return a doc for this one call
        const leanMock = (
            InternshipModel as unknown as { _lean: ReturnType<typeof vi.fn> }
        )._lean;
        leanMock.mockResolvedValueOnce({ _id: "existing-doc" });
        const result = await isDuplicate("abc123fingerprint");
        expect(result).toBe(true);
    });
});
