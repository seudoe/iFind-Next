import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyApplyLink } from "@/lib/pipeline/linkVerifier";

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(
    responses: Array<{ status: number; url?: string; body?: string }>,
) {
    let callIndex = 0;
    return vi.fn().mockImplementation(() => {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        const finalUrl = resp.url ?? "https://example.com/apply";
        return Promise.resolve({
            status: resp.status,
            url: finalUrl,
            text: () => Promise.resolve(resp.body ?? ""),
        });
    });
}

function mockFetchThrow(error: Error) {
    return vi.fn().mockRejectedValue(error);
}

describe("verifyApplyLink", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── Invalid URL ───────────────────────────────────────────────────────────────

    it("returns scam suspected for invalid URL", async () => {
        const result = await verifyApplyLink("not-a-url");
        expect(result.reachable).toBe(false);
        expect(result.isScamSuspected).toBe(true);
        expect(result.scamSignals).toContain("invalid_url");
    });

    // ── Reachability ──────────────────────────────────────────────────────────────

    it("marks reachable true for 200 response", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.reachable).toBe(true);
        expect(result.statusCode).toBe(200);
    });

    it("marks reachable false for 404", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 404 }]));
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.reachable).toBe(false);
    });

    it("marks reachable false for 500", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 500 }]));
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.reachable).toBe(false);
    });

    it("falls back to GET when HEAD returns 405", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([
                { status: 405 }, // HEAD → 405
                { status: 200 }, // GET → 200
            ]),
        );
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.reachable).toBe(true);
    });

    it("returns safe default when fetch throws", async () => {
        vi.stubGlobal("fetch", mockFetchThrow(new Error("Network error")));
        const result = await verifyApplyLink("https://example.com/apply");
        // Should not throw, reachable false
        expect(result.reachable).toBe(false);
        expect(result.isScamSuspected).toBe(false);
    });

    it("never throws — always returns a result", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetchThrow(new TypeError("Failed to fetch")),
        );
        await expect(
            verifyApplyLink("https://example.com"),
        ).resolves.toBeDefined();
    });

    // ── Expiry detection ──────────────────────────────────────────────────────────

    it("marks isExpired true for 410 Gone", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 410 }]));
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.isExpired).toBe(true);
        expect(result.reachable).toBe(false);
    });

    it("marks isExpired true for URL with /expired path segment", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink(
            "https://example.com/jobs/expired",
        );
        expect(result.isExpired).toBe(true);
    });

    it("marks isExpired true for URL with /closed path segment", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink("https://example.com/jobs/closed");
        expect(result.isExpired).toBe(true);
    });

    it("marks isExpired true for ?status=closed query param", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink(
            "https://example.com/job?status=closed",
        );
        expect(result.isExpired).toBe(true);
    });

    it("marks isExpired true when redirect goes to different domain root", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([{ status: 301, url: "https://acme.com/" }]),
        );
        // jobs.startup.io redirects to acme.com root — different root domain
        const result = await verifyApplyLink(
            "https://jobs.startup.io/internship/123",
        );
        expect(result.isExpired).toBe(true);
    });

    // ── Scam detection ────────────────────────────────────────────────────────────

    it("flags domain_on_blocklist for bit.ly", async () => {
        const result = await verifyApplyLink("https://bit.ly/apply123");
        expect(result.isScamSuspected).toBe(true);
        expect(result.scamSignals).toContain("domain_on_blocklist");
    });

    it("flags domain_on_blocklist for forms.gle", async () => {
        const result = await verifyApplyLink("https://forms.gle/abc123");
        expect(result.isScamSuspected).toBe(true);
        expect(result.scamSignals).toContain("domain_on_blocklist");
    });

    it("flags url_shortener_detected for short .ly domain", async () => {
        const result = await verifyApplyLink("https://ow.ly/apply");
        expect(result.scamSignals).toContain("url_shortener_detected");
    });

    it("flags suspicious_url_pattern for /apply-now-urgent", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink(
            "https://example.com/apply-now-urgent",
        );
        expect(result.scamSignals).toContain("suspicious_url_pattern");
    });

    it("flags excessive_subdomains for 4+ dot segments", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink(
            "https://apply.jobs.hiring.scamco.com/job",
        );
        expect(result.scamSignals).toContain("excessive_subdomains");
    });

    it("does NOT flag trusted domains as unrecognized", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink("https://linkedin.com/jobs/123");
        expect(result.scamSignals).not.toContain("unrecognized_domain");
    });

    it("flags scam_content:registration_fee in page body", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([
                { status: 405 }, // HEAD → 405, triggers GET
                {
                    status: 200,
                    body: "Please pay a registration fee to apply for this job.",
                },
            ]),
        );
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.scamSignals).toContain("scam_content:registration_fee");
    });

    it("flags scam_content:pay_to_apply in page body", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([
                { status: 405 },
                {
                    status: 200,
                    body: "You must pay to apply for this position.",
                },
            ]),
        );
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.scamSignals).toContain("scam_content:pay_to_apply");
    });

    // ── Result shape ──────────────────────────────────────────────────────────────

    it("always includes checkedAt as a Date", async () => {
        vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it("sets redirectedTo when final URL differs from input", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([
                { status: 200, url: "https://example.com/apply/redirected" },
            ]),
        );
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.redirectedTo).toBe(
            "https://example.com/apply/redirected",
        );
    });

    it("leaves redirectedTo undefined when URL does not change", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch([{ status: 200, url: "https://example.com/apply" }]),
        );
        const result = await verifyApplyLink("https://example.com/apply");
        expect(result.redirectedTo).toBeUndefined();
    });
});
