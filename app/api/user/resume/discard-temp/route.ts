import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { deleteResumeFileById } from "@/lib/gridfs";

/**
 * POST /api/user/resume/discard-temp
 *
 * User chose "Keep existing data".
 * - Deletes the pending GridFS file
 * - Clears pending* fields
 * - Live resume is completely untouched
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    // Delete the pending GridFS file if it exists
    if (user.resume?.pendingFileId) {
      await deleteResumeFileById(user.resume.pendingFileId);
    }

    // Clear pending fields — live resume untouched
    user.resume.pendingFileId     = null;
    user.resume.pendingViewLink   = null;
    user.resume.pendingParsedData = null;
    await user.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[resume/discard-temp POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Discard failed" },
      { status: 500 },
    );
  }
}
