import type { LinkVerificationResult } from "./types";

// ─── Domain Lists ─────────────────────────────────────────────────────────────

const SCAM_DOMAINS = new Set([
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "forms.gle",
    "docs.google.com",
    "telegra.ph",
    "telegraph.com",
    "wixsite.com",
    "weebly.com",
    "blogspot.com",
    "surveysparrow.com",
    "typeform.com",
]);

const TRUSTED_DOMAINS = new Set([
    "linkedin.com",
    "internshala.com",
    "naukri.com",
    "glassdoor.com",
    "indeed.com",
    "unstop.com",
    "letsintern.com",
    "twentynineteen.in",
    "angellist.com",
    "wellfound.com",
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "taleo.net",
    "icims.com",
    "smartrecruiters.com",
    "amazon.jobs",
    "google.com",
    "microsoft.com",
    "flipkart.com",
    "razorpay.com",
    "swiggy.com",
    "zomato.com",
    "phonepe.com",
    "paytm.com",
    "infosys.com",
    "wipro.com",
    "tcs.com",
    "hcl.com",
]);

const SHORTENER_TLDS = new Set([".ly", ".gl", ".gg", ".to", ".cc"]);

const SUSPICIOUS_PATH_PATTERNS = [
    /\/apply-now-urgent/i,
    /\/work-from-home-\d+/i,
    /\/earn-\d+/i,
    /\/daily-income/i,
    /\/part-time-job-\d+k/i,
];

const SCAM_CONTENT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    {
        pattern: /no\s+experience\s+required.*earn.*\$\d+/i,
        name: "no_experience_earn",
    },
    {
        pattern: /work\s+from\s+home.*guaranteed.*income/i,
        name: "wfh_guaranteed_income",
    },
    { pattern: /whatsapp.*\+?\d{10,}/i, name: "whatsapp_recruitment" },
    {
        pattern: /send\s+your\s+cv\s+to\s+[a-z]+@gmail\.com/i,
        name: "gmail_cv_submission",
    },
    { pattern: /registration\s+fee/i, name: "registration_fee" },
    { pattern: /pay.*to\s+apply/i, name: "pay_to_apply" },
    { pattern: /investment\s+required/i, name: "investment_required" },
    { pattern: /mlm|multi.level\s+marketing/i, name: "mlm" },
];

const EXPIRED_PATH_SEGMENTS = new Set([
    "expired",
    "closed",
    "filled",
    "no-longer-available",
    "job-not-found",
]);

const BOT_USER_AGENT =
    "Mozilla/5.0 (compatible; iFind-Bot/1.0; +https://ifind.app/bot)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRootDomain(hostname: string): string {
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join(".");
}

function checkScamDomain(hostname: string): string | null {
    // Exact match
    if (SCAM_DOMAINS.has(hostname)) return "domain_on_blocklist";
    // Root domain match
    const root = getRootDomain(hostname);
    if (SCAM_DOMAINS.has(root)) return "domain_on_blocklist";
    return null;
}

function checkUrlShortener(hostname: string): string | null {
    if (hostname.length <= 8) {
        for (const tld of SHORTENER_TLDS) {
            if (hostname.endsWith(tld)) return "url_shortener_detected";
        }
    }
    return null;
}

function checkSuspiciousPath(pathname: string): string | null {
    for (const pattern of SUSPICIOUS_PATH_PATTERNS) {
        if (pattern.test(pathname)) return "suspicious_url_pattern";
    }
    return null;
}

function checkExcessiveSubdomains(hostname: string): string | null {
    if (hostname.split(".").length >= 4) return "excessive_subdomains";
    return null;
}

function checkUnrecognizedDomain(hostname: string): string | null {
    const root = getRootDomain(hostname);
    if (TRUSTED_DOMAINS.has(root)) return null;
    // Check if it has a recognizable multi-part TLD structure (at least 2 parts)
    const parts = hostname.split(".");
    if (parts.length < 2) return "unrecognized_domain";
    // Known TLDs — if it ends with a common TLD, it's probably fine
    const commonTlds = new Set([
        "com",
        "org",
        "net",
        "edu",
        "gov",
        "io",
        "co",
        "in",
        "uk",
        "us",
        "ca",
        "au",
        "de",
        "fr",
        "jp",
        "cn",
        "br",
        "jobs",
    ]);
    const tld = parts[parts.length - 1].toLowerCase();
    if (!commonTlds.has(tld)) return "unrecognized_domain";
    return null;
}

function checkExpiredPath(pathname: string, searchParams: string): boolean {
    const segments = pathname.split("/").map((s) => s.toLowerCase());
    for (const seg of segments) {
        if (EXPIRED_PATH_SEGMENTS.has(seg)) return true;
    }
    const params = new URLSearchParams(searchParams);
    const status = params.get("status")?.toLowerCase();
    if (status === "closed" || status === "expired") return true;
    return false;
}

function checkRedirectExpiry(originalUrl: string, finalUrl: string): boolean {
    try {
        const orig = new URL(originalUrl);
        const final = new URL(finalUrl);
        const origRoot = getRootDomain(orig.hostname);
        const finalRoot = getRootDomain(final.hostname);
        // Domain changed AND final path is root
        if (
            origRoot !== finalRoot &&
            (final.pathname === "/" || final.pathname === "")
        ) {
            return true;
        }
    } catch {
        // ignore
    }
    return false;
}

