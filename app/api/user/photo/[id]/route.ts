import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { streamPhotoFromGridFS, getPhotoMimeType } from "@/lib/gridfs";

/**
 * GET /api/user/photo/[id]
 * Streams a profile photo from GridFS.
 * No auth required — the fileId is unguessable (MongoDB ObjectId).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const mimeType = await getPhotoMimeType(id);
    const stream = streamPhotoFromGridFS(id);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400", // cache for 1 day
      },
    });
  } catch (err) {
    console.error("[photo GET]", err);
    return NextResponse.json({ success: false, error: "Photo not found" }, { status: 404 });
  }
}
