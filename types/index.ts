// ─── User Types ───────────────────────────────────────────────────────────────

export interface Education {
  _id?: string;
  degree: string;
  field: string;
  institution: string;
  startDate: string;
  endDate?: string | null;
  grade?: string | null;
}

export interface Experience {
  _id?: string;
  type: "job" | "internship";
  title: string;
  company: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
  description?: string | null;
}

export interface Resume {
  driveFileId?: string | null;
  driveViewLink?: string | null;
  uploadedAt?: string | null;
  extractedSkills: string[]; // TODO: connect to skills extractor model
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
  profilePicture?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  skills: string[];
  education: Education[];
  experiences: Experience[];
  resume: Resume;
  appliedInternships: AppliedInternship[];
  savedInternships: string[];
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
