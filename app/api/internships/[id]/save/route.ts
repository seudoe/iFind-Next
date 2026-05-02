import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

// POST — save
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    await User.findByIdAndUpdate(session.userId, {
      $addToSet: { savedInternships: new mongoose.Types.ObjectId(id) },
    });

    return NextResponse.json({ success: true, message: "Saved" });
  } catch (err) {
    console.error("[save POST]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE — unsave
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    await User.findByIdAndUpdate(session.userId, {
      $pull: { savedInternships: new mongoose.Types.ObjectId(id) },
    });

    return NextResponse.json({ success: true, message: "Unsaved" });
  } catch (err) {
    console.error("[save DELETE]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
