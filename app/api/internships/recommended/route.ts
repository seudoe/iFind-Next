import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Internship from "@/models/Internship";
import { RecommendationEngine } from "@/lib/recommendation";

export async function GET() {
  try {
    await connectDB();

    const session = await getSession();

    // If logged in, try to use stored vectorized recommendations
    if (session) {
      const engine = new RecommendationEngine({ topN: 6 });
      const storedRecommendations = await engine.getStoredRecommendations(session.userId);

      // If we have stored recommendations, fetch and return those internships
      if (storedRecommendations && storedRecommendations.length > 0) {
        const internshipIds = storedRecommendations.map((r) => r.id);
        const recommended = await Internship.find({
          _id: { $in: internshipIds },
          isActive: true,
        })
          .lean();

        if (recommended.length > 0) {
          // Sort by recommendation score order
          const idToScore = new Map(
            storedRecommendations.map((r) => [r.id.toString(), r.score])
          );
          recommended.sort((a, b) => {
            const scoreA = idToScore.get(a._id.toString()) || 0;
            const scoreB = idToScore.get(b._id.toString()) || 0;
            return scoreB - scoreA;
          });

          return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(recommended.slice(0, 6))),
          });
        }
      }

      // Fallback: match by user's skills (original behavior)
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

    // Final fallback: latest 6 active internships
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
