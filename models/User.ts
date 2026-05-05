import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IResume {
    driveFileId?: string | null;
    driveViewLink?: string | null;
    uploadedAt?: Date | null;
    // parsedData matches ParsedResumeData from @/types — stored as Mixed in Mongo
    parsedData?: any | null;
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
    role: "user" | "admin";
    profilePicture?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    resume: IResume;
    appliedInternships: IAppliedInternship[];
    savedInternships: mongoose.Types.ObjectId[];
    recommendedInternships: mongoose.Types.ObjectId[];
    recommendedUpdatedAt?: Date | null;
    profileCompletionScore: number; // 0–100, computed field
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ResumeSchema = new Schema(
    {
        driveFileId:  { type: String, default: null },
        driveViewLink:{ type: String, default: null },
        uploadedAt:   { type: Date,   default: null },
        // parsedData stores the full Resume structure from types/resume.ts
        // Using Mixed because the nested schema is deeply nested and changes with the Resume type
        parsedData:   { type: Schema.Types.Mixed, default: null },
    },
    { _id: false },
);

const AppliedInternshipSchema = new Schema<IAppliedInternship>(
    {
        internshipId: {
            type: Schema.Types.ObjectId,
            ref: "Internship",
            required: true,
        },
        appliedAt: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ["applied", "shortlisted", "rejected", "selected"],
            default: "applied",
        },
    },
    { _id: false },
);

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password:       { type: String, required: true },
        role:           { type: String, enum: ["user", "admin"], default: "user" },
        profilePicture: { type: String, default: null },
        phone:          { type: String, default: null },
        city:           { type: String, default: null },
        state:          { type: String, default: null },
        country:        { type: String, default: null },
        resume: {
            type: ResumeSchema,
            default: () => ({}),
        },
        appliedInternships: { type: [AppliedInternshipSchema], default: [] },
        savedInternships:   [{ type: Schema.Types.ObjectId, ref: "Internship" }],
        recommendedInternships: [{ type: Schema.Types.ObjectId, ref: "Internship" }],
        recommendedUpdatedAt: { type: Date, default: null },
        recommendedScores: { type: Schema.Types.Mixed, default: [] },
        profileCompletionScore: { type: Number, default: 0, min: 0, max: 100 },
    },
    {
        timestamps: true,
    },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
