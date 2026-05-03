import type { Internship } from "@/types";
import type { RawInternship } from "./types";

const REMOTE_PATTERNS = /work\s*from\s*home|remote|wfh/i;

/**
 * Parse a duration string like "3 months" or "12 weeks" into value + unit.
 */
function parseDurationString(
    str: string,
): { value: number; unit: "weeks" | "months" } | null {
    const match = str.match(/(\d+)\s*(week|month)/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().startsWith("week") ? "weeks" : "months";
    return { value, unit };
}

/**
 * Normalize stipend — maps "0"/"unpaid" strings to unpaid, numeric strings to paid.
 */
function normalizeStipend(raw: RawInternship): Internship["stipend"] {
    const rawType = raw.stipend?.type ?? raw.stipend_type ?? "";
    const rawAmount = raw.stipend?.amount ?? raw.stipend_amount ?? null;

    let type: "paid" | "unpaid" | "performance-based" = "unpaid";
    let amount: number | null = null;

    const typeStr = String(rawType).toLowerCase().trim();

    if (typeStr === "0" || typeStr === "unpaid" || typeStr === "") {
        type = "unpaid";
    } else if (typeStr === "performance-based") {
        type = "performance-based";
    } else if (typeStr === "paid") {
        type = "paid";
    } else if (!isNaN(Number(typeStr)) && Number(typeStr) > 0) {
        // Numeric string in type field — treat as paid with that amount
        type = "paid";
        amount = Number(typeStr);
    }

    // Parse amount
    if (rawAmount !== null && rawAmount !== undefined) {
        const parsed = Number(rawAmount);
        if (!isNaN(parsed) && parsed > 0) {
            amount = parsed;
            if (type === "unpaid") type = "paid";
        }
    }

    return {
        type,
        amount,
        currency: raw.stipend?.currency ?? "INR",
        period:
            (raw.stipend?.period as Internship["stipend"]["period"]) ?? null,
    };
}

/**
 * Normalize duration — handles nested object or flat fields or free-form string.
 */
function normalizeDuration(
    raw: RawInternship,
): { value: number; unit: "weeks" | "months" } | null {
    // Try duration_string first
    if (raw.duration_string) {
        const parsed = parseDurationString(raw.duration_string);
        if (parsed) return parsed;
    }

    // Try nested duration object
    if (raw.duration) {
        const val =
            raw.duration.value !== undefined ? Number(raw.duration.value) : NaN;
        const unitRaw = String(raw.duration.unit ?? "").toLowerCase();
        const unit: "weeks" | "months" = unitRaw.startsWith("week")
            ? "weeks"
            : "months";
        if (!isNaN(val) && val > 0) return { value: val, unit };

        // Maybe value is a string like "3 months"
        if (typeof raw.duration.value === "string") {
            const parsed = parseDurationString(raw.duration.value);
            if (parsed) return parsed;
        }
    }

    // Try flat fields
    if (raw.duration_value !== undefined) {
        const val = Number(raw.duration_value);
        const unitRaw = String(raw.duration_unit ?? "months").toLowerCase();
        const unit: "weeks" | "months" = unitRaw.startsWith("week")
            ? "weeks"
            : "months";
        if (!isNaN(val) && val > 0) return { value: val, unit };
    }

    return null;
}

/**
 * Determine if the internship is remote based on location fields.
 */
function inferIsRemote(raw: RawInternship): boolean {
    if (raw.isRemote === true || raw.is_remote === true) return true;
    const locationText = [raw.city, raw.location, raw.state]
        .filter(Boolean)
        .join(" ");
    return REMOTE_PATTERNS.test(locationText);
}

/**
 * Normalize a RawInternship into a Partial<Internship>.
 * Maps snake_case → camelCase, infers remote, normalizes stipend/duration.
 */
export function normalizeInternship(raw: RawInternship): Partial<Internship> {
    const applyLink = (raw.applyLink ?? raw.apply_link ?? "").trim();
    const name = (raw.name ?? "").trim();
    const company = (raw.company ?? "").trim();
    const summary = (raw.summary ?? raw.description ?? "").trim();

    const datePublished = raw.datePublished ?? raw.date_published;
    const deadlineDate = raw.deadlineDate ?? raw.deadline_date;

    const stipend = normalizeStipend(raw);
    const duration = normalizeDuration(raw);
    const isRemote = inferIsRemote(raw);

    const skills = (raw.skills ?? []).map((s) => s.trim()).filter(Boolean);

    const result: Partial<Internship> = {
        name: name || undefined,
        company: company || undefined,
        applyLink: applyLink || undefined,
        summary: summary || undefined,
        isRemote,
        isActive: raw.isActive ?? raw.is_active ?? true,
        skills,
        source: raw.source ?? undefined,
        openings: raw.openings ?? undefined,
        country: raw.country?.trim() ?? undefined,
        state: raw.state?.trim() ?? undefined,
        city: raw.city?.trim() ?? undefined,
        degree: raw.degree ?? undefined,
        field: raw.field ?? undefined,
        responsibilities: raw.responsibilities ?? undefined,
        perks: raw.perks ?? undefined,
        tags: raw.tags ?? undefined,
        stipend,
        experienceRequired: raw.experienceRequired
            ? {
                  unit: raw.experienceRequired.unit ?? "months",
                  ...raw.experienceRequired,
              }
            : { unit: "months" as const },
    };

    if (datePublished) {
        result.datePublished = new Date(datePublished).toISOString();
    }
    if (deadlineDate) {
        result.deadlineDate = new Date(deadlineDate).toISOString();
    }
    if (duration) {
        result.duration = duration;
    }

    return result;
}
