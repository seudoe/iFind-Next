import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IStipend {
  type: "paid" | "unpaid" | "performance-based";
  amount?: number | null;
  currency?: string | null;
  period?: "monthly" | "weekly" | "lump-sum" | null;
}

export interface IDuration {
  value: number;
  unit: "weeks" | "months";
}

export interface IExperienceRequired {
  min?: number | null;
  max?: number | null;
  unit: "months" | "years";
}

// ─── Main Internship interface ────────────────────────────────────────────────

export interface IInternship extends Document {
  name: string;
  company: string;
  applyLink: string;
  datePublished: Date;
  deadlineDate?: Date | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  isRemote: boolean;
  stipend: IStipend;
  duration: IDuration;
  skills: string[];
  degree?: string[] | null;
  field?: string[] | null;
  experienceRequired: IExperienceRequired;
  openings?: number | null;
  summary: string;
  responsibilities?: string[] | null;
  perks?: string[] | null;
  tags?: string[] | null;
  source?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const StipendSchema = new Schema<IStipend>(
  {
    type: {
      type: String,
      enum: ["paid", "unpaid", "performance-based"],
      required: true,
    },
    amount: { type: Number, default: null },
    currency: { type: String, default: "INR" },
    period: {
      type: String,
      enum: ["monthly", "weekly", "lump-sum", null],
      default: null,
    },
  },
  { _id: false }
);

const DurationSchema = new Schema<IDuration>(
  {
    value: { type: Number, required: true },
    unit: { type: String, enum: ["weeks", "months"], required: true },
  },
  { _id: false }
);

const ExperienceRequiredSchema = new Schema<IExperienceRequired>(
  {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    unit: { type: String, enum: ["months", "years"], default: "months" },
  },
  { _id: false }
);

const InternshipSchema = new Schema<IInternship>(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    applyLink: { type: String, required: true },
    datePublished: { type: Date, required: true, default: Date.now },
    deadlineDate: { type: Date, default: null },
    country: { type: String, default: null },
    state: { type: String, default: null },
    city: { type: String, default: null },
    isRemote: { type: Boolean, default: false },
    stipend: { type: StipendSchema, required: true },
    duration: { type: DurationSchema, required: true },
    skills: { type: [String], default: [] },
    degree: { type: [String], default: null },
    field: { type: [String], default: null },
    experienceRequired: {
      type: ExperienceRequiredSchema,
      default: () => ({ unit: "months" }),
    },
    openings: { type: Number, default: null },
    summary: { type: String, required: true },
    responsibilities: { type: [String], default: null },
    perks: { type: [String], default: null },
    tags: { type: [String], default: null },
    source: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

InternshipSchema.index({ company: 1 });
InternshipSchema.index({ skills: 1 });
InternshipSchema.index({ isActive: 1, datePublished: -1 });
InternshipSchema.index({ isRemote: 1 });
InternshipSchema.index({ "stipend.type": 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const Internship: Model<IInternship> =
  mongoose.models.Internship ||
  mongoose.model<IInternship>("Internship", InternshipSchema);

export default Internship;
