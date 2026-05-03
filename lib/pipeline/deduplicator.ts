import { createHash } from "crypto";
import { connectDB } from "@/lib/db";
import InternshipModel from "@/models/Internship";
import type { Internship } from "@/types";

/**
 * Generate a SHA-256 fingerprint for deduplication.
 * Based on: company + name + city (normalized to lowercase).
 */
export async function generateFingerprint(
    internship: Partial<Internship>,
): Promise<string> {
    const company = (internship.company ?? "").toLowerCase().trim();
    const name = (internship.name ?? "").toLowerCase().trim();
    const city = (internship.city ?? "remote").toLowerCase().trim();

    const raw = `${company}:${name}:${city}`;
    return createHash("sha256").update(raw).digest("hex");
}

/**
 * Check if an internship with this fingerprint already exists in MongoDB.
 */
export async function isDuplicate(fingerprint: string): Promise<boolean> {
    await connectDB();
    const existing = await InternshipModel.findOne({ fingerprint }).lean();
    return existing !== null;
}
