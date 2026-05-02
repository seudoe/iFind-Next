import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Internship from "@/models/Internship";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const internship = await Internship.findById(id).lean();
    if (!internship) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: JSON.parse(JSON.stringify(internship)),
    });
  } catch (err) {
    console.error("[internship GET]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
