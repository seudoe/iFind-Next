import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { uploadPendingResumeToGridFS } from "@/lib/gridfs";
import { parseResumeWithAI } from "@/lib/resumeParser";

/**
 * POST /api/user/resume/upload-temp
 *
 * Uploads the new PDF to GridFS as a PENDING file (does NOT touch the live resume),
 * runs AI extraction, and saves both to resume.pending* fields on the user doc.
 *
 * The live resume (driveFileId, parsedData) is completely untouched.
 * The client then shows a comparison and calls /commit or /discard-temp.
 *
 * Returns:
 *   { pendingFileId, pendingViewLink, pendingParsedData, existingParsedData }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("resume") as File | null;

    if (!file)
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    if (file.type !== "application/pdf")
      return NextResponse.json({ success: false, error: "Only PDF files are accepted" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ success: false, error: "File must be under 5MB" }, { status: 400 });

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${user.username}_resume_pending.pdf`;

    // 1. Upload to GridFS as pending — live file untouched
    const { fileId, viewLink } = await uploadPendingResumeToGridFS(
      buffer,
      fileName,
      session.userId,
    );

    // 2. Run AI extraction on the new file
    const pendingParsedData = await parseResumeWithAI(buffer);

    // 3. Save pending fields to user doc — live resume unchanged
    user.resume.pendingFileId     = fileId;
    user.resume.pendingViewLink   = viewLink;
    user.resume.pendingParsedData = pendingParsedData;
    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        pendingFileId:     fileId,
        pendingViewLink:   viewLink,
        pendingParsedData,
        // Return existing data so client can show comparison without a second fetch
        existingParsedData: user.resume.parsedData ?? null,
      },
    });
  } catch (err) {
    console.error("[resume/upload-temp POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
