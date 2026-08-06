/**
 * Monitoring Metrics API
 * 
 * Phase 6: Metrics endpoint for recommendation system monitoring
 * 
 * GET /api/monitoring/metrics
 * 
 * Returns current metrics snapshot including:
 * - Recommendation generation times
 * - HNSW search latency
 * - Cache hit/miss ratios
 * - Background refresh statistics
 * - HNSW index size and vector count
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { globalMetrics } from "@/lib/monitoring/RecommendationMetrics";

/**
 * GET /api/monitoring/metrics
 * 
 * Returns current metrics snapshot
 * 
 * Access: Admin only
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin role
    const mongoose = await import("mongoose");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 }
      );
    }

    const user = await db
      .collection("users")
      .findOne({ _id: new mongoose.Types.ObjectId(session.userId) });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Get metrics snapshot
    const snapshot = globalMetrics.getSnapshot();

    return NextResponse.json({
      success: true,
      metrics: snapshot,
    });

  } catch (error) {
    console.error("[monitoring/metrics GET]", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Server error" 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/metrics/reset
 * 
 * Reset all metrics (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin role
    const mongoose = await import("mongoose");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 }
      );
    }

    const user = await db
      .collection("users")
      .findOne({ _id: new mongoose.Types.ObjectId(session.userId) });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Reset metrics
    globalMetrics.reset();

    return NextResponse.json({
      success: true,
      message: "Metrics reset successfully",
    });

  } catch (error) {
    console.error("[monitoring/metrics POST]", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Server error" 
      },
      { status: 500 }
    );
  }
}
