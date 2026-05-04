import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getResumeBuffer } from "@/lib/gridfs";
import { parseResumeWithAI } from "@/lib/resumeParser";

// POST /api/user/resume/reextract — re-parse existing resume with OpenAI
export async function POST() {
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

    if (!user.resume?.driveFileId) {
      return NextResponse.json({ success: false, error: "No resume uploaded" }, { status: 400 });
    }

    // Get the existing resume file from GridFS
    let buffer: Buffer;
    try {
      buffer = await getResumeBuffer(user.resume.driveFileId);
    } catch (fileError: any) {
      // File not found in GridFS - likely an old upload
      if (fileError.code === 'ENOENT' || fileError.message?.includes('FileNotFound')) {
        return NextResponse.json({ 
          success: false, 
          error: "Resume file not found. Please re-upload your resume to enable data extraction." 
        }, { status: 404 });
      }
      throw fileError;
    }

    // Parse with AI (OpenAI → Gemini fallback)
    const parsedData = await parseResumeWithAI(buffer);

    // Update user document with new parsed data
    user.resume.parsedData = parsedData;
    await user.save();

    return NextResponse.json({
      success: true,
      data: { parsedData },
      message: "Resume data re-extracted successfully",
    });
  } catch (err) {
    console.error("[resume reextract POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Re-extraction failed" },
      { status: 500 }
    );
  }
}
