import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Internship from "@/models/Internship";
import mongoose from "mongoose";

// POST /api/internships/by-ids
// Body: { ids: string[] }
// Returns internship documents for the given IDs, preserving order
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const internships = await Internship.find({ _id: { $in: objectIds } }).lean();

    // Preserve the original order from the ids array
    const map = new Map(internships.map((i) => [i._id.toString(), i]));
    const ordered = ids
      .map((id) => map.get(id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: JSON.parse(JSON.stringify(ordered)),
    });
  } catch (err) {
    console.error("[internships by-ids]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
