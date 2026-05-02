import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Both passwords are required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId).select("+password");
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return NextResponse.json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("[password PUT]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
