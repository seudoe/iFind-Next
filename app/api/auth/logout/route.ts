import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Logged out" });
  res.cookies.set("ifind_token", "", { maxAge: 0, path: "/" });
  return res;
}
