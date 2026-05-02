import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: "Email/username and password are required" }, { status: 400 });
    }

    await connectDB();

    // identifier can be email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    }).select("+password");

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const token = signToken({ userId: user._id.toString(), email: user.email, username: user.username });
    const { name: cookieName, value, options } = setAuthCookie(token);

    const res = NextResponse.json({ success: true, message: "Logged in" });
    res.cookies.set(cookieName, value, options as Parameters<typeof res.cookies.set>[2]);
    return res;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
