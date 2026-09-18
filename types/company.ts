// ─── Company Types ────────────────────────────────────────────────────────────
// Placeholder for when company profiles / employer accounts are added.

export type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "500+";

export type CompanyStage =
    | "pre-seed"
    | "seed"
    | "series-a"
    | "series-b"
    | "growth"
    | "public"
    | "non-profit";

export interface SocialLinks {
    website?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    github?: string | null;
}

export interface Company {
    _id: string;
    name: string;
    slug: string; // url-friendly identifier
    logo?: string | null;
    description?: string | null;
    industry?: string | null;
    size?: CompanySize | null;
    stage?: CompanyStage | null;
    headquarters?: {
        city: string;
        state?: string;
        country: string;
    } | null;
    socialLinks?: SocialLinks;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
}