function scanContentForScam(body: string): string[] {
    const signals: string[] = [];
    const sample = body.slice(0, 5000);
    for (const { pattern, name } of SCAM_CONTENT_PATTERNS) {
        if (pattern.test(sample)) {
            signals.push(`scam_content:${name}`);
        }
    }
    return signals;
}

// ─── Main Verifier ────────────────────────────────────────────────────────────

const SAFE_DEFAULT: LinkVerificationResult = {
    reachable: false,
    isScamSuspected: false,
    isExpired: false,
    scamSignals: ["verification_error"],
    checkedAt: new Date(),
};

export async function verifyApplyLink(
    url: string,
    timeoutMs = 8000,
): Promise<LinkVerificationResult> {
    try {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return {
                reachable: false,
                isScamSuspected: true,
                isExpired: false,
                scamSignals: ["invalid_url"],
                checkedAt: new Date(),
            };
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        const scamSignals: string[] = [];

        // ── Static URL checks (before any network request) ──────────────────────
        const domainSignal = checkScamDomain(hostname);
        if (domainSignal) scamSignals.push(domainSignal);

        const shortenerSignal = checkUrlShortener(hostname);
        if (shortenerSignal) scamSignals.push(shortenerSignal);

        const pathSignal = checkSuspiciousPath(parsedUrl.pathname);
        if (pathSignal) scamSignals.push(pathSignal);

        const subdomainSignal = checkExcessiveSubdomains(hostname);
        if (subdomainSignal) scamSignals.push(subdomainSignal);

        const domainRecognitionSignal = checkUnrecognizedDomain(hostname);
        if (domainRecognitionSignal) scamSignals.push(domainRecognitionSignal);

        // Check URL-level expiry signals
        const isExpiredByUrl = checkExpiredPath(
            parsedUrl.pathname,
            parsedUrl.search,
        );

        // ── Network request ──────────────────────────────────────────────────────
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let statusCode: number | undefined;
        let finalUrl: string | undefined;
        let reachable = false;
        let isExpired = isExpiredByUrl;
        let responseBody: string | null = null;

        try {
            // Try HEAD first; fall back to GET only on 405 Method Not Allowed
            let response: Response;
            let usedGet = false;

            try {
                response = await fetch(url, {
                    method: "HEAD",
                    redirect: "follow",
                    signal: controller.signal,
                    headers: { "User-Agent": BOT_USER_AGENT },
                });

                // 405 = server doesn't support HEAD — retry with GET
                if (response.status === 405) {
                    response = await fetch(url, {
                        method: "GET",
                        redirect: "follow",
                        signal: controller.signal,
                        headers: { "User-Agent": BOT_USER_AGENT },
                    });
                    usedGet = true;
                    try {
                        responseBody = await response.text();
                    } catch {
                        /* ignore */
                    }
                }
            } catch {
                // Network error / DNS failure / timeout on HEAD — try GET
                response = await fetch(url, {
                    method: "GET",
                    redirect: "follow",
                    signal: controller.signal,
                    headers: { "User-Agent": BOT_USER_AGENT },
                });
                usedGet = true;
                try {
                    responseBody = await response.text();
                } catch {
                    /* ignore */
                }
            }

            statusCode = response.status;
            finalUrl = response.url !== url ? response.url : undefined;

            // Determine reachability
            if (
                statusCode === 404 ||
                statusCode === 410 ||
                (statusCode >= 500 && statusCode < 600)
            ) {
                reachable = false;
            } else if (statusCode >= 200 && statusCode < 400) {
                reachable = true;
            } else {
                reachable = false;
            }

            // Expiry signals from HTTP
            if (statusCode === 410) {
                isExpired = true;
            }

            // Redirect expiry check
            if (finalUrl && checkRedirectExpiry(url, finalUrl)) {
                isExpired = true;
                reachable = false;
            }

            // Scan body for scam content
            if (responseBody) {
                const contentSignals = scanContentForScam(responseBody);
                scamSignals.push(...contentSignals);
            } else if (reachable && !usedGet) {
                // HEAD succeeded — do a GET for content scanning if no static signals yet
                if (scamSignals.length === 0) {
                    try {
                        const getController = new AbortController();
                        const getTimer = setTimeout(
                            () => getController.abort(),
                            timeoutMs,
                        );
                        const getResponse = await fetch(url, {
                            method: "GET",
                            redirect: "follow",
                            signal: getController.signal,
                            headers: { "User-Agent": BOT_USER_AGENT },
                        });
                        clearTimeout(getTimer);
                        const body = await getResponse.text();
                        const contentSignals = scanContentForScam(body);
                        scamSignals.push(...contentSignals);
                    } catch {
                        // Content scan failed — not critical
                    }
                }
            }
        } catch {
            // Network error, DNS failure, timeout on both HEAD and GET
            reachable = false;
        } finally {
            clearTimeout(timer);
        }

        return {
            reachable,
            statusCode,
            redirectedTo: finalUrl,
            isScamSuspected: scamSignals.length > 0,
            isExpired,
            scamSignals,
            checkedAt: new Date(),
        };
    } catch {
        // Catch-all — this function must never throw
        return { ...SAFE_DEFAULT, checkedAt: new Date() };
    }
}
