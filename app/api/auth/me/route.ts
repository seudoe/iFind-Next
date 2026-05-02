import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId).select("-password").lean();
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Serialize _id and nested ObjectIds to strings
    const serialized = JSON.parse(JSON.stringify(user));

    return NextResponse.json({ success: true, data: serialized });
  } catch (err) {
    console.error("[me]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
