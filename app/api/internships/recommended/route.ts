import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Internship from "@/models/Internship";

export async function GET() {
  try {
    await connectDB();

    const session = await getSession();

    // If logged in, match by user's skills
    if (session) {
      const user = await User.findById(session.userId).select("skills").lean();
      const skills = (user as { skills?: string[] })?.skills ?? [];

      if (skills.length > 0) {
        const recommended = await Internship.find({
          isActive: true,
          skills: { $in: skills },
        })
          .sort({ datePublished: -1 })
          .limit(6)
          .lean();

        if (recommended.length > 0) {
          return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(recommended)),
          });
        }
      }
    }

    // Fallback: latest 6 active internships
    // TODO: connect to recommender model for personalised ranking
    const fallback = await Internship.find({ isActive: true })
      .sort({ datePublished: -1 })
      .limit(6)
      .lean();

    return NextResponse.json({
      success: true,
      data: JSON.parse(JSON.stringify(fallback)),
    });
  } catch (err) {
    console.error("[recommended]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
