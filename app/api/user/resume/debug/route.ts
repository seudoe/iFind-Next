import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.userId).lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  console.log("[Resume Debug] parsedData for", (user as any).username);
  console.dir((user as any).resume?.parsedData, { depth: null });

  return NextResponse.json({ success: true });
}
