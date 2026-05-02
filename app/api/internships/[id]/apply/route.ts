import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const alreadyApplied = user.appliedInternships.some(
      (a) => a.internshipId.toString() === id
    );
    if (alreadyApplied) {
      return NextResponse.json({ success: false, error: "Already applied" }, { status: 409 });
    }

    user.appliedInternships.push({
      internshipId: new mongoose.Types.ObjectId(id),
      appliedAt: new Date(),
      status: "applied",
    });
    await user.save();

    return NextResponse.json({ success: true, message: "Application submitted" });
  } catch (err) {
    console.error("[apply]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
