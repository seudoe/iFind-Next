import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Internship from "@/models/Internship";
import User from "@/models/User";

export async function GET() {
    try {
        await connectDB();

        // Get total active internships
        const totalInternships = await Internship.countDocuments({
            isActive: true,
            "moderation.status": {
                $in: ["auto_approved", "manually_approved"],
            },
        });

        // Get total registered users
        const totalUsers = await User.countDocuments();

        // Get unique companies count
        const uniqueCompanies = await Internship.distinct("company", {
            isActive: true,
            "moderation.status": {
                $in: ["auto_approved", "manually_approved"],
            },
        });

        // Get categories with counts (based on tags/skills)
        const categoriesAgg = await Internship.aggregate([
            {
                $match: {
                    isActive: true,
                    "moderation.status": {
                        $in: ["auto_approved", "manually_approved"],
                    },
                },
            },
            { $unwind: "$tags" },
            {
                $group: {
                    _id: "$tags",
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 8 },
        ]);

        // Map tags to categories with icons
        const categoryMap: Record<string, { icon: string; label: string }> = {
            frontend: { icon: "💻", label: "Frontend Development" },
            backend: { icon: "⚙️", label: "Backend Development" },
            fullstack: { icon: "🖥️", label: "Full Stack Development" },
            "data-science": { icon: "📊", label: "Data Science" },
            ml: { icon: "🤖", label: "Machine Learning" },
            design: { icon: "🎨", label: "Design" },
            ux: { icon: "✨", label: "UI/UX" },
            android: { icon: "📱", label: "Android Development" },
            ios: { icon: "🍎", label: "iOS Development" },
            mobile: { icon: "📱", label: "Mobile Development" },
            marketing: { icon: "📣", label: "Marketing" },
            finance: { icon: "💰", label: "Finance" },
            fintech: { icon: "💳", label: "Fintech" },
            content: { icon: "✍️", label: "Content Writing" },
            hr: { icon: "👥", label: "HR & Management" },
            operations: { icon: "⚙️", label: "Operations" },
        };

        const categories = categoriesAgg.map((cat) => ({
            label: categoryMap[cat._id]?.label || cat._id,
            icon: categoryMap[cat._id]?.icon || "💼",
            count: cat.count,
        }));

        // Get locations with counts
        const locationsAgg = await Internship.aggregate([
            {
                $match: {
                    isActive: true,
                    "moderation.status": {
                        $in: ["auto_approved", "manually_approved"],
                    },
                },
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$isRemote", true] },
                            "Work from Home",
                            { $ifNull: ["$city", "Other"] },
                        ],
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        const locations = locationsAgg.map((loc) => ({
            name: loc._id,
            count: loc.count,
        }));

        // Calculate placement rate (mock for now - would need application tracking)
        const placementRate = 95; // This would need actual application/placement data

        return NextResponse.json({
            stats: {
                totalInternships,
                totalUsers,
                totalCompanies: uniqueCompanies.length,
                placementRate,
            },
            categories,
            locations,
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 },
        );
    }
}
