import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// POST /api/user/resume/apply
// Replaces resume.parsedData with the confirmed extracted data
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { parsedData } = await req.json();
    if (!parsedData) {
      return NextResponse.json({ success: false, error: "No parsed data provided" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Replace parsedData in the resume subdocument
    user.resume.parsedData = parsedData;

    // Recompute profile score
    let score = 20;
    if (user.profilePicture) score += 10;
    if (user.resume?.driveFileId) score += 20;
    if (parsedData?.skills?.length >= 3) score += 15;
    if (parsedData?.education?.length > 0) score += 15;
    if (parsedData?.workHistory?.length > 0) score += 10;
    if (user.phone) score += 5;
    if (user.city) score += 5;
    user.profileCompletionScore = Math.min(score, 100);

    await user.save();

    return NextResponse.json({ success: true, message: "Resume data applied successfully" });
  } catch (err) {
    console.error("[resume apply POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to apply data" },
      { status: 500 }
    );
  }
}
