/**
 * Cron Job: Refresh Recommendations
 * 
 * Phase 6: Background job to refresh expired caches for active users
 * 
 * GET /api/cron/refresh-recommendations
 * 
 * Runs background refresh service to proactively refresh recommendations
 * for recently active users with expired caches.
 * 
 * This endpoint should be called by a cron scheduler (e.g., Vercel Cron)
 * to run periodically (e.g., every hour).
 */

import { NextRequest, NextResponse } from "next/server";
import { runBackgroundRefresh } from "@/lib/recommendation/jobs/BackgroundRefresh";

/**
 * GET /api/cron/refresh-recommendations
 * 
 * Runs background refresh for active users
 * 
 * Query parameters:
 * - activeWithinDays: Only refresh users active within N days (default: 7)
 * - batchSize: Process users in batches of N (default: 50)
 * - maxUsers: Maximum users to process in one run (default: 1000)
 * - cacheOlderThanHours: Only refresh caches older than N hours (default: 23)
 * 
 * Authorization: Cron secret header (CRON_SECRET env var)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("❌ Unauthorized cron request");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const config = {
      activeWithinDays: searchParams.has("activeWithinDays")
        ? parseInt(searchParams.get("activeWithinDays")!)
        : undefined,
      batchSize: searchParams.has("batchSize")
        ? parseInt(searchParams.get("batchSize")!)
        : undefined,
      maxUsers: searchParams.has("maxUsers")
        ? parseInt(searchParams.get("maxUsers")!)
        : undefined,
      cacheOlderThanHours: searchParams.has("cacheOlderThanHours")
        ? parseInt(searchParams.get("cacheOlderThanHours")!)
        : undefined,
    };

    console.log("🔄 Starting cron job: refresh-recommendations");
    console.log("📊 Config:", config);

    // Run background refresh
    const result = await runBackgroundRefresh(config);

    console.log("✅ Cron job completed:", result);

    return NextResponse.json({
      success: result.success,
      result,
    });

  } catch (error) {
    console.error("[cron/refresh-recommendations GET]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
