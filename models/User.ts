import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IEducation {
  degree: string;
  field: string;
  institution: string;
  startDate: Date;
  endDate?: Date | null;
  grade?: string | null;
}

export interface IExperience {
  type: "job" | "internship";
  title: string;
  company: string;
  startDate: Date;
  endDate?: Date | null;
  current: boolean;
  description?: string | null;
}

export interface IResume {
  driveFileId?: string | null;
  driveViewLink?: string | null;
  uploadedAt?: Date | null;
  extractedSkills: string[]; // TODO: connect to skills extractor model
}

export interface IAppliedInternship {
  internshipId: mongoose.Types.ObjectId;
  appliedAt: Date;
  status: "applied" | "shortlisted" | "rejected" | "selected";
}

// ─── Main User interface ──────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  password: string;
  profilePicture?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  skills: string[];
  education: IEducation[];
  experiences: IExperience[];
  resume: IResume;
  appliedInternships: IAppliedInternship[];
  savedInternships: mongoose.Types.ObjectId[];
  profileCompletionScore: number; // 0–100, computed field
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const EducationSchema = new Schema<IEducation>(
  {
    degree: { type: String, required: true },
    field: { type: String, required: true },
    institution: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    grade: { type: String, default: null },
  },
  { _id: true }
);

const ExperienceSchema = new Schema<IExperience>(
  {
    type: { type: String, enum: ["job", "internship"], required: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    current: { type: Boolean, default: false },
    description: { type: String, default: null },
  },
  { _id: true }
);

const ResumeSchema = new Schema<IResume>(
  {
    driveFileId: { type: String, default: null },
    driveViewLink: { type: String, default: null },
    uploadedAt: { type: Date, default: null },
    extractedSkills: { type: [String], default: [] }, // TODO: connect to skills extractor model
  },
  { _id: false }
);

const AppliedInternshipSchema = new Schema<IAppliedInternship>(
  {
    internshipId: { type: Schema.Types.ObjectId, ref: "Internship", required: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "selected"],
      default: "applied",
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: null },
    phone: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    skills: { type: [String], default: [] },
    education: { type: [EducationSchema], default: [] },
    experiences: { type: [ExperienceSchema], default: [] },
    resume: { type: ResumeSchema, default: () => ({ extractedSkills: [] }) },
    appliedInternships: { type: [AppliedInternshipSchema], default: [] },
    savedInternships: [{ type: Schema.Types.ObjectId, ref: "Internship" }],
    profileCompletionScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
