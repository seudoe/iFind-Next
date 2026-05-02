import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { name, username, email, password, city, skills } = await req.json();

    if (!name || !username || !email || !password) {
      return NextResponse.json({ success: false, error: "All fields are required" }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return NextResponse.json({ success: false, error: `This ${field} is already taken` }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashed,
      city: city || null,
      skills: skills || [],
      profileCompletionScore: 20,
    });

    const token = signToken({ userId: user._id.toString(), email: user.email, username: user.username });
    const { name: cookieName, value, options } = setAuthCookie(token);

    const res = NextResponse.json({ success: true, message: "Account created" }, { status: 201 });
    res.cookies.set(cookieName, value, options as Parameters<typeof res.cookies.set>[2]);
    return res;
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
