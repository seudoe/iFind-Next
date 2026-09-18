// ─── Generic / Shared Base Types ─────────────────────────────────────────────
// Reusable primitives used across resume, internship, user, and other domain types.

/** A time period with an optional end date and a "current" flag */
export interface DateRange {
    start: string;
    end?: string | null;
    isCurrent: boolean;
}

/** Standard API envelope */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/** Paginated API envelope */
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** Generic ID + timestamp mixin — extend or intersect where needed */
export interface Timestamps {
    createdAt: string;
    updatedAt: string;
}
