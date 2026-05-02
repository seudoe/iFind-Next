import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { streamResumeFromGridFS } from "@/lib/gridfs";

/**
 * GET /api/user/resume/download/[id]
 * Forces a file download with Content-Disposition: attachment.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const stream = streamResumeFromGridFS(id);

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
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[resume download]", err);
    return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
  }
}
