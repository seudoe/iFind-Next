import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { streamResumeFromGridFS } from "@/lib/gridfs";

/**
 * GET /api/user/resume/view/[id]
 * Streams the PDF inline so it can be embedded in an <iframe>.
 * No auth required — the fileId is unguessable (MongoDB ObjectId).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const stream = streamResumeFromGridFS(id);

    // Collect chunks and return as a Response with PDF headers
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
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        // Allow iframe embedding from same origin
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[resume view]", err);
    return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
  }
}
