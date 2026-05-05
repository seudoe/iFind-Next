import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// GET /api/user/profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    await connectDB();
    const user = await User.findById(session.userId).select("-password").lean();
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(user)) });
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// PUT /api/user/profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const allowed = ["name", "phone", "city", "state", "country"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    Object.assign(user, updates);

    // Simple scoring: each section = points
    let score = 20; // base for having an account
    if (user.profilePicture) score += 10;
    if (user.resume?.driveFileId) score += 20;
    if (user.resume?.parsedData?.skills?.length >= 3) score += 15;
    if (user.resume?.parsedData?.education?.length > 0) score += 15;
    if (user.resume?.parsedData?.workHistory?.length > 0) score += 10;
    if (user.phone) score += 5;
    if (user.city) score += 5;
    user.profileCompletionScore = Math.min(score, 100);

    await user.save();

    const updated = await User.findById(session.userId).select("-password").lean();
    return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("[profile PUT]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
