// ─── User Types ───────────────────────────────────────────────────────────────

export interface Resume {
    driveFileId?: string | null;
    driveViewLink?: string | null;
    uploadedAt?: string | null;
    parsedData?: ParsedResumeData | null;
}

// ─── Parsed Resume Types ──────────────────────────────────────────────────────

export interface DateRange {
    start: string;
    end?: string | null;
    isCurrent: boolean;
}

export interface Skill {
    field: string;
    yearsOfExperience: number;
    lastUsed: string;
    tools: {
        name: string;
        score?: number | null;
    }[];
}

export interface Project {
    title: string;
    role: string;
    links: { repo: string; live?: string; demo?: string };
    techStack: string[];
    problemStatement: string | null;
    metrics: string[];
    technicalChallenges: string[];
    description: string[];
    architecture: string;
}

export interface WorkHistory {
    title: string;
    company: string;
    location: string;
    type: "job" | "internship" | "volunteer" | "co-op";
    period: DateRange;
    responsibilities: string[];
    achievements: string[];
}

export interface ResumeEducation {
    institution: string;
    field: {
        type: string;
        course: string;
    };
    period: DateRange;
    output: string;
}

export interface Publication {
    title: string;
    platform: string;
    type: "paper" | "article" | "talk";
    link: string;
    keywords: string[];
    date: string;
}

export interface Affiliation {
    organization: string;
    role: string;
    type: string;
    impact: string[];
    period: DateRange;
}

export interface Award {
    name: string;
    issuingBody: string;
    date: string;
    justification: string;
}

export interface ParsedResumeData {
    summary: string;
    workHistory: WorkHistory[];
    education: ResumeEducation[];
    skills: Skill[];
    projects: Project[];
    certifications: {
        name: string;
        issuer: string;
        skillsEarned: string[];
        type: string;
        date: string;
    }[];
    languages: {
        lang: string;
        proficiency: string;
        score?: string;
    }[];
    publications: Publication[];
    affiliations: Affiliation[];
    awards: Award[];
    interests: {
        activity: string;
        description: string;
        commitmentMetric?: string;
    }[];
    metaDetails: {
        name: string;
        phone_no: string;
        email: string;
        github_profile: string | null;
        linkedin: string | null;
        address: {
            city: string;
            country: string;
            postal_code: string;
        };
        extra_links: {
            name: string;
            link: string;
        }[];
    };
}

export interface AppliedInternship {
    internshipId: string;
    appliedAt: string;
    status: "applied" | "shortlisted" | "rejected" | "selected";
}

export interface User {
    _id: string;
    name: string;
    username: string;
    email: string;
    role?: "user" | "admin";
    profilePicture?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    resume: Resume;
    appliedInternships: AppliedInternship[];
    savedInternships: string[];
    recommendedInternships?: string[];
    recommendedScores?: { id: string; score: number }[];
    recommendedUpdatedAt?: string | null;
    profileCompletionScore: number;
    createdAt: string;
    updatedAt: string;
}

// ─── Internship Types ─────────────────────────────────────────────────────────

export interface Stipend {
    type: "paid" | "unpaid" | "performance-based";
    amount?: number | null;
    currency?: string | null;
    period?: "monthly" | "weekly" | "lump-sum" | null;
}

export interface Duration {
    value: number;
    unit: "weeks" | "months";
}

export interface ExperienceRequired {
    min?: number | null;
    max?: number | null;
    unit: "months" | "years";
}

export interface LinkVerification {
    reachable: boolean | null;
    statusCode?: number | null;
    redirectedTo?: string | null;
    isScamSuspected: boolean | null;
    isExpired: boolean | null;
    scamSignals: string[];
    checkedAt?: string | null;
    nextCheckAt?: string | null;
}

export interface Moderation {
    status:
        | "auto_approved"
        | "pending_review"
        | "auto_rejected"
        | "manually_approved"
        | "manually_rejected";
    score: number | null;
    flags: string[];
    source:
        | "web_scraping"
        | "api"
        | "user_contributed"
        | "email_parsing"
        | "rss"
        | "community_bot"
        | "manual";
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
}

export interface Internship {
    _id: string;
    name: string;
    company: string;
    applyLink: string;
    datePublished: string;
    deadlineDate?: string | null;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    isRemote: boolean;
    stipend: Stipend;
    duration: Duration;
    skills: string[];
    degree?: string[] | null;
    field?: string[] | null;
    experienceRequired: ExperienceRequired;
    openings?: number | null;
    summary: string;
    responsibilities?: string[] | null;
    perks?: string[] | null;
    tags?: string[] | null;
    source?: string | null;
    isActive: boolean;
    fingerprint?: string | null;
    linkVerification?: LinkVerification;
    moderation?: Moderation;
    createdAt: string;
    updatedAt: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface InternshipFilters {
    stipendType: "any" | "paid" | "unpaid" | "performance-based";
    stipendMin: number;
    stipendMax: number;
    locations: string[];
    workFromHome: boolean;
    durationMin: number;
    durationMax: number;
    skills: string[];
    companies: string[];
    perks: string[];
    sortBy: "latest" | "deadline" | "stipend";
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
