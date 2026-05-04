import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { uploadResumeToGridFS, deleteResumeFromGridFS } from "@/lib/gridfs";

// POST /api/user/resume — upload PDF to GridFS, save to user doc
// Parsing is intentionally NOT done here — the client calls /reextract after upload
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ success: false, error: "Only PDF files are accepted" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File must be under 5MB" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${user.username}_resume.pdf`;

    // Upload to GridFS (replaces any existing file for this user)
    const { fileId, viewLink, downloadLink } = await uploadResumeToGridFS(
      buffer,
      fileName,
      session.userId
    );

    const uploadedAt = new Date();

    // Save to user doc — clear old parsedData since this is a new file
    user.resume = {
      driveFileId: fileId,
      driveViewLink: viewLink,
      uploadedAt,
      extractedSkills: user.resume?.extractedSkills ?? [],
      parsedData: null,
    };

    if (user.profileCompletionScore < 100) {
      user.profileCompletionScore = Math.min(user.profileCompletionScore + 20, 100);
    }

    await user.save();

    return NextResponse.json({
      success: true,
      data: { fileId, viewLink, downloadLink, uploadedAt },
    });
  } catch (err) {
    console.error("[resume POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/user/resume — remove resume from GridFS and user doc
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    await deleteResumeFromGridFS(session.userId);

    user.resume = {
      driveFileId: null,
      driveViewLink: null,
      uploadedAt: null,
      extractedSkills: [],
      parsedData: null,
    };
    await user.save();

    return NextResponse.json({ success: true, message: "Resume deleted" });
  } catch (err) {
    console.error("[resume DELETE]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
