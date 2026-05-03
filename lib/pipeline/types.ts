// ─── Pipeline Types ───────────────────────────────────────────────────────────

export type PipelineSource =
    | "web_scraping"
    | "api"
    | "user_contributed"
    | "email_parsing"
    | "rss"
    | "community_bot";

export type ModerationStatus =
    | "auto_approved"
    | "pending_review"
    | "auto_rejected"
    | "manually_approved"
    | "manually_rejected";

export type QualityFlag =
    | "missing_skills"
    | "short_summary"
    | "invalid_apply_link"
    | "deadline_in_past"
    | "location_incoherent"
    | "missing_stipend_amount"
    | "suspicious_company_name"
    | "link_unreachable"
    | "link_expired"
    | "link_scam_suspected"
    | "link_unverified"
    | "validation_failed"
    | "duplicate";

export interface LinkVerificationResult {
    reachable: boolean;
    statusCode?: number;
    redirectedTo?: string;
    isScamSuspected: boolean;
    isExpired: boolean;
    scamSignals: string[];
    checkedAt: Date;
}

/**
 * Raw input — accepts both snake_case (legacy imports) and camelCase (new data).
 * All fields are optional at ingestion time.
 */
export interface RawInternship {
    // Identity
    name?: string;
    company?: string;

    // Apply link — both conventions
    applyLink?: string;
    apply_link?: string;

    // Dates
    datePublished?: string | Date;
    date_published?: string | Date;
    deadlineDate?: string | Date;
    deadline_date?: string | Date;

    // Location
    country?: string;
    state?: string;
    city?: string;
    location?: string; // free-form location string

    isRemote?: boolean;
    is_remote?: boolean;

    // Stipend
    stipend?: {
        type?: string;
        amount?: number | string | null;
        currency?: string | null;
        period?: string | null;
    };
    stipend_type?: string;
    stipend_amount?: number | string | null;

    // Duration
    duration?: {
        value?: number | string;
        unit?: string;
    };
    duration_value?: number | string;
    duration_unit?: string;
    duration_string?: string; // e.g. "3 months", "12 weeks"

    // Content
    skills?: string[];
    degree?: string[] | null;
    field?: string[] | null;
    summary?: string;
    description?: string; // alias for summary
    responsibilities?: string[] | null;
    perks?: string[] | null;
    tags?: string[] | null;

    // Meta
    source?: string;
    openings?: number | null;
    isActive?: boolean;
    is_active?: boolean;

    // Experience
    experienceRequired?: {
        min?: number | null;
        max?: number | null;
        unit?: "months" | "years";
    };
}

export interface PipelineResult {
    status: ModerationStatus;
    score: number;
    flags: QualityFlag[];
    normalized?: object; // saved Internship document
}
