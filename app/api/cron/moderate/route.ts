import { NextRequest, NextResponse } from "next/server";

/**
 * CRON: Process new internships through the moderation pipeline.
 *
 * Protected by x-cron-secret header matching CRON_SECRET env var.
 * Schedule this endpoint to run periodically (e.g. every 15 minutes).
 *
 * ── How to plug in data sources ──────────────────────────────────────────────
 *
 * 1. Web scraping:
 *    - Run your scraper, collect RawInternship[]
 *    - Call: await runModerationPipeline(raw, "web_scraping")
 *
 * 2. External APIs (e.g. Internshala, LinkedIn):
 *    - Fetch from API, map response to RawInternship
 *    - Call: await runModerationPipeline(raw, "api")
 *
 * 3. RSS feeds:
 *    - Parse RSS items into RawInternship
 *    - Call: await runModerationPipeline(raw, "rss")
 *
 * 4. Email parsing:
 *    - Parse inbound emails (e.g. via SendGrid inbound parse)
 *    - Call: await runModerationPipeline(raw, "email_parsing")
 *
 * 5. Community bot (Telegram/Discord):
 *    - Bot receives submission, maps to RawInternship
 *    - Call: await runModerationPipeline(raw, "community_bot")
 *
 * 6. User-contributed (via UI form):
 *    - Call: await runModerationPipeline(raw, "user_contributed")
 *    - These get 3-day re-verification schedule instead of 7-day
 *
 * Import: import { runModerationPipeline } from "@/lib/pipeline"
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 },
        );
    }

    console.log(`[cron/moderate] Called at ${new Date().toISOString()}`);

    // TODO: plug in data sources here (see comment block above)

    return NextResponse.json({
        success: true,
        message: "Pipeline ready — connect data sources here",
        processed: 0,
    });
}
