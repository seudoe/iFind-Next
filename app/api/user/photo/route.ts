import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { uploadPhotoToGridFS, deletePhotoFromGridFS } from "@/lib/gridfs";

// POST /api/user/photo — upload profile photo
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "Image must be under 2MB" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadPhotoToGridFS(buffer, file.type, session.userId);

    user.profilePicture = photoUrl;

    // Bump score if this is the first photo
    let score = user.profileCompletionScore ?? 20;
    if (!user.profilePicture) score = Math.min(score + 10, 100);
    user.profileCompletionScore = score;

    await user.save();

    return NextResponse.json({ success: true, data: { photoUrl } });
  } catch (err) {
    console.error("[photo POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/user/photo — remove profile photo
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    await deletePhotoFromGridFS(session.userId);
    user.profilePicture = null;
    await user.save();

    return NextResponse.json({ success: true, message: "Photo removed" });
  } catch (err) {
    console.error("[photo DELETE]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
